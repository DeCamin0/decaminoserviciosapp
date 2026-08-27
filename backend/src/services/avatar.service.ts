import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvatarStorageService } from './avatar-storage.service';

@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);
  private hasAvatarBlobColumnCache: boolean | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly avatarStorage: AvatarStorageService,
  ) {}

  /**
   * True while `Avatar.AVATAR` LONGBLOB still exists (pre-drop dual-read).
   */
  private async hasAvatarBlobColumn(): Promise<boolean> {
    if (this.hasAvatarBlobColumnCache != null) {
      return this.hasAvatarBlobColumnCache;
    }
    const rows = await this.prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(*) AS c
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'Avatar'
         AND COLUMN_NAME = 'AVATAR'`,
    );
    this.hasAvatarBlobColumnCache = Number(rows[0]?.c || 0) > 0;
    return this.hasAvatarBlobColumnCache;
  }

  private madridNow(): string {
    const now = new Date();
    const fechaSubida = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(now)
      .reduce(
        (acc, part) => {
          const type = part.type;
          if (type === 'year') acc.year = part.value;
          else if (type === 'month') acc.month = part.value;
          else if (type === 'day') acc.day = part.value;
          else if (type === 'hour') acc.hour = part.value;
          else if (type === 'minute') acc.minute = part.value;
          else if (type === 'second') acc.second = part.value;
          return acc;
        },
        {} as Record<string, string>,
      );

    return `${fechaSubida.year}-${fechaSubida.month}-${fechaSubida.day} ${fechaSubida.hour}:${fechaSubida.minute}:${fechaSubida.second}`;
  }

  /**
   * Resolve AVATAR_B64 for a row (R2 preferred, blob fallback).
   */
  private async toAvatarB64(row: {
    storage_key?: string | null;
    AVATAR?: unknown;
    AVATAR_B64?: string | null;
  }): Promise<string | null> {
    const key = row.storage_key ? String(row.storage_key).trim() : '';
    if (key) {
      try {
        const buf = await this.avatarStorage.resolveAvatar({
          storage_key: key,
        });
        return buf.toString('base64');
      } catch (err) {
        this.logger.warn(
          `R2 avatar fetch failed key=${key}: ${(err as Error)?.message}`,
        );
        // Dual-read: dacă R2 pică, încearcă blob-ul din DB (dacă există)
      }
    }
    if (row.AVATAR_B64) return row.AVATAR_B64;
    if (row.AVATAR != null) {
      try {
        return this.avatarStorage
          .coerceAvatarBuffer(row.AVATAR)
          .toString('base64');
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Obține avatarul unui angajat după CODIGO
   * @param codigo CODIGO-ul angajatului
   * @returns Avatar data cu AVATAR_B64 sau null dacă nu există
   */
  async getAvatar(codigo: string) {
    if (!codigo) {
      throw new BadRequestException('CODIGO is required');
    }

    const hasBlob = await this.hasAvatarBlobColumn();
    const blobSelect = hasBlob
      ? 'TO_BASE64(a.AVATAR) AS AVATAR_B64,'
      : 'NULL AS AVATAR_B64,';

    const result = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT
        d.CODIGO,
        COALESCE(a.NOMBRE, d.\`NOMBRE / APELLIDOS\`) AS NOMBRE,
        DATE_FORMAT(a.FECHA_SUBIDA, '%Y-%m-%d %H:%i:%s') AS FECHA_SUBIDA,
        a.storage_key,
        ${blobSelect}
        a.CODIGO AS AVATAR_ROW
      FROM DatosEmpleados d
      LEFT JOIN Avatar a ON a.CODIGO = d.CODIGO
      WHERE d.CODIGO = ${this.escapeSql(codigo)}
      LIMIT 1`,
    );

    if (!result || result.length === 0) {
      return null;
    }

    const avatarData = result[0];
    if (
      !avatarData.AVATAR_ROW &&
      !avatarData.storage_key &&
      !avatarData.AVATAR_B64
    ) {
      return null;
    }

    const avatarB64 = await this.toAvatarB64(avatarData);
    if (!avatarB64) {
      return null;
    }

    return {
      CODIGO: avatarData.CODIGO,
      NOMBRE: avatarData.NOMBRE,
      FECHA_SUBIDA: avatarData.FECHA_SUBIDA,
      AVATAR_B64: avatarB64,
    };
  }

  /**
   * Obține toate avatarele (pentru bulk operations)
   * Returnează TOȚI angajații, cu sau fără avatar (compatibil cu n8n)
   * @returns Array cu toți angajații și avatarele lor (dacă există)
   */
  async getAllAvatars() {
    const hasBlob = await this.hasAvatarBlobColumn();
    const blobSelect = hasBlob
      ? 'TO_BASE64(a.AVATAR) AS AVATAR_B64,'
      : 'NULL AS AVATAR_B64,';

    const result = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT
        d.CODIGO,
        d.\`NOMBRE / APELLIDOS\` AS NOMBRE,
        DATE_FORMAT(a.FECHA_SUBIDA, '%Y-%m-%d %H:%i:%s') AS FECHA_SUBIDA,
        a.storage_key,
        ${blobSelect}
        a.CODIGO AS AVATAR_ROW
      FROM DatosEmpleados d
      LEFT JOIN Avatar a ON a.CODIGO = d.CODIGO
      ORDER BY d.\`NOMBRE / APELLIDOS\` ASC`,
    );

    const mapped = await Promise.all(
      result.map(async (item) => {
        let avatarB64: string | null = null;
        if (item.AVATAR_ROW || item.storage_key || item.AVATAR_B64) {
          avatarB64 = await this.toAvatarB64(item);
        }
        return {
          CODIGO: item.CODIGO,
          NOMBRE: item.NOMBRE,
          FECHA_SUBIDA: item.FECHA_SUBIDA || null,
          AVATAR_B64: avatarB64,
        };
      }),
    );

    return mapped;
  }

  /**
   * Salvează sau actualizează avatarul unui angajat (R2 + metadata).
   * @param codigo CODIGO-ul angajatului
   * @param nombre Numele angajatului
   * @param avatarBuffer Buffer-ul imaginii
   * @returns Rezultatul operației
   */
  async saveAvatar(
    codigo: string,
    nombre: string | null,
    avatarBuffer: Buffer,
    originalName?: string | null,
    mimeHint?: string | null,
  ) {
    if (!codigo) {
      throw new BadRequestException('CODIGO is required');
    }

    if (!avatarBuffer || avatarBuffer.length === 0) {
      throw new BadRequestException('Avatar file is required');
    }

    if (!this.avatarStorage.isWriteEnabled()) {
      throw new BadRequestException(
        'R2 no está habilitado; no se pueden guardar avatares',
      );
    }

    const existing = await this.prisma.$queryRawUnsafe<
      Array<{ storage_key: string | null }>
    >(
      `SELECT storage_key FROM Avatar WHERE CODIGO = ${this.escapeSql(codigo)} LIMIT 1`,
    );
    const oldKey = existing[0]?.storage_key
      ? String(existing[0].storage_key).trim()
      : '';

    const put = await this.avatarStorage.putAvatar(
      avatarBuffer,
      codigo,
      originalName || 'avatar.jpg',
      mimeHint,
    );

    const fechaFormatted = this.madridNow();
    const hasBlob = await this.hasAvatarBlobColumn();

    if (hasBlob) {
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO Avatar (CODIGO, NOMBRE, AVATAR, FECHA_SUBIDA, storage_key, storage_bucket, tamano_bytes)
        VALUES (
          ${this.escapeSql(codigo)},
          ${nombre ? this.escapeSql(nombre) : 'NULL'},
          NULL,
          ${this.escapeSql(fechaFormatted)},
          ${this.escapeSql(put.storage_key)},
          ${this.escapeSql(put.storage_bucket)},
          ${put.tamano_bytes}
        )
        ON DUPLICATE KEY UPDATE
          NOMBRE = VALUES(NOMBRE),
          AVATAR = NULL,
          FECHA_SUBIDA = VALUES(FECHA_SUBIDA),
          storage_key = VALUES(storage_key),
          storage_bucket = VALUES(storage_bucket),
          tamano_bytes = VALUES(tamano_bytes)
      `);
    } else {
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO Avatar (CODIGO, NOMBRE, FECHA_SUBIDA, storage_key, storage_bucket, tamano_bytes)
        VALUES (
          ${this.escapeSql(codigo)},
          ${nombre ? this.escapeSql(nombre) : 'NULL'},
          ${this.escapeSql(fechaFormatted)},
          ${this.escapeSql(put.storage_key)},
          ${this.escapeSql(put.storage_bucket)},
          ${put.tamano_bytes}
        )
        ON DUPLICATE KEY UPDATE
          NOMBRE = VALUES(NOMBRE),
          FECHA_SUBIDA = VALUES(FECHA_SUBIDA),
          storage_key = VALUES(storage_key),
          storage_bucket = VALUES(storage_bucket),
          tamano_bytes = VALUES(tamano_bytes)
      `);
    }

    if (oldKey && oldKey !== put.storage_key) {
      await this.avatarStorage.deleteObjectIfAny(oldKey);
    }

    const savedAvatar = await this.getAvatar(codigo);
    return {
      success: true,
      avatar: savedAvatar
        ? `data:image/jpeg;base64,${savedAvatar.AVATAR_B64}`
        : null,
      version: Date.now(),
    };
  }

  /**
   * Șterge avatarul unui angajat
   * @param codigo CODIGO-ul angajatului
   */
  async deleteAvatar(codigo: string) {
    if (!codigo) {
      throw new BadRequestException('CODIGO is required');
    }

    const existing = await this.prisma.$queryRawUnsafe<
      Array<{ storage_key: string | null }>
    >(
      `SELECT storage_key FROM Avatar WHERE CODIGO = ${this.escapeSql(codigo)} LIMIT 1`,
    );

    if (!existing || existing.length === 0) {
      throw new NotFoundException(`Avatar not found for CODIGO: ${codigo}`);
    }

    await this.avatarStorage.deleteObjectIfAny(existing[0]?.storage_key);

    const result = await this.prisma.$executeRawUnsafe(`
      DELETE FROM Avatar
      WHERE CODIGO = ${this.escapeSql(codigo)}
      LIMIT 1
    `);

    if (result === 0) {
      throw new NotFoundException(`Avatar not found for CODIGO: ${codigo}`);
    }

    return {
      success: true,
      message: 'Avatar deleted successfully',
    };
  }

  /**
   * Helper pentru escape SQL (prevenire SQL injection)
   */
  private escapeSql(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
  }
}
