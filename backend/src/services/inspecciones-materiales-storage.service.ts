import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { buildObjectKey } from '../storage/object-key.util';

export type InspeccionDocStorageRow = {
  storage_key?: string | null;
  nombre_archivo?: string | null;
};

export type InspeccionDocPutResult = {
  storage_key: string;
  storage_bucket: string;
  tamano_bytes: number;
};

@Injectable()
export class InspeccionesMaterialesStorageService {
  private readonly logger = new Logger(
    InspeccionesMaterialesStorageService.name,
  );

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

  async putInspeccionPdf(
    buffer: Buffer,
    inspeccionId: string,
    originalName: string,
  ): Promise<InspeccionDocPutResult> {
    this.assertR2();
    const name = originalName || `${inspeccionId}.pdf`;
    const ext = name.includes('.')
      ? name.split('.').pop()?.toLowerCase()
      : 'pdf';
    const key = buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'inspecciones-materiales',
      scopeId: `inspecciones/${String(inspeccionId || '').trim() || 'sin-id'}`,
      originalName: name.endsWith('.pdf') ? name : `${name}.pdf`,
      ext: ext || 'pdf',
    });
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType: 'application/pdf',
      metadata: {
        module: 'inspecciones',
        inspeccion_id: String(inspeccionId || ''),
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  async putMaterialArchivo(
    buffer: Buffer,
    inspeccionId: string,
    originalName: string,
    mimeHint?: string | null,
  ): Promise<InspeccionDocPutResult> {
    this.assertR2();
    const name = originalName || 'material.pdf';
    const ext = name.includes('.')
      ? name.split('.').pop()?.toLowerCase()
      : 'pdf';
    const key = buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'inspecciones-materiales',
      scopeId: `materiales/${String(inspeccionId || '').trim() || 'sin-id'}`,
      originalName: name,
      ext,
    });
    const contentType =
      (mimeHint && String(mimeHint).trim()) ||
      (ext === 'png'
        ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : 'application/pdf');
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType,
      metadata: {
        module: 'materiales',
        inspeccion_id: String(inspeccionId || ''),
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  /** R2-only read after archivo DROP. */
  async resolveArchivo(row: InspeccionDocStorageRow): Promise<Buffer> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (!key) {
      throw new BadRequestException('Documento sin storage_key');
    }
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException(
        'Documento está en R2 pero R2 no está habilitado',
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
