import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CuadrantesService {
  private readonly logger = new Logger(CuadrantesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Escapă un string pentru SQL
   */
  private escapeSql(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    const str = String(value);
    // Escape single quotes și backslashes
    const escaped = str.replace(/\\/g, '\\\\\\\\').replace(/'/g, "\\\\'");
    return `'${escaped}'`;
  }

  /**
   * Obține lista de cuadrantes cu filtrare opțională pe centro, empleado (CODIGO), nombre și email
   * EXACT ca n8n: listeaza cuadrante.json și get-cuadrantes-yyBov0qVQZEhX2TL
   */
  async getCuadrantes(
    centro?: string,
    empleado?: string,
    nombre?: string,
    email?: string,
  ): Promise<any[]> {
    try {
      const conditions: string[] = [];

      // Filtrare pe centro (dacă este specificat)
      if (centro && centro.trim() !== '') {
        conditions.push(`CENTRO = ${this.escapeSql(centro.trim())}`);
      }

      // Filtrare pe empleado (CODIGO) (dacă este specificat)
      if (empleado && empleado.trim() !== '') {
        conditions.push(`CODIGO = ${this.escapeSql(empleado.trim())}`);
      }

      // Filtrare pe nombre (dacă este specificat)
      if (nombre && nombre.trim() !== '') {
        conditions.push(`NOMBRE = ${this.escapeSql(nombre.trim())}`);
      }

      // Filtrare pe email (dacă este specificat) - case-insensitive ca în n8n
      if (email && email.trim() !== '') {
        const emailLower = email.trim().toLowerCase();
        conditions.push(`LOWER(TRIM(EMAIL)) = ${this.escapeSql(emailLower)}`);
      }

      // Construiește query-ul SQL (exact ca n8n)
      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `SELECT * FROM cuadrante ${whereClause}`;

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(
        `✅ Cuadrantes retrieved: ${rows.length} records (centro: ${centro || 'all'}, empleado: ${empleado || 'all'}, nombre: ${nombre || 'all'}, email: ${email || 'all'})`,
      );

      return rows;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving cuadrantes:', error);
      throw new BadRequestException(
        `Error al obtener cuadrantes: ${error.message}`,
      );
    }
  }

  /**
   * Salvează sau actualizează un cuadrante
   * Folosește INSERT ... ON DUPLICATE KEY UPDATE (exact ca n8n)
   * Unique constraint: (CODIGO, LUNA)
   */
  async saveCuadrante(data: {
    CODIGO: string;
    EMAIL?: string;
    NOMBRE?: string;
    LUNA: string;
    CENTRO?: string;
    ZI_1?: string;
    ZI_2?: string;
    ZI_3?: string;
    ZI_4?: string;
    ZI_5?: string;
    ZI_6?: string;
    ZI_7?: string;
    ZI_8?: string;
    ZI_9?: string;
    ZI_10?: string;
    ZI_11?: string;
    ZI_12?: string;
    ZI_13?: string;
    ZI_14?: string;
    ZI_15?: string;
    ZI_16?: string;
    ZI_17?: string;
    ZI_18?: string;
    ZI_19?: string;
    ZI_20?: string;
    ZI_21?: string;
    ZI_22?: string;
    ZI_23?: string;
    ZI_24?: string;
    ZI_25?: string;
    ZI_26?: string;
    ZI_27?: string;
    ZI_28?: string;
    ZI_29?: string;
    ZI_30?: string;
    ZI_31?: string;
    TotalHoras?: string;
  }): Promise<{ success: true }> {
    try {
      if (!data.CODIGO || !data.LUNA) {
        throw new BadRequestException('CODIGO and LUNA are required');
      }

      // Construiește query-ul SQL exact ca în n8n
      const query = `
        INSERT INTO cuadrante (
          CODIGO, EMAIL, NOMBRE, LUNA, CENTRO,
          ZI_1, ZI_2, ZI_3, ZI_4, ZI_5, ZI_6, ZI_7, ZI_8, ZI_9, ZI_10,
          ZI_11, ZI_12, ZI_13, ZI_14, ZI_15, ZI_16, ZI_17, ZI_18, ZI_19, ZI_20,
          ZI_21, ZI_22, ZI_23, ZI_24, ZI_25, ZI_26, ZI_27, ZI_28, ZI_29, ZI_30, ZI_31
        )
        VALUES (
          ${this.escapeSql(data.CODIGO)},
          ${data.EMAIL ? this.escapeSql(data.EMAIL) : 'NULL'},
          ${data.NOMBRE ? this.escapeSql(data.NOMBRE) : 'NULL'},
          ${this.escapeSql(data.LUNA)},
          ${data.CENTRO ? this.escapeSql(data.CENTRO) : 'NULL'},
          ${data.ZI_1 ? this.escapeSql(data.ZI_1) : 'NULL'}, ${data.ZI_2 ? this.escapeSql(data.ZI_2) : 'NULL'}, ${data.ZI_3 ? this.escapeSql(data.ZI_3) : 'NULL'},
          ${data.ZI_4 ? this.escapeSql(data.ZI_4) : 'NULL'}, ${data.ZI_5 ? this.escapeSql(data.ZI_5) : 'NULL'}, ${data.ZI_6 ? this.escapeSql(data.ZI_6) : 'NULL'},
          ${data.ZI_7 ? this.escapeSql(data.ZI_7) : 'NULL'}, ${data.ZI_8 ? this.escapeSql(data.ZI_8) : 'NULL'}, ${data.ZI_9 ? this.escapeSql(data.ZI_9) : 'NULL'},
          ${data.ZI_10 ? this.escapeSql(data.ZI_10) : 'NULL'}, ${data.ZI_11 ? this.escapeSql(data.ZI_11) : 'NULL'}, ${data.ZI_12 ? this.escapeSql(data.ZI_12) : 'NULL'},
          ${data.ZI_13 ? this.escapeSql(data.ZI_13) : 'NULL'}, ${data.ZI_14 ? this.escapeSql(data.ZI_14) : 'NULL'}, ${data.ZI_15 ? this.escapeSql(data.ZI_15) : 'NULL'},
          ${data.ZI_16 ? this.escapeSql(data.ZI_16) : 'NULL'}, ${data.ZI_17 ? this.escapeSql(data.ZI_17) : 'NULL'}, ${data.ZI_18 ? this.escapeSql(data.ZI_18) : 'NULL'},
          ${data.ZI_19 ? this.escapeSql(data.ZI_19) : 'NULL'}, ${data.ZI_20 ? this.escapeSql(data.ZI_20) : 'NULL'}, ${data.ZI_21 ? this.escapeSql(data.ZI_21) : 'NULL'},
          ${data.ZI_22 ? this.escapeSql(data.ZI_22) : 'NULL'}, ${data.ZI_23 ? this.escapeSql(data.ZI_23) : 'NULL'}, ${data.ZI_24 ? this.escapeSql(data.ZI_24) : 'NULL'},
          ${data.ZI_25 ? this.escapeSql(data.ZI_25) : 'NULL'}, ${data.ZI_26 ? this.escapeSql(data.ZI_26) : 'NULL'}, ${data.ZI_27 ? this.escapeSql(data.ZI_27) : 'NULL'},
          ${data.ZI_28 ? this.escapeSql(data.ZI_28) : 'NULL'}, ${data.ZI_29 ? this.escapeSql(data.ZI_29) : 'NULL'}, ${data.ZI_30 ? this.escapeSql(data.ZI_30) : 'NULL'},
          ${data.ZI_31 ? this.escapeSql(data.ZI_31) : 'NULL'}
        )
        ON DUPLICATE KEY UPDATE
          EMAIL = VALUES(EMAIL),
          NOMBRE = VALUES(NOMBRE),
          CENTRO = VALUES(CENTRO),
          ZI_1 = VALUES(ZI_1), ZI_2 = VALUES(ZI_2), ZI_3 = VALUES(ZI_3),
          ZI_4 = VALUES(ZI_4), ZI_5 = VALUES(ZI_5), ZI_6 = VALUES(ZI_6),
          ZI_7 = VALUES(ZI_7), ZI_8 = VALUES(ZI_8), ZI_9 = VALUES(ZI_9),
          ZI_10 = VALUES(ZI_10), ZI_11 = VALUES(ZI_11), ZI_12 = VALUES(ZI_12),
          ZI_13 = VALUES(ZI_13), ZI_14 = VALUES(ZI_14), ZI_15 = VALUES(ZI_15),
          ZI_16 = VALUES(ZI_16), ZI_17 = VALUES(ZI_17), ZI_18 = VALUES(ZI_18),
          ZI_19 = VALUES(ZI_19), ZI_20 = VALUES(ZI_20), ZI_21 = VALUES(ZI_21),
          ZI_22 = VALUES(ZI_22), ZI_23 = VALUES(ZI_23), ZI_24 = VALUES(ZI_24),
          ZI_25 = VALUES(ZI_25), ZI_26 = VALUES(ZI_26), ZI_27 = VALUES(ZI_27),
          ZI_28 = VALUES(ZI_28), ZI_29 = VALUES(ZI_29), ZI_30 = VALUES(ZI_30),
          ZI_31 = VALUES(ZI_31)
      `;

      this.logger.log(
        `📝 Saving cuadrante: CODIGO=${data.CODIGO}, LUNA=${data.LUNA}, NOMBRE=${data.NOMBRE || 'N/A'}`,
      );

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(
        `✅ Cuadrante saved/updated: CODIGO=${data.CODIGO}, LUNA=${data.LUNA}`,
      );

      return { success: true };
    } catch (error: any) {
      this.logger.error('❌ Error saving cuadrante:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al guardar cuadrante: ${error.message}`,
      );
    }
  }

  /**
   * Actualizează multiple cuadrantes (bulk update)
   * Folosește UPDATE cu COALESCE și NULLIF pentru a actualiza doar câmpurile cu valori
   * EXACT ca n8n: Cuadrante editare.json
   */
  async updateCuadrantesBulk(
    cuadrantes: Array<{
      CODIGO: string;
      LUNA: string;
      CENTRO?: string;
      ZI_1?: string;
      ZI_2?: string;
      ZI_3?: string;
      ZI_4?: string;
      ZI_5?: string;
      ZI_6?: string;
      ZI_7?: string;
      ZI_8?: string;
      ZI_9?: string;
      ZI_10?: string;
      ZI_11?: string;
      ZI_12?: string;
      ZI_13?: string;
      ZI_14?: string;
      ZI_15?: string;
      ZI_16?: string;
      ZI_17?: string;
      ZI_18?: string;
      ZI_19?: string;
      ZI_20?: string;
      ZI_21?: string;
      ZI_22?: string;
      ZI_23?: string;
      ZI_24?: string;
      ZI_25?: string;
      ZI_26?: string;
      ZI_27?: string;
      ZI_28?: string;
      ZI_29?: string;
      ZI_30?: string;
      ZI_31?: string;
      TotalHoras?: string;
    }>,
  ): Promise<{ success: true; updated: number }> {
    try {
      if (!Array.isArray(cuadrantes) || cuadrantes.length === 0) {
        throw new BadRequestException('cuadrantes must be a non-empty array');
      }

      let updatedCount = 0;

      // Execută UPDATE pentru fiecare cuadrante (exact ca în n8n)
      for (const cuadrante of cuadrantes) {
        if (!cuadrante.CODIGO || !cuadrante.LUNA) {
          this.logger.warn(
            `⚠️ Skipping cuadrante without CODIGO or LUNA: ${JSON.stringify(cuadrante)}`,
          );
          continue;
        }

        // Construiește query-ul UPDATE exact ca în n8n
        const updates: string[] = [];

        // Pentru fiecare ZI_X, folosește COALESCE(NULLIF(...)) ca în n8n
        for (let i = 1; i <= 31; i++) {
          const ziKey = `ZI_${i}` as keyof typeof cuadrante;
          const value = cuadrante[ziKey];
          if (value !== undefined) {
            if (value === null || value === '') {
              // Dacă este gol, păstrează valoarea existentă (COALESCE(NULLIF('', ''), ZI_X))
              updates.push(`ZI_${i} = COALESCE(NULLIF('', ''), ZI_${i})`);
            } else {
              updates.push(
                `ZI_${i} = COALESCE(NULLIF(${this.escapeSql(String(value))}, ''), ZI_${i})`,
              );
            }
          }
        }

        // TotalHoras
        if (cuadrante.TotalHoras !== undefined) {
          if (cuadrante.TotalHoras === null || cuadrante.TotalHoras === '') {
            updates.push('TotalHoras = NULL');
          } else {
            updates.push(
              `TotalHoras = ${this.escapeSql(String(cuadrante.TotalHoras))}`,
            );
          }
        }

        if (updates.length === 0) {
          this.logger.warn(
            `⚠️ No fields to update for cuadrante CODIGO=${cuadrante.CODIGO}, LUNA=${cuadrante.LUNA}`,
          );
          continue;
        }

        // Construiește WHERE clause
        const whereConditions: string[] = [
          `CODIGO = ${this.escapeSql(cuadrante.CODIGO)}`,
          `LUNA = ${this.escapeSql(cuadrante.LUNA)}`,
        ];

        if (cuadrante.CENTRO) {
          whereConditions.push(`CENTRO = ${this.escapeSql(cuadrante.CENTRO)}`);
        }

        const query = `
          UPDATE cuadrante
          SET ${updates.join(', ')}
          WHERE ${whereConditions.join(' AND ')}
        `;

        this.logger.log(
          `📝 Updating cuadrante: CODIGO=${cuadrante.CODIGO}, LUNA=${cuadrante.LUNA}`,
        );

        const result = await this.prisma.$executeRawUnsafe(query);
        updatedCount += result;
      }

      this.logger.log(
        `✅ Bulk update completed: ${updatedCount} cuadrantes updated`,
      );

      return { success: true, updated: updatedCount };
    } catch (error: any) {
      this.logger.error('❌ Error updating cuadrantes bulk:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar cuadrantes: ${error.message}`,
      );
    }
  }
}
