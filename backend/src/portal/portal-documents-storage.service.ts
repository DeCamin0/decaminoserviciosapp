import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { buildObjectKey } from '../storage/object-key.util';

export type PortalDocStorageRow = {
  archivo?: unknown;
  storage_key?: string | null;
  mime_type?: string | null;
  nombre_archivo?: string | null;
  nombre_documento?: string | null;
};

export type PortalDocPutResult = {
  storage_key: string;
  storage_bucket: string;
  tamano_bytes: number;
};

@Injectable()
export class PortalDocumentsStorageService {
  private readonly logger = new Logger(PortalDocumentsStorageService.name);

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

  private assertR2Enabled(): void {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
  }

  async putFactura(
    buffer: Buffer,
    clienteId: number | string,
    originalName: string,
    mimeHint?: string | null,
  ): Promise<PortalDocPutResult> {
    this.assertR2Enabled();
    const name = originalName || 'factura.pdf';
    const ext = name.includes('.')
      ? name.split('.').pop()?.toLowerCase()
      : 'pdf';
    const key = buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'portal',
      scopeId: `facturas/cli_${clienteId}`,
      originalName: name,
      ext,
    });
    const contentType =
      (mimeHint && String(mimeHint).trim()) || 'application/pdf';
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType,
      metadata: {
        module: 'portal-facturas',
        cliente_id: String(clienteId),
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  async putGeneral(
    buffer: Buffer,
    originalName: string,
    mimeHint?: string | null,
  ): Promise<PortalDocPutResult> {
    this.assertR2Enabled();
    const name = originalName || 'documento.pdf';
    const ext = name.includes('.')
      ? name.split('.').pop()?.toLowerCase()
      : 'pdf';
    const key = buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'portal',
      scopeId: 'general',
      originalName: name,
      ext,
    });
    const contentType =
      (mimeHint && String(mimeHint).trim()) || 'application/pdf';
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType,
      metadata: { module: 'portal-general' },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  async putInspeccion(
    buffer: Buffer,
    clienteId: number | string,
    originalName: string,
    mimeHint?: string | null,
  ): Promise<PortalDocPutResult> {
    this.assertR2Enabled();
    const name = originalName || 'inspeccion.pdf';
    const ext = name.includes('.')
      ? name.split('.').pop()?.toLowerCase()
      : 'pdf';
    const key = buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'portal',
      scopeId: `inspecciones/cli_${clienteId}`,
      originalName: name,
      ext,
    });
    const contentType =
      (mimeHint && String(mimeHint).trim()) || 'application/pdf';
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType,
      metadata: {
        module: 'portal-inspecciones',
        cliente_id: String(clienteId),
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
        'Columna "archivo" no está disponible para este documento',
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
  async resolveArchivo(row: PortalDocStorageRow): Promise<Buffer> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (!key) {
      throw new BadRequestException(
        'Documento sin storage_key (solo R2; columna archivo eliminada)',
      );
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
        `R2 delete failed for portal key=${key}: ${(err as Error)?.message}`,
      );
    }
  }
}
