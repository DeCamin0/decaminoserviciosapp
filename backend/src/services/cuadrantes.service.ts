import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GestoriaService } from './gestoria.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class CuadrantesService {
  private readonly logger = new Logger(CuadrantesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => GestoriaService))
    private readonly gestoriaService: GestoriaService,
  ) {}

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

      // Debug: Verifică dacă câmpul visible este prezent în rezultate
      if (rows.length > 0) {
        const firstRow = rows[0];
        const hasVisible = 'visible' in firstRow;
        this.logger.debug(
          `🔍 First cuadrante sample - CODIGO: ${firstRow.CODIGO}, LUNA: ${firstRow.LUNA}, visible field exists: ${hasVisible}, visible value: ${firstRow.visible}, visible type: ${typeof firstRow.visible}`,
        );
      }

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
    visible?: boolean;
  }): Promise<{ success: true }> {
    try {
      if (!data.CODIGO || !data.LUNA) {
        throw new BadRequestException('CODIGO and LUNA are required');
      }

      // Construiește query-ul SQL exact ca în n8n
      const visibleValue = data.visible !== undefined ? (data.visible ? '1' : '0') : '1';
      const query = `
        INSERT INTO cuadrante (
          CODIGO, EMAIL, NOMBRE, LUNA, CENTRO,
          ZI_1, ZI_2, ZI_3, ZI_4, ZI_5, ZI_6, ZI_7, ZI_8, ZI_9, ZI_10,
          ZI_11, ZI_12, ZI_13, ZI_14, ZI_15, ZI_16, ZI_17, ZI_18, ZI_19, ZI_20,
          ZI_21, ZI_22, ZI_23, ZI_24, ZI_25, ZI_26, ZI_27, ZI_28, ZI_29, ZI_30, ZI_31,
          TotalHoras, visible
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
          ${data.ZI_31 ? this.escapeSql(data.ZI_31) : 'NULL'},
          ${data.TotalHoras ? this.escapeSql(data.TotalHoras) : 'NULL'},
          ${visibleValue}
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
          ZI_31 = VALUES(ZI_31),
          TotalHoras = VALUES(TotalHoras),
          visible = VALUES(visible)
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
      EMAIL?: string;
      NOMBRE?: string;
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
      visible?: boolean;
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

        // Folosim INSERT ... ON DUPLICATE KEY UPDATE (exact ca n8n și saveCuadrante)
        // Construim câmpurile pentru INSERT
        const fields: string[] = ['CODIGO', 'LUNA'];
        const values: string[] = [
          this.escapeSql(cuadrante.CODIGO),
          this.escapeSql(cuadrante.LUNA),
        ];

        // Adăugăm EMAIL dacă există
        if (cuadrante.EMAIL) {
          fields.push('EMAIL');
          values.push(this.escapeSql(cuadrante.EMAIL));
        } else {
          fields.push('EMAIL');
          values.push('NULL');
        }

        // Adăugăm NOMBRE dacă există
        if ((cuadrante as any).NOMBRE) {
          fields.push('NOMBRE');
          values.push(this.escapeSql((cuadrante as any).NOMBRE));
        } else {
          fields.push('NOMBRE');
          values.push('NULL');
        }

        // Adăugăm CENTRO dacă există
        if (cuadrante.CENTRO) {
          fields.push('CENTRO');
          values.push(this.escapeSql(cuadrante.CENTRO));
        } else {
          fields.push('CENTRO');
          values.push('NULL');
        }

        // Adăugăm ZI_1...ZI_31
        for (let i = 1; i <= 31; i++) {
          fields.push(`ZI_${i}`);
          const ziKey = `ZI_${i}` as keyof typeof cuadrante;
          const value = cuadrante[ziKey];
          if (value !== undefined && value !== null && value !== '') {
            values.push(this.escapeSql(String(value)));
          } else {
            values.push('NULL');
          }
        }

        // Adăugăm TotalHoras dacă există
        if (cuadrante.TotalHoras !== undefined) {
          fields.push('TotalHoras');
          if (cuadrante.TotalHoras === null || cuadrante.TotalHoras === '') {
            values.push('NULL');
          } else {
            values.push(this.escapeSql(String(cuadrante.TotalHoras)));
          }
        }

        // Construim partea ON DUPLICATE KEY UPDATE
        const updates: string[] = [];

        // EMAIL
        if (cuadrante.EMAIL) {
          updates.push(`EMAIL = ${this.escapeSql(cuadrante.EMAIL)}`);
        } else {
          updates.push('EMAIL = VALUES(EMAIL)');
        }

        // NOMBRE
        if (cuadrante.NOMBRE) {
          updates.push(`NOMBRE = ${this.escapeSql(cuadrante.NOMBRE)}`);
        } else {
          updates.push('NOMBRE = VALUES(NOMBRE)');
        }

        // CENTRO
        if (cuadrante.CENTRO) {
          updates.push(`CENTRO = ${this.escapeSql(cuadrante.CENTRO)}`);
        } else {
          updates.push('CENTRO = VALUES(CENTRO)');
        }

        // ZI_1...ZI_31
        for (let i = 1; i <= 31; i++) {
          const ziKey = `ZI_${i}` as keyof typeof cuadrante;
          const value = cuadrante[ziKey];
          if (value !== undefined) {
            if (value === null || value === '') {
              updates.push(`ZI_${i} = NULL`);
            } else {
              updates.push(`ZI_${i} = ${this.escapeSql(String(value))}`);
            }
          } else {
            updates.push(`ZI_${i} = VALUES(ZI_${i})`);
          }
        }

        // TotalHoras
        if (cuadrante.TotalHoras !== undefined) {
          if (cuadrante.TotalHoras === null || cuadrante.TotalHoras === '') {
            updates.push('TotalHoras = NULL');
          } else {
            updates.push(`TotalHoras = VALUES(TotalHoras)`);
          }
        } else {
          updates.push('TotalHoras = VALUES(TotalHoras)');
        }

        // visible
        if (cuadrante.visible !== undefined) {
          fields.push('visible');
          values.push(cuadrante.visible ? '1' : '0');
          updates.push(`visible = VALUES(visible)`);
        }

        const query = `
          INSERT INTO cuadrante (${fields.join(', ')})
          VALUES (${values.join(', ')})
          ON DUPLICATE KEY UPDATE
            ${updates.join(', ')}
        `;

        this.logger.log(
          `📝 Insert/Update cuadrante: CODIGO=${cuadrante.CODIGO}, LUNA=${cuadrante.LUNA}`,
        );

        try {
          const result = await this.prisma.$executeRawUnsafe(query);
          // INSERT ... ON DUPLICATE KEY UPDATE returnează:
          // - 1 pentru INSERT nou
          // - 2 pentru UPDATE (duplicate key)
          // - 0 dacă valorile sunt identice (nu s-a făcut nicio modificare)
          this.logger.debug(
            `📊 Query result pentru CODIGO=${cuadrante.CODIGO}, LUNA=${cuadrante.LUNA}: ${result}`,
          );

          // Numărăm orice rezultat >= 1 (INSERT sau UPDATE)
          // Rezultat 0 înseamnă că valorile sunt identice, dar totuși cuadrante-ul există
          // Pentru a fi consistent, numărăm doar dacă s-a făcut INSERT sau UPDATE
          if (result >= 1) {
            updatedCount += 1;
          } else if (result === 0) {
            // Dacă e 0, înseamnă că cuadrante-ul există deja cu aceleași valori
            // Pentru moment, îl numărăm tot ca "updated" pentru că există în baza de date
            updatedCount += 1;
            this.logger.debug(
              `⚠️ Cuadrante CODIGO=${cuadrante.CODIGO}, LUNA=${cuadrante.LUNA} nu a fost modificat (valori identice)`,
            );
          }
        } catch (err: any) {
          this.logger.error(
            `❌ Error executing query pentru CODIGO=${cuadrante.CODIGO}, LUNA=${cuadrante.LUNA}: ${err.message}`,
          );
          this.logger.error(`📋 Query: ${query}`);
          // Continuăm cu următorul cuadrante în loc să întrerupem procesul
        }
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

  /**
   * Toggle vizibilitate cuadrante by ID
   */
  async toggleVisibleById(id: number, visible: boolean): Promise<void> {
    try {
      const query = `UPDATE cuadrante SET visible = ${visible ? '1' : '0'} WHERE id = ${id}`;
      await this.prisma.$executeRawUnsafe(query);
      this.logger.log(`✅ Toggled visibility for cuadrante id=${id} to ${visible}`);
    } catch (error: any) {
      this.logger.error(`❌ Error toggling visibility for cuadrante id=${id}:`, error);
      throw new BadRequestException(
        `Error al actualizar visibilidad: ${error.message}`,
      );
    }
  }

  /**
   * Toggle vizibilitate cuadrante by CODIGO and LUNA
   */
  async toggleVisibleByCodigoLuna(CODIGO: string, LUNA: string, visible: boolean): Promise<void> {
    try {
      const query = `UPDATE cuadrante SET visible = ${visible ? '1' : '0'} WHERE CODIGO = ${this.escapeSql(CODIGO)} AND LUNA = ${this.escapeSql(LUNA)}`;
      await this.prisma.$executeRawUnsafe(query);
      this.logger.log(`✅ Toggled visibility for cuadrante CODIGO=${CODIGO}, LUNA=${LUNA} to ${visible}`);
    } catch (error: any) {
      this.logger.error(`❌ Error toggling visibility for cuadrante CODIGO=${CODIGO}, LUNA=${LUNA}:`, error);
      throw new BadRequestException(
        `Error al actualizar visibilidad: ${error.message}`,
      );
    }
  }

  /**
   * Helper pentru a mapă timpi la ture
   */
  private mapTimeToTurno(he?: string, hs?: string): string | null {
    if (!he && !hs) return null;

    // "L" = LIBRE
    if (he === 'L' || hs === 'L') return 'LIBRE';

    // Convertim timpii la format HH:MM pentru comparație
    const parseTime = (timeStr: string): number | null => {
      if (!timeStr || timeStr === '' || timeStr === 'L') return null;

      // Format: "06:45", "07:00", etc.
      const match = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        return hours * 60 + minutes; // Minute din zi
      }
      return null;
    };

    const heMinutes = he ? parseTime(he) : null;
    const hsMinutes = hs ? parseTime(hs) : null;

    // Dacă avem ambele HE și HS, calculăm durata și deducem turnul
    if (heMinutes !== null && hsMinutes !== null) {
      // Calculăm durata în minute
      let durationMinutes = hsMinutes - heMinutes;

      // Dacă HS < HE, înseamnă că trece peste miezul nopții (tura de noapte T3)
      if (durationMinutes < 0) {
        durationMinutes += 24 * 60; // Adăugăm 24 ore (1440 minute)
      }

      // Verificăm dacă durata este aproximativ 8 ore (480 minute, cu toleranță ±60 minute)
      if (durationMinutes >= 420 && durationMinutes <= 540) {
        // Durata este corectă (~8 ore), deducem turnul din HE
        // T1: HE între 06:00-09:00 (360-540 minute) - tură de dimineață
        if (heMinutes >= 360 && heMinutes <= 540) {
          return 'T1';
        }
        // T2: HE între 14:00-17:00 (840-1020 minute) - tură de după-amiază
        if (heMinutes >= 840 && heMinutes <= 1020) {
          return 'T2';
        }
        // T3: HE între 22:00-08:00 (1320-1440 SAU 0-480 minute) - tură de noapte
        if (heMinutes >= 1320 || heMinutes <= 480) {
          return 'T3';
        }
      }

      // Fallback: Verificăm intervalele clasice (pentru compatibilitate)
      // T1: 06:00-09:00 → 14:00-17:00
      if (
        heMinutes >= 360 &&
        heMinutes <= 540 &&
        hsMinutes >= 840 &&
        hsMinutes <= 1020
      ) {
        return 'T1';
      }
      // T2: 14:00-17:00 → 22:00-00:00
      if (
        heMinutes >= 840 &&
        heMinutes <= 1020 &&
        (hsMinutes >= 1320 || hsMinutes <= 480)
      ) {
        return 'T2';
      }
      // T3: 22:00-08:00 (trece peste miezul nopții)
      if (
        (heMinutes >= 1320 || heMinutes <= 480) &&
        hsMinutes >= 360 &&
        hsMinutes <= 540
      ) {
        return 'T3';
      }
    }

    // Dacă avem doar HE sau HS, deducem din valoare
    if (heMinutes !== null) {
      // T1: 06:00-09:00 (360-540 minute)
      if (heMinutes >= 360 && heMinutes <= 540) return 'T1';
      // T2: 14:00-17:00 (840-1020 minute)
      if (heMinutes >= 840 && heMinutes <= 1020) return 'T2';
      // T3: 22:00-08:00 (1320-1440 SAU 0-480 minute)
      if (heMinutes >= 1320 || heMinutes <= 480) return 'T3';
    }

    if (hsMinutes !== null) {
      // T1: HS între 14:00-17:00 (840-1020 minute)
      if (hsMinutes >= 840 && hsMinutes <= 1020) return 'T1';
      // T2: HS între 22:00-00:00 (1320-1440 SAU 0-480 minute)
      if (hsMinutes >= 1320 || hsMinutes <= 480) return 'T2';
      // T3: HS între 06:00-09:00 (360-540 minute) - tura de noapte care se termină dimineața
      if (hsMinutes >= 360 && hsMinutes <= 540) return 'T3';
    }

    return null;
  }

  /**
   * Procesează Excel cu cuadrantes
   * Parsează Excel-ul cu structura identificată (2 linii header, nume angajați, HE/HS)
   */
  async procesarCuadrantesExcel(
    fileBuffer: Buffer | ArrayBuffer,
    mes: string,
    centro: string,
  ): Promise<{
    success: boolean;
    cuadrantes: Array<{
      CODIGO: string;
      EMAIL?: string;
      NOMBRE?: string;
      LUNA: string;
      CENTRO: string;
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
      empleado_encontrado: boolean;
      confianza: number;
      matchType?: string;
    }>;
    errors?: string[];
  }> {
    try {
      this.logger.log(
        `📊 Procesando Excel cuadrantes - mes: ${mes}, centro: ${centro}`,
      );

      // Citește Excel-ul
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer as any);

      // Găsește primul sheet (sau "Hoja1")
      const sheetName =
        workbook.worksheets.find(
          (s) =>
            s.name.toLowerCase().includes('hoja') ||
            s.name.toLowerCase().includes('sheet'),
        )?.name || workbook.worksheets[0]?.name;

      if (!sheetName) {
        throw new BadRequestException('Excel-ul nu conține sheet-uri');
      }

      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        throw new BadRequestException(`Sheet "${sheetName}" nu a fost găsit`);
      }

      this.logger.log(`📄 Procesez sheet: "${sheetName}"`);

      // Citim manual rândurile pentru a construi header-urile pe 2 linii
      const headerRow1Raw = worksheet.getRow(1);
      const headerRow2Raw = worksheet.getRow(2);

      // Construim header-uri combinate (linia 1 = zile săptămânii, linia 2 = zilele lunii + TRABAJADOR/TURNO)
      const headers: string[] = [];
      const columnToDayMap: { [key: string]: number } = {};

      // Numărul de coloane (maxim coloanele folosite)
      const maxColumns = Math.max(
        headerRow1Raw.cellCount,
        headerRow2Raw.cellCount,
      );

      for (let colNumber = 1; colNumber <= maxColumns; colNumber++) {
        const cell1 = headerRow1Raw.getCell(colNumber);
        const cell2 = headerRow2Raw.getCell(colNumber);

        const col1 = cell1.value ? String(cell1.value).trim() : '';
        const col2 = cell2.value ? String(cell2.value).trim() : '';

        // Primele 2 coloane sunt TRABAJADOR și TURNO
        if (colNumber === 1) {
          headers[colNumber - 1] = col2 || 'TRABAJADOR';
        } else if (colNumber === 2) {
          headers[colNumber - 1] = col2 || 'TURNO';
        } else {
          // Pentru coloanele cu zile: dacă col2 este un număr (ziua lunii), construim ZI_X
          if (col2 && !isNaN(parseInt(col2))) {
            const dayNum = parseInt(col2, 10);
            if (dayNum >= 1 && dayNum <= 31) {
              const headerKey = `ZI_${dayNum}`;
              headers[colNumber - 1] = headerKey;
              columnToDayMap[headerKey] = dayNum; // Map direct pe headerKey
              this.logger.debug(
                `  Col ${colNumber}: ${col1} + ${col2} → ${headerKey}`,
              );
            } else {
              headers[colNumber - 1] = col1 || col2 || `col_${colNumber}`;
            }
          } else if (col2 === 'TOTAL') {
            headers[colNumber - 1] = 'TOTAL';
          } else {
            headers[colNumber - 1] = col1 || col2 || `col_${colNumber}`;
          }
        }
      }

      this.logger.log(
        `📅 Mapping zile lunii: ${JSON.stringify(columnToDayMap)}`,
      );
      this.logger.log(
        `📋 Headers găsite: ${headers.filter((h) => h && h.startsWith('ZI_')).length} zile`,
      );

      // Parsează datele începând cu rândul 3 (după header-uri)
      // Construim manual rândurile pentru a avea control complet
      const data: any[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 2) return; // Skip header rows

        const rowData: any = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (!header) return;

          let value: any = null;

          if (cell.value === null || cell.value === undefined) {
            value = '';
          } else if (cell.value instanceof Date) {
            // Date/timp - convertim la HH:MM cu rotunjire
            let hours = cell.value.getHours();
            let minutes = cell.value.getMinutes();

            // Rotunjim la cea mai apropiată oră dacă diferența este mică (ex: 14:45 → 15:00)
            if (minutes >= 45) {
              hours = (hours + 1) % 24;
              minutes = 0;
            } else if (minutes < 15) {
              minutes = 0;
            } else {
              minutes = 30; // Rotunjim la 30 minute pentru standardizare
            }

            value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          } else if (
            typeof cell.value === 'number' &&
            cell.value < 1 &&
            cell.value >= 0
          ) {
            // Dacă e număr între 0 și 1, probabil e timp Excel (fracție de zi)
            const totalHours = cell.value * 24;
            const hours = Math.floor(totalHours);
            const minutes = Math.round((totalHours - hours) * 60);

            // Rotunjim la cea mai apropiată oră dacă diferența este mică
            const roundedHours = minutes >= 45 ? hours + 1 : hours;
            const roundedMinutes = minutes >= 45 ? 0 : minutes;

            const finalMinutes =
              roundedMinutes < 15 ? 0 : roundedMinutes < 45 ? 30 : 0;
            const finalHours =
              roundedMinutes >= 45 ? roundedHours : roundedHours;

            value = `${String(finalHours % 24).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
          } else if (typeof cell.value === 'object' && 'result' in cell.value) {
            // Formula rezolvată
            value = String(cell.value.result || '');
          } else if (typeof cell.value === 'number') {
            value = String(cell.value);
          } else {
            value = String(cell.value).trim();
          }

          rowData[header] = value;
        });

        data.push(rowData);
      });

      this.logger.log(`📊 Rânduri de date găsite: ${data.length}`);

      // Procesăm datele (începând cu linia 3 - după header-uri)
      const cuadrantes: any[] = [];
      const empleadosMap = new Map<string, any>();

      // Grupăm rândurile după TRABAJADOR
      // Prima coloană este TRABAJADOR, a doua este TURNO
      const trabajadorHeader = headers[0] || 'TRABAJADOR';
      const turnoHeader = headers[1] || 'TURNO';

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const trabajador = row[trabajadorHeader] || '';
        const turno = row[turnoHeader] || '';

        // Ignorăm rândurile cu TRABAJADOR gol, TOTAL sau DIAS DE LA SEMANA
        if (
          !trabajador ||
          trabajador.trim() === '' ||
          trabajador === 'TOTAL' ||
          trabajador === 'DIAS DE LA SEMANA' ||
          trabajador === 'TURNO'
        ) {
          continue;
        }

        const nombre = String(trabajador).trim();

        // Ignorăm rândurile unde TRABAJADOR este "M" sau "T" (acestea sunt label-uri pentru TURNO, nu nume)
        if (nombre === 'M' || nombre === 'T' || nombre.length <= 1) {
          continue;
        }

        if (!empleadosMap.has(nombre)) {
          empleadosMap.set(nombre, {
            nombre,
            turnoM: [], // Rânduri TURNO M (Mañana)
            turnoT: [], // Rânduri TURNO T (Tarde)
          });
        }

        const empleadoData = empleadosMap.get(nombre);

        // Identificăm dacă rândul este HE sau HS pe baza valorilor din coloane
        // Verificăm dacă există "HE" sau "HS" explicit (probabil în coloana 3 sau 4)
        // Coloana 3 (index 2) conține de obicei "HE", "HS", sau zile săptămânii
        let isHE = false;
        let isHS = false;

        // Verificăm dacă există "HE" sau "HS" în oricare coloană a rândului
        // Mai întâi verificăm dacă există explicit în primele coloane (după TRABAJADOR și TURNO)
        const rowKeys = Object.keys(row);
        for (let i = 0; i < Math.min(5, rowKeys.length); i++) {
          const key = rowKeys[i];
          const val = String(row[key] || '')
            .trim()
            .toUpperCase();
          if (val === 'HE') {
            isHE = true;
            break;
          } else if (val === 'HS') {
            isHS = true;
            break;
          }
        }

        // Dacă nu am găsit explicit HE/HS, identificăm logic pe baza poziției:
        // Primul rând M/T = HE, al doilea = HS (doar dacă nu au fost identificate altfel)
        if (!isHE && !isHS) {
          if (turno === 'M') {
            if (empleadoData.turnoM.length === 0) {
              isHE = true; // Primul rând M = HE
            } else if (empleadoData.turnoM.length === 1) {
              isHS = true; // Al doilea rând M = HS
            }
          } else if (turno === 'T') {
            if (empleadoData.turnoT.length === 0) {
              isHE = true; // Primul rând T = HE
            } else if (empleadoData.turnoT.length === 1) {
              isHS = true; // Al doilea rând T = HS
            }
          }
        }

        // Salvăm rândul pentru procesare ulterioară cu flag-ul HE/HS
        if (turno === 'M') {
          row._isHE = isHE;
          row._isHS = isHS;
          empleadoData.turnoM.push(row);
        } else if (turno === 'T') {
          row._isHE = isHE;
          row._isHS = isHS;
          empleadoData.turnoT.push(row);
        }
      }

      this.logger.log(`👤 Găsiți ${empleadosMap.size} angajați în Excel`);

      // Procesăm fiecare angajat
      for (const [nombre, empleadoData] of empleadosMap.entries()) {
        // Căutăm angajatul în baza de date
        const empleadoEncontrado =
          await this.gestoriaService.findEmpleadoFlexible(nombre, null, null);

        let codigo: string | null = null;
        let nombreBd: string | null = null;
        let email: string | null = null;
        let empleadoEncontradoFlag = false;
        let confianza = 0;
        let matchType = 'not_found';

        if (empleadoEncontrado) {
          codigo = empleadoEncontrado.CODIGO;
          nombreBd = empleadoEncontrado['NOMBRE / APELLIDOS'] || null;
          confianza = empleadoEncontrado.confianza || 0;
          matchType = empleadoEncontrado.matchType || 'unknown';
          empleadoEncontradoFlag = confianza >= 80;

          // Obținem email-ul din baza de date
          if (codigo) {
            try {
              const empleadoQuery = `
                SELECT \`CORREO ELECTRONICO\` AS EMAIL
                FROM \`DatosEmpleados\`
                WHERE CODIGO = ${this.escapeSql(codigo)}
                LIMIT 1
              `;
              const empleadoEmail =
                await this.prisma.$queryRawUnsafe<
                  Array<{ EMAIL: string | null }>
                >(empleadoQuery);
              if (empleadoEmail.length > 0 && empleadoEmail[0].EMAIL) {
                email = empleadoEmail[0].EMAIL.trim() || null;
                this.logger.debug(`📧 Email găsit pentru ${codigo}: ${email}`);
              } else {
                this.logger.debug(`⚠️ Email NULL sau gol pentru ${codigo}`);
              }
            } catch (err) {
              this.logger.warn(
                `⚠️ Nu s-a putut obține email pentru ${codigo}: ${err}`,
              );
            }
          }
        }

        // Construim cuadrante-ul pentru acest angajat
        const cuadranteData: any = {
          CODIGO: codigo || '',
          EMAIL: email || null,
          NOMBRE: nombreBd || nombre,
          LUNA: mes,
          CENTRO: centro,
          empleado_encontrado: empleadoEncontradoFlag,
          confianza,
          matchType,
        };

        // Inițializăm toate zilele cu null
        for (let zi = 1; zi <= 31; zi++) {
          cuadranteData[`ZI_${zi}`] = null;
        }

        // Funcție helper pentru formatare timp
        const formatTime = (val: any): string | null => {
          if (!val || val === '' || val === null || val === undefined)
            return null;
          if (val === 'L') return 'LIBRE';

          // Dacă e număr (fracție de zi din Excel), convertim manual
          if (typeof val === 'number') {
            const totalHours = val * 24;
            const hours = Math.floor(totalHours);
            const minutes = Math.round((totalHours - hours) * 60);
            const roundedHours = minutes >= 45 ? hours + 1 : hours;
            const roundedMinutes = minutes >= 45 ? 0 : minutes;
            const finalMinutes =
              roundedMinutes < 15 ? 0 : roundedMinutes < 45 ? 30 : 0;
            const finalHours =
              roundedMinutes >= 45 ? roundedHours : roundedHours;
            return `${String(finalHours % 24).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
          }

          if (val instanceof Date) {
            let hours = val.getHours();
            let minutes = val.getMinutes();
            if (minutes >= 45) {
              hours = (hours + 1) % 24;
              minutes = 0;
            } else if (minutes < 15) {
              minutes = 0;
            } else {
              minutes = 30;
            }
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          }

          const strVal = String(val).trim();
          const timeMatch = strVal.match(/(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            let hours = parseInt(timeMatch[1], 10);
            let minutes = parseInt(timeMatch[2], 10);
            if (minutes >= 45) {
              hours = (hours + 1) % 24;
              minutes = 0;
            } else if (minutes < 15) {
              minutes = 0;
            } else {
              minutes = 30;
            }
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          }

          return strVal;
        };

        // Procesăm fiecare zi combinând HE și HS
        // IMPORTANT: Pentru ture de noapte, HE poate fi în T (23:00) și HS în M a doua zi (07:00)
        // Trebuie să combinăm corect: HE din T cu HS din M (a doua zi) pentru ture de noapte
        Object.entries(columnToDayMap).forEach(([ziKey, dayNum]) => {
          // Colectăm HE și HS din TURNO M (pentru ziua curentă)
          // Identificăm corect HE și HS pe baza flag-urilor _isHE și _isHS sau pe baza poziției
          let heM: any = null;
          let hsM: any = null;

          if (empleadoData.turnoM.length >= 1) {
            // Căutăm rândul cu _isHE = true sau primul rând
            const heRowM =
              empleadoData.turnoM.find((r) => r._isHE === true) ||
              empleadoData.turnoM[0];
            heM = heRowM[ziKey];

            // Căutăm rândul cu _isHS = true sau al doilea rând
            if (empleadoData.turnoM.length >= 2) {
              const hsRowM =
                empleadoData.turnoM.find((r) => r._isHS === true) ||
                empleadoData.turnoM[1];
              hsM = hsRowM[ziKey];
            } else {
              // Dacă există doar un rând M, verificăm dacă este HS (sfârșitul turei anterioare)
              // Dacă nu este explicit marcat ca HE, îl tratăm ca HS pentru a nu-l combina greșit
              if (empleadoData.turnoM[0]._isHS === true) {
                hsM = heM;
                heM = null; // Nu combinăm HE din ziua anterioară
              }
            }
          }

          // Colectăm HE și HS din TURNO T (pentru ziua curentă)
          let heT: any = null;
          let hsT: any = null;

          if (empleadoData.turnoT.length >= 1) {
            // Căutăm rândul cu _isHE = true sau primul rând
            const heRowT =
              empleadoData.turnoT.find((r) => r._isHE === true) ||
              empleadoData.turnoT[0];
            heT = heRowT[ziKey];

            // Căutăm rândul cu _isHS = true sau al doilea rând
            if (empleadoData.turnoT.length >= 2) {
              const hsRowT =
                empleadoData.turnoT.find((r) => r._isHS === true) ||
                empleadoData.turnoT[1];
              hsT = hsRowT[ziKey];
            }
          }

          // Colectăm HS din M pentru ziua următoare (pentru ture de noapte)
          let hsMNextDay: any = null;
          if (dayNum < 31 && empleadoData.turnoM.length >= 2) {
            const nextDayKey = `ZI_${dayNum + 1}`;
            hsMNextDay = empleadoData.turnoM[1][nextDayKey]; // HS din M pentru ziua următoare
          }

          // Formatăm timpii
          const heStrM = heM ? formatTime(heM) : null;
          const hsStrM = hsM ? formatTime(hsM) : null;
          const heStrT = heT ? formatTime(heT) : null;
          const hsStrT = hsT ? formatTime(hsT) : null;
          const hsStrMNextDay = hsMNextDay ? formatTime(hsMNextDay) : null;

          // Prioritate 1: T1 - Combinăm HE și HS din TURNO M (aceeași sursă, aceeași zi)
          // Aceasta este tură de dimineață T1 (ex: 07:00-15:00)
          // IMPORTANT: Combinăm DOAR dacă există ambele (HE și HS) din aceeași sursă M
          // IGNORĂM dacă unul dintre ele este 'L' (LIBRE), dar verificăm dacă ambele sunt valide
          if (
            heStrM &&
            hsStrM &&
            heStrM !== 'LIBRE' &&
            hsStrM !== 'LIBRE' &&
            heM !== 'L' &&
            hsM !== 'L'
          ) {
            const turnoM = this.mapTimeToTurno(heStrM, hsStrM);
            if (turnoM && turnoM !== 'LIBRE') {
              cuadranteData[`ZI_${dayNum}`] = `${turnoM} ${heStrM}-${hsStrM}`;
              return; // T1 are prioritate (dimineața)
            }
          }

          // Prioritate 2: T2 - Combinăm HS din M cu HE din T (aceeași zi)
          // Aceasta este tură de după-amiază T2 (ex: 15:00-23:00)
          // STRUCTURĂ: HS din M = entrada pentru T2, HE din T = salida pentru T2
          if (
            (!cuadranteData[`ZI_${dayNum}`] ||
              cuadranteData[`ZI_${dayNum}`] === null) &&
            hsStrM &&
            heStrT &&
            hsStrM !== 'LIBRE' &&
            heStrT !== 'LIBRE' &&
            hsM !== 'L' &&
            heT !== 'L'
          ) {
            // Pentru T2, trimitem HS din M ca HE și HE din T ca HS către mapTimeToTurno
            // mapTimeToTurno va deduce că este T2 dacă: HE (HS din M) = 14:45-15:00, HS (HE din T) = 22:45-23:00
            const turnoT2 = this.mapTimeToTurno(hsStrM, heStrT);
            if (turnoT2 === 'T2') {
              cuadranteData[`ZI_${dayNum}`] = `${turnoT2} ${hsStrM}-${heStrT}`;
              return;
            }

            // Fallback: Verificăm manual dacă este o tură de după-amiază validă (8 ore între HS din M și HE din T)
            const hsParts = hsStrM.split(':');
            const heParts = heStrT.split(':');
            const hsHour = parseInt(hsParts[0], 10);
            const heHour = parseInt(heParts[0], 10);
            const hsMinutes = hsHour * 60 + parseInt(hsParts[1] || '0', 10);
            const heMinutes = heHour * 60 + parseInt(heParts[1] || '0', 10);
            const durationMinutes = heMinutes - hsMinutes;

            // T2 trebuie să fie între 14:00-16:00 (HS din M) și 22:00-23:59 (HE din T)
            // Durata trebuie să fie aproximativ 8 ore (480 minute, cu toleranță 7-9h)
            if (
              hsHour >= 14 &&
              hsHour <= 16 &&
              heHour >= 22 &&
              durationMinutes >= 420 &&
              durationMinutes <= 600
            ) {
              cuadranteData[`ZI_${dayNum}`] = `T2 ${hsStrM}-${heStrT}`;
              return;
            }
          }

          // Prioritate 3: T3 - Combinăm HE și HS din TURNO T (aceeași sursă, aceeași zi)
          // Aceasta este tură de noapte T3 (ex: 23:00-07:00 în aceeași zi sau peste noapte)
          if (
            (!cuadranteData[`ZI_${dayNum}`] ||
              cuadranteData[`ZI_${dayNum}`] === null) &&
            heStrT &&
            hsStrT &&
            heStrT !== 'LIBRE' &&
            hsStrT !== 'LIBRE' &&
            heT !== 'L' &&
            hsT !== 'L'
          ) {
            const turnoT = this.mapTimeToTurno(heStrT, hsStrT);
            if (turnoT && turnoT !== 'LIBRE') {
              cuadranteData[`ZI_${dayNum}`] = `${turnoT} ${heStrT}-${hsStrT}`;
              return;
            }
          }

          // Prioritate 4: T3 Noapte - combinăm HE din T (ziua curentă) cu HS din M (ziua următoare)
          // Aceasta este tură de noapte T3 care trece peste miezul nopții (ex: 23:00-07:00 următoarea zi)
          if (
            (!cuadranteData[`ZI_${dayNum}`] ||
              cuadranteData[`ZI_${dayNum}`] === null) &&
            heStrT &&
            hsStrMNextDay &&
            heStrT !== 'LIBRE' &&
            hsStrMNextDay !== 'LIBRE' &&
            heT !== 'L' &&
            hsMNextDay !== 'L'
          ) {
            // Verificăm dacă este o tură de noapte logică
            // HE trebuie să fie >= 22:00 sau în intervalul 00:00-08:00
            // HS trebuie să fie <= 08:00 (din ziua următoare)
            const heParts = heStrT.split(':');
            const hsParts = hsStrMNextDay.split(':');
            const heHour = parseInt(heParts[0], 10);
            const hsHour = parseInt(hsParts[0], 10);

            // Verificăm dacă este tură de noapte:
            // 1. HE >= 22:00 (tura începe seara) și HS <= 08:00 (tura se termină dimineața următoare)
            // 2. SAU HE între 00:00-08:00 și HS <= 08:00 (tura începe dimineața devreme)
            const isNightShift =
              (heHour >= 22 || (heHour >= 0 && heHour <= 8)) &&
              (hsHour <= 8 || (hsHour >= 22 && heHour < hsHour));

            if (isNightShift) {
              const turnoNocturno = this.mapTimeToTurno(heStrT, hsStrMNextDay);
              if (turnoNocturno) {
                cuadranteData[`ZI_${dayNum}`] =
                  `${turnoNocturno} ${heStrT}-${hsStrMNextDay}`;
                return;
              }
            }
          }

          // Verificăm dacă ziua este LIBRE (doar dacă nu am găsit nicio combinație validă)
          // O zi este LIBRE dacă TOATE valorile pentru ziua curentă sunt LIBRE sau 'L'
          if (
            !cuadranteData[`ZI_${dayNum}`] ||
            cuadranteData[`ZI_${dayNum}`] === null
          ) {
            const allLibre =
              (heM === 'L' || !heStrM || heStrM === 'LIBRE') &&
              (hsM === 'L' || !hsStrM || hsStrM === 'LIBRE') &&
              (heT === 'L' || !heStrT || heStrT === 'LIBRE') &&
              (hsT === 'L' || !hsStrT || hsStrT === 'LIBRE');

            if (allLibre) {
              cuadranteData[`ZI_${dayNum}`] = 'LIBRE';
            } else {
              // Prioritate 5: Dacă avem doar HE din M, deducem turnul (presupunem tură de dimineață T1)
              if (heStrM && heStrM !== 'LIBRE' && heM !== 'L') {
                const turno = this.mapTimeToTurno(heStrM, undefined);
                if (turno && turno !== 'LIBRE') {
                  cuadranteData[`ZI_${dayNum}`] = turno;
                }
              }

              // Prioritate 6: Dacă avem doar HE din T, deducem turnul (presupunem tură T2 sau T3)
              // NOTĂ: Dacă avem HS din M fără HE din M, acesta este sfârșitul turei anterioare și trebuie ignorat
              // NU combinăm HS din M cu nimic pentru ziua curentă dacă nu există HE din M
              // Aceasta este sfârșitul turei de dimineață din ziua anterioară (ex: ZI_31 -> ZI_1)
              if (
                !cuadranteData[`ZI_${dayNum}`] ||
                cuadranteData[`ZI_${dayNum}`] === null
              ) {
                if (heStrT && heStrT !== 'LIBRE' && heT !== 'L') {
                  const turno = this.mapTimeToTurno(heStrT, undefined);
                  if (turno && turno !== 'LIBRE') {
                    cuadranteData[`ZI_${dayNum}`] = turno;
                  }
                } else if (hsStrT && hsStrT !== 'LIBRE' && hsT !== 'L') {
                  const turno = this.mapTimeToTurno(undefined, hsStrT);
                  if (turno && turno !== 'LIBRE') {
                    cuadranteData[`ZI_${dayNum}`] = turno;
                  }
                }
              }

              // Dacă tot nu am găsit nimic, setăm LIBRE
              if (
                !cuadranteData[`ZI_${dayNum}`] ||
                cuadranteData[`ZI_${dayNum}`] === null
              ) {
                cuadranteData[`ZI_${dayNum}`] = 'LIBRE';
              }
            }
          }
        });

        // Calculăm TotalHoras sumând orele din toate zilele
        let totalHoras = 0;
        const getHorasFromTurno = (turno: string | null): number => {
          if (!turno || turno === '' || turno === null || turno === 'LIBRE') {
            return 0;
          }

          // Format: "T2 19:30-07:30" sau "T1 07:00-15:00"
          const timeMatch = turno.match(
            /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/,
          );
          if (timeMatch) {
            const startHour = parseInt(timeMatch[1], 10);
            const startMin = parseInt(timeMatch[2], 10);
            const endHour = parseInt(timeMatch[3], 10);
            const endMin = parseInt(timeMatch[4], 10);

            const startMinutes = startHour * 60 + startMin;
            let endMinutes = endHour * 60 + endMin;

            // Pentru ture nocturne (peste miezul nopții)
            if (endMinutes < startMinutes) {
              endMinutes += 24 * 60;
            }

            const diffMinutes = endMinutes - startMinutes;
            return diffMinutes / 60;
          }

          // T1, T2, T3 fără ore = 8 ore standard
          if (turno === 'T1' || turno === 'T2' || turno === 'T3') {
            return 8;
          }

          // Dacă turno conține "T1", "T2", "T3" dar fără ore
          if (turno.includes('T1') && !turno.includes(':')) return 8;
          if (turno.includes('T2') && !turno.includes(':')) return 8;
          if (turno.includes('T3') && !turno.includes(':')) return 8;

          // Fallback: 8 ore
          return 8;
        };

        for (let zi = 1; zi <= 31; zi++) {
          const turno = cuadranteData[`ZI_${zi}`];
          totalHoras += getHorasFromTurno(turno);
        }

        // Adăugăm TotalHoras la cuadranteData (format ca string cu 2 zecimale)
        cuadranteData.TotalHoras = totalHoras.toFixed(2);

        cuadrantes.push(cuadranteData);
      }

      this.logger.log(`✅ Procesate ${cuadrantes.length} cuadrantes din Excel`);

      return {
        success: true,
        cuadrantes,
      };
    } catch (error: any) {
      this.logger.error('❌ Error procesando Excel cuadrantes:', error);
      throw new BadRequestException(
        `Error al procesar Excel: ${error.message}`,
      );
    }
  }
}
