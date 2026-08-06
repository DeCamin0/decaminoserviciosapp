import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../storage/storage.service';
import { buildObjectKey } from '../storage/object-key.util';

export type PresupuestoFirmaStorageRow = {
  storage_key?: string | null;
  pdf_content?: unknown;
  pdf_path?: string | null;
};

export type PresupuestoFirmaPutResult = {
  storage_key: string;
  storage_bucket: string;
  tamano_bytes: number;
};

@Injectable()
export class PresupuestosFirmasStorageService {
  private readonly logger = new Logger(PresupuestosFirmasStorageService.name);

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

  buildObjectKeyForFirma(
    presupuestoId: string | number | null | undefined,
    originalName: string,
  ): string {
    const name = originalName?.toLowerCase().endsWith('.pdf')
      ? originalName
      : `${originalName || 'presupuesto-firmado'}.pdf`;
    return buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'presupuestos-firmas',
      scopeId: String(presupuestoId ?? '').trim() || 'sin-id',
      originalName: name,
      ext: 'pdf',
    });
  }

  async putFirmaPdf(
    buffer: Buffer,
    presupuestoId: string | number | null | undefined,
    originalName: string,
  ): Promise<PresupuestoFirmaPutResult> {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    const key = this.buildObjectKeyForFirma(presupuestoId, originalName);
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType: 'application/pdf',
      metadata: {
        module: 'presupuestos-firmas',
        presupuesto_id: String(presupuestoId ?? ''),
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  buildObjectKeyForFirmaImagen(
    presupuestoId: string | number | null | undefined,
  ): string {
    return buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'presupuestos-firmas',
      scopeId: String(presupuestoId ?? '').trim() || 'sin-id',
      originalName: 'firma-cliente.png',
      ext: 'png',
    });
  }

  /** Semnătura client (PNG) — separat de PDF-ul semnat. */
  async putFirmaImagenPng(
    buffer: Buffer,
    presupuestoId: string | number | null | undefined,
  ): Promise<PresupuestoFirmaPutResult> {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    const key = this.buildObjectKeyForFirmaImagen(presupuestoId);
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType: 'image/png',
      metadata: {
        module: 'presupuestos-firmas-imagen',
        presupuesto_id: String(presupuestoId ?? ''),
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  parseFirmaImagenBase64(raw: string | null | undefined): Buffer | null {
    const s = String(raw || '')
      .trim()
      .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, '');
    if (!s) return null;
    try {
      const buf = Buffer.from(s, 'base64');
      return buf.length > 0 ? buf : null;
    } catch {
      return null;
    }
  }

  async resolveFirmaImagenBase64(row: {
    firma_imagen_storage_key?: string | null;
    firma_imagen_base64?: string | null;
  }): Promise<string | null> {
    const key = row.firma_imagen_storage_key
      ? String(row.firma_imagen_storage_key).trim()
      : '';
    if (key) {
      if (!this.storage.isEnabled()) {
        throw new ServiceUnavailableException(
          'Firma imagen está en R2 pero R2 no está habilitado',
        );
      }
      const obj = await this.storage.get(key);
      return Buffer.from(obj.body).toString('base64');
    }
    const legacy = String(row.firma_imagen_base64 || '').trim();
    if (!legacy) return null;
    return legacy.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, '');
  }

  coercePdfContentBuffer(pdfContent: unknown): Buffer | null {
    if (pdfContent == null) return null;
    if (Buffer.isBuffer(pdfContent)) {
      return pdfContent.length > 0 ? pdfContent : null;
    }
    if (
      typeof pdfContent === 'object' &&
      pdfContent !== null &&
      (pdfContent as { type?: string }).type === 'Buffer' &&
      Array.isArray((pdfContent as { data?: unknown }).data)
    ) {
      const buf = Buffer.from((pdfContent as { data: number[] }).data);
      return buf.length > 0 ? buf : null;
    }
    if (typeof pdfContent === 'string') {
      const buf = Buffer.from(pdfContent, 'base64');
      return buf.length > 0 ? buf : null;
    }
    if (pdfContent instanceof Uint8Array) {
      const buf = Buffer.from(pdfContent);
      return buf.length > 0 ? buf : null;
    }
    if (Array.isArray(pdfContent) && pdfContent.length > 0) {
      const buf = Buffer.from(pdfContent);
      return buf.length > 0 ? buf : null;
    }
    return null;
  }

  readDiskPdf(pdfPath: string | null | undefined): Buffer | null {
    const rel = pdfPath ? String(pdfPath).trim() : '';
    if (!rel) return null;
    const absolute = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
    if (!fs.existsSync(absolute)) return null;
    try {
      const buf = fs.readFileSync(absolute);
      return buf.length > 0 ? buf : null;
    } catch (err) {
      this.logger.warn(
        `Disk read failed for presupuestos-firmas path=${absolute}: ${(err as Error)?.message}`,
      );
      return null;
    }
  }

  /**
   * Dual-read: R2 storage_key → pdf_content LONGBLOB → disk pdf_path.
   */
  async resolvePdf(row: PresupuestoFirmaStorageRow): Promise<Buffer | null> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (key) {
      if (!this.storage.isEnabled()) {
        throw new ServiceUnavailableException(
          'PDF firmado está en R2 pero R2 no está habilitado',
        );
      }
      const obj = await this.storage.get(key);
      return Buffer.from(obj.body);
    }

    const fromBlob = this.coercePdfContentBuffer(row.pdf_content);
    if (fromBlob) return fromBlob;

    return this.readDiskPdf(row.pdf_path);
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
        `R2 delete failed for presupuestos-firmas key=${key}: ${(err as Error)?.message}`,
      );
    }
  }
}
