import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { buildObjectKey } from '../storage/object-key.util';

export type DiplomaStorageRow = {
  archivo?: unknown;
  storage_key?: string | null;
};

export type DiplomaPutResult = {
  storage_key: string;
  storage_bucket: string;
  tamano_bytes: number;
};

@Injectable()
export class DiplomasStorageService {
  private readonly logger = new Logger(DiplomasStorageService.name);

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

  buildObjectKeyForDiploma(
    empleadoId: string | null | undefined,
    originalName: string,
  ): string {
    const name = originalName?.toLowerCase().endsWith('.pdf')
      ? originalName
      : `${originalName || 'diploma'}.pdf`;
    return buildObjectKey({
      app: 'decamino',
      tenant: this.tenantSlug(),
      domain: 'diplomas',
      scopeId: String(empleadoId || '').trim() || 'sin-codigo',
      originalName: name,
      ext: 'pdf',
    });
  }

  async putDiplomaPdf(
    buffer: Buffer,
    empleadoId: string | null | undefined,
    originalName: string,
  ): Promise<DiplomaPutResult> {
    if (!this.isWriteEnabled()) {
      throw new ServiceUnavailableException(
        'R2 no está habilitado. Configura R2_ENABLED=true y credenciales.',
      );
    }
    const key = this.buildObjectKeyForDiploma(empleadoId, originalName);
    const put = await this.storage.put({
      key,
      body: buffer,
      contentType: 'application/pdf',
      metadata: {
        module: 'diplomas',
        empleado: String(empleadoId || ''),
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
        'Columna "archivo" no está disponible para este diploma',
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

  async resolveArchivo(row: DiplomaStorageRow): Promise<Buffer> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (!key) {
      throw new BadRequestException(
        'Diploma sin storage_key (solo R2; columna archivo eliminada)',
      );
    }
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException(
        'Diploma está en R2 pero R2 no está habilitado',
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
        `R2 delete failed for diplomas key=${key}: ${(err as Error)?.message}`,
      );
    }
  }
}
