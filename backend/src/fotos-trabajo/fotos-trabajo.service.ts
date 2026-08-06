import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import AdmZip from 'adm-zip';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { safeFileName } from '../storage/object-key.util';
import {
  buildImportTree,
  isMediaFileName,
  matchFolderToClientes,
  mimeFromFileName,
  newImportJobId,
  type ImportClientPreview,
  type ImportFileEntry,
} from './fotos-trabajo-import.util';
import { ensureBrowserImage } from './heic-convert.util';

const MODULE_KEY = 'fotos-trabajo';
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/3gpp',
  'video/3gpp2',
]);

type ImportJob = {
  id: string;
  dir: string;
  createdAt: number;
  preview: ImportClientPreview[];
  skipped: number;
  /** relativePath → absolute disk path */
  fileMap: Map<string, { diskPath: string; size: number; mime: string }>;
};

const IMPORT_JOB_TTL_MS = 2 * 60 * 60 * 1000; // 2h
const importJobs = new Map<string, ImportJob>();

@Injectable()
export class FotosTrabajoService {
  private readonly logger = new Logger(FotosTrabajoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private tenantSlug(): string {
    const db = (process.env.DB_NAME || '').trim().toLowerCase();
    if (db === 'hera_facility_db' || db.includes('hera')) return 'hera';
    if (db === 'decamino_db' || db.includes('decamino')) return 'decamino';
    if (db.startsWith('tenant_')) return db.replace(/^tenant_/, '') || 'tenant';
    return 'decamino';
  }

  async assertCanAccess(user: {
    grupo?: string;
    GRUPO?: string;
    userId?: string;
    codigo?: string;
  }): Promise<void> {
    const grupo = String(user?.grupo || user?.GRUPO || '').trim();
    if (!grupo) {
      throw new ForbiddenException('Sin grupo de usuario');
    }
    if (
      grupo === 'Developer' ||
      grupo === 'Admin' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor'
    ) {
      // Still require matrix if explicitly false; otherwise allow defaults for ops roles
      const explicit = await this.prisma.permissions.findFirst({
        where: { grupo_module: `${grupo}_${MODULE_KEY}` },
      });
      if (explicit && String(explicit.permitted).toLowerCase() === 'false') {
        throw new ForbiddenException('Sin permiso para Fotos Trabajo');
      }
      if (explicit && String(explicit.permitted).toLowerCase() === 'true') {
        return;
      }
      // No row yet: allow Supervisor/Manager/Developer/Admin so module works before matrix save
      return;
    }

    const row = await this.prisma.permissions.findFirst({
      where: { grupo_module: `${grupo}_${MODULE_KEY}` },
    });
    if (!row || String(row.permitted).toLowerCase() !== 'true') {
      throw new ForbiddenException('Sin permiso para Fotos Trabajo');
    }
  }

  async listComunidades(q?: string, conFotos = false) {
    const term = (q || '').trim();
    const nameFilter = term
      ? {
          OR: [
            { NOMBRE_O_RAZON_SOCIAL: { contains: term } },
            { NIF: { contains: term } },
            { POBLACION: { contains: term } },
          ],
        }
      : {};

    let clienteIdsWithFotos: number[] | null = null;
    const countsByCliente = new Map<
      number,
      { albumes: number; fotos: number }
    >();

    if (conFotos) {
      const albums = await this.prisma.fotosTrabajoAlbum.findMany({
        where: { fotos: { some: {} } },
        select: {
          cliente_id: true,
          _count: { select: { fotos: true } },
        },
      });
      for (const a of albums) {
        const prev = countsByCliente.get(a.cliente_id) || {
          albumes: 0,
          fotos: 0,
        };
        prev.albumes += 1;
        prev.fotos += a._count.fotos;
        countsByCliente.set(a.cliente_id, prev);
      }
      clienteIdsWithFotos = [...countsByCliente.keys()];
      if (!clienteIdsWithFotos.length) {
        return [];
      }
    }

    const rows = await this.prisma.clientes.findMany({
      where: {
        ...nameFilter,
        ...(clienteIdsWithFotos ? { id: { in: clienteIdsWithFotos } } : {}),
      },
      select: {
        id: true,
        NIF: true,
        NOMBRE_O_RAZON_SOCIAL: true,
        POBLACION: true,
        DIRECCION: true,
      },
      orderBy: { NOMBRE_O_RAZON_SOCIAL: 'asc' },
      take: conFotos ? 500 : 200,
    });

    return rows.map((c) => {
      const counts = countsByCliente.get(c.id);
      return {
        id: c.id,
        nif: c.NIF,
        nombre: c.NOMBRE_O_RAZON_SOCIAL,
        poblacion: c.POBLACION,
        direccion: c.DIRECCION,
        albumes_count: counts?.albumes ?? undefined,
        fotos_count: counts?.fotos ?? undefined,
      };
    });
  }

  async listAlbumes(clienteId: number) {
    const cliente = await this.prisma.clientes.findUnique({
      where: { id: clienteId },
      select: { id: true },
    });
    if (!cliente) throw new NotFoundException('Comunidad no encontrada');

    const albums = await this.prisma.fotosTrabajoAlbum.findMany({
      where: { cliente_id: clienteId },
      orderBy: [{ fecha_servicio: 'desc' }, { created_at: 'desc' }],
      include: { _count: { select: { fotos: true } } },
    });

    return albums.map((a) => ({
      id: a.id,
      cliente_id: a.cliente_id,
      titulo: a.titulo,
      fecha_servicio: a.fecha_servicio,
      notas: a.notas,
      creado_por: a.creado_por,
      created_at: a.created_at,
      updated_at: a.updated_at,
      fotos_count: a._count.fotos,
    }));
  }

  async createAlbum(
    data: {
      cliente_id: number;
      titulo: string;
      fecha_servicio?: string | null;
      notas?: string | null;
      reuse_if_exists?: boolean;
    },
    userCodigo: string,
  ) {
    const titulo = (data.titulo || '').trim();
    if (!titulo) throw new BadRequestException('titulo requerido');
    if (!data.cliente_id) throw new BadRequestException('cliente_id requerido');

    const cliente = await this.prisma.clientes.findUnique({
      where: { id: data.cliente_id },
      select: { id: true },
    });
    if (!cliente) throw new NotFoundException('Comunidad no encontrada');

    if (data.reuse_if_exists) {
      const existing = await this.prisma.fotosTrabajoAlbum.findFirst({
        where: { cliente_id: data.cliente_id, titulo },
        include: { _count: { select: { fotos: true } } },
      });
      if (existing) {
        return {
          id: existing.id,
          cliente_id: existing.cliente_id,
          titulo: existing.titulo,
          fecha_servicio: existing.fecha_servicio,
          notas: existing.notas,
          creado_por: existing.creado_por,
          created_at: existing.created_at,
          fotos_count: existing._count.fotos,
          reused: true,
        };
      }
    }

    let fecha: Date | null = null;
    if (data.fecha_servicio) {
      const d = new Date(data.fecha_servicio);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('fecha_servicio inválida');
      }
      fecha = d;
    }

    const album = await this.prisma.fotosTrabajoAlbum.create({
      data: {
        cliente_id: data.cliente_id,
        titulo,
        fecha_servicio: fecha,
        notas: data.notas?.trim() || null,
        creado_por: userCodigo,
      },
    });

    return {
      id: album.id,
      cliente_id: album.cliente_id,
      titulo: album.titulo,
      fecha_servicio: album.fecha_servicio,
      notas: album.notas,
      creado_por: album.creado_por,
      created_at: album.created_at,
      fotos_count: 0,
    };
  }

