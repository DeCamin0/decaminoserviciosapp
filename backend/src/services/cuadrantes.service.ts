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
   * Verifică dacă există deja cuadrante sau horario_multicentro pentru un angajat, lună și centru
   * @param codigo - CODIGO al angajatului
   * @param mes - Luna în format YYYY-MM
   * @param centro - Numele centrului (opțional)
   * @returns Informații despre existența cuadrantelor
   */
  async checkExistingCuadrante(
    codigo: string,
    mes: string,
    centro?: string,
  ): Promise<{
    hasCuadrante: boolean;
    hasHorarioMulticentro: boolean;
    cuadrante?: any;
    horarioMulticentro?: any[];
  }> {
    try {
      const codigoClean = codigo.trim();
      const mesClean = mes.trim();

      this.logger.log(
        `🔍 [checkExistingCuadrante] Verificăm pentru CODIGO: ${codigoClean}, LUNA: ${mesClean}, CENTRO: ${centro || 'N/A'}`,
      );

      // Verifică cuadrante
      // NOTĂ: Constraint-ul unique pentru cuadrante este pe (CODIGO, LUNA), nu pe (CODIGO, LUNA, CENTRO)
      // Deci verificăm doar CODIGO și LUNA, nu și CENTRO
      const cuadranteQuery = `
        SELECT CODIGO, LUNA, CENTRO, ZI_1, ZI_2, ZI_3, ZI_4, ZI_5, ZI_6, ZI_7, ZI_8, ZI_9, ZI_10,
          ZI_11, ZI_12, ZI_13, ZI_14, ZI_15, ZI_16, ZI_17, ZI_18, ZI_19, ZI_20,
          ZI_21, ZI_22, ZI_23, ZI_24, ZI_25, ZI_26, ZI_27, ZI_28, ZI_29, ZI_30, ZI_31
        FROM cuadrante
        WHERE CODIGO = ${this.escapeSql(codigoClean)}
          AND LUNA = ${this.escapeSql(mesClean)}
        LIMIT 1
      `;

      const cuadranteResult =
        await this.prisma.$queryRawUnsafe<any[]>(cuadranteQuery);

      const hasCuadrante = cuadranteResult && cuadranteResult.length > 0;
      const cuadrante = hasCuadrante ? cuadranteResult[0] : undefined;

      // Verifică horario_multicentro
      let horarioMulticentroQuery = `
        SELECT id, CODIGO, LUNA, CLIENTE, HORARIO, SERVICIO, ZI_1, ZI_2, ZI_3, ZI_4, ZI_5, ZI_6, ZI_7, ZI_8, ZI_9, ZI_10,
          ZI_11, ZI_12, ZI_13, ZI_14, ZI_15, ZI_16, ZI_17, ZI_18, ZI_19, ZI_20,
          ZI_21, ZI_22, ZI_23, ZI_24, ZI_25, ZI_26, ZI_27, ZI_28, ZI_29, ZI_30, ZI_31
        FROM horario_multicentro
        WHERE CODIGO = ${this.escapeSql(codigoClean)}
          AND LUNA = ${this.escapeSql(mesClean)}
      `;

      if (centro && centro.trim() !== '') {
        horarioMulticentroQuery += ` AND CLIENTE = ${this.escapeSql(centro.trim())}`;
      }

      const horarioMulticentroResult = await this.prisma.$queryRawUnsafe<any[]>(
        horarioMulticentroQuery,
      );

      const hasHorarioMulticentro =
        horarioMulticentroResult && horarioMulticentroResult.length > 0;

      this.logger.log(
        `✅ [checkExistingCuadrante] Rezultat - hasCuadrante: ${hasCuadrante}, hasHorarioMulticentro: ${hasHorarioMulticentro}`,
      );

      return {
        hasCuadrante,
        hasHorarioMulticentro,
        cuadrante,
        horarioMulticentro: hasHorarioMulticentro
          ? horarioMulticentroResult
          : undefined,
      };
    } catch (error: any) {
      this.logger.error('❌ Error checking existing cuadrante:', error);
      throw new BadRequestException(
        `Error al verificar cuadrante existente: ${error.message}`,
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
      const visibleValue =
        data.visible !== undefined ? (data.visible ? '1' : '0') : '1';
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
      this.logger.log(
        `✅ Toggled visibility for cuadrante id=${id} to ${visible}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Error toggling visibility for cuadrante id=${id}:`,
        error,
      );
      throw new BadRequestException(
        `Error al actualizar visibilidad: ${error.message}`,
      );
    }
  }

  /**
   * Toggle vizibilitate cuadrante by CODIGO and LUNA
   */
  async toggleVisibleByCodigoLuna(
    CODIGO: string,
    LUNA: string,
    visible: boolean,
  ): Promise<void> {
    try {
      const query = `UPDATE cuadrante SET visible = ${visible ? '1' : '0'} WHERE CODIGO = ${this.escapeSql(CODIGO)} AND LUNA = ${this.escapeSql(LUNA)}`;
      await this.prisma.$executeRawUnsafe(query);
      this.logger.log(
        `✅ Toggled visibility for cuadrante CODIGO=${CODIGO}, LUNA=${LUNA} to ${visible}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Error toggling visibility for cuadrante CODIGO=${CODIGO}, LUNA=${LUNA}:`,
        error,
      );
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

      // Mismo día: jornada larga (>8 h), ej. Bosquepino 07:15–19:15 (12 h presencia)
      if (heMinutes !== null && hsMinutes !== null && hsMinutes > heMinutes) {
        const durSame = hsMinutes - heMinutes;
        if (
          durSame > 540 &&
          durSame <= 18 * 60 &&
          heMinutes >= 5 * 60 &&
          heMinutes <= 15 * 60
        ) {
          return 'T1';
        }
      }

      // Cruza medianoche en columna del día (HE > HS en reloj): ej. T 19:15 → 07:15
      if (heMinutes !== null && hsMinutes !== null && heMinutes > hsMinutes) {
        const durN = hsMinutes - heMinutes + 24 * 60;
        if (
          durN >= 300 &&
          durN <= 16 * 60 &&
          (heMinutes >= 16 * 60 || heMinutes <= 5 * 60)
        ) {
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
   * Celdas fusionadas (Bosquepino y similares): la fila HS queda vacía pero la celda HE
   * contiene rango "07:30-15:00", "7:30 / 15:00" o dos HH:MM en el mismo texto.
   */
  private tryExtractHeHsPairFromMaybeMergedCell(
    heCell: unknown,
    hsCell: unknown,
  ): { he: string; hs: string } | null {
    const hsTrim =
      hsCell === null || hsCell === undefined ? '' : String(hsCell).trim();
    if (hsTrim !== '' && hsTrim !== 'L' && hsTrim.toUpperCase() !== 'LIBRE') {
      return null;
    }
    if (heCell instanceof Date) {
      return null;
    }
    if (typeof heCell === 'number') {
      return null;
    }
    const raw = String(heCell ?? '').trim();
    if (!raw || raw === 'L' || raw.toUpperCase() === 'LIBRE') {
      return null;
    }
    const dash = raw.match(/(\d{1,2}:\d{2})\s*[-–/]\s*(\d{1,2}:\d{2})/);
    if (dash) {
      return { he: dash[1], hs: dash[2] };
    }
    const times: string[] = [];
    const re = /\b(\d{1,2}:\d{2})\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      times.push(m[1]);
    }
    if (times.length >= 2) {
      return { he: times[0], hs: times[1] };
    }
    return null;
  }

  /**
   * Fusión vertical en columna del día: solo queda HE (fecha/hora); la fila HS está vacía.
   * Sin texto "07:30-15:00" en una celda, no hay HS → P1 falla. Asumimos +8h (jornada típica)
   * para reconstruir salida (misma lógica de redondeo de minutos que formatTime en import).
   */
  private inferHsFromHeWhenHsMergedAway(heStr: string): string | null {
    const match = heStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      return null;
    }
    let h = parseInt(match[1], 10);
    let min = parseInt(match[2], 10);
    let totalMin = h * 60 + min + 480;
    totalMin %= 24 * 60;
    h = Math.floor(totalMin / 60);
    min = totalMin % 60;
    if (min >= 45) {
      h = (h + 1) % 24;
      min = 0;
    } else if (min < 15) {
      min = 0;
    } else {
      min = 30;
    }
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  private resolveCuadranteWorksheet(workbook: ExcelJS.Workbook): {
    worksheet: ExcelJS.Worksheet;
    sheetName: string;
  } {
    const sheetName =
      workbook.worksheets.find(
        (s) =>
          s.name.toLowerCase().includes('hoja') ||
          s.name.toLowerCase().includes('sheet'),
      )?.name || workbook.worksheets[0]?.name;

    if (!sheetName) {
      throw new BadRequestException('El Excel no contiene hojas');
    }

    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      throw new BadRequestException(`No se encontró la hoja "${sheetName}"`);
    }
    return { worksheet, sheetName };
  }

  /**
   * Foaie + antet (2 rânduri) pentru import cuadrantes — folosit de ambele formate.
   */
  private loadCuadranteExcelLayout(workbook: ExcelJS.Workbook): {
    worksheet: ExcelJS.Worksheet;
    sheetName: string;
    headers: string[];
    columnToDayMap: { [key: string]: number };
    maxColumns: number;
  } {
    const { worksheet, sheetName } = this.resolveCuadranteWorksheet(workbook);

    const headerRow1Raw = worksheet.getRow(1);
    const headerRow2Raw = worksheet.getRow(2);
    const headers: string[] = [];
    const columnToDayMap: { [key: string]: number } = {};
    const maxColumns = Math.max(
      headerRow1Raw.cellCount,
      headerRow2Raw.cellCount,
    );

    for (let colNumber = 1; colNumber <= maxColumns; colNumber++) {
      const cell1 = headerRow1Raw.getCell(colNumber);
      const cell2 = headerRow2Raw.getCell(colNumber);
      const col1 = cell1.value ? String(cell1.value).trim() : '';
      const col2 = cell2.value ? String(cell2.value).trim() : '';

      if (colNumber === 1) {
        headers[colNumber - 1] = col2 || 'TRABAJADOR';
      } else if (colNumber === 2) {
        headers[colNumber - 1] = col2 || 'TURNO';
      } else {
        if (col2 && !isNaN(parseInt(col2, 10))) {
          const dayNum = parseInt(col2, 10);
          if (dayNum >= 1 && dayNum <= 31) {
            const headerKey = `ZI_${dayNum}`;
            headers[colNumber - 1] = headerKey;
            columnToDayMap[headerKey] = dayNum;
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

    return { worksheet, sheetName, headers, columnToDayMap, maxColumns };
  }

  private cellToPlainString(cell: ExcelJS.Cell | undefined): string {
    if (!cell || cell.value === null || cell.value === undefined) {
      return '';
    }
    if (typeof cell.value === 'string') {
      return cell.value;
    }
    if (typeof cell.value === 'number') {
      return String(cell.value);
    }
    if (cell.value instanceof Date) {
      return cell.value.toISOString();
    }
    const v = cell.value as {
      richText?: Array<{ text: string }>;
      result?: unknown;
    };
    if (v && Array.isArray(v.richText)) {
      return v.richText.map((r) => r.text).join('');
    }
    if (v && 'result' in v) {
      return String(v.result ?? '');
    }
    return String(cell.value);
  }

  private cellValueToCuadranteInputString(
    cell: ExcelJS.Cell | undefined,
  ): string {
    if (!cell || cell.value === null || cell.value === undefined) {
      return '';
    }
    if (cell.value instanceof Date) {
      let hours = cell.value.getHours();
      let minutes = cell.value.getMinutes();
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
    if (typeof cell.value === 'number' && cell.value < 1 && cell.value >= 0) {
      const totalHours = cell.value * 24;
      const h = Math.floor(totalHours);
      const minutes = Math.round((totalHours - h) * 60);
      const roundedHours = minutes >= 45 ? h + 1 : h;
      const finalMinutes =
        minutes >= 45 ? 0 : minutes < 15 ? 0 : minutes < 45 ? 30 : 0;
      const finalHours = roundedHours;
      return `${String(finalHours % 24).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
    }
    return this.cellToPlainString(cell).trim();
  }

  /**
   * Celulă cu 4 ore pe linii (ex. 19:00 / 22:00 / 23:00 / 06:00) → "19:00-22:00 / 23:00-06:00".
   * 2 ore → "T1|2|3 HH:MM-HH:MM" ca înainte.
   */
  private parseCeldaCuadranteMultilinea(raw: string): string | null {
    const s0 = raw.replace(/\r\n/g, '\n').trim();
    if (!s0) {
      return null;
    }
    const sl = s0.toLowerCase();
    if (sl === 'l' || sl === 'libre' || sl === '-' || sl === '—') {
      return 'LIBRE';
    }

    const re = /\b(\d{1,2}):(\d{2})\b/g;
    const times: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(s0)) !== null) {
      const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
      const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
      times.push(
        `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
      );
    }

    if (times.length === 0) {
      return null;
    }

    if (times.length === 4) {
      return `${times[0]}-${times[1]} / ${times[2]}-${times[3]}`;
    }

    if (times.length === 2) {
      const turno = this.mapTimeToTurno(times[0], times[1]);
      if (turno && turno !== 'LIBRE') {
        return `${turno} ${times[0]}-${times[1]}`;
      }
      return `${times[0]}-${times[1]}`;
    }

    if (times.length >= 6 && times.length % 2 === 0) {
      const parts: string[] = [];
      for (let i = 0; i < times.length; i += 2) {
        parts.push(`${times[i]}-${times[i + 1]}`);
      }
      return parts.join(' / ');
    }

    return null;
  }

  private horasFromIntervalFragment(fragment: string): number {
    const frag = fragment.trim();
    if (!frag || frag === 'LIBRE') {
      return 0;
    }
    const v = frag.replace(/^T[123]\s+/i, '').trim();
    const timeMatch = v.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const startHour = parseInt(timeMatch[1], 10);
      const startMin = parseInt(timeMatch[2], 10);
      const endHour = parseInt(timeMatch[3], 10);
      const endMin = parseInt(timeMatch[4], 10);
      const startMinutes = startHour * 60 + startMin;
      let endMinutes = endHour * 60 + endMin;
      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
      }
      return (endMinutes - startMinutes) / 60;
    }
    if (/^T[123]$/i.test(frag)) {
      return 8;
    }
    if (frag.includes('T1') && !frag.includes(':')) {
      return 8;
    }
    if (frag.includes('T2') && !frag.includes(':')) {
      return 8;
    }
    if (frag.includes('T3') && !frag.includes(':')) {
      return 8;
    }
    return 0;
  }

  private horasFromZiCellValue(val: string | null | undefined): number {
    if (val == null || val === '') {
      return 0;
    }
    const s = String(val).trim();
    if (s === 'LIBRE' || s === 'L') {
      return 0;
    }
    if (/^T[123]$/i.test(s)) {
      return 8;
    }
    const tNumH = s.match(/^T[123]\s+(\d+(?:[.,]\d+)?)\s*h?$/i);
    if (tNumH) {
      const n = parseFloat(tNumH[1].replace(',', '.'));
      return !isNaN(n) && n > 0 ? n : 8;
    }
    const soloH = s.match(/^(\d+(?:[.,]\d+)?)\s*h?$/i);
    if (soloH) {
      const n = parseFloat(soloH[1].replace(',', '.'));
      return !isNaN(n) && n > 0 ? n : 0;
    }
    if (s.includes(' / ')) {
      return s
        .split(' / ')
        .reduce((acc, p) => acc + this.horasFromIntervalFragment(p), 0);
    }
    return this.horasFromIntervalFragment(s);
  }

  private computeTotalHorasCuadranteRow(
    cuadranteData: Record<string, unknown>,
  ): number {
    let totalHoras = 0;
    for (let zi = 1; zi <= 31; zi++) {
      totalHoras += this.horasFromZiCellValue(
        cuadranteData[`ZI_${zi}`] as string | null | undefined,
      );
    }
    return totalHoras;
  }

  private normHdrExcel(v: unknown): string {
    if (v == null || v === undefined) {
      return '';
    }
    let s = String(v).trim().toLowerCase();
    s = s.normalize('NFD').replace(/\p{M}/gu, '');
    return s
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Última columna con valor en la fila (ExcelJS a veces deja cellCount bajo). */
  private rowLastNonEmptyCol(row: ExcelJS.Row, hardCap = 200): number {
    let last = 0;
    for (let c = 1; c <= hardCap; c++) {
      const cell = row.getCell(c);
      const v = cell.value;
      if (v == null || v === '') {
        continue;
      }
      if (typeof v === 'string' && v.trim() === '') {
        continue;
      }
      last = c;
    }
    return last;
  }

  private isTurnoHeaderNorm(n: string): boolean {
    return n === 'turno' || n.startsWith('turno ');
  }

  private isHorasHeaderNorm(n: string): boolean {
    return (
      n === 'horas' ||
      n === 'hora' ||
      n === 'hrs' ||
      n === 'hr' ||
      n.startsWith('horas ') ||
      n.startsWith('hora ')
    );
  }

  /** Cabeceras: leer texto plano (richText / fórmula) — evita "[object Object]" en normHdrExcel. */
  private normHdrExcelCell(cell: ExcelJS.Cell | undefined): string {
    return this.normHdrExcel(this.cellToPlainString(cell));
  }

  /**
   * Pares Turno|Horas: etiquetas explícitas, Horas vacía (fusiones), o solo "Turno" cada 2 columnas.
   */
  private collectTurnoHorasPairsFromHeaderRow(
    row: ExcelJS.Row,
    maxCol: number,
  ): Array<{ turnoCol: number; horasCol: number }> | null {
    const pairsStrict: Array<{ turnoCol: number; horasCol: number }> = [];
    for (let c = 1; c < maxCol; c++) {
      const a = this.normHdrExcelCell(row.getCell(c));
      const b = this.normHdrExcelCell(row.getCell(c + 1));
      if (
        this.isTurnoHeaderNorm(a) &&
        (this.isHorasHeaderNorm(b) || b === '')
      ) {
        pairsStrict.push({ turnoCol: c, horasCol: c + 1 });
        c++;
      }
    }
    if (pairsStrict.length >= 5) {
      return pairsStrict;
    }

    const turnoCols: number[] = [];
    for (let c = 1; c <= maxCol; c++) {
      if (this.isTurnoHeaderNorm(this.normHdrExcelCell(row.getCell(c)))) {
        turnoCols.push(c);
      }
    }
    if (turnoCols.length < 5) {
      return null;
    }
    let bestRun: number[] = [];
    let run: number[] = [turnoCols[0]];
    for (let i = 1; i < turnoCols.length; i++) {
      if (turnoCols[i] === run[run.length - 1] + 2) {
        run.push(turnoCols[i]);
      } else {
        if (run.length > bestRun.length) {
          bestRun = run;
        }
        run = [turnoCols[i]];
      }
    }
    if (run.length > bestRun.length) {
      bestRun = run;
    }
    if (bestRun.length < 5) {
      return null;
    }
    return bestRun.map((tc) => ({ turnoCol: tc, horasCol: tc + 1 }));
  }

  private tryDetectTurnoHorasHeader(worksheet: ExcelJS.Worksheet): {
    turnoRow: number;
    pairs: Array<{ turnoCol: number; horasCol: number }>;
    maxCol: number;
  } | null {
    for (let r = 1; r <= 55; r++) {
      const row = worksheet.getRow(r);
      const lastNonEmpty = this.rowLastNonEmptyCol(row, 200);
      const maxCol = Math.min(
        200,
        Math.max(
          lastNonEmpty,
          row.cellCount || 0,
          (row as { actualCellCount?: number }).actualCellCount || 0,
          32,
        ),
      );
      const pairs = this.collectTurnoHorasPairsFromHeaderRow(row, maxCol);
      if (pairs && pairs.length >= 5) {
        return {
          turnoRow: r,
          pairs,
          maxCol,
        };
      }
    }
    return null;
  }

  /** Primera hoja que tenga cabecera tabla Turno/Horas o HE/HS×4 por día. */
  private findWorkbookSheetWithTurnoHorasOrHeHsCuatro(
    workbook: ExcelJS.Workbook,
  ): { worksheet: ExcelJS.Worksheet; sheetName: string } | null {
    for (const ws of workbook.worksheets) {
      if (!ws) {
        continue;
      }
      if (
        this.tryDetectHeHsCuatroPorDiaHeader(ws) != null ||
        this.tryDetectTurnoHorasHeader(ws) != null
      ) {
        return { worksheet: ws, sheetName: ws.name };
      }
    }
    return null;
  }

  private detectTurnoHorasHeader(worksheet: ExcelJS.Worksheet): {
    turnoRow: number;
    pairs: Array<{ turnoCol: number; horasCol: number }>;
    maxCol: number;
  } {
    const t = this.tryDetectTurnoHorasHeader(worksheet);
    if (!t) {
      throw new BadRequestException(
        'No se encontró cabecera Turno/Horas repetida (mín. 5 días). Elija otro formato o revise el Excel.',
      );
    }
    return t;
  }

  /**
   * Elige formato entre los tres importadores (sin leer todo el fichero).
   * - Tabla Turno/Horas o HE/HS×2 por día: cabeceras anchas repetidas.
   * - Estándar HE/HS (M/T): varias filas por mismo nombre en col. 1.
   * - Celdas multilínea: una fila por empleado con columnas ZI_* en cabecera.
   */
  private detectCuadranteExcelFormat(
    workbook: ExcelJS.Workbook,
  ): 'turno_horas_tabla' | 'he_hs' | 'celdas_multilinea' {
    if (this.findWorkbookSheetWithTurnoHorasOrHeHsCuatro(workbook) != null) {
      return 'turno_horas_tabla';
    }

    const { worksheet: ws, columnToDayMap } =
      this.loadCuadranteExcelLayout(workbook);
    const ziCount = Object.keys(columnToDayMap).length;
    if (ziCount < 5) {
      throw new BadRequestException(
        'No se pudo detectar el formato automáticamente: no hay cabecera Turno/Horas ni suficientes columnas de día (1–31). Elija el formato manualmente.',
      );
    }

    const lastRow = Math.min(ws.rowCount || 100, 120);
    const trabSet = new Set<string>();
    let rowCount = 0;
    for (let r = 3; r <= lastRow; r++) {
      const row = ws.getRow(r);
      const trab = this.cellToPlainString(row.getCell(1)).trim();
      if (
        !trab ||
        trab === 'TOTAL' ||
        trab === 'DIAS DE LA SEMANA' ||
        trab === 'TURNO'
      ) {
        continue;
      }
      if (trab === 'M' || trab === 'T' || trab.length <= 1) {
        continue;
      }
      rowCount += 1;
      trabSet.add(trab);
    }
    const distinct = trabSet.size;
    if (distinct === 0) {
      throw new BadRequestException(
        'No se pudo detectar el formato automáticamente: no hay filas de empleados reconocibles. Elija el formato manualmente.',
      );
    }
    const ratio = rowCount / distinct;
    if (ratio > 1.2) {
      return 'he_hs';
    }
    return 'celdas_multilinea';
  }

  /**
   * CASTILLO OROPESA: tras fila M/HE y fila (TURNO vacío)/HS, las siguientes filas HE/HS
   * con TURNO vacío son tarde, no mañana. Bosquepino solo añade HS con TURNO vacío cuando
   * en turnoM aún no hay fila HS → aquí sigue siendo false hasta después del HS.
   */
  private morningBandHasHeAndHs(turnoM: any[]): boolean {
    if (!turnoM?.length) {
      return false;
    }
    return (
      turnoM.some((r) => r._isHE === true) &&
      turnoM.some((r) => r._isHS === true)
    );
  }

  /**
   * Empareja filas HE/HS en orden (Castillo: 2+2 en turnoT = tarde compartida + noche).
   * Bosquepino: 1 HE + 1 HS por banda → un solo par.
   */
  private zipHeHsRowPairs(turnoRows: any[]): Array<{ heRow: any; hsRow: any }> {
    if (!turnoRows?.length) {
      return [];
    }
    const he = turnoRows.filter((r) => r._isHE === true);
    const hs = turnoRows.filter((r) => r._isHS === true);
    if (he.length === hs.length && he.length >= 1) {
      return he.map((heRow, k) => ({ heRow, hsRow: hs[k] }));
    }
    const heRow =
      turnoRows.find((r) => r._isHE === true) ?? turnoRows[0] ?? null;
    const hsRow =
      turnoRows.find((r) => r._isHS === true) ??
      (turnoRows.length >= 2 ? turnoRows[1] : null);
    if (heRow && hsRow) {
      return [{ heRow, hsRow }];
    }
    return [];
  }

  private dedupeOrderedIntervalStrings(segments: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of segments) {
      if (seen.has(s)) {
        continue;
      }
      seen.add(s);
      out.push(s);
    }
    return out;
  }

  private formatHeHsPairAtZiKey(
    heRow: any,
    hsRow: any,
    ziKey: string,
    formatTime: (v: any) => string | null,
    inferHsWhenEmpty: boolean,
  ): {
    heStr: string | null;
    hsStr: string | null;
    heRaw: any;
    hsRaw: any;
  } {
    let heRaw = heRow[ziKey];
    let hsRaw = hsRow[ziKey];
    const merged = this.tryExtractHeHsPairFromMaybeMergedCell(heRaw, hsRaw);
    if (merged) {
      heRaw = merged.he;
      hsRaw = merged.hs;
    }
    let heStr = heRaw != null && heRaw !== '' ? formatTime(heRaw) : null;
    let hsStr = hsRaw != null && hsRaw !== '' ? formatTime(hsRaw) : null;
    const hsEmpty =
      hsRaw === '' ||
      hsRaw == null ||
      hsRaw === undefined ||
      (typeof hsRaw === 'string' && hsRaw.trim() === '');
    if (
      inferHsWhenEmpty &&
      heStr &&
      heStr !== 'LIBRE' &&
      (!hsStr || hsStr === '') &&
      heRaw !== 'L' &&
      hsRaw !== 'L' &&
      hsEmpty
    ) {
      const inferred = this.inferHsFromHeWhenHsMergedAway(heStr);
      if (inferred) {
        hsStr = inferred;
      }
    }
    return { heStr, hsStr, heRaw, hsRaw };
  }

  private buildHeHsIntervalSegmentsForZiKey(
    turnoRows: any[],
    ziKey: string,
    formatTime: (v: any) => string | null,
    inferHsWhenEmpty: boolean,
  ): string[] {
    const pairs = this.zipHeHsRowPairs(turnoRows);
    const segments: string[] = [];
    for (const { heRow, hsRow } of pairs) {
      const { heStr, hsStr, heRaw, hsRaw } = this.formatHeHsPairAtZiKey(
        heRow,
        hsRow,
        ziKey,
        formatTime,
        inferHsWhenEmpty,
      );
      if (
        heStr &&
        hsStr &&
        heStr !== 'LIBRE' &&
        hsStr !== 'LIBRE' &&
        heRaw !== 'L' &&
        hsRaw !== 'L'
      ) {
        const turnoCode = this.mapTimeToTurno(heStr, hsStr);
        if (turnoCode && turnoCode !== 'LIBRE') {
          segments.push(`${turnoCode} ${heStr}-${hsStr}`);
        }
      }
    }
    return segments;
  }

  /** Cabecera HE / HS / HE / HS por día (dos pares entrada-salida por día). */
  private isHeHeaderNorm(n: string): boolean {
    if (!n) return false;
    if (n === 'he') return true;
    if (n === 'entrada') return true;
    if (n.startsWith('hora entrada')) return true;
    if (n.includes('entrada') && !n.includes('salida')) return true;
    return false;
  }

  private isHsHeaderNorm(n: string): boolean {
    if (!n) return false;
    if (n === 'hs') return true;
    if (n === 'salida') return true;
    if (n.startsWith('hora salida')) return true;
    if (n.includes('salida') && !n.includes('entrada')) return true;
    return false;
  }

  private tryDetectHeHsCuatroPorDiaHeader(worksheet: ExcelJS.Worksheet): {
    headerRow: number;
    dayBlocks: Array<{
      dayNum: number;
      he1: number;
      hs1: number;
      he2: number;
      hs2: number;
    }>;
    maxCol: number;
  } | null {
    for (let r = 1; r <= 55; r++) {
      const row = worksheet.getRow(r);
      const lastNonEmpty = this.rowLastNonEmptyCol(row, 200);
      const maxCol = Math.min(
        200,
        Math.max(
          lastNonEmpty,
          row.cellCount || 0,
          (row as { actualCellCount?: number }).actualCellCount || 0,
          32,
        ),
      );
      const dayBlocks: Array<{
        he1: number;
        hs1: number;
        he2: number;
        hs2: number;
      }> = [];
      for (let c = 1; c < maxCol - 2; c++) {
        const n0 = this.normHdrExcelCell(row.getCell(c));
        const n1 = this.normHdrExcelCell(row.getCell(c + 1));
        const n2 = this.normHdrExcelCell(row.getCell(c + 2));
        const n3 = this.normHdrExcelCell(row.getCell(c + 3));
        if (
          this.isHeHeaderNorm(n0) &&
          this.isHsHeaderNorm(n1) &&
          this.isHeHeaderNorm(n2) &&
          this.isHsHeaderNorm(n3)
        ) {
          dayBlocks.push({
            he1: c,
            hs1: c + 1,
            he2: c + 2,
            hs2: c + 3,
          });
          c += 3;
        }
      }
      if (dayBlocks.length >= 5) {
        return {
          headerRow: r,
          dayBlocks: dayBlocks.map((b, i) => ({ ...b, dayNum: i + 1 })),
          maxCol,
        };
      }
    }
    return null;
  }

  /**
   * Si el Excel repite Turno+Horas dos veces por día calendario, hay ~2× pares que días del mes.
   * Agrupamos pares consecutivos (0+1 → día 1, 2+3 → día 2, …).
   */
  private buildTurnoHorasDayBlocksFromPairs(
    pairs: Array<{ turnoCol: number; horasCol: number }>,
    daysInMonth: number,
  ): Array<{
    dayNum: number;
    turno1: number | null;
    horas1: number | null;
    turno2: number | null;
    horas2: number | null;
  }> {
    const slack = 2;
    const useDouble =
      pairs.length > daysInMonth && pairs.length >= 2 * daysInMonth - slack;

    const blocks: Array<{
      dayNum: number;
      turno1: number | null;
      horas1: number | null;
      turno2: number | null;
      horas2: number | null;
    }> = [];

    if (useDouble) {
      for (let i = 0; i < daysInMonth; i++) {
        const ix = i * 2;
        if (ix + 1 < pairs.length) {
          const a = pairs[ix];
          const b = pairs[ix + 1];
          blocks.push({
            dayNum: i + 1,
            turno1: a.turnoCol,
            horas1: a.horasCol,
            turno2: b.turnoCol,
            horas2: b.horasCol,
          });
        } else if (ix < pairs.length) {
          const a = pairs[ix];
          blocks.push({
            dayNum: i + 1,
            turno1: a.turnoCol,
            horas1: a.horasCol,
            turno2: null,
            horas2: null,
          });
        } else {
          blocks.push({
            dayNum: i + 1,
            turno1: null,
            horas1: null,
            turno2: null,
            horas2: null,
          });
        }
      }
      return blocks;
    }

    for (let i = 0; i < daysInMonth; i++) {
      if (i < pairs.length) {
        const p = pairs[i];
        blocks.push({
          dayNum: i + 1,
          turno1: p.turnoCol,
          horas1: p.horasCol,
          turno2: null,
          horas2: null,
        });
      } else {
        blocks.push({
          dayNum: i + 1,
          turno1: null,
          horas1: null,
          turno2: null,
          horas2: null,
        });
      }
    }
    return blocks;
  }

  private mergeZiFromTwoTurnoHorasPairs(
    turnoA: unknown,
    horasA: unknown,
    turnoB: unknown,
    horasB: unknown,
  ): string {
    const v1 = this.ziValueFromTurnoHorasCells(turnoA, horasA);
    const v2 = this.ziValueFromTurnoHorasCells(turnoB, horasB);
    if (v1 === 'LIBRE' && v2 === 'LIBRE') {
      return 'LIBRE';
    }
    if (v1 === 'LIBRE') {
      return v2;
    }
    if (v2 === 'LIBRE') {
      return v1;
    }
    if (v1 === v2) {
      return v1;
    }
    return `${v1} / ${v2}`;
  }

  /** Cuatro celdas HE/HS/HE/HS → un solo ZI (p. ej. T1 … / T3 …). */
  private ziValueFromCuatroHeHsCells(
    row: ExcelJS.Row,
    he1: number,
    hs1: number,
    he2: number,
    hs2: number,
  ): string {
    const a1 = this.cellValueToCuadranteInputString(row.getCell(he1));
    const b1 = this.cellValueToCuadranteInputString(row.getCell(hs1));
    const a2 = this.cellValueToCuadranteInputString(row.getCell(he2));
    const b2 = this.cellValueToCuadranteInputString(row.getCell(hs2));

    const seg = (he: string, hs: string): string | null => {
      const h = he.trim();
      const s = hs.trim();
      if (!h && !s) {
        return null;
      }
      if (!h || !s) {
        return null;
      }
      const sl = h.toLowerCase();
      if (sl === 'l' || sl === 'libre' || s.toLowerCase() === 'l') {
        return 'LIBRE';
      }
      const turno = this.mapTimeToTurno(h, s);
      if (turno && turno !== 'LIBRE') {
        return `${turno} ${h}-${s}`;
      }
      return `${h}-${s}`;
    };

    const s1 = seg(a1, b1);
    const s2 = seg(a2, b2);
    if (!s1 && !s2) {
      return 'LIBRE';
    }
    if (!s1 || s1 === 'LIBRE') {
      return s2 && s2 !== 'LIBRE' ? s2 : 'LIBRE';
    }
    if (!s2 || s2 === 'LIBRE') {
      return s1;
    }
    if (s1 === s2) {
      return s1;
    }
    return `${s1} / ${s2}`;
  }

  private mapNombreCodigoEmailCentroCols(
    worksheet: ExcelJS.Worksheet,
    labelRow: number,
    lastMetaCol: number,
  ): {
    colNombre: number;
    colCodigo: number;
    colEmail: number;
    colCentro: number;
  } {
    const row = worksheet.getRow(labelRow);
    let colNombre = 1;
    let colCodigo = 2;
    let colEmail = 3;
    let colCentro = 4;
    const lim = Math.max(1, lastMetaCol);
    for (let c = 1; c <= lim; c++) {
      const raw = this.cellToPlainString(row.getCell(c)).toLowerCase();
      const n = this.normHdrExcelCell(row.getCell(c));
      if (raw.includes('nombre') || n.includes('nombre')) {
        colNombre = c;
      }
      if (
        raw.includes('código') ||
        raw.includes('codigo') ||
        n.includes('codigo')
      ) {
        colCodigo = c;
      }
      if (
        raw.includes('email') ||
        raw.includes('correo') ||
        n.includes('email')
      ) {
        colEmail = c;
      }
      if (
        raw.includes('centro') ||
        raw.includes('cliente') ||
        n.includes('centro')
      ) {
        colCentro = c;
      }
    }
    return { colNombre, colCodigo, colEmail, colCentro };
  }

  /**
   * O singură „fâșie” Turno (fără a îmbina cu alt T); horasRaw doar dacă e util.
   */
  private ziValueSingleTurnoLine(t: string, hRaw: string): string {
    const hClean = hRaw.replace(/\s/g, '').replace(',', '.');
    const hNum = parseFloat(hClean.replace(/h$/i, ''));
    const hasHoras = !isNaN(hNum) && hNum > 0;
    const turnoBad =
      !t ||
      t === '-' ||
      t === '—' ||
      /^l$/i.test(t) ||
      t.toLowerCase() === 'libre';

    if (turnoBad && !hasHoras) {
      return 'LIBRE';
    }
    if (turnoBad && hasHoras) {
      return hRaw.toLowerCase().includes('h') ? `${hNum}h` : String(hNum);
    }
    const tu = t.toUpperCase();
    if (/^T[123]$/.test(tu)) {
      if (!hasHoras) {
        return tu;
      }
      return `${tu} ${hRaw}`;
    }
    // Deja include interval (T1 08:00-14:00): nu concatenăm Horas (evită „… 6.0h” care strică parsarea)
    if (/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(t)) {
      return t.trim();
    }
    return `${t} ${hRaw}`.trim();
  }

  /**
   * Celulă Turno cu o tură sau mai multe (Alt+Enter sau „T1 … T3 …” pe același rând).
   */
  private ziValueFromTurnoHorasCells(
    turnoRaw: unknown,
    horasRaw: unknown,
  ): string {
    const t0 = String(turnoRaw ?? '').trim();
    const hRaw = String(horasRaw ?? '').trim();
    const hClean = hRaw.replace(/\s/g, '').replace(',', '.');
    const hNum = parseFloat(hClean.replace(/h$/i, ''));
    const hasHoras = !isNaN(hNum) && hNum > 0;

    const linesFromNewlines = t0
      .split(/\r\n|\n|\r/)
      .map((x) => x.trim())
      .filter((x) => x.length > 0);

    let segments: string[] = [];
    for (const chunk of linesFromNewlines) {
      if (/\s+(?=T[123]\s)/i.test(chunk)) {
        segments.push(
          ...chunk
            .split(/\s+(?=T[123]\s)/i)
            .map((x) => x.trim())
            .filter((x) => x.length > 0),
        );
      } else {
        segments.push(chunk);
      }
    }

    if (segments.length > 1) {
      const pieces = segments.map((ln) => this.ziValueSingleTurnoLine(ln, ''));
      const cleaned = pieces.filter((p) => p && p !== 'LIBRE');
      if (cleaned.length === 0) {
        if (this.turnoBadish(t0) && hasHoras) {
          return hRaw.toLowerCase().includes('h') ? `${hNum}h` : String(hNum);
        }
        return 'LIBRE';
      }
      return cleaned.join(' / ');
    }

    const single = segments[0] || '';
    return this.ziValueSingleTurnoLine(single, hRaw);
  }

  private turnoBadish(t: string): boolean {
    const s = String(t ?? '').trim();
    return (
      !s ||
      s === '-' ||
      s === '—' ||
      /^l$/i.test(s) ||
      s.toLowerCase() === 'libre'
    );
  }

  private async lookupEmpleadoParaTablaTurnoHoras(
    nombreRaw: string,
    codigoRaw: string,
    emailRaw: string,
  ): Promise<{
    codigo: string | null;
    nombreBd: string | null;
    email: string | null;
    empleadoEncontradoFlag: boolean;
    confianza: number;
    matchType: string;
  }> {
    const nombreTrim = String(nombreRaw ?? '').trim();
    let codeTry =
      String(codigoRaw ?? '').trim() && String(codigoRaw ?? '').trim() !== '-'
        ? String(codigoRaw).trim()
        : '';
    if (!codeTry && /^\d+$/.test(nombreTrim)) {
      codeTry = nombreTrim;
    }
    const emailTrim = String(emailRaw ?? '').trim();

    if (codeTry) {
      const q = `
        SELECT CAST(CODIGO AS CHAR) AS CODIGO, \`NOMBRE / APELLIDOS\` AS NOMBRE, \`CORREO ELECTRONICO\` AS EMAIL
        FROM \`DatosEmpleados\`
        WHERE TRIM(CAST(CODIGO AS CHAR)) = ${this.escapeSql(codeTry)}
        LIMIT 1
      `;
      try {
        const rows = await this.prisma.$queryRawUnsafe<
          Array<{
            CODIGO: string;
            NOMBRE: string;
            EMAIL: string | null;
          }>
        >(q);
        if (rows.length > 0) {
          return {
            codigo: String(rows[0].CODIGO),
            nombreBd: rows[0].NOMBRE,
            email: rows[0].EMAIL?.trim() || null,
            empleadoEncontradoFlag: true,
            confianza: 100,
            matchType: 'codigo_excel',
          };
        }
      } catch (err) {
        this.logger.warn(`⚠️ lookupEmpleado codigo ${codeTry}: ${err}`);
      }

      try {
        const byNif = await this.gestoriaService.findEmpleadoFlexible(
          '',
          codeTry,
          null,
        );
        if (byNif && byNif.matchType === 'nif') {
          let emailNif: string | null = null;
          try {
            const empleadoQuery = `
                SELECT \`CORREO ELECTRONICO\` AS EMAIL
                FROM \`DatosEmpleados\`
                WHERE CODIGO = ${this.escapeSql(byNif.CODIGO)}
                LIMIT 1
              `;
            const empleadoEmail =
              await this.prisma.$queryRawUnsafe<
                Array<{ EMAIL: string | null }>
              >(empleadoQuery);
            if (empleadoEmail.length > 0 && empleadoEmail[0].EMAIL) {
              emailNif = empleadoEmail[0].EMAIL.trim() || null;
            }
          } catch {
            /* ignore */
          }
          return {
            codigo: String(byNif.CODIGO),
            nombreBd: byNif['NOMBRE / APELLIDOS'],
            email: emailNif,
            empleadoEncontradoFlag: true,
            confianza: 100,
            matchType: 'nif_excel',
          };
        }
      } catch (err) {
        this.logger.warn(`⚠️ lookupEmpleado NIF ${codeTry}: ${err}`);
      }
    }

    if (emailTrim && emailTrim !== '-' && emailTrim.includes('@')) {
      const q = `
        SELECT CAST(CODIGO AS CHAR) AS CODIGO, \`NOMBRE / APELLIDOS\` AS NOMBRE, \`CORREO ELECTRONICO\` AS EMAIL
        FROM \`DatosEmpleados\`
        WHERE LOWER(TRIM(\`CORREO ELECTRONICO\`)) = ${this.escapeSql(emailTrim.toLowerCase())}
        LIMIT 1
      `;
      try {
        const rows = await this.prisma.$queryRawUnsafe<
          Array<{
            CODIGO: string;
            NOMBRE: string;
            EMAIL: string | null;
          }>
        >(q);
        if (rows.length > 0) {
          return {
            codigo: String(rows[0].CODIGO),
            nombreBd: rows[0].NOMBRE,
            email: rows[0].EMAIL?.trim() || null,
            empleadoEncontradoFlag: true,
            confianza: 100,
            matchType: 'email_excel',
          };
        }
      } catch (err) {
        this.logger.warn(`⚠️ lookupEmpleado email: ${err}`);
      }
    }

    const nombreForFlex =
      nombreTrim && !/^\d+$/.test(nombreTrim) ? nombreTrim : '';
    const flex = nombreForFlex
      ? await this.gestoriaService.findEmpleadoFlexible(
          nombreForFlex,
          null,
          null,
        )
      : null;

    if (flex) {
      let email: string | null = null;
      try {
        const empleadoQuery = `
                SELECT \`CORREO ELECTRONICO\` AS EMAIL
                FROM \`DatosEmpleados\`
                WHERE CODIGO = ${this.escapeSql(flex.CODIGO)}
                LIMIT 1
              `;
        const empleadoEmail =
          await this.prisma.$queryRawUnsafe<Array<{ EMAIL: string | null }>>(
            empleadoQuery,
          );
        if (empleadoEmail.length > 0 && empleadoEmail[0].EMAIL) {
          email = empleadoEmail[0].EMAIL.trim() || null;
        }
      } catch {
        /* ignore */
      }
      return {
        codigo: String(flex.CODIGO),
        nombreBd: flex['NOMBRE / APELLIDOS'],
        email,
        empleadoEncontradoFlag: (flex.confianza || 0) >= 80,
        confianza: flex.confianza || 0,
        matchType: flex.matchType || 'flex',
      };
    }

    return {
      codigo: codeTry || null,
      nombreBd: nombreTrim || null,
      email: emailTrim || null,
      empleadoEncontradoFlag: false,
      confianza: 0,
      matchType: 'not_found',
    };
  }

  private async procesarCuadrantesExcelTurnoHorasTablaInner(
    workbook: ExcelJS.Workbook,
    mes: string,
    centro: string,
  ): Promise<{ success: boolean; cuadrantes: any[] }> {
    const tabSheet =
      this.findWorkbookSheetWithTurnoHorasOrHeHsCuatro(workbook) ??
      this.resolveCuadranteWorksheet(workbook);
    const { worksheet, sheetName } = tabSheet;

    const [ys, ms] = mes.split('-');
    const y = parseInt(ys, 10);
    const mo = parseInt(ms, 10);
    const daysInMonth = new Date(y, mo, 0).getDate();

    const heHsLayout = this.tryDetectHeHsCuatroPorDiaHeader(worksheet);
    if (heHsLayout) {
      const { headerRow, dayBlocks } = heHsLayout;
      const firstDataCol = dayBlocks[0].he1;
      const candidateLabelRows = [
        Math.max(1, headerRow - 2),
        headerRow - 1,
        1,
      ].filter((x) => x >= 1 && x < headerRow);
      const uniqRows = [...new Set(candidateLabelRows)];
      let labelRow = uniqRows[0];
      let bestScore = -1;
      for (const tr of uniqRows) {
        const row = worksheet.getRow(tr);
        let score = 0;
        for (let c = 1; c < firstDataCol; c++) {
          const raw = this.cellToPlainString(row.getCell(c)).toLowerCase();
          if (raw.includes('nombre')) {
            score += 2;
          }
          if (raw.includes('codigo') || raw.includes('código')) {
            score += 2;
          }
          if (raw.includes('email') || raw.includes('correo')) {
            score += 1;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          labelRow = tr;
        }
      }
      const { colNombre, colCodigo, colEmail, colCentro } =
        this.mapNombreCodigoEmailCentroCols(
          worksheet,
          labelRow,
          firstDataCol - 1,
        );

      this.logger.log(
        `📄 [turno_horas_tabla] HE/HS×2 sheet="${sheetName}" filaCabecera=${headerRow} nombre@col${colNombre} días=${dayBlocks.length}`,
      );

      const cuadrantes: any[] = [];
      const lastRow = worksheet.rowCount || 600;
      for (let r = headerRow + 1; r <= lastRow; r++) {
        const row = worksheet.getRow(r);
        const nombreVal = this.cellToPlainString(row.getCell(colNombre)).trim();
        const codigoVal = this.cellToPlainString(row.getCell(colCodigo)).trim();
        const emailVal = this.cellToPlainString(row.getCell(colEmail)).trim();
        const centroVal = this.cellToPlainString(row.getCell(colCentro)).trim();

        let anyDay = false;
        for (const b of dayBlocks) {
          if (b.dayNum > daysInMonth) {
            break;
          }
          const s = this.ziValueFromCuatroHeHsCells(
            row,
            b.he1,
            b.hs1,
            b.he2,
            b.hs2,
          );
          if (s && s !== 'LIBRE') {
            anyDay = true;
            break;
          }
        }

        if (!nombreVal && !codigoVal && !emailVal && !anyDay) {
          continue;
        }

        const em = await this.lookupEmpleadoParaTablaTurnoHoras(
          nombreVal,
          codigoVal,
          emailVal,
        );

        const cuadranteData: any = {
          CODIGO: em.codigo || '',
          EMAIL: em.email,
          NOMBRE: em.nombreBd || nombreVal || codigoVal || '',
          LUNA: mes,
          CENTRO: centroVal || centro,
          empleado_encontrado: em.empleadoEncontradoFlag,
          confianza: em.confianza,
          matchType: em.matchType,
        };

        for (let zi = 1; zi <= 31; zi++) {
          cuadranteData[`ZI_${zi}`] = null;
        }

        for (const b of dayBlocks) {
          if (b.dayNum > daysInMonth) {
            break;
          }
          cuadranteData[`ZI_${b.dayNum}`] = this.ziValueFromCuatroHeHsCells(
            row,
            b.he1,
            b.hs1,
            b.he2,
            b.hs2,
          );
        }

        cuadranteData.TotalHoras =
          this.computeTotalHorasCuadranteRow(cuadranteData).toFixed(2);

        cuadrantes.push(cuadranteData);
      }

      this.logger.log(
        `✅ [turno_horas_tabla] HE/HS×2 ${cuadrantes.length} filas procesadas`,
      );
      return { success: true, cuadrantes };
    }

    const { turnoRow, pairs } = this.detectTurnoHorasHeader(worksheet);
    const dayBlocks = this.buildTurnoHorasDayBlocksFromPairs(
      pairs,
      daysInMonth,
    );
    const useDoublePerDay =
      pairs.length > daysInMonth && pairs.length >= 2 * daysInMonth - 2;

    const firstTurnoCol = pairs[0].turnoCol;
    const candidateLabelRows = [
      Math.max(1, turnoRow - 2),
      turnoRow - 1,
      1,
    ].filter((x) => x >= 1 && x < turnoRow);
    const uniqRows = [...new Set(candidateLabelRows)];
    let labelRow = uniqRows[0];
    let bestScore = -1;
    for (const tr of uniqRows) {
      const row = worksheet.getRow(tr);
      let score = 0;
      for (let c = 1; c < firstTurnoCol; c++) {
        const raw = this.cellToPlainString(row.getCell(c)).toLowerCase();
        if (raw.includes('nombre')) {
          score += 2;
        }
        if (raw.includes('codigo') || raw.includes('código')) {
          score += 2;
        }
        if (raw.includes('email') || raw.includes('correo')) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        labelRow = tr;
      }
    }
    const { colNombre, colCodigo, colEmail, colCentro } =
      this.mapNombreCodigoEmailCentroCols(
        worksheet,
        labelRow,
        firstTurnoCol - 1,
      );

    this.logger.log(
      `📄 [turno_horas_tabla] sheet="${sheetName}" filaTurno=${turnoRow} nombre@col${colNombre} codigo@col${colCodigo} pares=${pairs.length} doblePorDia=${useDoublePerDay} bloquesDia=${dayBlocks.length}`,
    );

    const cuadrantes: any[] = [];
    const lastRow = worksheet.rowCount || 600;
    for (let r = turnoRow + 1; r <= lastRow; r++) {
      const row = worksheet.getRow(r);
      const nombreVal = this.cellToPlainString(row.getCell(colNombre)).trim();
      const codigoVal = this.cellToPlainString(row.getCell(colCodigo)).trim();
      const emailVal = this.cellToPlainString(row.getCell(colEmail)).trim();
      const centroVal = this.cellToPlainString(row.getCell(colCentro)).trim();

      let anyDay = false;
      for (const p of pairs) {
        const t = this.cellToPlainString(row.getCell(p.turnoCol)).trim();
        const h = this.cellToPlainString(row.getCell(p.horasCol)).trim();
        const hn = parseFloat(h.replace(/h/gi, '').replace(',', '.').trim());
        if (t && t !== '-') {
          anyDay = true;
          break;
        }
        if (h && !isNaN(hn) && hn > 0) {
          anyDay = true;
          break;
        }
      }

      if (!nombreVal && !codigoVal && !emailVal && !anyDay) {
        continue;
      }

      const em = await this.lookupEmpleadoParaTablaTurnoHoras(
        nombreVal,
        codigoVal,
        emailVal,
      );

      const cuadranteData: any = {
        CODIGO: em.codigo || '',
        EMAIL: em.email,
        NOMBRE: em.nombreBd || nombreVal || codigoVal || '',
        LUNA: mes,
        CENTRO: centroVal || centro,
        empleado_encontrado: em.empleadoEncontradoFlag,
        confianza: em.confianza,
        matchType: em.matchType,
      };

      for (let zi = 1; zi <= 31; zi++) {
        cuadranteData[`ZI_${zi}`] = null;
      }

      for (const b of dayBlocks) {
        if (b.dayNum > daysInMonth) {
          break;
        }
        if (b.turno1 == null || b.horas1 == null) {
          cuadranteData[`ZI_${b.dayNum}`] = 'LIBRE';
          continue;
        }
        const turnoCell1 = row.getCell(b.turno1).value;
        const horasCell1 = row.getCell(b.horas1).value;
        if (b.turno2 != null && b.horas2 != null) {
          const turnoCell2 = row.getCell(b.turno2).value;
          const horasCell2 = row.getCell(b.horas2).value;
          cuadranteData[`ZI_${b.dayNum}`] = this.mergeZiFromTwoTurnoHorasPairs(
            turnoCell1,
            horasCell1,
            turnoCell2,
            horasCell2,
          );
        } else {
          cuadranteData[`ZI_${b.dayNum}`] = this.ziValueFromTurnoHorasCells(
            turnoCell1,
            horasCell1,
          );
        }
      }

      cuadranteData.TotalHoras =
        this.computeTotalHorasCuadranteRow(cuadranteData).toFixed(2);

      cuadrantes.push(cuadranteData);
    }

    this.logger.log(
      `✅ [turno_horas_tabla] ${cuadrantes.length} filas procesadas`,
    );
    return { success: true, cuadrantes };
  }

  private async procesarCuadrantesExcelCeldasMultilineaInner(
    workbook: ExcelJS.Workbook,
    mes: string,
    centro: string,
  ): Promise<{ success: boolean; cuadrantes: any[] }> {
    const { worksheet, sheetName, headers, columnToDayMap, maxColumns } =
      this.loadCuadranteExcelLayout(workbook);

    this.logger.log(
      `📄 [celdas_multilinea] sheet: "${sheetName}", días: ${Object.keys(columnToDayMap).length}`,
    );

    type RowAcc = { trabajador: string; colByZiKey: Record<string, string> };
    const pending: RowAcc[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) {
        return;
      }
      const trabajador = this.cellToPlainString(row.getCell(1)).trim();
      if (
        !trabajador ||
        trabajador === 'TOTAL' ||
        trabajador === 'DIAS DE LA SEMANA' ||
        trabajador === 'TURNO'
      ) {
        return;
      }
      if (trabajador === 'M' || trabajador === 'T' || trabajador.length <= 1) {
        return;
      }

      const colByZiKey: Record<string, string> = {};
      for (let colNumber = 1; colNumber <= maxColumns; colNumber++) {
        const header = headers[colNumber - 1];
        if (!header || !String(header).startsWith('ZI_')) {
          continue;
        }
        colByZiKey[header] = this.cellValueToCuadranteInputString(
          row.getCell(colNumber),
        );
      }
      pending.push({ trabajador, colByZiKey });
    });

    const cuadrantes: any[] = [];

    for (const pr of pending) {
      const empleadoMatch = await this.gestoriaService.findEmpleadoFlexible(
        pr.trabajador,
        null,
        null,
      );

      let codigo: string | null = null;
      let nombreBd: string | null = null;
      let email: string | null = null;
      let empleadoEncontradoFlag = false;
      let confianza = 0;
      let matchType = 'not_found';

      if (empleadoMatch) {
        codigo = empleadoMatch.CODIGO;
        nombreBd = empleadoMatch['NOMBRE / APELLIDOS'] || null;
        confianza = empleadoMatch.confianza || 0;
        matchType = empleadoMatch.matchType || 'unknown';
        empleadoEncontradoFlag = confianza >= 80;

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
            }
          } catch (err) {
            this.logger.warn(
              `⚠️ [celdas_multilinea] Email lookup ${codigo}: ${err}`,
            );
          }
        }
      }

      const cuadranteData: any = {
        CODIGO: codigo || '',
        EMAIL: email || null,
        NOMBRE: nombreBd || pr.trabajador,
        LUNA: mes,
        CENTRO: centro,
        empleado_encontrado: empleadoEncontradoFlag,
        confianza,
        matchType,
      };

      for (let zi = 1; zi <= 31; zi++) {
        cuadranteData[`ZI_${zi}`] = null;
      }

      for (const ziKey of Object.keys(columnToDayMap)) {
        const raw = pr.colByZiKey[ziKey] || '';
        const parsed = this.parseCeldaCuadranteMultilinea(raw);
        const dayNum = columnToDayMap[ziKey];
        let finalVal: string | null;
        if (parsed !== null) {
          finalVal = parsed;
        } else if (raw.trim()) {
          finalVal = raw.trim();
        } else {
          finalVal = 'LIBRE';
        }
        cuadranteData[`ZI_${dayNum}`] = finalVal;
      }

      cuadranteData.TotalHoras =
        this.computeTotalHorasCuadranteRow(cuadranteData).toFixed(2);

      cuadrantes.push(cuadranteData);
    }

    this.logger.log(
      `✅ [celdas_multilinea] ${cuadrantes.length} cuadrantes procesados`,
    );

    return { success: true, cuadrantes };
  }

  /**
   * Procesează Excel cu cuadrantes
   * Parsează Excel-ul cu structura identificată (2 linii header, nume angajați, HE/HS)
   */
  async procesarCuadrantesExcel(
    fileBuffer: Buffer | ArrayBuffer,
    mes: string,
    centro: string,
    opts?: {
      excelFormat?:
        | 'he_hs'
        | 'celdas_multilinea'
        | 'turno_horas_tabla'
        | 'auto';
    },
  ): Promise<{
    success: boolean;
    excelFormatUsed?: 'he_hs' | 'celdas_multilinea' | 'turno_horas_tabla';
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
        `📊 Procesando Excel cuadrantes - mes: ${mes}, centro: ${centro}, formato: ${opts?.excelFormat || 'he_hs'}`,
      );

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer as any);

      let resolvedFormat: 'he_hs' | 'celdas_multilinea' | 'turno_horas_tabla';
      if (opts?.excelFormat === 'auto') {
        resolvedFormat = this.detectCuadranteExcelFormat(workbook);
        this.logger.log(
          `🔍 Formato Excel detectado automáticamente: ${resolvedFormat}`,
        );
      } else if (opts?.excelFormat === 'turno_horas_tabla') {
        resolvedFormat = 'turno_horas_tabla';
      } else if (opts?.excelFormat === 'celdas_multilinea') {
        resolvedFormat = 'celdas_multilinea';
      } else {
        resolvedFormat = 'he_hs';
      }

      if (resolvedFormat === 'turno_horas_tabla') {
        const r = await this.procesarCuadrantesExcelTurnoHorasTablaInner(
          workbook,
          mes,
          centro,
        );
        return { ...r, excelFormatUsed: resolvedFormat };
      }

      if (resolvedFormat === 'celdas_multilinea') {
        const r = await this.procesarCuadrantesExcelCeldasMultilineaInner(
          workbook,
          mes,
          centro,
        );
        return { ...r, excelFormatUsed: resolvedFormat };
      }

      const { worksheet, sheetName, headers, columnToDayMap } =
        this.loadCuadranteExcelLayout(workbook);

      this.logger.log(`📄 Procesez sheet: "${sheetName}"`);
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

      /**
       * Celdas compartidas (merge) en columna TRABAJADOR: Excel suele dejar vacío el nombre en las
       * filas siguientes del mismo empleado (M/HE, M/HS, T/HE, T/HS). Sin esto, esas filas se saltan
       * y se pierde el par HE+HS → preview raro o solo "T1" sin rango.
       */
      let ultimoNombreTrabajador = '';
      /** Bosquepino: fila HS deja TURNO vacío; sigue a la última M o T explícita. */
      let ultimoBandaTurno: 'M' | 'T' | null = null;
      let nombrePrevioGrupo = '';

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        let trabajador = String(row[trabajadorHeader] || '').trim();
        const turno = row[turnoHeader] || '';
        const turnoTrim = String(turno).trim();

        if (
          !trabajador &&
          ultimoNombreTrabajador &&
          (turnoTrim === 'M' || turnoTrim === 'T')
        ) {
          trabajador = ultimoNombreTrabajador;
          row[trabajadorHeader] = ultimoNombreTrabajador;
        }

        // Ignorăm rândurile cu TRABAJADOR gol, TOTAL sau DIAS DE LA SEMANA
        if (
          !trabajador ||
          trabajador === 'TOTAL' ||
          trabajador === 'DIAS DE LA SEMANA' ||
          trabajador === 'TURNO'
        ) {
          continue;
        }

        const nombre = trabajador;

        // Ignorăm rândurile unde TRABAJADOR este "M" sau "T" (acestea sunt label-uri pentru TURNO, nu nume)
        if (nombre === 'M' || nombre === 'T' || nombre.length <= 1) {
          continue;
        }

        ultimoNombreTrabajador = nombre;

        if (nombre !== nombrePrevioGrupo) {
          ultimoBandaTurno = null;
          nombrePrevioGrupo = nombre;
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
          } else if (turnoTrim === '') {
            if (
              ultimoBandaTurno === 'M' &&
              this.morningBandHasHeAndHs(empleadoData.turnoM)
            ) {
              if (!isHE && !isHS) {
                if (empleadoData.turnoT.length === 0) {
                  isHE = true;
                } else if (empleadoData.turnoT.length === 1) {
                  isHS = true;
                }
              }
            } else if (ultimoBandaTurno === 'M') {
              if (!isHE && !isHS) {
                if (empleadoData.turnoM.length === 1) {
                  isHS = true;
                } else if (empleadoData.turnoM.length === 0) {
                  isHE = true;
                }
              }
            } else if (ultimoBandaTurno === 'T') {
              if (!isHE && !isHS) {
                if (empleadoData.turnoT.length === 1) {
                  isHS = true;
                } else if (empleadoData.turnoT.length === 0) {
                  isHE = true;
                }
              }
            }
          }
        }

        // Salvăm rândul pentru procesare ulterioară cu flag-ul HE/HS
        if (turnoTrim === 'M') {
          row._isHE = isHE;
          row._isHS = isHS;
          empleadoData.turnoM.push(row);
          ultimoBandaTurno = 'M';
        } else if (turnoTrim === 'T') {
          row._isHE = isHE;
          row._isHS = isHS;
          empleadoData.turnoT.push(row);
          ultimoBandaTurno = 'T';
        } else if (
          turnoTrim === '' &&
          (isHE || isHS) &&
          this.morningBandHasHeAndHs(empleadoData.turnoM) &&
          ultimoBandaTurno === 'M'
        ) {
          // Plantilla CASTILLO: bloque tarde con TURNO vacío antes (o sin) fila T explícita
          row._isHE = isHE;
          row._isHS = isHS;
          empleadoData.turnoT.push(row);
          ultimoBandaTurno = 'T';
        } else if (
          turnoTrim === '' &&
          ultimoBandaTurno === 'M' &&
          (isHE || isHS)
        ) {
          row._isHE = isHE;
          row._isHS = isHS;
          empleadoData.turnoM.push(row);
        } else if (
          turnoTrim === '' &&
          ultimoBandaTurno === 'T' &&
          (isHE || isHS)
        ) {
          row._isHE = isHE;
          row._isHS = isHS;
          empleadoData.turnoT.push(row);
        } else if (turnoTrim === '') {
          this.logger.warn(
            `[cuadrantes-he_hs] Rând HE/HS ignorat (TURNO gol, sin banda M/T previa) — "${nombre.slice(0, 48)}". ` +
              `isHE=${isHE} isHS=${isHS}`,
          );
        } else {
          this.logger.warn(
            `[cuadrantes-he_hs] Rând ignorat — "${nombre.slice(0, 48)}…" TURNO="${turnoTrim}" (doar M și T sunt acceptate).`,
          );
        }
      }

      this.logger.log(`👤 Găsiți ${empleadosMap.size} angajați în Excel`);
      for (const [nom, ed] of empleadosMap.entries()) {
        this.logger.log(
          `[cuadrantes-he_hs] Grup "${nom.slice(0, 56)}": turnoM=${ed.turnoM.length} rânduri, turnoT=${ed.turnoT.length} rânduri`,
        );
      }

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
        const heHsDayStats = {
          p1_t1_m: 0,
          p2_t2: 0,
          p2_t2_fallback: 0,
          p3_t3_same: 0,
          p4_t3_night_span: 0,
          all_libre: 0,
          p5_he_m_only: 0,
          p6_he_t_or_hs_t: 0,
          fallback_libre: 0,
        };

        Object.entries(columnToDayMap).forEach(([ziKey, dayNum]) => {
          const pairsM = this.zipHeHsRowPairs(empleadoData.turnoM);
          const pairsT = this.zipHeHsRowPairs(empleadoData.turnoT);
          const inferM = empleadoData.turnoM.length >= 2;
          const inferT = empleadoData.turnoT.length >= 2;

          const segmentsM = this.buildHeHsIntervalSegmentsForZiKey(
            empleadoData.turnoM,
            ziKey,
            formatTime,
            inferM,
          );
          const segmentsT = this.buildHeHsIntervalSegmentsForZiKey(
            empleadoData.turnoT,
            ziKey,
            formatTime,
            inferT,
          );

          const morningStr =
            this.dedupeOrderedIntervalStrings(segmentsM).join(' / ') || null;
          const afternoonStr =
            this.dedupeOrderedIntervalStrings(segmentsT).join(' / ') || null;

          let combinedDay: string | null = null;
          if (morningStr && afternoonStr) {
            combinedDay = `${morningStr} / ${afternoonStr}`;
            heHsDayStats.p1_t1_m += 1;
            heHsDayStats.p3_t3_same += 1;
          } else if (morningStr) {
            combinedDay = morningStr;
            heHsDayStats.p1_t1_m += 1;
          } else if (afternoonStr) {
            combinedDay = afternoonStr;
            heHsDayStats.p3_t3_same += 1;
          }

          if (combinedDay) {
            cuadranteData[`ZI_${dayNum}`] = combinedDay;
            return;
          }

          const fpM = pairsM[0]
            ? this.formatHeHsPairAtZiKey(
                pairsM[0].heRow,
                pairsM[0].hsRow,
                ziKey,
                formatTime,
                inferM,
              )
            : {
                heStr: null as string | null,
                hsStr: null as string | null,
                heRaw: null as any,
                hsRaw: null as any,
              };
          const fpT = pairsT[0]
            ? this.formatHeHsPairAtZiKey(
                pairsT[0].heRow,
                pairsT[0].hsRow,
                ziKey,
                formatTime,
                inferT,
              )
            : {
                heStr: null as string | null,
                hsStr: null as string | null,
                heRaw: null as any,
                hsRaw: null as any,
              };

          const heStrM = fpM.heStr;
          const hsStrM = fpM.hsStr;
          const heM = fpM.heRaw;
          const hsM = fpM.hsRaw;

          const heStrT = fpT.heStr;
          const hsStrT = fpT.hsStr;
          const heT = fpT.heRaw;
          const hsT = fpT.hsRaw;

          let hsMNextDay: any = null;
          if (dayNum < 31 && empleadoData.turnoM.length >= 1) {
            const nextDayKey = `ZI_${dayNum + 1}`;
            const hsRowForNext =
              pairsM.length >= 1
                ? pairsM[0].hsRow
                : empleadoData.turnoM.find((r) => r._isHS === true) ||
                  empleadoData.turnoM[1];
            const heRowForNext =
              pairsM.length >= 1
                ? pairsM[0].heRow
                : empleadoData.turnoM.find((r) => r._isHE === true) ||
                  empleadoData.turnoM[0];
            hsMNextDay = hsRowForNext[nextDayKey];
            const heMNextRaw = heRowForNext[nextDayKey];
            const mNext = this.tryExtractHeHsPairFromMaybeMergedCell(
              heMNextRaw,
              hsMNextDay,
            );
            if (mNext) {
              hsMNextDay = mNext.he;
            }
          }

          const hsStrMNextDay = hsMNextDay ? formatTime(hsMNextDay) : null;

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
            const turnoT2 = this.mapTimeToTurno(hsStrM, heStrT);
            if (turnoT2 === 'T2') {
              cuadranteData[`ZI_${dayNum}`] = `${turnoT2} ${hsStrM}-${heStrT}`;
              heHsDayStats.p2_t2 += 1;
              return;
            }

            const hsParts = hsStrM.split(':');
            const heParts = heStrT.split(':');
            const hsHour = parseInt(hsParts[0], 10);
            const heHour = parseInt(heParts[0], 10);
            const hsMinutes = hsHour * 60 + parseInt(hsParts[1] || '0', 10);
            const heMinutes = heHour * 60 + parseInt(heParts[1] || '0', 10);
            const durationMinutes = heMinutes - hsMinutes;

            if (
              hsHour >= 14 &&
              hsHour <= 16 &&
              heHour >= 22 &&
              durationMinutes >= 420 &&
              durationMinutes <= 600
            ) {
              cuadranteData[`ZI_${dayNum}`] = `T2 ${hsStrM}-${heStrT}`;
              heHsDayStats.p2_t2_fallback += 1;
              return;
            }
          }

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
              heHsDayStats.p3_t3_same += 1;
              return;
            }
          }

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
            const heParts = heStrT.split(':');
            const hsParts = hsStrMNextDay.split(':');
            const heHour = parseInt(heParts[0], 10);
            const hsHour = parseInt(hsParts[0], 10);

            const isNightShift =
              (heHour >= 22 || (heHour >= 0 && heHour <= 8)) &&
              (hsHour <= 8 || (hsHour >= 22 && heHour < hsHour));

            if (isNightShift) {
              const turnoNocturno = this.mapTimeToTurno(heStrT, hsStrMNextDay);
              if (turnoNocturno) {
                cuadranteData[`ZI_${dayNum}`] =
                  `${turnoNocturno} ${heStrT}-${hsStrMNextDay}`;
                heHsDayStats.p4_t3_night_span += 1;
                return;
              }
            }
          }

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
              heHsDayStats.all_libre += 1;
            } else {
              if (heStrM && heStrM !== 'LIBRE' && heM !== 'L') {
                const turno = this.mapTimeToTurno(heStrM, undefined);
                if (turno && turno !== 'LIBRE') {
                  // Solo HE: guardar T1/T2/T3 (sin intervalo). Evitar "T1 07:30" sin HS: el preview y TotalHoras dan 0h.
                  cuadranteData[`ZI_${dayNum}`] = turno;
                  heHsDayStats.p5_he_m_only += 1;
                }
              }

              if (
                !cuadranteData[`ZI_${dayNum}`] ||
                cuadranteData[`ZI_${dayNum}`] === null
              ) {
                if (heStrT && heStrT !== 'LIBRE' && heT !== 'L') {
                  const turno = this.mapTimeToTurno(heStrT, undefined);
                  if (turno && turno !== 'LIBRE') {
                    cuadranteData[`ZI_${dayNum}`] = turno;
                    heHsDayStats.p6_he_t_or_hs_t += 1;
                  }
                } else if (hsStrT && hsStrT !== 'LIBRE' && hsT !== 'L') {
                  const turno = this.mapTimeToTurno(undefined, hsStrT);
                  if (turno && turno !== 'LIBRE') {
                    cuadranteData[`ZI_${dayNum}`] = turno;
                    heHsDayStats.p6_he_t_or_hs_t += 1;
                  }
                }
              }

              if (
                !cuadranteData[`ZI_${dayNum}`] ||
                cuadranteData[`ZI_${dayNum}`] === null
              ) {
                cuadranteData[`ZI_${dayNum}`] = 'LIBRE';
                heHsDayStats.fallback_libre += 1;
              }
            }
          }
        });

        this.logger.log(
          `[cuadrantes-he_hs] Rezolvare zile "${String(nombre).slice(0, 52)}": ` +
            `P1_T1_M=${heHsDayStats.p1_t1_m} P2_T2=${heHsDayStats.p2_t2} P2_T2_fb=${heHsDayStats.p2_t2_fallback} ` +
            `P3_T3_same=${heHsDayStats.p3_t3_same} P4_T3_night=${heHsDayStats.p4_t3_night_span} all_LIBRE=${heHsDayStats.all_libre} ` +
            `P5_soloHE_M=${heHsDayStats.p5_he_m_only} P6_soloT=${heHsDayStats.p6_he_t_or_hs_t} fallback_LIBRE=${heHsDayStats.fallback_libre}`,
        );

        const totalHoras = this.computeTotalHorasCuadranteRow(cuadranteData);
        cuadranteData.TotalHoras = totalHoras.toFixed(2);

        cuadrantes.push(cuadranteData);
      }

      this.logger.log(`✅ Procesate ${cuadrantes.length} cuadrantes din Excel`);

      return {
        success: true,
        cuadrantes,
        excelFormatUsed: resolvedFormat,
      };
    } catch (error: any) {
      this.logger.error('❌ Error procesando Excel cuadrantes:', error);
      throw new BadRequestException(
        `Error al procesar Excel: ${error.message}`,
      );
    }
  }
}
