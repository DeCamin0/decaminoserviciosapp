import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { buildObjectKey } from '../storage/object-key.util';

export type CatalogoStorageRow = {
  fotoproducto?: unknown;
  storage_key?: string | null;
};

export type CatalogoPutResult = {
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
};

@Injectable()
export class CatalogoStorageService {
  private readonly logger = new Logger(CatalogoStorageService.name);

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

  /**
   * Guess content type from data-URL / mime hint / filename.
   * Defaults to image/jpeg for product photos.
   */
  guessContentType(
    originalName?: string | null,
    mimeHint?: string | null,
  ): string {
    if (mimeHint && String(mimeHint).trim()) {
      const hint = String(mimeHint).trim().toLowerCase();
      if (hint.startsWith('image/')) return hint;
    }
    const ext = String(originalName || '')
      .split('.')
      .pop()
      ?.toLowerCase();
    return (ext && MIME_BY_EXT[ext]) || 'image/jpeg';
  }

  /** Parse data URL or raw base64 into buffer + content type. */
  parseImagenBase64(imagenBase64: string): {
    buffer: Buffer;
    contentType: string;
    originalName: string;
  } {
    const raw = String(imagenBase64 || '').trim();
    if (!raw) {
      throw new BadRequestException('imagen_base64 vacío');
    }

    let contentType = 'image/jpeg';
    let b64 = raw;

    const dataUrl = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
    if (dataUrl) {
      contentType = dataUrl[1].toLowerCase();
      b64 = dataUrl[2];
    } else {
      b64 = raw.replace(/^data:image\/[^;]+;base64,/, '');
    }

    const buffer = Buffer.from(b64, 'base64');
    if (!buffer.length) {
      throw new BadRequestException('imagen_base64 inválido o vacío');
    }

    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('gif')
          ? 'gif'
          : 'jpg';

    return {
      buffer,
      contentType,
      originalName: `producto.${ext}`,
    };
  }

  buildObjectKeyForProducto(
    productoId: string | number | null | undefined,
    originalName: string,
  ): string {
    const name = originalName || 'producto.jpg';
    const ext = name.includes('.')
      ? name.split('.').pop()?.toLowerCase()
      : 'jpg';
    return buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'catalogo',
      scopeId: String(productoId ?? '').trim() || 'sin-id',
      originalName: name,
      ext: ext || 'jpg',
    });
  }

  async putProductoImagen(
    buffer: Buffer,
    productoId: string | number | null | undefined,
    originalName: string,
    contentType?: string | null,
  ): Promise<CatalogoPutResult> {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    const key = this.buildObjectKeyForProducto(productoId, originalName);
    const ct = this.guessContentType(originalName, contentType);
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType: ct,
      metadata: {
        module: 'catalogo',
        producto: String(productoId || ''),
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  coerceFotoproductoBuffer(fotoproducto: unknown): Buffer | null {
    if (fotoproducto == null) return null;
    if (Buffer.isBuffer(fotoproducto)) {
      return fotoproducto.length ? fotoproducto : null;
    }
    if (
      typeof fotoproducto === 'object' &&
      fotoproducto !== null &&
      (fotoproducto as { type?: string }).type === 'Buffer' &&
      Array.isArray((fotoproducto as { data?: unknown }).data)
    ) {
      const buf = Buffer.from((fotoproducto as { data: number[] }).data);
      return buf.length ? buf : null;
    }
    if (typeof fotoproducto === 'string') {
      const buf = Buffer.from(fotoproducto, 'base64');
      return buf.length ? buf : null;
    }
    if (fotoproducto instanceof Uint8Array) {
      const buf = Buffer.from(fotoproducto);
      return buf.length ? buf : null;
    }
    return null;
  }

  /**
   * Dual-read: prefer R2 storage_key; fall back to LONGBLOB fotoproducto
   * while the column still exists. After drop, only storage_key is valid.
   */
  async resolveArchivo(row: CatalogoStorageRow): Promise<Buffer> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (key) {
      if (!this.storage.isEnabled()) {
        throw new ServiceUnavailableException(
          'Imagen de producto está en R2 pero R2 no está habilitado',
        );
      }
      const obj = await this.storage.get(key);
      return Buffer.from(obj.body);
    }

    const blob = this.coerceFotoproductoBuffer(row.fotoproducto);
    if (blob) return blob;

    throw new BadRequestException(
      'Producto sin imagen (ni storage_key ni fotoproducto)',
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
        `R2 delete failed for catalogo key=${key}: ${(err as Error)?.message}`,
      );
    }
  }
}
