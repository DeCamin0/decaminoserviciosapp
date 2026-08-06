import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { buildObjectKey } from '../storage/object-key.util';

export type ComunicadoStorageRow = {
  archivo?: unknown;
  storage_key?: string | null;
};

export type ComunicadoPutResult = {
  storage_key: string;
  storage_bucket: string;
  tamano_bytes: number;
};

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

@Injectable()
export class ComunicadosStorageService {
  private readonly logger = new Logger(ComunicadosStorageService.name);

  constructor(private readonly storage: StorageService) {}

  isWriteEnabled(): boolean {
    return this.storage.isEnabled();
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

  buildObjectKeyForComunicado(
    comunicadoId: string | number | bigint | null | undefined,
    originalName: string,
  ): string {
    const name = originalName || 'comunicado';
    const ext = name.includes('.')
      ? name.split('.').pop()?.toLowerCase()
      : undefined;
    return buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'comunicados',
      scopeId: String(comunicadoId ?? '').trim() || 'sin-id',
      originalName: name,
      ext,
    });
  }

  async putArchivo(
    buffer: Buffer,
    comunicadoId: string | number | bigint | null | undefined,
    originalName: string,
    mimeHint?: string | null,
  ): Promise<ComunicadoPutResult> {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    const key = this.buildObjectKeyForComunicado(comunicadoId, originalName);
    const contentType = this.guessContentType(originalName, mimeHint);
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType,
      metadata: {
        module: 'comunicados',
        comunicado_id: String(comunicadoId ?? ''),
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  coerceArchivoBuffer(archivo: unknown): Buffer {
    if (archivo == null) {
      throw new BadRequestException(
        'Columna "archivo" no está disponible para este comunicado',
      );
    }
    if (Buffer.isBuffer(archivo)) return archivo;
    if (
      typeof archivo === 'object' &&
      archivo !== null &&
      (archivo as { type?: string }).type === 'Buffer' &&
      Array.isArray((archivo as { data?: unknown }).data)
    ) {
      return Buffer.from((archivo as { data: number[] }).data);
    }
    if (typeof archivo === 'string') {
      return Buffer.from(archivo, 'base64');
    }
    if (archivo instanceof Uint8Array) {
      return Buffer.from(archivo);
    }
    throw new BadRequestException(
      'Formato desconocido para el campo "archivo"',
    );
  }

  /**
   * Dual-read: prefer R2 via storage_key, fall back to LONGBLOB archivo.
   * After drop-archivo migration this becomes R2-only (blob path unused).
   */
  async resolveArchivo(row: ComunicadoStorageRow): Promise<Buffer> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (key) {
      if (!this.storage.isEnabled()) {
        throw new ServiceUnavailableException(
          'Comunicado está en R2 pero R2 no está habilitado',
        );
      }
      const obj = await this.storage.get(key);
      return Buffer.from(obj.body);
    }

    if (row.archivo != null) {
      return this.coerceArchivoBuffer(row.archivo);
    }

    throw new BadRequestException('Este comunicado no tiene archivo adjunto');
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
        `R2 delete failed for comunicados key=${key}: ${(err as Error)?.message}`,
      );
    }
  }
}
