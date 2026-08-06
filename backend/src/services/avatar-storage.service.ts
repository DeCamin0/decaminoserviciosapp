import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { buildObjectKey } from '../storage/object-key.util';

export type AvatarStorageRow = {
  AVATAR?: unknown;
  storage_key?: string | null;
};

export type AvatarPutResult = {
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
  bmp: 'image/bmp',
};

@Injectable()
export class AvatarStorageService {
  private readonly logger = new Logger(AvatarStorageService.name);

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

  guessContentType(
    originalName?: string | null,
    mimeHint?: string | null,
  ): string {
    if (mimeHint && String(mimeHint).trim()) {
      return String(mimeHint).trim();
    }
    const ext = String(originalName || '')
      .split('.')
      .pop()
      ?.toLowerCase();
    return (ext && MIME_BY_EXT[ext]) || 'image/jpeg';
  }

  detectExtFromBuffer(buffer: Buffer): string {
    if (buffer.length >= 8) {
      if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      ) {
        return 'png';
      }
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'jpg';
      }
      if (
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38
      ) {
        return 'gif';
      }
      if (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      ) {
        return 'webp';
      }
    }
    return 'jpg';
  }

  buildObjectKeyForAvatar(
    empleadoCodigo: string | null | undefined,
    originalName?: string | null,
    buffer?: Buffer,
  ): string {
    const extFromName = originalName?.includes('.')
      ? originalName.split('.').pop()?.toLowerCase()
      : undefined;
    const ext =
      (extFromName && MIME_BY_EXT[extFromName] ? extFromName : null) ||
      (buffer ? this.detectExtFromBuffer(buffer) : 'jpg');
    const name =
      originalName && String(originalName).trim()
        ? originalName
        : `avatar.${ext}`;
    return buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'avatars',
      scopeId: String(empleadoCodigo || '').trim() || 'sin-codigo',
      originalName: name,
      ext,
    });
  }

  async putAvatar(
    buffer: Buffer,
    empleadoCodigo: string | null | undefined,
    originalName?: string | null,
    mimeHint?: string | null,
  ): Promise<AvatarPutResult> {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    const key = this.buildObjectKeyForAvatar(
      empleadoCodigo,
      originalName,
      buffer,
    );
    const contentType = this.guessContentType(originalName, mimeHint);
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType,
      metadata: {
        module: 'avatars',
        empleado: String(empleadoCodigo || ''),
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  coerceAvatarBuffer(avatar: unknown): Buffer {
    if (avatar == null) {
      throw new BadRequestException(
        'Columna "AVATAR" no está disponible para este registro',
      );
    }
    if (Buffer.isBuffer(avatar)) return avatar;
    if (
      typeof avatar === 'object' &&
      avatar !== null &&
      (avatar as { type?: string }).type === 'Buffer' &&
      Array.isArray((avatar as { data?: unknown }).data)
    ) {
      return Buffer.from((avatar as { data: number[] }).data);
    }
    if (typeof avatar === 'string') {
      return Buffer.from(avatar, 'base64');
    }
    if (avatar instanceof Uint8Array) {
      return Buffer.from(avatar);
    }
    throw new BadRequestException('Formato desconocido para el campo "AVATAR"');
  }

  /**
   * Dual-read: prefer R2 (storage_key), fallback to AVATAR LONGBLOB.
   */
  async resolveAvatar(row: AvatarStorageRow): Promise<Buffer> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (key) {
      if (!this.storage.isEnabled()) {
        throw new ServiceUnavailableException(
          'Avatar está en R2 pero R2 no está habilitado',
        );
      }
      const obj = await this.storage.get(key);
      return Buffer.from(obj.body);
    }
    if (row.AVATAR != null) {
      return this.coerceAvatarBuffer(row.AVATAR);
    }
    throw new BadRequestException('Avatar sin storage_key ni blob AVATAR');
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
        `R2 delete failed for avatars key=${key}: ${(err as Error)?.message}`,
      );
    }
  }
}
