import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { safeFileName } from '../storage/object-key.util';

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

      const safe = safeFileName(
        file.originalname ||
          (mime.startsWith('video/') ? 'video.mp4' : 'foto.jpg'),
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
        body: file.buffer,
        contentType: mime || 'application/octet-stream',
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
          mime_type: mime || null,
          tamano_bytes: file.size ?? file.buffer?.length ?? null,
          nombre_original: file.originalname || null,
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

    return { uploaded: created.length, fotos: created };
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
}
