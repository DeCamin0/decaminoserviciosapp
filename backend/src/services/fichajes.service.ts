import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FichajeRegularizacionService } from './fichaje-regularizacion.service';

@Injectable()
export class FichajesService {
  private readonly logger = new Logger(FichajesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FichajeRegularizacionService))
    private readonly regularizacionService?: FichajeRegularizacionService,
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
    const escaped = str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }

  /**
   * Obtine lista de registros (fichajes) cu filtrare pe CODIGO și MES
   */
  async getRegistros(codigo: string, mes: string): Promise<any[]> {
    try {
      if (!codigo || codigo.trim() === '') {
        throw new BadRequestException('CODIGO is required');
      }

      if (!mes || mes.trim() === '') {
        throw new BadRequestException('MES is required');
      }

      const codigoClean = codigo.trim();
      const mesClean = mes.trim();

      // Validăm formatul MES (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(mesClean)) {
        throw new BadRequestException(
          'MES must be in format YYYY-MM (e.g., 2025-12)',
        );
      }

      // Construim query-ul SQL similar cu n8n
      // FECHA >= prima zi a lunii (MES-01)
      // FECHA < prima zi a lunii următoare (MES+1 lună)
      // LEFT JOIN cu FichajeRegularizacion pentru a obține effective_minutes
      // Include atât CONFIRMED cât și REJECTED (ambele au effective_minutes setat)
      // Include has_regularizacion pentru a detecta dacă există o regularizare (indiferent de status)
      const query = `
        SELECT 
          f.*,
          CASE 
            WHEN fr_confirmed.status IN ('CONFIRMED', 'REJECTED') AND fr_confirmed.effective_minutes IS NOT NULL 
            THEN fr_confirmed.effective_minutes
            ELSE NULL
          END AS effective_minutes,
          CASE 
            WHEN fr_confirmed.status IN ('CONFIRMED', 'REJECTED') AND fr_confirmed.effective_minutes IS NOT NULL 
            THEN CONCAT(
              LPAD(FLOOR(fr_confirmed.effective_minutes / 60), 2, '0'), ':',
              LPAD(fr_confirmed.effective_minutes % 60, 2, '0'), ':00'
            )
            ELSE NULL
          END AS effective_duration,
          CASE 
            WHEN fr_any.id IS NOT NULL THEN 1
            ELSE 0
          END AS has_regularizacion
        FROM Fichaje f
        LEFT JOIN FichajeRegularizacion fr_confirmed
          ON fr_confirmed.employee_codigo = f.CODIGO
          AND (
            -- Prioritate 1: Dacă fichaje_ids este setat și nu este gol, folosim DOAR fichaje_ids
            (fr_confirmed.fichaje_ids IS NOT NULL 
             AND fr_confirmed.fichaje_ids != '[]'
             AND fr_confirmed.fichaje_ids != ''
             AND (fr_confirmed.fichaje_ids LIKE CONCAT('%"', f.ID, '"%')
                  OR fr_confirmed.fichaje_ids LIKE CONCAT('%', f.ID, '%')))
            -- Fallback: Dacă fichaje_ids este NULL sau gol, folosim window_start/window_end
            OR ((fr_confirmed.fichaje_ids IS NULL 
                 OR fr_confirmed.fichaje_ids = '[]'
                 OR fr_confirmed.fichaje_ids = '')
                AND STR_TO_DATE(CONCAT(f.FECHA, ' ', f.HORA), '%Y-%m-%d %H:%i:%s') >= fr_confirmed.window_start
                AND STR_TO_DATE(CONCAT(f.FECHA, ' ', f.HORA), '%Y-%m-%d %H:%i:%s') <= fr_confirmed.window_end)
          )
          AND fr_confirmed.status IN ('CONFIRMED', 'REJECTED')
          AND fr_confirmed.effective_minutes IS NOT NULL
        LEFT JOIN FichajeRegularizacion fr_any
          ON fr_any.employee_codigo = f.CODIGO
          AND (
            -- Prioritate 1: Dacă fichaje_ids este setat și nu este gol, folosim DOAR fichaje_ids
            (fr_any.fichaje_ids IS NOT NULL 
             AND fr_any.fichaje_ids != '[]'
             AND fr_any.fichaje_ids != ''
             AND (fr_any.fichaje_ids LIKE CONCAT('%"', f.ID, '"%')
                  OR fr_any.fichaje_ids LIKE CONCAT('%', f.ID, '%')))
            -- Fallback: Dacă fichaje_ids este NULL sau gol, folosim window_start/window_end
            OR ((fr_any.fichaje_ids IS NULL 
                 OR fr_any.fichaje_ids = '[]'
                 OR fr_any.fichaje_ids = '')
                AND STR_TO_DATE(CONCAT(f.FECHA, ' ', f.HORA), '%Y-%m-%d %H:%i:%s') >= fr_any.window_start
                AND STR_TO_DATE(CONCAT(f.FECHA, ' ', f.HORA), '%Y-%m-%d %H:%i:%s') <= fr_any.window_end)
          )
        WHERE f.CODIGO = ${this.escapeSql(codigoClean)}
          AND f.FECHA >= STR_TO_DATE(CONCAT(${this.escapeSql(mesClean)}, '-01'), '%Y-%m-%d')
          AND f.FECHA < DATE_ADD(STR_TO_DATE(CONCAT(${this.escapeSql(mesClean)}, '-01'), '%Y-%m-%d'), INTERVAL 1 MONTH)
        ORDER BY f.FECHA DESC, f.HORA DESC
      `;

      // Adăugăm și regularizările NO_PUNCH (fără fichajes) care sunt CONFIRMED
      // Acestea nu apar în query-ul principal pentru că nu există recorduri în Fichaje
      const noPunchRegularizacionesQuery = `
        SELECT 
          NULL AS ID,
          fr.employee_codigo AS CODIGO,
          NULL AS nombre,
          NULL AS email,
          'Salida' AS TIPO,
          '00:00:00' AS HORA,
          DATE_FORMAT(fr.workday_date, '%Y-%m-%d') AS FECHA,
          NULL AS address,
          NULL AS modificatDe,
          NULL AS data,
          NULL AS motivo,
          NULL AS DURACION,
          fr.effective_minutes,
          CONCAT(
            LPAD(FLOOR(fr.effective_minutes / 60), 2, '0'), ':',
            LPAD(fr.effective_minutes % 60, 2, '0'), ':00'
          ) AS effective_duration,
          1 AS has_regularizacion
        FROM FichajeRegularizacion fr
        WHERE fr.employee_codigo = ${this.escapeSql(codigoClean)}
          AND fr.workday_date >= STR_TO_DATE(CONCAT(${this.escapeSql(mesClean)}, '-01'), '%Y-%m-%d')
          AND fr.workday_date < DATE_ADD(STR_TO_DATE(CONCAT(${this.escapeSql(mesClean)}, '-01'), '%Y-%m-%d'), INTERVAL 1 MONTH)
          AND fr.status = 'CONFIRMED'
          AND fr.effective_minutes IS NOT NULL
          AND (
            -- Include doar regularizările NO_PUNCH (fără fichajes)
            (fr.fichaje_ids IS NULL OR fr.fichaje_ids = '[]' OR fr.fichaje_ids = '')
            AND fr.regularization_type = 'NO_PUNCH'
          )
          -- Exclude zilele care au deja fichajes (pentru a evita duplicate)
          AND NOT EXISTS (
            SELECT 1
            FROM Fichaje f
            WHERE f.CODIGO = fr.employee_codigo
              AND DATE(f.FECHA) = fr.workday_date
          )
      `;

      const noPunchRows = await this.prisma.$queryRawUnsafe<any[]>(
        noPunchRegularizacionesQuery,
      );

      // Combinăm rezultatele
      const rows = [
        ...(await this.prisma.$queryRawUnsafe<any[]>(query)),
        ...noPunchRows,
      ];

      // Debug: verifică dacă există effective_duration în răspuns
      const rowsWithEffective = rows.filter(
        (r) => r.effective_duration || r.effective_minutes,
      );
      if (rowsWithEffective.length > 0) {
        this.logger.log(
          `🔍 Found ${rowsWithEffective.length} registros with effective_duration/effective_minutes`,
        );
        this.logger.debug(
          `Sample row with effective: ${JSON.stringify(rowsWithEffective[0], null, 2)}`,
        );
      } else {
        // Debug: verifică dacă există regularizări pentru acest codigo și lună
        const checkRegularizacionQuery = `
          SELECT 
            id,
            employee_codigo,
            workday_date,
            status,
            effective_minutes
          FROM FichajeRegularizacion
          WHERE employee_codigo = ${this.escapeSql(codigoClean)}
            AND workday_date >= STR_TO_DATE(CONCAT(${this.escapeSql(mesClean)}, '-01'), '%Y-%m-%d')
            AND workday_date < DATE_ADD(STR_TO_DATE(CONCAT(${this.escapeSql(mesClean)}, '-01'), '%Y-%m-%d'), INTERVAL 1 MONTH)
        `;
        const regularizaciones = await this.prisma.$queryRawUnsafe<any[]>(
          checkRegularizacionQuery,
        );
        this.logger.debug(
          `🔍 Found ${regularizaciones.length} regularizaciones for codigo ${codigoClean} in month ${mesClean}`,
        );
        if (regularizaciones.length > 0) {
          this.logger.debug(
            `Regularizaciones: ${JSON.stringify(regularizaciones, null, 2)}`,
          );
          // Verifică dacă JOIN-ul funcționează corect pentru prima regularizare
          const firstReg = regularizaciones[0];
          // Convert workday_date to string format YYYY-MM-DD
          const workdayDateStr =
            firstReg.workday_date instanceof Date
              ? firstReg.workday_date.toISOString().split('T')[0]
              : firstReg.workday_date;
          const testJoinQuery = `
            SELECT 
              f.FECHA,
              f.CODIGO,
              STR_TO_DATE(f.FECHA, '%Y-%m-%d') AS fecha_parsed,
              fr.workday_date,
              fr.status,
              fr.effective_minutes,
              CASE 
                WHEN fr.status = 'CONFIRMED' AND fr.effective_minutes IS NOT NULL 
                THEN CONCAT(
                  LPAD(FLOOR(fr.effective_minutes / 60), 2, '0'), ':',
                  LPAD(fr.effective_minutes % 60, 2, '0'), ':00'
                )
                ELSE NULL
              END AS effective_duration
            FROM Fichaje f
            LEFT JOIN FichajeRegularizacion fr
              ON fr.employee_codigo = f.CODIGO
              AND fr.workday_date = STR_TO_DATE(f.FECHA, '%Y-%m-%d')
              AND fr.status = 'CONFIRMED'
            WHERE f.CODIGO = ${this.escapeSql(codigoClean)}
              AND f.FECHA = ${this.escapeSql(workdayDateStr)}
            LIMIT 5
          `;
          const testJoin =
            await this.prisma.$queryRawUnsafe<any[]>(testJoinQuery);
          this.logger.debug(
            `Test JOIN result: ${JSON.stringify(testJoin, null, 2)}`,
          );
        }
      }

      this.logger.log(
        `✅ Registros retrieved: ${rows.length} records (codigo: ${codigoClean}, mes: ${mesClean})`,
      );

      return rows;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving registros:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener registros: ${error.message}`,
      );
    }
  }

  /**
   * Obtine ultimul marcaj (fichaje) pentru un codigo dat, indiferent de lună
   * Folosit pentru a verifica dacă există un turn deschis
   */
  async getUltimoRegistro(codigo: string): Promise<any | null> {
    try {
      if (!codigo || codigo.trim() === '') {
        throw new BadRequestException('CODIGO is required');
      }

      const codigoClean = codigo.trim();

      // Query SQL: ultimul marcaj pentru codigo dat, ordonat după FECHA și HORA
      const query = `
        SELECT *
        FROM Fichaje
        WHERE CODIGO = ${this.escapeSql(codigoClean)}
        ORDER BY FECHA DESC, HORA DESC
        LIMIT 1
      `;

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(
        `✅ Ultimo registro retrieved: ${rows.length > 0 ? 'found' : 'not found'} (codigo: ${codigoClean})`,
      );

      return rows.length > 0 ? rows[0] : null;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving ultimo registro:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener ultimo registro: ${error.message}`,
      );
    }
  }

  /**
   * Obtine toate registros (fichajes) pentru TOȚI angajații pentru o lună specifică
   * Folosit pentru manageri/supervisori pentru a vedea toate marcajele dintr-o lună
   */
  async getRegistrosEmpleados(mes: string): Promise<any[]> {
    try {
      if (!mes || mes.trim() === '') {
        throw new BadRequestException('mes is required');
      }

      const mesClean = mes.trim();

      // Validăm formatul MES (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(mesClean)) {
        throw new BadRequestException(
          'mes must be in format YYYY-MM (e.g., 2025-12)',
        );
      }

      // Query SQL: toate registros pentru luna specificată (FĂRĂ filtrare pe CODIGO)
      // Include effective_duration din FichajeRegularizacion
      // Include has_regularizacion pentru a detecta dacă există o regularizare (indiferent de status)
      const query = `
        SELECT 
          f.*,
          CASE 
            WHEN fr_confirmed.status IN ('CONFIRMED', 'REJECTED') AND fr_confirmed.effective_minutes IS NOT NULL 
            THEN fr_confirmed.effective_minutes
            ELSE NULL
          END AS effective_minutes,
          CASE 
            WHEN fr_confirmed.status IN ('CONFIRMED', 'REJECTED') AND fr_confirmed.effective_minutes IS NOT NULL 
            THEN CONCAT(
              LPAD(FLOOR(fr_confirmed.effective_minutes / 60), 2, '0'), ':',
              LPAD(fr_confirmed.effective_minutes % 60, 2, '0'), ':00'
            )
            ELSE NULL
          END AS effective_duration,
          CASE 
            WHEN fr_any.id IS NOT NULL THEN 1
            ELSE 0
          END AS has_regularizacion
        FROM Fichaje f
        LEFT JOIN FichajeRegularizacion fr_confirmed
          ON fr_confirmed.employee_codigo = f.CODIGO
          AND (
            -- Prioritate 1: Dacă fichaje_ids este setat și nu este gol, folosim DOAR fichaje_ids
            (fr_confirmed.fichaje_ids IS NOT NULL 
             AND fr_confirmed.fichaje_ids != '[]'
             AND fr_confirmed.fichaje_ids != ''
             AND (fr_confirmed.fichaje_ids LIKE CONCAT('%"', f.ID, '"%')
                  OR fr_confirmed.fichaje_ids LIKE CONCAT('%', f.ID, '%')))
            -- Fallback: Dacă fichaje_ids este NULL sau gol, folosim window_start/window_end
            OR ((fr_confirmed.fichaje_ids IS NULL 
                 OR fr_confirmed.fichaje_ids = '[]'
                 OR fr_confirmed.fichaje_ids = '')
                AND STR_TO_DATE(CONCAT(f.FECHA, ' ', f.HORA), '%Y-%m-%d %H:%i:%s') >= fr_confirmed.window_start
                AND STR_TO_DATE(CONCAT(f.FECHA, ' ', f.HORA), '%Y-%m-%d %H:%i:%s') <= fr_confirmed.window_end)
          )
          AND fr_confirmed.status IN ('CONFIRMED', 'REJECTED')
          AND fr_confirmed.effective_minutes IS NOT NULL
        LEFT JOIN FichajeRegularizacion fr_any
          ON fr_any.employee_codigo = f.CODIGO
          AND (
            -- Prioritate 1: Dacă fichaje_ids este setat și nu este gol, folosim DOAR fichaje_ids
            (fr_any.fichaje_ids IS NOT NULL 
             AND fr_any.fichaje_ids != '[]'
             AND fr_any.fichaje_ids != ''
             AND (fr_any.fichaje_ids LIKE CONCAT('%"', f.ID, '"%')
                  OR fr_any.fichaje_ids LIKE CONCAT('%', f.ID, '%')))
            -- Fallback: Dacă fichaje_ids este NULL sau gol, folosim window_start/window_end
            OR ((fr_any.fichaje_ids IS NULL 
                 OR fr_any.fichaje_ids = '[]'
                 OR fr_any.fichaje_ids = '')
                AND STR_TO_DATE(CONCAT(f.FECHA, ' ', f.HORA), '%Y-%m-%d %H:%i:%s') >= fr_any.window_start
                AND STR_TO_DATE(CONCAT(f.FECHA, ' ', f.HORA), '%Y-%m-%d %H:%i:%s') <= fr_any.window_end)
          )
        WHERE f.FECHA >= STR_TO_DATE(CONCAT(${this.escapeSql(mesClean)}, '-01'), '%Y-%m-%d')
          AND f.FECHA < DATE_ADD(STR_TO_DATE(CONCAT(${this.escapeSql(mesClean)}, '-01'), '%Y-%m-%d'), INTERVAL 1 MONTH)
        ORDER BY f.FECHA DESC, f.HORA DESC
      `;

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      // Debug: verifică dacă există registre cu effective_duration sau has_regularizacion
      const withEffective = rows.filter(
        (r: any) => r.effective_duration || r.effective_minutes,
      );
      const withRegularizacion = rows.filter(
        (r: any) => r.has_regularizacion === 1 || r.has_regularizacion === true,
      );

      if (withEffective.length > 0) {
        this.logger.log(
          `🔍 Found ${withEffective.length} registros with effective_duration/effective_minutes`,
        );
        this.logger.debug(
          `Sample row with effective:`,
          JSON.stringify(withEffective[0], null, 2),
        );
      }

      if (withRegularizacion.length > 0) {
        this.logger.log(
          `🔍 Found ${withRegularizacion.length} registros with has_regularizacion=1`,
        );
      } else {
        // Debug: verifică dacă există regularizări pentru această lună
        const checkRegQuery = `
          SELECT 
            id,
            employee_codigo,
            workday_date,
            window_start,
            window_end,
            status,
            effective_minutes
          FROM FichajeRegularizacion
          WHERE workday_date >= STR_TO_DATE(CONCAT(${this.escapeSql(mesClean)}, '-01'), '%Y-%m-%d')
            AND workday_date < DATE_ADD(STR_TO_DATE(CONCAT(${this.escapeSql(mesClean)}, '-01'), '%Y-%m-%d'), INTERVAL 1 MONTH)
          LIMIT 5
        `;
        const regs = await this.prisma.$queryRawUnsafe<any[]>(checkRegQuery);
        if (regs.length > 0) {
          this.logger.warn(
            `⚠️ Found ${regs.length} regularizaciones in DB but JOIN didn't match! Sample: ${JSON.stringify(regs[0], null, 2)}`,
          );
        }
      }

      this.logger.log(
        `✅ Registros empleados retrieved: ${rows.length} records (mes: ${mesClean})`,
      );

      return rows;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving registros empleados:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener registros empleados: ${error.message}`,
      );
    }
  }

  /**
   * Obtine registros pentru o perioadă personalizată (fecha_inicio - fecha_fin)
   * Poate fi filtrat opțional pe un codigo specific
   */
  async getRegistrosPeriodo(
    fechaInicio: string,
    fechaFin: string,
    codigo?: string,
  ): Promise<any[]> {
    try {
      if (!fechaInicio || fechaInicio.trim() === '') {
        throw new BadRequestException('fecha_inicio is required');
      }

      if (!fechaFin || fechaFin.trim() === '') {
        throw new BadRequestException('fecha_fin is required');
      }

      const fechaInicioClean = fechaInicio.trim();
      const fechaFinClean = fechaFin.trim();
      const codigoClean = codigo?.trim();

      // Validăm formatul datelor (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicioClean)) {
        throw new BadRequestException(
          'fecha_inicio must be in format YYYY-MM-DD (e.g., 2025-12-01)',
        );
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaFinClean)) {
        throw new BadRequestException(
          'fecha_fin must be in format YYYY-MM-DD (e.g., 2025-12-31)',
        );
      }

      // Validăm că fecha_inicio <= fecha_fin
      const dateInicio = new Date(fechaInicioClean);
      const dateFin = new Date(fechaFinClean);
      if (dateInicio > dateFin) {
        throw new BadRequestException(
          'fecha_inicio must be less than or equal to fecha_fin',
        );
      }

      // Construim query-ul SQL cu LEFT JOIN pentru effective_minutes
      // Include has_regularizacion pentru a detecta dacă există o regularizare (indiferent de status)
      let query = `
        SELECT 
          f.*,
          CASE 
            WHEN fr_confirmed.status IN ('CONFIRMED', 'REJECTED') AND fr_confirmed.effective_minutes IS NOT NULL 
            THEN fr_confirmed.effective_minutes
            ELSE NULL
          END AS effective_minutes,
          CASE 
            WHEN fr_confirmed.status IN ('CONFIRMED', 'REJECTED') AND fr_confirmed.effective_minutes IS NOT NULL 
            THEN CONCAT(
              LPAD(FLOOR(fr_confirmed.effective_minutes / 60), 2, '0'), ':',
              LPAD(fr_confirmed.effective_minutes % 60, 2, '0'), ':00'
            )
            ELSE NULL
          END AS effective_duration,
          CASE 
            WHEN fr_any.id IS NOT NULL THEN 1
            ELSE 0
          END AS has_regularizacion
        FROM Fichaje f
        LEFT JOIN FichajeRegularizacion fr_confirmed
          ON fr_confirmed.employee_codigo = f.CODIGO
          AND (
            -- Prioritate 1: Dacă fichaje_ids este setat și nu este gol, folosim DOAR fichaje_ids
            (fr_confirmed.fichaje_ids IS NOT NULL 
             AND fr_confirmed.fichaje_ids != '[]'
             AND fr_confirmed.fichaje_ids != ''
             AND (fr_confirmed.fichaje_ids LIKE CONCAT('%"', f.ID, '"%')
                  OR fr_confirmed.fichaje_ids LIKE CONCAT('%', f.ID, '%')))
            -- Fallback: Dacă fichaje_ids este NULL sau gol, folosim window_start/window_end
            OR ((fr_confirmed.fichaje_ids IS NULL 
                 OR fr_confirmed.fichaje_ids = '[]'
                 OR fr_confirmed.fichaje_ids = '')
                AND STR_TO_DATE(CONCAT(f.FECHA, ' ', f.HORA), '%Y-%m-%d %H:%i:%s') >= fr_confirmed.window_start
                AND STR_TO_DATE(CONCAT(f.FECHA, ' ', f.HORA), '%Y-%m-%d %H:%i:%s') <= fr_confirmed.window_end)
          )
          AND fr_confirmed.status IN ('CONFIRMED', 'REJECTED')
          AND fr_confirmed.effective_minutes IS NOT NULL
        LEFT JOIN FichajeRegularizacion fr_any
          ON fr_any.employee_codigo = f.CODIGO
          AND (
            -- Prioritate 1: Dacă fichaje_ids este setat și nu este gol, folosim DOAR fichaje_ids
            (fr_any.fichaje_ids IS NOT NULL 
             AND fr_any.fichaje_ids != '[]'
             AND fr_any.fichaje_ids != ''
             AND (fr_any.fichaje_ids LIKE CONCAT('%"', f.ID, '"%')
                  OR fr_any.fichaje_ids LIKE CONCAT('%', f.ID, '%')))
            -- Fallback: Dacă fichaje_ids este NULL sau gol, folosim window_start/window_end
            OR ((fr_any.fichaje_ids IS NULL 
                 OR fr_any.fichaje_ids = '[]'
                 OR fr_any.fichaje_ids = '')
                AND STR_TO_DATE(CONCAT(f.FECHA, ' ', f.HORA), '%Y-%m-%d %H:%i:%s') >= fr_any.window_start
                AND STR_TO_DATE(CONCAT(f.FECHA, ' ', f.HORA), '%Y-%m-%d %H:%i:%s') <= fr_any.window_end)
          )
        WHERE f.FECHA >= STR_TO_DATE(${this.escapeSql(fechaInicioClean)}, '%Y-%m-%d')
          AND f.FECHA <= STR_TO_DATE(${this.escapeSql(fechaFinClean)}, '%Y-%m-%d')
      `;

      // Dacă este specificat codigo, adăugăm filtrare
      if (codigoClean && codigoClean !== '') {
        query += ` AND f.CODIGO = ${this.escapeSql(codigoClean)}`;
      }

      query += ` ORDER BY f.FECHA DESC, f.HORA DESC`;

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(
        `✅ Registros periodo retrieved: ${rows.length} records (fecha_inicio: ${fechaInicioClean}, fecha_fin: ${fechaFinClean}, codigo: ${codigoClean || 'all'})`,
      );

      return rows;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving registros periodo:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener registros periodo: ${error.message}`,
      );
    }
  }

  /**
   * Obtine TOATE registros (fichajes) fără filtrare
   * Folosit pentru paginile de statistici (accesibil doar pentru manageri/supervisori/admins)
   */
  async getAllFichajes(): Promise<any[]> {
    try {
      // Query SQL: toate registros fără filtrare
      const query = `
        SELECT *
        FROM Fichaje
        ORDER BY FECHA DESC, HORA DESC
      `;

      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);

      this.logger.log(`✅ All fichajes retrieved: ${rows.length} records`);

      return rows;
    } catch (error: any) {
      this.logger.error('❌ Error retrieving all fichajes:', error);
      throw new BadRequestException(
        `Error al obtener todos los fichajes: ${error.message}`,
      );
    }
  }

  /**
   * Adaugă un nou marcaje (fichaje) în baza de date
   */
  async addFichaje(fichajeData: {
    id: string;
    codigo: string;
    nombre: string;
    email: string;
    tipo: string;
    hora: string;
    address: string | null;
    modificatDe: string;
    data: string;
    motivo: string;
  }): Promise<{
    success: true;
    id: string;
    needs_confirmation?: boolean;
    confirmation_data?: {
      delta_minutes: number;
      punched_minutes: number;
      scheduled_minutes: number;
      workday_date: string;
    };
    entrada_warning?: {
      message: string;
      scheduled_time: string;
      fichada_time: string;
      delay_minutes: number;
      suggestion: string;
    };
  }> {
    try {
      // Validări
      if (!fichajeData.id || fichajeData.id.trim() === '') {
        throw new BadRequestException('ID is required');
      }

      if (!fichajeData.codigo || fichajeData.codigo.trim() === '') {
        throw new BadRequestException('CODIGO is required');
      }

      if (!fichajeData.nombre || fichajeData.nombre.trim() === '') {
        throw new BadRequestException('NOMBRE is required');
      }

      if (!fichajeData.tipo || fichajeData.tipo.trim() === '') {
        throw new BadRequestException('TIPO is required');
      }

      if (!fichajeData.hora || fichajeData.hora.trim() === '') {
        throw new BadRequestException('HORA is required');
      }

      if (!fichajeData.data || fichajeData.data.trim() === '') {
        throw new BadRequestException('FECHA (data) is required');
      }

      // Construiește query-ul INSERT (EXACT ca n8n: Entrada_Salida-para registros registrados manual.json)
      // n8n folosește ON DUPLICATE KEY UPDATE pentru a actualiza dacă ID-ul există deja
      const query = `
        INSERT INTO \`Fichaje\`
        (
          \`CODIGO\`,
          \`NOMBRE / APELLIDOS\`,
          \`CORREO ELECTRONICO\`,
          \`TIPO\`,
          \`HORA\`,
          \`DIRECCION\`,
          \`MODIFICADO_POR\`,
          \`FECHA\`,
          \`DURACION\`,
          \`Estado\`,
          \`Motivo\`,
          \`ID\`
        )
        VALUES
        (
          ${this.escapeSql(fichajeData.codigo.trim())},
          ${this.escapeSql(fichajeData.nombre.trim())},
          ${this.escapeSql(fichajeData.email?.trim() || '')},
          ${this.escapeSql(fichajeData.tipo.trim())},
          ${this.escapeSql(fichajeData.hora.trim())},
          ${fichajeData.address ? this.escapeSql(fichajeData.address.trim()) : 'NULL'},
          ${this.escapeSql(fichajeData.modificatDe?.trim() || 'Empleado')},
          ${this.escapeSql(fichajeData.data.trim())},
          NULL,
          'Aprobado',
          NULL,
          ${this.escapeSql(fichajeData.id.trim())}
        )
        ON DUPLICATE KEY UPDATE
          \`HORA\` = VALUES(\`HORA\`),
          \`DIRECCION\` = VALUES(\`DIRECCION\`),
          \`MODIFICADO_POR\` = VALUES(\`MODIFICADO_POR\`),
          \`FECHA\` = VALUES(\`FECHA\`),
          \`Estado\` = 'Aprobado'
      `;

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(
        `✅ Fichaje added: ID=${fichajeData.id}, CODIGO=${fichajeData.codigo}, TIPO=${fichajeData.tipo}, FECHA=${fichajeData.data}`,
      );

      // Verificări pentru Entrada și Salida
      let needs_confirmation = false;
      let confirmation_data = null;
      let entrada_warning = null; // Warning pentru Entrada tardía

      if (this.regularizacionService) {
        try {
          if (fichajeData.tipo === 'Entrada') {
            // Verifică dacă Entrada e mai târziu decât programat
            const fechaDate = new Date(fichajeData.data);
            const scheduledEntryTime =
              await this.regularizacionService.getScheduledEntryTime(
                fichajeData.codigo,
                fechaDate,
              );

            if (scheduledEntryTime) {
              // Parse ora fichada (ex: "09:30:00" sau "09:30")
              const horaParts = fichajeData.hora.split(':');
              const horaFichada = `${horaParts[0].padStart(2, '0')}:${horaParts[1].padStart(2, '0')}`;

              // Parse ora programată
              const [scheduledHour, scheduledMin] = scheduledEntryTime
                .split(':')
                .map(Number);
              const [fichadaHour, fichadaMin] = horaFichada
                .split(':')
                .map(Number);

              const scheduledMinutes = scheduledHour * 60 + scheduledMin;
              const fichadaMinutes = fichadaHour * 60 + fichadaMin;
              const delayMinutes = fichadaMinutes - scheduledMinutes;

              // Dacă e mai târziu cu >15 minute, afișează warning
              if (
                delayMinutes >
                this.regularizacionService['CONFIRMATION_THRESHOLD_MINUTES']
              ) {
                const delayHours = Math.floor(delayMinutes / 60);
                const delayMins = delayMinutes % 60;

                entrada_warning = {
                  message: `⚠️ Has fichado la entrada con ${delayHours > 0 ? `${delayHours}h ` : ''}${delayMins}min de retraso.`,
                  scheduled_time: scheduledEntryTime,
                  fichada_time: horaFichada,
                  delay_minutes: delayMinutes,
                  suggestion: `Recuerda fichar la salida más tarde para compensar las horas.`,
                };
              }
            }
          } else if (fichajeData.tipo === 'Salida') {
            // Verifică dacă trebuie confirmare pentru Salida
            const checkResult =
              await this.regularizacionService.checkNeedsConfirmation(
                fichajeData.codigo,
                fichajeData.data,
              );
            needs_confirmation = checkResult.needs_confirmation;
            confirmation_data = {
              delta_minutes: checkResult.delta_minutes,
              punched_minutes: checkResult.punched_minutes,
              scheduled_minutes: checkResult.scheduled_minutes,
              workday_date: checkResult.workday_date,
            };
          }
        } catch (error: any) {
          this.logger.warn(
            `⚠️ Error checking entrada/salida confirmation: ${error.message}`,
          );
          // Nu aruncăm eroare, doar logăm
        }
      }

      return {
        success: true,
        id: fichajeData.id,
        needs_confirmation,
        confirmation_data,
        entrada_warning, // Warning pentru Entrada tardía (în spaniolă)
      };
    } catch (error: any) {
      this.logger.error('❌ Error adding fichaje:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Extrage mesajul relevant din eroarea Prisma
      let errorMessage = error.message || 'Error desconocido';

      // Dacă este o eroare Prisma cu meta.message, folosește mesajul din meta
      if (error.meta && error.meta.message) {
        errorMessage = error.meta.message;
      } else if (error.message) {
        // Încearcă să extragă mesajul din formatul Prisma complex
        const metaMatch = error.message.match(/Message: `([^`]+)`/);
        if (metaMatch) {
          errorMessage = metaMatch[1];
        }
      }

      throw new BadRequestException(errorMessage);
    }
  }

  /**
   * Actualizează un marcaje (fichaje) existent în baza de date
   */
  async updateFichaje(
    id: string,
    fichajeData: {
      codigo?: string;
      nombre?: string;
      email?: string;
      tipo?: string;
      hora?: string;
      address?: string | null;
      modificatDe?: string;
      data?: string;
      duration?: string;
    },
  ): Promise<{ success: true; id: string; message: string }> {
    try {
      // Validări
      if (!id || id.trim() === '') {
        throw new BadRequestException('ID is required');
      }

      // Verifică dacă marcajele există și obține datele curente
      const checkQuery = `
        SELECT ID, CODIGO, TIPO, FECHA, HORA 
        FROM Fichaje 
        WHERE ID = ${this.escapeSql(id.trim())} 
        LIMIT 1
      `;
      const existing = await this.prisma.$queryRawUnsafe<any[]>(checkQuery);

      if (!existing || existing.length === 0) {
        throw new BadRequestException(`Fichaje with ID ${id} not found`);
      }

      const currentFichaje = existing[0];
      const currentCodigo = currentFichaje.CODIGO;
      const currentTipo = currentFichaje.TIPO;
      const currentFecha = currentFichaje.FECHA;
      const currentHora = currentFichaje.HORA;

      const newTipo = fichajeData.tipo?.trim();
      const newCodigo = fichajeData.codigo?.trim() || currentCodigo;
      const newFecha = fichajeData.data?.trim() || currentFecha;
      const newHora = fichajeData.hora?.trim() || currentHora;

      // Dacă se schimbă TIPO, validăm că nu se creează 2 Entrada sau 2 Salida consecutive
      if (newTipo && newTipo !== currentTipo) {
        // Obține registrele pentru același CODIGO, ordonate cronologic
        const validationQuery = `
          SELECT ID, TIPO, FECHA, HORA
          FROM Fichaje
          WHERE CODIGO = ${this.escapeSql(newCodigo)}
            AND ID != ${this.escapeSql(id.trim())}
          ORDER BY FECHA ASC, HORA ASC
        `;
        const relatedFichajes =
          await this.prisma.$queryRawUnsafe<any[]>(validationQuery);

        // Folosește noile valori de FECHA/HORA pentru a calcula poziția în secvență
        const newDateTime = `${newFecha} ${newHora}`;
        let previousFichaje: any = null;
        let nextFichaje: any = null;

        for (let i = 0; i < relatedFichajes.length; i++) {
          const fichajeDateTime = `${relatedFichajes[i].FECHA} ${relatedFichajes[i].HORA}`;
          if (fichajeDateTime < newDateTime) {
            previousFichaje = relatedFichajes[i];
          } else if (fichajeDateTime > newDateTime) {
            nextFichaje = relatedFichajes[i];
            break;
          }
        }

        // Verifică dacă noua valoare ar crea 2 Entrada sau 2 Salida consecutive
        if (newTipo === 'Entrada') {
          if (previousFichaje && previousFichaje.TIPO === 'Entrada') {
            throw new BadRequestException(
              'Nu se pot avea 2 Entrada consecutive. Există deja o Entrada înainte de acest registru.',
            );
          }
          if (nextFichaje && nextFichaje.TIPO === 'Entrada') {
            throw new BadRequestException(
              'Nu se pot avea 2 Entrada consecutive. Există deja o Entrada după acest registru.',
            );
          }
        } else if (newTipo === 'Salida') {
          if (previousFichaje && previousFichaje.TIPO === 'Salida') {
            throw new BadRequestException(
              'Nu se pot avea 2 Salida consecutive. Există deja o Salida înainte de acest registru.',
            );
          }
          if (nextFichaje && nextFichaje.TIPO === 'Salida') {
            throw new BadRequestException(
              'Nu se pot avea 2 Salida consecutive. Există deja o Salida după acest registru.',
            );
          }
        }
      }

      // Construiește query-ul UPDATE doar cu câmpurile care sunt trimise
      const updateFields: string[] = [];

      if (fichajeData.codigo !== undefined) {
        updateFields.push(
          `CODIGO = ${this.escapeSql(fichajeData.codigo.trim())}`,
        );
      }

      if (fichajeData.nombre !== undefined) {
        updateFields.push(
          `\`NOMBRE / APELLIDOS\` = ${this.escapeSql(fichajeData.nombre.trim())}`,
        );
      }

      if (fichajeData.email !== undefined) {
        updateFields.push(
          `\`CORREO ELECTRONICO\` = ${this.escapeSql(fichajeData.email.trim())}`,
        );
      }

      if (fichajeData.tipo !== undefined) {
        updateFields.push(`TIPO = ${this.escapeSql(fichajeData.tipo.trim())}`);
      }

      if (fichajeData.hora !== undefined) {
        updateFields.push(`HORA = ${this.escapeSql(fichajeData.hora.trim())}`);
      }

      if (fichajeData.address !== undefined) {
        if (fichajeData.address === null || fichajeData.address === '') {
          updateFields.push('DIRECCION = NULL');
        } else {
          updateFields.push(
            `DIRECCION = ${this.escapeSql(fichajeData.address.trim())}`,
          );
        }
      }

      if (fichajeData.modificatDe !== undefined) {
        updateFields.push(
          `MODIFICADO_POR = ${this.escapeSql(fichajeData.modificatDe.trim())}`,
        );
      }

      if (fichajeData.data !== undefined) {
        updateFields.push(`FECHA = ${this.escapeSql(fichajeData.data.trim())}`);
      }

      if (fichajeData.duration !== undefined) {
        if (fichajeData.duration === null || fichajeData.duration === '') {
          updateFields.push('DURACION = NULL');
        } else {
          updateFields.push(
            `DURACION = ${this.escapeSql(fichajeData.duration.trim())}`,
          );
        }
      }

      if (updateFields.length === 0) {
        throw new BadRequestException('No fields to update');
      }

      const updateQuery = `
        UPDATE Fichaje
        SET ${updateFields.join(', ')}
        WHERE ID = ${this.escapeSql(id.trim())}
      `;

      await this.prisma.$executeRawUnsafe(updateQuery);

      this.logger.log(
        `✅ Fichaje updated: ID=${id}, fields updated: ${updateFields.length}`,
      );

      return {
        success: true,
        id: id.trim(),
        message: 'Registro actualizado correctamente.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error updating fichaje:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar fichaje: ${error.message}`,
      );
    }
  }

  /**
   * Șterge un marcaje (fichaje) din baza de date
   */
  async deleteFichaje(id: string): Promise<{ success: true; message: string }> {
    try {
      // Validări
      if (!id || id.trim() === '') {
        throw new BadRequestException('ID is required');
      }

      // Verifică dacă marcajele există
      const checkQuery = `SELECT ID FROM Fichaje WHERE ID = ${this.escapeSql(id.trim())} LIMIT 1`;
      const existing = await this.prisma.$queryRawUnsafe<any[]>(checkQuery);

      if (!existing || existing.length === 0) {
        throw new BadRequestException(`Fichaje with ID ${id} not found`);
      }

      // Construiește query-ul DELETE
      const deleteQuery = `
        DELETE FROM Fichaje
        WHERE ID = ${this.escapeSql(id.trim())}
      `;

      await this.prisma.$executeRawUnsafe(deleteQuery);

      this.logger.log(`✅ Fichaje deleted: ID=${id}`);

      return {
        success: true,
        message: 'Registro eliminado correctamente.',
      };
    } catch (error: any) {
      this.logger.error('❌ Error deleting fichaje:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar fichaje: ${error.message}`,
      );
    }
  }
}
