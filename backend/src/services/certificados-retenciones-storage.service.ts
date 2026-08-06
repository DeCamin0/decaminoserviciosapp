import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { buildObjectKey } from '../storage/object-key.util';

export type CertificadoRetencionStorageRow = {
  storage_key?: string | null;
};

export type CertificadoRetencionPutResult = {
  storage_key: string;
  storage_bucket: string;
  tamano_bytes: number;
};

@Injectable()
export class CertificadosRetencionesStorageService {
  private readonly logger = new Logger(
    CertificadosRetencionesStorageService.name,
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

  buildObjectKeyForCertificado(
    empleadoId: string | null | undefined,
    originalName: string,
  ): string {
    const name = originalName?.toLowerCase().endsWith('.pdf')
      ? originalName
      : `${originalName || 'certificado-retencion'}.pdf`;
    return buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'certificados-retenciones',
      scopeId: String(empleadoId || '').trim() || 'sin-codigo',
      originalName: name,
      ext: 'pdf',
    });
  }

  async putCertificadoPdf(
    buffer: Buffer,
    empleadoId: string | null | undefined,
    originalName: string,
  ): Promise<CertificadoRetencionPutResult> {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    const key = this.buildObjectKeyForCertificado(empleadoId, originalName);
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType: 'application/pdf',
      metadata: {
        module: 'certificados-retenciones',
        empleado: String(empleadoId || ''),
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  async resolveArchivo(row: CertificadoRetencionStorageRow): Promise<Buffer> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (!key) {
      throw new BadRequestException(
        'Certificado sin storage_key (solo R2; columna archivo eliminada)',
      );
    }
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException(
        'Certificado está en R2 pero R2 no está habilitado',
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
        `R2 delete failed for certificados-retenciones key=${key}: ${(err as Error)?.message}`,
      );
    }
  }
}
