import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../storage/storage.service';
import { buildObjectKey } from '../storage/object-key.util';

export type DocumentoOficialStorageRow = {
  storage_key?: string | null;
};

export type DocumentoOficialPutResult = {
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
export class DocumentosOficialesStorageService {
  private readonly logger = new Logger(DocumentosOficialesStorageService.name);

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

  buildObjectKeyForDocumento(
    empleadoId: string | null | undefined,
    originalName: string,
  ): string {
    const name = originalName || 'documento-oficial';
    const ext = name.includes('.')
      ? name.split('.').pop()?.toLowerCase()
      : undefined;
    return buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'docs-oficiales',
      scopeId: String(empleadoId || '').trim() || 'sin-codigo',
      originalName: name,
      ext,
    });
  }

  async putDocumento(
    buffer: Buffer,
    empleadoId: string | null | undefined,
    originalName: string,
    mimeHint?: string | null,
  ): Promise<DocumentoOficialPutResult> {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    const key = this.buildObjectKeyForDocumento(empleadoId, originalName);
    const contentType = this.guessContentType(originalName, mimeHint);
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType,
      metadata: {
        module: 'docs-oficiales',
        empleado: String(empleadoId || ''),
      },
    });
    return {
      storage_key: put.key,
      storage_bucket: put.bucket,
      tamano_bytes: buffer.length,
    };
  }

  async resolveArchivo(row: DocumentoOficialStorageRow): Promise<Buffer> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (!key) {
      throw new BadRequestException(
        'Documento oficial sin storage_key (solo R2; columna archivo eliminada)',
      );
    }
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException(
        'Documento oficial está en R2 pero R2 no está habilitado',
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
        `R2 delete failed for docs-oficiales key=${key}: ${(err as Error)?.message}`,
      );
    }
  }

  /** R2 key for company stamp PNG (tenant-aware). */
  selloEmpresaObjectKey(): string {
    return `decamino/${this.tenantSlug()}/branding/sello-empresa/sello-decamino-empresa.png`;
  }

  /**
   * Load company stamp PNG from R2, with local frontend/public fallback.
   */
  async resolveSelloEmpresaPng(): Promise<Buffer> {
    const key = this.selloEmpresaObjectKey();
    if (this.storage.isEnabled()) {
      try {
        const obj = await this.storage.get(key);
        return Buffer.from(obj.body);
      } catch (err) {
        this.logger.warn(
          `R2 sello empresa missing key=${key}: ${(err as Error)?.message}; trying local fallback`,
        );
      }
    }

    const candidates = [
      path.join(
        process.cwd(),
        '..',
        'frontend',
        'public',
        'assets',
        'sello-decamino-empresa.png',
      ),
      path.join(
        process.cwd(),
        'frontend',
        'public',
        'assets',
        'sello-decamino-empresa.png',
      ),
      path.join(process.cwd(), 'assets', 'sello-decamino-empresa.png'),
    ];
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath);
      }
    }

    throw new NotFoundException(
      `Sello de empresa no encontrado (R2 key=${key} ni archivo local)`,
    );
  }
}
