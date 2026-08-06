import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { buildObjectKey } from '../storage/object-key.util';

export type PrlDocumentoStorageRow = {
  storage_key?: string | null;
};

export type PrlDocumentoPutResult = {
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
export class PrlDocumentsStorageService {
  private readonly logger = new Logger(PrlDocumentsStorageService.name);

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

  /** Safe path segment for grupo nombre. */
  slugGrupo(grupoNombre: string): string {
    const cleaned = String(grupoNombre || '')
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 120);
    return cleaned || 'grupo';
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

  async putTemplate(
    buffer: Buffer,
    grupoNombre: string,
    originalName: string,
    mimeHint?: string | null,
  ): Promise<PrlDocumentoPutResult> {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    const name = originalName || 'template-prl';
    const ext = name.includes('.')
      ? name.split('.').pop()?.toLowerCase()
      : undefined;
    const key = buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'prl',
      scopeId: `templates/${this.slugGrupo(grupoNombre)}`,
      originalName: name,
      ext,
    });
    const contentType = this.guessContentType(name, mimeHint);
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType,
      metadata: {
        module: 'prl',
        kind: 'template',
        grupo: this.slugGrupo(grupoNombre),
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  async putEmployeeOriginal(
    buffer: Buffer,
    empleadoId: string,
    originalName: string,
    mimeHint?: string | null,
  ): Promise<PrlDocumentoPutResult> {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    const emp = String(empleadoId || '').trim() || 'sin-codigo';
    const name = originalName || 'documento-prl';
    const ext = name.includes('.')
      ? name.split('.').pop()?.toLowerCase()
      : undefined;
    const key = buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'prl',
      scopeId: `employees/${emp}/original`,
      originalName: name,
      ext,
    });
    const contentType = this.guessContentType(name, mimeHint);
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType,
      metadata: {
        module: 'prl',
        kind: 'original',
        empleado: emp,
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  async putEmployeeFirmado(
    buffer: Buffer,
    empleadoId: string,
    originalName: string,
    mimeHint?: string | null,
  ): Promise<PrlDocumentoPutResult> {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    const emp = String(empleadoId || '').trim() || 'sin-codigo';
    const name = originalName || 'documento-firmado';
    const ext = name.includes('.')
      ? name.split('.').pop()?.toLowerCase()
      : undefined;
    const key = buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'prl',
      scopeId: `employees/${emp}/firmado`,
      originalName: name,
      ext,
    });
    const contentType = this.guessContentType(name, mimeHint);
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType,
      metadata: {
        module: 'prl',
        kind: 'firmado',
        empleado: emp,
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  /** R2-only: requires storage_key (LONGBLOB columns dropped). */
  async resolveArchivo(row: PrlDocumentoStorageRow): Promise<Buffer> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (!key) {
      throw new BadRequestException(
        'Documento PRL sin storage_key (solo R2; columnas archivo eliminadas)',
      );
    }
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException(
        'Documento PRL está en R2 pero R2 no está habilitado',
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
        `R2 delete failed for prl key=${key}: ${(err as Error)?.message}`,
      );
    }
  }
}
