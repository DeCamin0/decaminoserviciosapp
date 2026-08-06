import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../storage/storage.service';
import { buildObjectKey } from '../storage/object-key.util';

export type PedidosNotaImagenStorageRow = {
  storage_key?: string | null;
  ruta_archivo?: string | null;
  tipo_mime?: string | null;
  nombre_archivo?: string | null;
};

export type PedidosNotaImagenPutResult = {
  storage_key: string;
  storage_bucket: string;
  tamano_bytes: number;
};

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
};

@Injectable()
export class PedidosNotasStorageService {
  private readonly logger = new Logger(PedidosNotasStorageService.name);
  private readonly uploadsDir = path.join(
    process.cwd(),
    'uploads',
    'pedidos-notas',
  );

  constructor(private readonly storage: StorageService) {}

  isWriteEnabled(): boolean {
    return this.storage.isEnabled();
  }

  getUploadsDir(): string {
    return this.uploadsDir;
  }

  tenantSlug(): string {
    const db = (process.env.DB_NAME || '').trim().toLowerCase();
    if (db === 'hera_facility_db' || db.includes('hera')) return 'hera';
    if (db === 'decamino_db' || db.includes('decamino')) return 'decamino';
    if (db.startsWith('tenant_')) return db.replace(/^tenant_/, '') || 'tenant';
    return 'decamino';
  }

  guessContentType(originalName: string, mimeHint?: string | null): string {
    if (mimeHint && String(mimeHint).trim()) {
      return String(mimeHint).trim();
    }
    const ext = String(originalName || '')
      .split('.')
      .pop()
      ?.toLowerCase();
    return (ext && MIME_BY_EXT[ext]) || 'application/octet-stream';
  }

  buildObjectKeyForImagen(
    notaId: number | string | null | undefined,
    originalName: string,
  ): string {
    const name = originalName || 'imagen';
    const ext = name.includes('.')
      ? name.split('.').pop()?.toLowerCase()
      : undefined;
    return buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'pedidos-notas',
      scopeId: String(notaId ?? '').trim() || 'sin-nota',
      originalName: name,
      ext,
    });
  }

  async putImagen(
    buffer: Buffer,
    notaId: number | string | null | undefined,
    originalName: string,
    mimeHint?: string | null,
  ): Promise<PedidosNotaImagenPutResult> {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    const key = this.buildObjectKeyForImagen(notaId, originalName);
    const contentType = this.guessContentType(originalName, mimeHint);
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType,
      metadata: {
        module: 'pedidos-notas',
        nota_id: String(notaId ?? ''),
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  resolveDiskPath(rutaArchivo: string | null | undefined): string | null {
    const ruta = rutaArchivo ? String(rutaArchivo).trim() : '';
    if (!ruta) return null;
    const fileName = path.basename(ruta);
    if (!fileName || fileName === '.' || fileName === '..') return null;
    return path.join(this.uploadsDir, fileName);
  }

  /**
   * Dual-read: prefer R2 via storage_key, fall back to disk via ruta_archivo.
   */
  async resolveArchivo(row: PedidosNotaImagenStorageRow): Promise<{
    buffer: Buffer;
    contentType: string;
  }> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (key) {
      if (!this.storage.isEnabled()) {
        throw new ServiceUnavailableException(
          'Imagen está en R2 pero R2 no está habilitado',
        );
      }
      const obj = await this.storage.get(key);
      return {
        buffer: Buffer.from(obj.body),
        contentType:
          obj.contentType ||
          this.guessContentType(row.nombre_archivo || '', row.tipo_mime),
      };
    }

    const diskPath = this.resolveDiskPath(row.ruta_archivo);
    if (diskPath && fs.existsSync(diskPath)) {
      const buffer = fs.readFileSync(diskPath);
      return {
        buffer,
        contentType: this.guessContentType(
          row.nombre_archivo || path.basename(diskPath),
          row.tipo_mime,
        ),
      };
    }

    throw new NotFoundException(
      'Archivo de imagen no encontrado (ni R2 ni disco)',
    );
  }

  async deleteObjectIfAny(
    storageKey: string | null | undefined,
  ): Promise<void> {
    const key = storageKey ? String(storageKey).trim() : '';
    if (!key || !this.storage.isEnabled()) return;
    try {
      await this.storage.delete(key);
    } catch (err) {
      this.logger.warn(
        `R2 delete failed for pedidos-notas key=${key}: ${(err as Error)?.message}`,
      );
    }
  }

  deleteDiskFileIfAny(rutaArchivo: string | null | undefined): void {
    try {
      const diskPath = this.resolveDiskPath(rutaArchivo);
      if (diskPath && fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
        this.logger.log(`Deleted disk file: ${diskPath}`);
      }
    } catch (err) {
      this.logger.warn(
        `Error deleting disk file ${rutaArchivo}: ${(err as Error)?.message}`,
      );
    }
  }

  assertHasReadableSource(row: PedidosNotaImagenStorageRow): void {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    const ruta = row.ruta_archivo ? String(row.ruta_archivo).trim() : '';
    if (!key && !ruta) {
      throw new BadRequestException('Imagen sin storage_key ni ruta_archivo');
    }
  }
}
