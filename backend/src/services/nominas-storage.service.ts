import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { buildObjectKey } from '../storage/object-key.util';

export type NominaStorageRow = {
  storage_key?: string | null;
};

export type NominaPutResult = {
  storage_key: string;
  storage_bucket: string;
  tamano_bytes: number;
};

@Injectable()
export class NominasStorageService {
  private readonly logger = new Logger(NominasStorageService.name);

  constructor(private readonly storage: StorageService) {}

  /** New nómina uploads go to R2 whenever object storage is enabled. */
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

  buildObjectKeyForNomina(
    codigoEmpleado: string | null | undefined,
    originalName: string,
  ): string {
    const name = originalName?.toLowerCase().endsWith('.pdf')
      ? originalName
      : `${originalName || 'nomina'}.pdf`;
    return buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'nominas',
      scopeId: String(codigoEmpleado || '').trim() || 'sin-codigo',
      originalName: name,
      ext: 'pdf',
    });
  }

  async putNominaPdf(
    buffer: Buffer,
    codigoEmpleado: string | null | undefined,
    originalName: string,
  ): Promise<NominaPutResult> {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    const key = this.buildObjectKeyForNomina(codigoEmpleado, originalName);
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType: 'application/pdf',
      metadata: {
        module: 'nominas',
        codigo: String(codigoEmpleado || ''),
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  /**
   * R2-only read (columna archivo eliminada).
   */
  async resolveArchivo(row: NominaStorageRow): Promise<Buffer> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (!key) {
      throw new BadRequestException(
        'Nómina sin storage_key (solo R2; columna archivo eliminada)',
      );
    }
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException(
        'Nómina está en R2 pero R2 no está habilitado',
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
        `R2 delete failed for nominas key=${key}: ${(err as Error)?.message}`,
      );
    }
  }
}