  async updateAlbum(
    albumId: number,
    data: {
      titulo?: string;
      fecha_servicio?: string | null;
      notas?: string | null;
    },
  ) {
    const album = await this.prisma.fotosTrabajoAlbum.findUnique({
      where: { id: albumId },
    });
    if (!album) throw new NotFoundException('Álbum no encontrado');

    const patch: {
      titulo?: string;
      fecha_servicio?: Date | null;
      notas?: string | null;
    } = {};
    if (data.titulo !== undefined) {
      const t = data.titulo.trim();
      if (!t) throw new BadRequestException('titulo vacío');
      patch.titulo = t;
    }
    if (data.fecha_servicio !== undefined) {
      if (data.fecha_servicio === null || data.fecha_servicio === '') {
        patch.fecha_servicio = null;
      } else {
        const d = new Date(data.fecha_servicio);
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('fecha_servicio inválida');
        }
        patch.fecha_servicio = d;
      }
    }
    if (data.notas !== undefined) {
      patch.notas = data.notas?.trim() || null;
    }

    const updated = await this.prisma.fotosTrabajoAlbum.update({
      where: { id: albumId },
      data: patch,
    });
    return updated;
  }

  async deleteAlbum(albumId: number) {
    const album = await this.prisma.fotosTrabajoAlbum.findUnique({
      where: { id: albumId },
      include: { fotos: true },
    });
    if (!album) throw new NotFoundException('Álbum no encontrado');

    for (const foto of album.fotos) {
      try {
        if (this.storage.isEnabled()) {
          await this.storage.delete(foto.storage_key);
        }
      } catch (err) {
        this.logger.warn(
          `No se pudo borrar R2 key=${foto.storage_key}: ${(err as Error)?.message}`,
        );
      }
    }

    await this.prisma.fotosTrabajoAlbum.delete({ where: { id: albumId } });
    return { deleted: true, fotos_removed: album.fotos.length };
  }

  async listFotos(albumId: number) {
    const album = await this.prisma.fotosTrabajoAlbum.findUnique({
      where: { id: albumId },
      select: { id: true, cliente_id: true, titulo: true },
    });
    if (!album) throw new NotFoundException('Álbum no encontrado');

    const fotos = await this.prisma.fotosTrabajoFoto.findMany({
      where: { album_id: albumId },
      orderBy: { created_at: 'desc' },
    });

    return {
      album,
      fotos: fotos.map((f) => ({
        id: f.id,
        album_id: f.album_id,
        mime_type: f.mime_type,
        tamano_bytes: f.tamano_bytes,
        nombre_original: f.nombre_original,
        uploaded_by: f.uploaded_by,
        created_at: f.created_at,
      })),
    };
  }

  /** Same community + same original name + same size ⇒ treat as duplicate (skip R2 put). */
  private async findDuplicateOnCliente(
    clienteId: number,
    nombreOriginal: string | null | undefined,
    tamanoBytes: number | null | undefined,
  ) {
    const nombre = (nombreOriginal || '').trim();
    if (!nombre || tamanoBytes == null || Number.isNaN(Number(tamanoBytes))) {
      return null;
    }
    return this.prisma.fotosTrabajoFoto.findFirst({
      where: {
        nombre_original: nombre,
        tamano_bytes: Number(tamanoBytes),
        album: { cliente_id: clienteId },
      },
      select: { id: true, album_id: true },
    });
  }

  async uploadFotos(
    albumId: number,
    files: Express.Multer.File[],
    userCodigo: string,
  ) {
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    if (!files?.length) {
      throw new BadRequestException('No se recibieron archivos');
    }

    const album = await this.prisma.fotosTrabajoAlbum.findUnique({
      where: { id: albumId },
    });
    if (!album) throw new NotFoundException('Álbum no encontrado');

    const tenant = this.tenantSlug();
    const created: Array<{
      id: number;
      nombre_original: string | null;
      mime_type: string | null;
      tamano_bytes: number | null;
    }> = [];
    let skippedDuplicates = 0;

    for (const file of files) {
      const mime = (file.mimetype || '').toLowerCase();
      const okMime =
        ALLOWED_MIME.has(mime) ||
        mime.startsWith('image/') ||
        mime.startsWith('video/');
      if (!okMime) {
        throw new BadRequestException(
          `Tipo no permitido: ${file.mimetype || 'unknown'}`,
        );
      }

      const nombreOriginalRaw = file.originalname || null;
      const sizeRaw = file.size ?? file.buffer?.length ?? null;
      const dup = await this.findDuplicateOnCliente(
        album.cliente_id,
        nombreOriginalRaw,
        sizeRaw,
      );
      if (dup) {
        skippedDuplicates += 1;
        this.logger.log(
          `Skip duplicate foto cliente=${album.cliente_id} name=${nombreOriginalRaw} size=${sizeRaw}`,
        );
        continue;
      }

      let uploadBuffer: Buffer = file.buffer;
      let uploadMime = mime || 'application/octet-stream';
      let storageFileName = nombreOriginalRaw;
      try {
        const normalized = await ensureBrowserImage({
          buffer: file.buffer,
          mime,
          fileName: nombreOriginalRaw,
        });
        uploadBuffer = Buffer.from(normalized.buffer);
        uploadMime = normalized.mime;
        storageFileName = normalized.fileName;
        if (normalized.converted) {
          this.logger.log(
            `HEIC→JPEG album=${album.id} ${nombreOriginalRaw} → ${storageFileName} (${uploadBuffer.length} bytes)`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `HEIC convert failed album=${album.id} name=${nombreOriginalRaw}: ${(err as Error)?.message}`,
        );
        throw new BadRequestException(
          `No se pudo convertir HEIC: ${nombreOriginalRaw || 'archivo'}`,
        );
      }

      const size = uploadBuffer.length;
      const safe = safeFileName(
        storageFileName ||
          (uploadMime.startsWith('video/') ? 'video.mp4' : 'foto.jpg'),
      );
      const now = new Date();
      const yyyy = String(now.getUTCFullYear());
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const id = randomUUID();
      const key = [
        'decamino',
        tenant,
        'fotos-trabajo',
        String(album.cliente_id),
        String(album.id),
        yyyy,
        mm,
        `${id}__${safe}`,
      ].join('/');

      const put = await this.storage.put({
        key,
        body: uploadBuffer,
        contentType: uploadMime,
        metadata: {
          albumId: String(album.id),
          clienteId: String(album.cliente_id),
          uploadedBy: userCodigo,
        },
      });

      const row = await this.prisma.fotosTrabajoFoto.create({
        data: {
          album_id: album.id,
          storage_key: put.key,
          storage_bucket: put.bucket,
          mime_type: uploadMime || null,
          tamano_bytes: size,
          // Keep original name (e.g. .heic) for duplicate detection / UI
          nombre_original: nombreOriginalRaw,
          uploaded_by: userCodigo,
        },
      });

      created.push({
        id: row.id,
        nombre_original: row.nombre_original,
        mime_type: row.mime_type,
        tamano_bytes: row.tamano_bytes,
      });
    }

    return {
      uploaded: created.length,
      skipped_duplicates: skippedDuplicates,
      fotos: created,
    };
  }

  async getPresignedUrl(fotoId: number, expiresInSeconds = 300) {
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException('R2 no está habilitado');
    }
    const foto = await this.prisma.fotosTrabajoFoto.findUnique({
      where: { id: fotoId },
    });
    if (!foto) throw new NotFoundException('Foto no encontrada');

    const signed = await this.storage.getPresignedGetUrl({
      key: foto.storage_key,
      expiresInSeconds,
    });

    return {
      id: foto.id,
      url: signed.url,
      expiresInSeconds: signed.expiresInSeconds,
      mime_type: foto.mime_type,
      nombre_original: foto.nombre_original,
    };
  }

  /** Binary for preview/download (used for HEIC → JPEG in browser, same pattern as pedidos albarán). */
  async getFotoFile(fotoId: number) {
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException('R2 no está habilitado');
    }
    const foto = await this.prisma.fotosTrabajoFoto.findUnique({
      where: { id: fotoId },
    });
    if (!foto) throw new NotFoundException('Foto no encontrada');

    const obj = await this.storage.get(foto.storage_key);
    return {
      body: obj.body,
      mime_type:
        foto.mime_type || obj.contentType || 'application/octet-stream',
      nombre_original: foto.nombre_original || `foto-${foto.id}`,
    };
  }

  async deleteFoto(fotoId: number) {
    const foto = await this.prisma.fotosTrabajoFoto.findUnique({
      where: { id: fotoId },
    });
    if (!foto) throw new NotFoundException('Foto no encontrada');

    if (this.storage.isEnabled()) {
      try {
        await this.storage.delete(foto.storage_key);
      } catch (err) {
        this.logger.warn(
          `R2 delete failed for ${foto.storage_key}: ${(err as Error)?.message}`,
        );
      }
    }

    await this.prisma.fotosTrabajoFoto.delete({ where: { id: fotoId } });
    return { deleted: true };
  }

  private purgeExpiredImportJobs() {
    const now = Date.now();
    for (const [id, job] of importJobs) {
      if (now - job.createdAt > IMPORT_JOB_TTL_MS) {
        importJobs.delete(id);
        fsp
          .rm(job.dir, { recursive: true, force: true })
          .catch(() => undefined);
      }
    }
  }

  private async loadClientesForMatch() {
    const rows = await this.prisma.clientes.findMany({
      select: {
        id: true,
        NOMBRE_O_RAZON_SOCIAL: true,
        NIF: true,
      },
      take: 5000,
    });
    return rows.map((c) => ({
      id: c.id,
      nombre: c.NOMBRE_O_RAZON_SOCIAL,
      nif: c.NIF,
    }));
  }

  async matchImportFolders(folders: string[]) {
    const names = (folders || [])
      .map((f) => String(f || '').trim())
      .filter(Boolean);
    if (!names.length) {
      throw new BadRequestException('folders vacío');
    }
    const clientes = await this.loadClientesForMatch();
    return {
      matches: names.map((folder) => matchFolderToClientes(folder, clientes)),
      clientes: clientes.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        nif: c.nif,
      })),
    };
  }

  async previewImportFromPaths(
    paths: Array<{ relativePath: string; size?: number }>,
  ) {
    if (!paths?.length) {
      throw new BadRequestException('paths vacío');
    }
    const clientes = await this.loadClientesForMatch();
    const entries: ImportFileEntry[] = paths.map((p) => ({
      relativePath: p.relativePath,
      size: p.size || 0,
    }));
    const topFromPaths = new Set<string>();
    for (const p of paths) {
      const parts = String(p.relativePath || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .split('/')
        .filter(Boolean);
      if (parts[0]) topFromPaths.add(parts[0]);
    }
    const { clients, skipped, stats } = buildImportTree(entries, clientes, [
      ...topFromPaths,
    ]);
    return {
      clients,
      skipped,
      stats,
      clientes: clientes.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        nif: c.nif,
      })),
    };
  }

  async previewImportZip(zipBuffer: Buffer) {
    this.purgeExpiredImportJobs();
    if (!zipBuffer?.length) {
      throw new BadRequestException('ZIP vacío');
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch (err) {
      throw new BadRequestException(
        `ZIP inválido: ${(err as Error)?.message || 'error'}`,
      );
    }

    const jobId = newImportJobId();
    const dir = path.join(os.tmpdir(), 'fotos-trabajo-import', jobId);
    await fsp.mkdir(dir, { recursive: true });

    const entries: ImportFileEntry[] = [];
    const fileMap = new Map<
      string,
      { diskPath: string; size: number; mime: string }
    >();
    const topFolders = new Set<string>();

    const decodeEntryName = (entry: any): string => {
      const raw = String(entry?.entryName || '').replace(/\\/g, '/');
      try {
        const flag =
          entry?.header?.flags ?? entry?.header?.general_purpose_bit_flag;
        const rawName = entry?.rawEntryName;
        if (flag != null && (flag & 0x800) === 0 && Buffer.isBuffer(rawName)) {
          return rawName.toString('utf8').replace(/\\/g, '/');
        }
      } catch {
        /* use entryName */
      }
      return raw;
    };

    for (const entry of zip.getEntries()) {
      const rel = decodeEntryName(entry).replace(/\\/g, '/');
      if (!rel || rel.includes('__MACOSX')) continue;

      const parts = rel.replace(/^\/+/, '').split('/').filter(Boolean);
      if (parts[0] && parts[0] !== '__MACOSX') {
        topFolders.add(parts[0]);
      }

      if (entry.isDirectory) continue;
      const base = parts[parts.length - 1] || '';
      if (!isMediaFileName(base)) continue;

      const data = entry.getData();
      const safeRel = rel
        .split('/')
        .map((p) => p.replace(/[<>:"|?*]/g, '_'))
        .join('/');
      const diskPath = path.join(dir, ...safeRel.split('/'));
      await fsp.mkdir(path.dirname(diskPath), { recursive: true });
      await fsp.writeFile(diskPath, data);
      const mime = mimeFromFileName(base);
      entries.push({
        relativePath: rel,
        diskPath,
        size: data.length,
        mime,
      });
      fileMap.set(rel, { diskPath, size: data.length, mime });
    }

    // If ZIP has wrapper FotosTrabajo/, collect second-level as community folders too
    const communityFolders = new Set<string>();
    const topArr = [...topFolders];
    const onlyWrapper =
      topArr.length === 1 && /foto|trabajo|fotos|import/i.test(topArr[0]);
    if (onlyWrapper) {
      for (const entry of zip.getEntries()) {
        const rel = decodeEntryName(entry).replace(/\\/g, '/');
        const parts = rel.replace(/^\/+/, '').split('/').filter(Boolean);
        if (parts.length >= 2 && /foto|trabajo|fotos|import/i.test(parts[0])) {
          communityFolders.add(parts[1]);
        }
      }
    } else {
      for (const t of topArr) communityFolders.add(t);
    }

    if (!entries.length && !communityFolders.size) {
      await fsp.rm(dir, { recursive: true, force: true });
      throw new BadRequestException(
        'El ZIP no contiene imágenes/vídeos reconocibles ni carpetas',
      );
    }

    const clientes = await this.loadClientesForMatch();
    const { clients, skipped, stats } = buildImportTree(entries, clientes, [
      ...communityFolders,
    ]);

    const job: ImportJob = {
      id: jobId,
      dir,
      createdAt: Date.now(),
      preview: clients,
      skipped,
      fileMap,
    };
    importJobs.set(jobId, job);

    this.logger.log(
      `Import ZIP job=${jobId}: top=${stats.top_folders_total} withMedia=${stats.with_media} mediaFiles=${stats.media_files}`,
    );

    return {
      job_id: jobId,
      clients,
      skipped,
      stats,
      expires_in_seconds: Math.floor(IMPORT_JOB_TTL_MS / 1000),
      clientes: clientes.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        nif: c.nif,
      })),
    };
  }

  async commitImportJob(
    jobId: string,
    mapping: Record<string, number | null | undefined>,
    userCodigo: string,
    options?: { folder?: string; finalize?: boolean },
  ) {
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    this.purgeExpiredImportJobs();
    const job = importJobs.get(jobId);
    if (!job) {
      throw new NotFoundException(
        'Job de import no encontrado o expirado. Vuelve a subir el ZIP.',
      );
    }

    const onlyFolder = options?.folder ? String(options.folder) : null;
    const finalize =
      options?.finalize !== undefined ? Boolean(options.finalize) : !onlyFolder;

    const tenant = this.tenantSlug();
    let albumsCreated = 0;
    let albumsReused = 0;
    let fotosUploaded = 0;
    let skippedDuplicates = 0;
    let foldersSkipped = 0;
    const errors: string[] = [];

    const clientsToProcess = onlyFolder
      ? job.preview.filter((c) => c.folder === onlyFolder)
      : job.preview;

    if (onlyFolder && !clientsToProcess.length) {
      throw new BadRequestException(
        `Carpeta no encontrada en el job: ${onlyFolder}`,
      );
    }

    for (const client of clientsToProcess) {
      const raw = mapping[client.folder];
      const clienteId =
        raw === undefined || raw === null || raw === ('' as any)
          ? null
          : Number(raw);
      if (!clienteId || Number.isNaN(clienteId)) {
        foldersSkipped += 1;
        continue;
      }

      const cliente = await this.prisma.clientes.findUnique({
        where: { id: clienteId },
        select: { id: true },
      });
      if (!cliente) {
        errors.push(`Cliente id=${clienteId} no existe (${client.folder})`);
        foldersSkipped += 1;
        continue;
      }

      for (const albumPrev of client.albumes) {
        try {
          const titulo = albumPrev.album_title.slice(0, 500);
          let album = await this.prisma.fotosTrabajoAlbum.findFirst({
            where: { cliente_id: clienteId, titulo },
          });
          if (!album) {
            album = await this.prisma.fotosTrabajoAlbum.create({
              data: {
                cliente_id: clienteId,
                titulo,
                fecha_servicio: null,
                notas: `Import Synology: ${client.folder}`,
                creado_por: userCodigo || 'import',
              },
            });
            albumsCreated += 1;
          } else {
            albumsReused += 1;
          }

          for (const f of albumPrev.files) {
            const meta = job.fileMap.get(f.relativePath);
            if (!meta || !fs.existsSync(meta.diskPath)) {
              errors.push(`Fichero faltante: ${f.relativePath}`);
              continue;
            }
            const size = meta.size ?? f.size ?? null;
            const dup = await this.findDuplicateOnCliente(
              clienteId,
              f.name,
              size,
            );
            if (dup) {
              skippedDuplicates += 1;
              continue;
            }

            const bufRaw = await fsp.readFile(meta.diskPath);
            const mimeRaw = meta.mime || mimeFromFileName(f.name);
            let buf: Buffer = bufRaw;
            let mime = mimeRaw;
            let storageFileName = f.name;
            try {
              const normalized = await ensureBrowserImage({
                buffer: bufRaw,
                mime: mimeRaw,
                fileName: f.name,
              });
              buf = Buffer.from(normalized.buffer);
              mime = normalized.mime;
              storageFileName = normalized.fileName || f.name;
              if (normalized.converted) {
                this.logger.log(
                  `HEIC→JPEG import ${f.name} → ${storageFileName} (${buf.length} bytes)`,
                );
              }
            } catch (err) {
              errors.push(
                `HEIC convert falló: ${f.relativePath}: ${(err as Error)?.message}`,
              );
              continue;
            }

            const safe = safeFileName(storageFileName || 'foto.jpg');
            const now = new Date();
            const yyyy = String(now.getUTCFullYear());
            const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
            const id = randomUUID();
            const key = [
              'decamino',
              tenant,
              'fotos-trabajo',
              String(clienteId),
              String(album.id),
              yyyy,
              mm,
              `${id}__${safe}`,
            ].join('/');

            const put = await this.storage.put({
              key,
              body: buf,
              contentType: mime,
              metadata: {
                albumId: String(album.id),
                clienteId: String(clienteId),
                uploadedBy: userCodigo,
                import: 'synology-zip',
              },
            });

            await this.prisma.fotosTrabajoFoto.create({
              data: {
                album_id: album.id,
                storage_key: put.key,
                storage_bucket: put.bucket,
                mime_type: mime,
                // Original size/name for duplicate detection
                tamano_bytes: size,
                nombre_original: f.name,
                uploaded_by: userCodigo || 'import',
              },
            });
            fotosUploaded += 1;
          }
        } catch (err) {
          errors.push(
            `${client.folder} / ${albumPrev.album_title}: ${(err as Error)?.message}`,
          );
        }
      }
    }

    if (finalize) {
      importJobs.delete(jobId);
      fsp.rm(job.dir, { recursive: true, force: true }).catch(() => undefined);
    }

    return {
      albums_created: albumsCreated,
      albums_reused: albumsReused,
      fotos_uploaded: fotosUploaded,
      skipped_duplicates: skippedDuplicates,
      folders_skipped: foldersSkipped,
      errors,
      finalized: finalize,
    };
  }

  async cleanupImportJob(jobId: string) {
    this.purgeExpiredImportJobs();
    const job = importJobs.get(jobId);
    if (!job) {
      return { cleaned: false };
    }
    importJobs.delete(jobId);
    await fsp
      .rm(job.dir, { recursive: true, force: true })
      .catch(() => undefined);
    return { cleaned: true };
  }

  /** Lightweight list for import dropdown */
  async listClientesLite() {
    const clientes = await this.loadClientesForMatch();
    return clientes.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      nif: c.nif,
    }));
  }
}
