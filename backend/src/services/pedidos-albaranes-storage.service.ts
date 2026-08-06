import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { buildObjectKey } from '../storage/object-key.util';

export type PedidosAlbaranStorageRow = {
  archivo?: unknown;
  storage_key?: string | null;
  nombre_archivo?: string | null;
  tipo_mime?: string | null;
};

export type PedidosAlbaranPutResult = {
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
  heic: 'image/heic',
  heif: 'image/heif',
};

@Injectable()
export class PedidosAlbaranesStorageService {
  private readonly logger = new Logger(PedidosAlbaranesStorageService.name);

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

  sanitizePedidoUid(pedidoUid: string | null | undefined): string {
    return (
      String(pedidoUid || '')
        .trim()
        .replace(/^=+/, '')
        .replace(/[/\\]+/g, '_')
        .slice(0, 64) || 'sin-pedido'
    );
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

  buildObjectKeyForAlbaran(
    pedidoUid: string | null | undefined,
    originalName: string,
  ): string {
    const name = originalName || 'albaran.pdf';
    const ext = name.includes('.')
      ? name.split('.').pop()?.toLowerCase()
      : 'pdf';
    return buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'pedidos-albaranes',
      scopeId: this.sanitizePedidoUid(pedidoUid),
      originalName: name,
      ext,
    });
  }

  async putAlbaran(
    buffer: Buffer,
    pedidoUid: string | null | undefined,
    originalName: string,
    mimeHint?: string | null,
  ): Promise<PedidosAlbaranPutResult> {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    const key = this.buildObjectKeyForAlbaran(pedidoUid, originalName);
    const contentType = this.guessContentType(originalName, mimeHint);
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType,
      metadata: {
        module: 'pedidos-albaranes',
        pedido_uid: this.sanitizePedidoUid(pedidoUid),
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
        'Columna "archivo" no está disponible para este albarán',
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
   * R2-only after archivo DROP.
   */
  async resolveArchivo(row: PedidosAlbaranStorageRow): Promise<Buffer> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (!key) {
      throw new BadRequestException(
        'Albarán sin storage_key (solo R2; columna archivo eliminada)',
      );
    }
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException(
        'Albarán está en R2 pero R2 no está habilitado',
      );
    }
    const obj = await this.storage.get(key);
    return Buffer.from(obj.body);
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
        `R2 delete failed for pedidos-albaranes key=${key}: ${(err as Error)?.message}`,
      );
    }
  }
}
