import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { StorageService } from '../../storage/storage.service';
import { buildObjectKey } from '../../storage/object-key.util';

@Injectable()
export class PresupuestosV2StorageService {
  private readonly logger = new Logger(PresupuestosV2StorageService.name);

  constructor(private readonly storage: StorageService) {}

  isEnabled(): boolean {
    return this.storage.isEnabled();
  }

  tenantSlug(): string {
    const db = (process.env.DB_NAME || '').trim().toLowerCase();
    if (db === 'hera_facility_db' || db.includes('hera')) return 'hera';
    if (db === 'decamino_db' || db.includes('decamino')) return 'decamino';
    if (db.startsWith('tenant_')) return db.replace(/^tenant_/, '') || 'tenant';
    return 'decamino';
  }

  buildKey(
    presupuestoId: number,
    filename: string,
    kind: 'borrador' | 'emitido',
  ): string {
    const name = filename.toLowerCase().endsWith('.pdf')
      ? filename
      : `${filename}.pdf`;
    return buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'v2-presupuestos',
      scopeId: `${presupuestoId}/${kind}`,
      originalName: name,
      ext: 'pdf',
      uuid: randomUUID(),
    });
  }

  sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  async putPdf(opts: {
    presupuestoId: number;
    buffer: Buffer;
    filename: string;
    kind: 'borrador' | 'emitido';
  }): Promise<{
    storage_key: string;
    storage_bucket: string;
    size_bytes: number;
    sha256: string;
  }> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    const sha = this.sha256(opts.buffer);
    const key = this.buildKey(opts.presupuestoId, opts.filename, opts.kind);
    try {
      const put = await this.storage.put({
        key,
        body: opts.buffer,
        contentType: 'application/pdf',
        metadata: {
          module: 'presupuestos-v2',
          presupuesto_id: String(opts.presupuestoId),
          kind: opts.kind,
          sha256: sha,
        },
      });
      return {
        storage_key: put.key,
        storage_bucket: put.bucket,
        size_bytes: opts.buffer.length,
        sha256: sha,
      };
    } catch (e: any) {
      this.logger.error(`V2 PDF R2 put failed: ${e?.message || e}`);
      throw e;
    }
  }

  async getObjectBuffer(key: string): Promise<Buffer | null> {
    if (!key || !this.isEnabled()) return null;
    try {
      const obj = await this.storage.get(key);
      return Buffer.isBuffer(obj.body)
        ? obj.body
        : Buffer.from(obj.body as any);
    } catch (e: any) {
      this.logger.warn(`R2 get failed for ${key}: ${e?.message || e}`);
      return null;
    }
  }

  async getPdf(storageKey: string): Promise<Buffer> {
    const obj = await this.storage.get(storageKey);
    return Buffer.isBuffer(obj.body)
      ? obj.body
      : Buffer.from(obj.body as any);
  }
}
