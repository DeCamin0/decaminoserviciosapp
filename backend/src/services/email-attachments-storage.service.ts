import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { buildObjectKey } from '../storage/object-key.util';

export type EmailAttachmentStorageRow = {
  storage_key?: string | null;
  filename?: string | null;
  mime_type?: string | null;
};

export type EmailAttachmentPutResult = {
  storage_key: string;
  storage_bucket: string;
  tamano_bytes: number;
};

@Injectable()
export class EmailAttachmentsStorageService {
  private readonly logger = new Logger(EmailAttachmentsStorageService.name);

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

  private assertR2(): void {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
  }

  async putAttachment(
    buffer: Buffer,
    emailId: string,
    filename: string,
    mimeType?: string | null,
  ): Promise<EmailAttachmentPutResult> {
    this.assertR2();
    const name = filename || 'attachment.bin';
    const ext = name.includes('.')
      ? name.split('.').pop()?.toLowerCase()
      : undefined;
    const scope =
      String(emailId || '')
        .trim()
        .replace(/[/\\]+/g, '_')
        .slice(0, 64) || 'sin-email';
    const key = buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'email-attachments',
      scopeId: scope,
      originalName: name,
      ext,
    });
    const contentType =
      (mimeType && String(mimeType).trim()) || 'application/octet-stream';
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType,
      metadata: {
        module: 'email-attachments',
        email_id: scope,
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  /** R2-only after file_content DROP. */
  async resolveFileContent(row: EmailAttachmentStorageRow): Promise<Buffer> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (!key) {
      throw new BadRequestException('Adjunto sin storage_key');
    }
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException(
        'Adjunto está en R2 pero R2 no está habilitado',
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
        `R2 delete failed key=${key}: ${(err as Error)?.message}`,
      );
    }
  }
}
