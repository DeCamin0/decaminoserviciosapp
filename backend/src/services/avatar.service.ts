import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AvatarService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obține avatarul unui angajat după CODIGO
   * @param codigo CODIGO-ul angajatului
   * @returns Avatar data cu AVATAR_B64 sau null dacă nu există
   */
  async getAvatar(codigo: string) {
    if (!codigo) {
      throw new BadRequestException('CODIGO is required');
    }

    const result = await this.prisma.$queryRaw<any[]>`
      SELECT 
        d.CODIGO,
        COALESCE(a.NOMBRE, d.\`NOMBRE / APELLIDOS\`) AS NOMBRE,
        DATE_FORMAT(a.FECHA_SUBIDA, '%Y-%m-%d %H:%i:%s') AS FECHA_SUBIDA,
        TO_BASE64(a.AVATAR) AS AVATAR_B64
      FROM DatosEmpleados d
      LEFT JOIN Avatar a ON a.CODIGO = d.CODIGO
      WHERE d.CODIGO = ${codigo}
      LIMIT 1
    `;

    if (!result || result.length === 0) {
      return null;
    }

    const avatarData = result[0];
    if (!avatarData.AVATAR_B64) {
      return null;
    }

    return {
      CODIGO: avatarData.CODIGO,
      NOMBRE: avatarData.NOMBRE,
      FECHA_SUBIDA: avatarData.FECHA_SUBIDA,
      AVATAR_B64: avatarData.AVATAR_B64,
    };
  }

  /**
   * Obține toate avatarele (pentru bulk operations)
   * Returnează TOȚI angajații, cu sau fără avatar (compatibil cu n8n)
   * @returns Array cu toți angajații și avatarele lor (dacă există)
   */
  async getAllAvatars() {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT 
        d.CODIGO,
        d.\`NOMBRE / APELLIDOS\` AS NOMBRE,
        DATE_FORMAT(a.FECHA_SUBIDA, '%Y-%m-%d %H:%i:%s') AS FECHA_SUBIDA,
        TO_BASE64(a.AVATAR) AS AVATAR_B64
      FROM DatosEmpleados d
      LEFT JOIN Avatar a ON a.CODIGO = d.CODIGO
      ORDER BY d.\`NOMBRE / APELLIDOS\` ASC
    `;

    // Returnează TOȚI angajații (cu sau fără avatar), ca în n8n
    return result.map((item) => ({
      CODIGO: item.CODIGO,
      NOMBRE: item.NOMBRE,
      FECHA_SUBIDA: item.FECHA_SUBIDA || null,
      AVATAR_B64: item.AVATAR_B64 || null, // null dacă nu are avatar
    }));
  }

  /**
   * Salvează sau actualizează avatarul unui angajat
   * @param codigo CODIGO-ul angajatului
   * @param nombre Numele angajatului
   * @param avatarBuffer Buffer-ul imaginii
   * @returns Rezultatul operației
   */
  async saveAvatar(
    codigo: string,
    nombre: string | null,
    avatarBuffer: Buffer,
  ) {
    if (!codigo) {
      throw new BadRequestException('CODIGO is required');
    }

    if (!avatarBuffer || avatarBuffer.length === 0) {
      throw new BadRequestException('Avatar file is required');
    }

    // Convertim buffer-ul la base64 pentru FROM_BASE64
    const base64Data = avatarBuffer.toString('base64');

    // Obținem data curentă în format Europe/Madrid (similar cu n8n)
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
      .reduce((acc, part) => {
        const type = part.type;
        if (type === 'year') acc.year = part.value;
        else if (type === 'month') acc.month = part.value;
        else if (type === 'day') acc.day = part.value;
        else if (type === 'hour') acc.hour = part.value;
        else if (type === 'minute') acc.minute = part.value;
        else if (type === 'second') acc.second = part.value;
        return acc;
      }, {} as any);

    const fechaFormatted = `${fechaSubida.year}-${fechaSubida.month}-${fechaSubida.day} ${fechaSubida.hour}:${fechaSubida.minute}:${fechaSubida.second}`;

    // Folosim UPSERT (INSERT ... ON DUPLICATE KEY UPDATE)
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO Avatar (CODIGO, NOMBRE, AVATAR, FECHA_SUBIDA)
      VALUES (
        ${this.escapeSql(codigo)},
        ${nombre ? this.escapeSql(nombre) : 'NULL'},
        FROM_BASE64(${this.escapeSql(base64Data)}),
        ${this.escapeSql(fechaFormatted)}
      )
      ON DUPLICATE KEY UPDATE
        NOMBRE = VALUES(NOMBRE),
        AVATAR = VALUES(AVATAR),
        FECHA_SUBIDA = VALUES(FECHA_SUBIDA)
    `);

    // Returnează avatarul salvat ca base64 pentru răspuns
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
