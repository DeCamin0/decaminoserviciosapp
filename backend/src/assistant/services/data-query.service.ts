import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AssistantDataScope } from '../constants/assistant-data-scope.const';
import { RbacService } from './rbac.service';
import { calculateCuadranteHours } from '../../utils/cuadrante-hours-helper';
import {
  ASSISTANT_KB_MAX_SEARCH_TERMS,
  ASSISTANT_KB_QUERY_LIMIT,
} from '../constants/assistant-session.constants';
import type { KbQueryMeta } from '../types/kb-query.types';
import { normalizeKbSearchTerms } from '../utils/kb-search-normalize.util';
import { getSpainCalendarYearMonthDay } from '../utils/month-and-relative-dates.util';

import * as mysql from 'mysql2/promise';
import { buildDailyPlanMysqlCore } from './daily-plan-mysql-core.util';

@Injectable()
export class DataQueryService {
  private readonly logger = new Logger(DataQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Query pentru FICHAJES
   */
  async queryFichajes(
    userId: string,
    rol: string | null,
    entidades?: {
      codigo?: string;
      fecha?: string;
      mes?: string;
      year?: string;
    },
    dataScope?: AssistantDataScope,
  ): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'CODIGO',
      dataScope,
    );

    let fechaCondition = '';

    // VerificÄƒ dacÄƒ e cerut "tot mesul"
    if (entidades?.mes && entidades.mes.startsWith('completo_')) {
      const mesNombre = entidades.mes.replace('completo_', '');
      const meses = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ];
      const mesIndex = meses.indexOf(mesNombre);

      if (mesIndex !== -1) {
        const ahora = new Date();
        const anio = ahora.getFullYear();
        const mes = mesIndex + 1; // JavaScript months are 0-indexed, SQL months are 1-indexed

        // Prima zi a lunii
        const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
        // Ultima zi a lunii
        const ultimoDia = new Date(anio, mes, 0).getDate();
        const fechaFin = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

        fechaCondition = `AND DATE(FECHA) >= ${this.escapeSql(fechaInicio)} AND DATE(FECHA) <= ${this.escapeSql(fechaFin)}`;
        this.logger.log(
          `ðŸ“… Query fichajes para mes completo: ${fechaInicio} a ${fechaFin}`,
        );
      } else {
        // Fallback la luna curentÄƒ
        const ahora = new Date();
        const anio = ahora.getFullYear();
        const mes = ahora.getMonth() + 1;
        const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
        const ultimoDia = new Date(anio, mes, 0).getDate();
        const fechaFin = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
        fechaCondition = `AND DATE(FECHA) >= ${this.escapeSql(fechaInicio)} AND DATE(FECHA) <= ${this.escapeSql(fechaFin)}`;
        this.logger.log(
          `ðŸ“… Query fichajes para mes actual completo: ${fechaInicio} a ${fechaFin}`,
        );
      }
    } else if (
      entidades?.year &&
      /^\d{4}$/.test(String(entidades.year).trim())
    ) {
      const y = String(entidades.year).trim();
      const fechaInicio = `${y}-01-01`;
      const fechaFin = `${y}-12-31`;
      fechaCondition = `AND DATE(FECHA) >= ${this.escapeSql(fechaInicio)} AND DATE(FECHA) <= ${this.escapeSql(fechaFin)}`;
      this.logger.log(
        `ðŸ“… Query fichajes para anio completo: ${fechaInicio} a ${fechaFin}`,
      );
    } else if (entidades?.fecha) {
      // escapeSql already wraps the value in single quotes — do not nest quotes here (MySQL 1064).
      fechaCondition = `AND DATE(FECHA) = ${this.escapeSql(entidades.fecha)}`;
    } else {
      fechaCondition = `AND DATE(FECHA) = CURDATE()`;
    }

    const query = `
      SELECT 
        fichaje_pk,
        CODIGO,
        \`NOMBRE / APELLIDOS\` as nombre_apellidos,
        TIPO,
        HORA,
        FECHA,
        DURACION,
        Estado
      FROM Fichaje
      WHERE ${rbacCondition}
        ${fechaCondition}
      ORDER BY FECHA DESC, HORA DESC
      LIMIT 500
    `;

    this.logger.log(`ðŸ” Query fichajes: ${query.substring(0, 150)}...`);

    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    return results || [];
  }

  /**
   * Query pentru angajaÈ›i care ar trebui sÄƒ lucreze (conform cuadrantelor/horario) dar nu au fichat
   * FoloseÈ™te aceeaÈ™i logicÄƒ ca MonthlyAlertsService pentru a fi consistent
   */
  async queryFichajesFaltantes(
    userId: string,
    rol: string | null,
    fecha?: string,
    dataScope?: AssistantDataScope,
  ): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'CODIGO',
      dataScope,
    );

    // ParseazÄƒ data sau foloseÈ™te data curentÄƒ
    let fechaDate: Date;
    if (fecha) {
      fechaDate = new Date(fecha);
    } else {
      fechaDate = new Date();
    }

    const anio = fechaDate.getFullYear();
    const mes = fechaDate.getMonth() + 1;
    const dia = fechaDate.getDate();
    const fechaFormatted = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const mesFormatted = `${anio}-${String(mes).padStart(2, '0')}`;

    // FoloseÈ™te aceeaÈ™i logicÄƒ ca MonthlyAlertsService.getResumenMensual
    const dailyPlanMysqlCore = buildDailyPlanMysqlCore(
      (v) => this.escapeSql(v),
      rbacCondition,
      fechaFormatted,
      mesFormatted,
    );
    const query = `${dailyPlanMysqlCore},
      fichaje_base AS (
        SELECT
          CAST(f.CODIGO AS CHAR) AS empleadoId,
          DATE(f.FECHA)          AS fecha,
          f.DURACION             AS duracion
        FROM Fichaje f
        WHERE DATE(f.FECHA) = @fecha_buscar
      ),
      fichaje_has_events AS (
        SELECT empleadoId, fecha, COUNT(*) AS cnt_events
        FROM fichaje_base
        GROUP BY empleadoId, fecha
      ),
      fichaje_with_duration AS (
        SELECT empleadoId, fecha, TIME_TO_SEC(duracion) AS dur_secs
        FROM fichaje_base
        WHERE duracion IS NOT NULL AND TRIM(duracion) <> '' AND duracion <> '00:00:00'
      ),
      fichaje_dia AS (
        SELECT
          he.empleadoId,
          he.fecha,
          ROUND(COALESCE(SUM(fd.dur_secs),0)/3600,2) AS horas_fichadas,
          CASE WHEN he.cnt_events > 0 AND COALESCE(SUM(fd.dur_secs),0) = 0 THEN 1 ELSE 0 END AS fichaje_incompleto
        FROM fichaje_has_events he
        LEFT JOIN fichaje_with_duration fd
          ON fd.empleadoId = he.empleadoId AND fd.fecha = he.fecha
        GROUP BY he.empleadoId, he.fecha, he.cnt_events
      )
      SELECT
        dp.empleadoId AS CODIGO,
        de.\`NOMBRE / APELLIDOS\` AS nombre,
        de.\`CENTRO TRABAJO\` AS centro,
        dp.fecha AS fecha_esperada,
        dp.horas_plan,
        dp.fuente,
        COALESCE(fd.horas_fichadas, 0) AS horas_fichadas,
        COALESCE(fd.fichaje_incompleto, 0) AS fichaje_incompleto,
        CASE
          WHEN dp.fuente = 'none' THEN
            CONCAT(
              CASE WHEN cd.tiene_cuadrante = 0 OR cd.tiene_cuadrante IS NULL THEN 'Sin cuadrante asignado' ELSE '' END,
              CASE 
                WHEN (cd.tiene_cuadrante = 0 OR cd.tiene_cuadrante IS NULL) 
                     AND (hd.horas_horario_dia IS NULL OR hd.horas_horario_dia = 0) 
                THEN ', ' 
                ELSE '' 
              END,
              CASE WHEN hd.horas_horario_dia IS NULL OR hd.horas_horario_dia = 0 THEN 'Sin horario asignado' ELSE '' END,
              CASE 
                WHEN (cd.tiene_cuadrante = 0 OR cd.tiene_cuadrante IS NULL) 
                     AND (hd.horas_horario_dia IS NULL OR hd.horas_horario_dia = 0)
                     AND (de.\`CENTRO TRABAJO\` IS NULL OR TRIM(de.\`CENTRO TRABAJO\`) = '')
                THEN ', ' 
                ELSE '' 
              END,
              CASE WHEN de.\`CENTRO TRABAJO\` IS NULL OR TRIM(de.\`CENTRO TRABAJO\`) = '' THEN 'Sin centro asignado' ELSE '' END
            )
          ELSE NULL
        END AS detalles_faltantes
      FROM daily_plan dp
      JOIN DatosEmpleados de ON CAST(de.CODIGO AS CHAR) = dp.empleadoId
      LEFT JOIN fichaje_dia fd
        ON fd.empleadoId = dp.empleadoId AND fd.fecha = dp.fecha
      LEFT JOIN cuadrante_dia cd
        ON cd.empleadoId = dp.empleadoId AND cd.fecha = dp.fecha
      LEFT JOIN horario_dia hd
        ON hd.empleadoId = dp.empleadoId AND hd.fecha = dp.fecha
      WHERE (
        -- AngajaÈ›i cu cuadrante/horario care nu au fichat
        (dp.horas_plan > 0 AND (COALESCE(fd.horas_fichadas, 0) = 0 OR COALESCE(fd.fichaje_incompleto, 0) = 1))
        OR
        -- AngajaÈ›i fÄƒrÄƒ cuadrante/horario/centro asignado
        (dp.fuente = 'none' AND (
          cd.tiene_cuadrante = 0 OR cd.tiene_cuadrante IS NULL OR
          hd.horas_horario_dia IS NULL OR hd.horas_horario_dia = 0 OR
          de.\`CENTRO TRABAJO\` IS NULL OR TRIM(de.\`CENTRO TRABAJO\`) = ''
        ))
      )
      ORDER BY 
        CASE WHEN dp.fuente = 'none' THEN 1 ELSE 0 END,
        de.\`NOMBRE / APELLIDOS\`
      LIMIT 100
    `;

    this.logger.log(`[queryFichajesFaltantes] ${query.substring(0, 300)}...`);

    try {
      const rows = await this.runMysqlMultiStatementQuery(
        query,
        'fichajes_faltantes',
      );
      return await this.processFichajesFaltantesResults(rows || []);
    } catch (error: any) {
      this.logger.error(
        `Error en queryFichajesFaltantes: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Plan zilnic (cuadrante vs horario, 3 segmente horario) pentru asistent — fără filtru fichajes.
   */
  async queryDailyPlanDiaForAssistant(
    userId: string,
    rol: string | null,
    fecha?: string,
    dataScope?: AssistantDataScope,
    empleado?: { codigo?: string; nombre?: string; centro?: string },
  ): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'CODIGO',
      dataScope,
    );
    let fechaDate: Date;
    if (fecha) {
      fechaDate = new Date(fecha);
    } else {
      fechaDate = new Date();
    }
    const anio = fechaDate.getFullYear();
    const mes = fechaDate.getMonth() + 1;
    const dia = fechaDate.getDate();
    const fechaFormatted = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const mesFormatted = `${anio}-${String(mes).padStart(2, '0')}`;

    const core = buildDailyPlanMysqlCore(
      (v) => this.escapeSql(v),
      rbacCondition,
      fechaFormatted,
      mesFormatted,
    );
    const rbacDe = rbacCondition.replace('CODIGO', 'de.CODIGO');
    let empleadoFilterSql = '';
    const cod = empleado?.codigo?.trim();
    const nomRaw = empleado?.nombre?.trim();
    const centroRaw = empleado?.centro?.trim();
    if (cod) {
      empleadoFilterSql = `AND CAST(de.CODIGO AS CHAR) = ${this.escapeSql(cod)}`;
    } else if (centroRaw) {
      empleadoFilterSql = this.buildCentroPlanFilterSql(centroRaw);
    } else if (nomRaw) {
      empleadoFilterSql = this.buildNombreEmpleadoSqlFilter(
        'de.`NOMBRE / APELLIDOS`',
        nomRaw,
      );
    }
    /** Listă „cine la centru” poate depăși 25; nume/cod rămân limitate. */
    const rowLimit = empleadoFilterSql ? (centroRaw ? 200 : 25) : 200;
    const assistantSelect = `
      SELECT
        CAST(de.CODIGO AS CHAR) AS CODIGO,
        de.\`NOMBRE / APELLIDOS\` AS nombre,
        de.\`CENTRO TRABAJO\` AS centro,
        dp.fecha AS fecha,
        dp.horas_plan,
        dp.fuente,
        cd.valor_celula_cuadrante,
        ROUND(COALESCE(cd.horas_cuadrante_dia, 0), 2) AS horas_cuadrante_dia,
        ROUND(COALESCE(hd.horas_horario_dia, 0), 2) AS horas_horario_dia,
        ROUND(COALESCE(hdm.m1, 0) / 60, 2) AS horario_segmento_1_horas,
        ROUND(COALESCE(hdm.m2, 0) / 60, 2) AS horario_segmento_2_horas,
        ROUND(COALESCE(hdm.m3, 0) / 60, 2) AS horario_segmento_3_horas,
        ROUND(COALESCE(hmdp.horas_horario_multicentro_dia, 0), 2) AS horas_horario_multicentro_dia,
        hmcli.cliente_horario_multicentro,
        CASE WHEN dp.horas_plan > 0 THEN 1 ELSE 0 END AS trabaja_este_dia
      FROM daily_plan dp
      JOIN DatosEmpleados de ON CAST(de.CODIGO AS CHAR) = dp.empleadoId
      LEFT JOIN cuadrante_dia cd
        ON cd.empleadoId = dp.empleadoId AND cd.fecha = dp.fecha
      LEFT JOIN horario_dia hd
        ON hd.empleadoId = dp.empleadoId AND hd.fecha = dp.fecha
      LEFT JOIN horario_dia_m hdm
        ON hdm.empleadoId = dp.empleadoId AND hdm.fecha = dp.fecha
      LEFT JOIN horario_multicentro_dia_best hmdp
        ON hmdp.empleadoId = dp.empleadoId AND hmdp.fecha = dp.fecha
      LEFT JOIN (
        SELECT empleadoId, fecha, MAX(cliente) AS cliente_horario_multicentro
        FROM horario_multicentro_dia
        GROUP BY empleadoId, fecha
      ) hmcli ON hmcli.empleadoId = dp.empleadoId AND hmcli.fecha = dp.fecha
      WHERE de.ESTADO='ACTIVO'
        AND ${rbacDe}
        ${empleadoFilterSql}
      ORDER BY de.\`NOMBRE / APELLIDOS\`
      LIMIT ${rowLimit}
    `;
    const fullQuery = `${core}
${assistantSelect}`;

    try {
      return await this.runMysqlMultiStatementQuery(
        fullQuery,
        'plan_trabajo_dia',
      );
    } catch (error: any) {
      this.logger.error(
        `Error en queryDailyPlanDiaForAssistant: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /** mysql2 multi-statement; extrage rândurile tabulare (CODIGO / nombre). */
  private async runMysqlMultiStatementQuery(
    query: string,
    logLabel: string,
  ): Promise<any[]> {
    const dbConfig = this.configService.get<{
      host: string;
      port: number;
      username: string;
      password: string;
      database: string;
    }>('database');
    const connectionConfig = dbConfig
      ? {
          host: dbConfig.host,
          port: dbConfig.port,
          user: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
        }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '3306', 10),
          user: process.env.DB_USERNAME || 'root',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || 'decaminoservicios',
        };

    const connection = await mysql.createConnection({
      ...connectionConfig,
      multipleStatements: true,
    });

    try {
      const queryResult = await connection.query(query);
      let rows: any[] = [];

      if (Array.isArray(queryResult) && queryResult.length >= 1) {
        const firstResult = queryResult[0];
        if (Array.isArray(firstResult)) {
          for (let i = firstResult.length - 1; i >= 0; i--) {
            const item = firstResult[i];
            if (Array.isArray(item) && item.length > 0) {
              const firstRow = item[0];
              if (
                firstRow &&
                typeof firstRow === 'object' &&
                ('CODIGO' in firstRow || 'nombre' in firstRow) &&
                !('fieldCount' in firstRow)
              ) {
                rows = item;
                this.logger.log(
                  `[${logLabel}] data rows at index ${i}, count=${rows.length}`,
                );
                break;
              }
            }
          }
        }
      }

      this.logger.log(`[${logLabel}] returned ${rows?.length || 0} rows`);
      return rows || [];
    } finally {
      await connection.end();
    }
  }

  /**
   * Query pentru LISTADO DE EMPLEADOS cu estado, cuadrante, horario, centro
   * @param filtro - OpÈ›ional: 'sin_cuadrante', 'sin_horario', 'sin_centro', 'sin_cuadrante_ni_horario', 'sin_centro_ni_cuadrante_ni_horario'
   */
  async queryListadoEmpleados(
    userId: string,
    rol: string | null,
    filtro?: string,
    dataScope?: AssistantDataScope,
  ): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'CODIGO',
      dataScope,
    );

    // ConstruieÈ™te condiÈ›iile WHERE pentru filtrare
    let filtroWhere = '';
    if (filtro === 'sin_cuadrante') {
      filtroWhere = `AND NOT EXISTS (
        SELECT 1 FROM cuadrante c 
        WHERE CAST(c.CODIGO AS CHAR) = CAST(de.CODIGO AS CHAR)
          AND c.LUNA = DATE_FORMAT(NOW(), '%Y-%m')
      )`;
    } else if (filtro === 'sin_horario') {
      filtroWhere = `AND NOT EXISTS (
        SELECT 1 FROM horarios h
        WHERE h.centro_nombre = de.\`CENTRO TRABAJO\`
          AND h.grupo_nombre = de.\`GRUPO\`
      )`;
    } else if (filtro === 'sin_centro') {
      filtroWhere = `AND (de.\`CENTRO TRABAJO\` IS NULL OR TRIM(de.\`CENTRO TRABAJO\`) = '')`;
    } else if (filtro === 'sin_cuadrante_ni_horario') {
      // AND logic: nu are cuadrante È˜I nu are horario
      filtroWhere = `AND NOT EXISTS (
        SELECT 1 FROM cuadrante c 
        WHERE CAST(c.CODIGO AS CHAR) = CAST(de.CODIGO AS CHAR)
          AND c.LUNA = DATE_FORMAT(NOW(), '%Y-%m')
      ) AND NOT EXISTS (
        SELECT 1 FROM horarios h
        WHERE h.centro_nombre = de.\`CENTRO TRABAJO\`
          AND h.grupo_nombre = de.\`GRUPO\`
      )`;
    } else if (filtro === 'sin_cuadrante_o_horario') {
      // OR logic: nu are cuadrante SAU nu are horario
      filtroWhere = `AND (
        NOT EXISTS (
          SELECT 1 FROM cuadrante c 
          WHERE CAST(c.CODIGO AS CHAR) = CAST(de.CODIGO AS CHAR)
            AND c.LUNA = DATE_FORMAT(NOW(), '%Y-%m')
        ) OR NOT EXISTS (
          SELECT 1 FROM horarios h
          WHERE h.centro_nombre = de.\`CENTRO TRABAJO\`
            AND h.grupo_nombre = de.\`GRUPO\`
        )
      )`;
    } else if (filtro === 'sin_centro_ni_cuadrante_ni_horario') {
      filtroWhere = `AND (de.\`CENTRO TRABAJO\` IS NULL OR TRIM(de.\`CENTRO TRABAJO\`) = '')
        AND NOT EXISTS (
          SELECT 1 FROM cuadrante c 
          WHERE CAST(c.CODIGO AS CHAR) = CAST(de.CODIGO AS CHAR)
            AND c.LUNA = DATE_FORMAT(NOW(), '%Y-%m')
        ) AND NOT EXISTS (
          SELECT 1 FROM horarios h
          WHERE h.centro_nombre = de.\`CENTRO TRABAJO\`
            AND h.grupo_nombre = de.\`GRUPO\`
        )`;
    }

    const query = `
      SELECT
        CAST(de.CODIGO AS CHAR) AS CODIGO,
        de.\`NOMBRE / APELLIDOS\` AS nombre,
        de.ESTADO AS estado,
        de.\`CENTRO TRABAJO\` AS centro,
        de.\`GRUPO\` AS grupo,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM cuadrante c 
            WHERE CAST(c.CODIGO AS CHAR) = CAST(de.CODIGO AS CHAR)
              AND c.LUNA = DATE_FORMAT(NOW(), '%Y-%m')
          ) THEN 'SÃ­'
          ELSE 'No'
        END AS tiene_cuadrante,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM horarios h
            WHERE h.centro_nombre = de.\`CENTRO TRABAJO\`
              AND h.grupo_nombre = de.\`GRUPO\`
          ) THEN 'SÃ­'
          ELSE 'No'
        END AS tiene_horario,
        CASE 
          WHEN de.\`CENTRO TRABAJO\` IS NOT NULL 
            AND TRIM(de.\`CENTRO TRABAJO\`) <> '' 
          THEN 'SÃ­'
          ELSE 'No'
        END AS tiene_centro,
        CONCAT(
          CASE WHEN NOT EXISTS (
            SELECT 1 FROM cuadrante c 
            WHERE CAST(c.CODIGO AS CHAR) = CAST(de.CODIGO AS CHAR)
              AND c.LUNA = DATE_FORMAT(NOW(), '%Y-%m')
          ) THEN 'Sin cuadrante asignado' ELSE '' END,
          CASE 
            WHEN NOT EXISTS (
              SELECT 1 FROM cuadrante c 
              WHERE CAST(c.CODIGO AS CHAR) = CAST(de.CODIGO AS CHAR)
                AND c.LUNA = DATE_FORMAT(NOW(), '%Y-%m')
            ) 
            AND NOT EXISTS (
              SELECT 1 FROM horarios h
              WHERE h.centro_nombre = de.\`CENTRO TRABAJO\`
                AND h.grupo_nombre = de.\`GRUPO\`
            )
            THEN ', ' 
            ELSE '' 
          END,
          CASE WHEN NOT EXISTS (
            SELECT 1 FROM horarios h
            WHERE h.centro_nombre = de.\`CENTRO TRABAJO\`
              AND h.grupo_nombre = de.\`GRUPO\`
          ) THEN 'Sin horario asignado' ELSE '' END,
          CASE 
            WHEN (NOT EXISTS (
              SELECT 1 FROM cuadrante c 
              WHERE CAST(c.CODIGO AS CHAR) = CAST(de.CODIGO AS CHAR)
                AND c.LUNA = DATE_FORMAT(NOW(), '%Y-%m')
            ) OR NOT EXISTS (
              SELECT 1 FROM horarios h
              WHERE h.centro_nombre = de.\`CENTRO TRABAJO\`
                AND h.grupo_nombre = de.\`GRUPO\`
            ))
            AND (de.\`CENTRO TRABAJO\` IS NULL OR TRIM(de.\`CENTRO TRABAJO\`) = '')
            THEN ', ' 
            ELSE '' 
          END,
          CASE WHEN de.\`CENTRO TRABAJO\` IS NULL OR TRIM(de.\`CENTRO TRABAJO\`) = '' THEN 'Sin centro asignado' ELSE '' END
        ) AS detalles_faltantes
      FROM DatosEmpleados de
      WHERE ${rbacCondition.replace('CODIGO', 'de.CODIGO')}
        ${filtroWhere}
      ORDER BY de.\`NOMBRE / APELLIDOS\`
    `;

    try {
      const results = await this.prisma.$queryRawUnsafe<any[]>(query);
      this.logger.log(
        `âœ… Query listado empleados retornÃ³ ${results?.length || 0} resultados (filtro: ${filtro || 'ninguno'})`,
      );
      return results || [];
    } catch (error: any) {
      this.logger.error(
        `âŒ Error en queryListadoEmpleados: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Resumen del propio contrato (usuario JWT) desde DatosEmpleados.
   * No expone sueldo, DNI, cuenta, email.
   */
  async queryMisDatosContrato(
    userId: string,
    _rol: string | null,
    _dataScope?: AssistantDataScope,
  ): Promise<Record<string, unknown>[]> {
    const row = await this.prisma.user.findUnique({
      where: { CODIGO: userId },
      select: {
        CODIGO: true,
        NOMBRE_APELLIDOS: true,
        TIPO_DE_CONTRATO: true,
        HORAS_DE_CONTRATO: true,
        FECHA_DE_ALTA: true,
        Fecha_Antig_edad: true,
        Antig_edad: true,
        EMPRESA: true,
        CENTRO_TRABAJO: true,
        ESTADO: true,
      },
    });
    if (!row) {
      return [];
    }

    let documentoContratoSubido = false;
    try {
      const cnt = await this.prisma.$queryRawUnsafe<{ c: bigint }[]>(
        `SELECT COUNT(*) AS c FROM CarpetasDocumentos
         WHERE id = ${this.escapeSql(userId)}
           AND archivo IS NOT NULL
           AND LENGTH(archivo) > 0
           AND (
             LOWER(COALESCE(tipo_documento,'')) LIKE '%contrato%'
             OR LOWER(COALESCE(nombre_archivo,'')) LIKE '%contrato%'
           )`,
      );
      documentoContratoSubido = Number(cnt?.[0]?.c ?? 0) > 0;
    } catch (e: any) {
      this.logger.warn(
        `queryMisDatosContrato: no se pudo comprobar CarpetasDocumentos (${e?.message ?? e})`,
      );
    }

    return [
      {
        row_kind: 'contrato_propio',
        codigo: row.CODIGO,
        nombre: row.NOMBRE_APELLIDOS,
        tipo_contrato: row.TIPO_DE_CONTRATO,
        horas_contrato: row.HORAS_DE_CONTRATO,
        fecha_alta: row.FECHA_DE_ALTA,
        fecha_antiguedad: row.Fecha_Antig_edad,
        antiguedad: row.Antig_edad,
        empresa: row.EMPRESA,
        centro: row.CENTRO_TRABAJO,
        estado: row.ESTADO,
        documento_contrato_subido: documentoContratoSubido,
      },
    ];
  }

  /**
   * ProceseazÄƒ rezultatele queryFichajesFaltantes pentru a calcula corect orele pentru ture multiple
   */
  private async processFichajesFaltantesResults(
    results: any[],
  ): Promise<any[]> {
    if (!results || results.length === 0) {
      return results;
    }

    this.logger.log(
      `ðŸ”„ Processing ${results.length} results for horas recalculation...`,
    );

    // Trebuie sÄƒ obÈ›inem valorile originale din cuadrante pentru a calcula corect orele
    // Pentru fiecare rezultat, trebuie sÄƒ verificÄƒm dacÄƒ are cuadrante sau horario
    const processedResults = await Promise.all(
      results.map(async (result) => {
        // Log pentru debugging - verificÄƒ dacÄƒ existÄƒ angajaÈ›i cu 24h
        if (result.horas_plan && parseFloat(result.horas_plan) >= 24) {
          this.logger.warn(
            `ðŸ” Found employee with horas_plan >= 24: CODIGO ${result.CODIGO}, horas_plan: ${result.horas_plan}, fuente: ${result.fuente}`,
          );
        }

        if (result.fuente === 'cuadrante' && result.fecha_esperada) {
          // ObÈ›ine valoarea originalÄƒ din cuadrante
          const fecha = new Date(result.fecha_esperada);
          const dia = fecha.getDate();
          const mesFormatted = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

          try {
            // FoloseÈ™te backticks pentru coloana ZI_X (poate conÈ›ine spaÈ›ii sau caractere speciale)
            const cuadrante = await this.prisma.$queryRawUnsafe<any[]>(`
              SELECT \`ZI_${dia}\` AS val
              FROM cuadrante
              WHERE CODIGO = ${this.escapeSql(result.CODIGO)}
                AND LUNA = ${this.escapeSql(mesFormatted)}
              LIMIT 1
            `);

            if (cuadrante && cuadrante.length > 0 && cuadrante[0].val) {
              const valOriginal = cuadrante[0].val;
              const horasAnterioare = result.horas_plan;
              // FoloseÈ™te helper-ul JavaScript pentru a calcula corect orele
              const horasCorrectas = calculateCuadranteHours(valOriginal);
              if (horasCorrectas > 0) {
                result.horas_plan = parseFloat(horasCorrectas.toFixed(2));
                this.logger.log(
                  `âœ… Recalculated horas_plan for CODIGO ${result.CODIGO}: ${horasAnterioare} â†’ ${result.horas_plan} (original: ${valOriginal})`,
                );
              }
            } else {
              this.logger.warn(
                `No cuadrante found for CODIGO ${result.CODIGO}, dia ${dia}, mes ${mesFormatted}`,
              );
            }
          } catch (error: any) {
            this.logger.warn(
              `Error processing horas for CODIGO ${result.CODIGO}: ${error.message}`,
            );
          }
        } else if (
          result.fuente === 'horario' &&
          result.horas_plan &&
          parseFloat(result.horas_plan) >= 24
        ) {
          // Pentru horario, dacÄƒ e 24h, probabil e 3 ture de 8h â†’ returnÄƒm 8h per turÄƒ
          const horasAnterioare = result.horas_plan;
          if (parseFloat(horasAnterioare) === 24) {
            result.horas_plan = 8;
            this.logger.log(
              `âœ… Recalculated horas_plan for CODIGO ${result.CODIGO} (horario): ${horasAnterioare} â†’ ${result.horas_plan} (24h = 3Ã—8h)`,
            );
          }
        }
        // Pentru horario normal, calculul este deja corect (suma tuturor turelor)
        return result;
      }),
    );

    this.logger.log(`âœ… Processed ${processedResults.length} results`);
    return processedResults;
  }

  /**
   * Query pentru CUADRANTE
   */
  /**
   * Pedidos de material (PedidosTodos), RBAC: empleado solo los suyos.
   */
  async queryPedidosForAssistant(
    userId: string,
    rol: string | null,
    entidades?: { mes?: string; year?: string },
    dataScope?: AssistantDataScope,
  ): Promise<any[]> {
    const scope = this.rbacService.effectiveDataScope(rol, dataScope);
    let empleadoCondition = '';
    if (scope === AssistantDataScope.OWN) {
      const uid = String(userId).trim();
      empleadoCondition = `AND CAST(empleado_id AS CHAR) = ${this.escapeSql(uid)}`;
    }

    const { y, m } = this.resolveAssistantPedidosMonthYear(entidades);
    const dateCondition = `AND YEAR(COALESCE(creado_en, fecha)) = ${y} AND MONTH(COALESCE(creado_en, fecha)) = ${m}`;

    const query = `
      SELECT
        pedido_uid,
        MAX(empleado_id) AS empleado_id,
        MAX(comunidad_nombre) AS comunidad_nombre,
        MAX(fecha) AS fecha,
        MAX(creado_en) AS creado_en,
        MAX(estado) AS estado,
        MAX(moneda) AS moneda,
        MAX(total) AS total,
        COUNT(*) AS num_items
      FROM PedidosTodos
      WHERE 1=1
        ${empleadoCondition}
        ${dateCondition}
      GROUP BY pedido_uid
      ORDER BY MAX(creado_en) DESC, pedido_uid DESC
      LIMIT 40
    `;

    this.logger.log(
      `🔍 queryPedidosForAssistant: ${query.substring(0, 120)}...`,
    );

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(query);
      return rows || [];
    } catch (e: any) {
      this.logger.error(`queryPedidosForAssistant: ${e?.message ?? e}`);
      return [];
    }
  }

  private resolveAssistantPedidosMonthYear(entidades?: {
    mes?: string;
    year?: string;
  }): { y: number; m: number } {
    const meses = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
    const now = new Date();
    let y = now.getFullYear();
    let mo = now.getMonth() + 1;
    if (entidades?.year && /^\d{4}$/.test(String(entidades.year).trim())) {
      y = parseInt(String(entidades.year).trim(), 10);
    }
    if (entidades?.mes) {
      const raw = String(entidades.mes)
        .replace(/^completo_/i, '')
        .toLowerCase();
      const idx = meses.indexOf(raw);
      if (idx >= 0) {
        mo = idx + 1;
      }
    }
    return { y, m: mo };
  }

  /**
   * Coloana `cuadrante.LUNA` în produs este de obicei `YYYY-MM`, nu text „marzo”.
   * Filtrul vechi `LIKE '%marzo%'` nu găsea rânduri → „sin datos” la „horario este mes”.
   */
  private buildCuadranteMesSqlCondition(
    entidadesMes: string | undefined,
  ): string {
    const meses = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const spain = getSpainCalendarYearMonthDay();

    if (!entidadesMes) {
      const y = spain.year;
      const m = spain.month;
      const ym = `${y}-${pad2(m)}`;
      const nombre = meses[m - 1];
      return `AND (
        LUNA = ${this.escapeSql(ym)}
        OR LUNA LIKE ${this.escapeSql(`${ym}-%`)}
        OR LUNA LIKE ${this.escapeSql(`${ym}/%`)}
        OR LOWER(CAST(LUNA AS CHAR)) LIKE ${this.escapeSql(`%${nombre}%`)}
      )`;
    }

    const mesToken = String(entidadesMes)
      .replace(/^completo_/i, '')
      .toLowerCase();
    const mesIndex = meses.indexOf(mesToken);
    if (mesIndex < 0) {
      return `AND LOWER(CAST(LUNA AS CHAR)) LIKE ${this.escapeSql(`%${mesToken}%`)}`;
    }

    let y = spain.year;
    if (spain.month === 12 && mesIndex === 0) {
      y += 1;
    }
    const ym = `${y}-${pad2(mesIndex + 1)}`;
    return `AND (
      LUNA = ${this.escapeSql(ym)}
      OR LUNA LIKE ${this.escapeSql(`${ym}-%`)}
      OR LUNA LIKE ${this.escapeSql(`${ym}/%`)}
      OR LOWER(CAST(LUNA AS CHAR)) LIKE ${this.escapeSql(`%${mesToken}%`)}
    )`;
  }

  async queryCuadrante(
    userId: string,
    rol: string | null,
    entidades?: {
      codigo?: string;
      mes?: string;
      nombre?: string;
      centro?: string;
    },
    dataScope?: AssistantDataScope,
  ): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'CODIGO',
      dataScope,
    );

    const mesCondition = this.buildCuadranteMesSqlCondition(entidades?.mes);

    let empleadoFilterSql = '';
    const cod = entidades?.codigo?.trim();
    const nomRaw = entidades?.nombre?.trim();
    if (cod) {
      empleadoFilterSql = `AND CAST(CODIGO AS CHAR) = ${this.escapeSql(cod)}`;
    } else if (nomRaw) {
      empleadoFilterSql = this.buildNombreEmpleadoSqlFilter('NOMBRE', nomRaw);
    }
    const centroRaw = entidades?.centro?.trim();
    const centroFilterSql = this.buildCentroTrabajoSqlFilter(
      'CENTRO',
      centroRaw,
    );

    let rowLimit = 10;
    if (cod || nomRaw) {
      rowLimit = 25;
    } else if (centroRaw) {
      rowLimit = 80;
    }

    const ziCols = Array.from({ length: 31 }, (_, i) => `ZI_${i + 1}`).join(
      ',\n        ',
    );

    const query = `
      SELECT 
        id,
        CODIGO,
        NOMBRE,
        LUNA,
        CENTRO,
        TotalHoras,
        ${ziCols}
      FROM cuadrante
      WHERE ${rbacCondition}
        ${mesCondition}
        ${empleadoFilterSql}
        ${centroFilterSql}
      ORDER BY LUNA DESC
      LIMIT ${rowLimit}
    `;

    this.logger.log(
      `[cuadrante_mes] mes=${entidades?.mes ?? '(luna implicită)'} codigo=${cod ?? '-'} nombre=${nomRaw ? `${nomRaw.slice(0, 40)}${nomRaw.length > 40 ? '…' : ''}` : '-'} centro=${centroRaw ?? '-'} empleadoFilter=${empleadoFilterSql ? 'yes' : 'no'} limit=${rowLimit}`,
    );
    this.logger.log(`🔍 Query cuadrante: ${query.substring(0, 160)}...`);

    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    return results || [];
  }

  /**
   * Grid mensual `horario_multicentro` (misma columna LUNA / ZI_* que cuadrante).
   * Empleados sin fila en `cuadrante` pero con turnos por cliente/centro.
   */
  async queryHorarioMulticentroMes(
    userId: string,
    rol: string | null,
    entidades?: {
      codigo?: string;
      mes?: string;
      nombre?: string;
      centro?: string;
    },
    dataScope?: AssistantDataScope,
  ): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'CODIGO',
      dataScope,
    );

    const mesCondition = this.buildCuadranteMesSqlCondition(entidades?.mes);

    let empleadoFilterSql = '';
    const cod = entidades?.codigo?.trim();
    const nomRaw = entidades?.nombre?.trim();
    if (cod) {
      empleadoFilterSql = `AND CAST(CODIGO AS CHAR) = ${this.escapeSql(cod)}`;
    } else if (nomRaw) {
      empleadoFilterSql = this.buildNombreEmpleadoSqlFilter('NOMBRE', nomRaw);
    }
    const centroRaw = entidades?.centro?.trim();
    const centroHmSql =
      this.buildHorarioMulticentroMesCentroClienteServicioFilterSql(centroRaw);

    let rowLimit = 10;
    if (cod || nomRaw) {
      rowLimit = 25;
    } else if (centroRaw) {
      rowLimit = 80;
    }

    const ziCols = Array.from({ length: 31 }, (_, i) => `ZI_${i + 1}`).join(
      ',\n        ',
    );

    const query = `
      SELECT 
        id,
        CODIGO,
        NOMBRE,
        EMAIL,
        LUNA,
        CLIENTE,
        HORARIO,
        SERVICIO,
        TotalHoras,
        ${ziCols}
      FROM horario_multicentro
      WHERE ${rbacCondition}
        ${mesCondition}
        ${empleadoFilterSql}
        ${centroHmSql}
      ORDER BY LUNA DESC, CLIENTE ASC, HORARIO ASC
      LIMIT ${rowLimit}
    `;

    this.logger.log(
      `[horario_multicentro_mes] mes=${entidades?.mes ?? '(luna implicită)'} codigo=${cod ?? '-'} nombre=${nomRaw ? `${nomRaw.slice(0, 40)}${nomRaw.length > 40 ? '…' : ''}` : '-'} centro=${centroRaw ?? '-'} empleadoFilter=${empleadoFilterSql ? 'yes' : 'no'} limit=${rowLimit}`,
    );

    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    return results || [];
  }

  /**
   * Para fallback mensual día a día (`plan_trabajo_dia`): empleado concreto.
   * OWN → codigo = userId. ALL → codigo o nombre en entidades; sin eso → null (no recorrer el mes).
   */
  resolveEmpleadoTargetForPlanMesRead(
    userId: string,
    rol: string | null,
    entidades?: { codigo?: string; nombre?: string },
    dataScope?: AssistantDataScope,
  ): { codigo?: string; nombre?: string } | null {
    const scope = this.rbacService.effectiveDataScope(rol, dataScope);
    if (scope === AssistantDataScope.OWN) {
      const c = String(userId).trim();
      return c ? { codigo: c } : null;
    }
    const cod = entidades?.codigo?.trim();
    if (cod) {
      return { codigo: cod };
    }
    const nom = entidades?.nombre?.trim();
    if (nom) {
      return { nombre: nom };
    }
    return null;
  }

  /**
   * Query pentru VACACIONES (foloseÈ™te VacacionesService pentru saldo + query solicitudes)
   */
  async queryVacaciones(
    userId: string,
    rol: string | null,
    entidades?: {
      mes?: string;
      year?: string;
      tipo?: string;
      soloPendientes?: boolean;
    },
    dataScope?: AssistantDataScope,
  ): Promise<any> {
    // VerificÄƒ RBAC
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'codigo',
      dataScope,
    );

    // ConstruieÈ™te condiÈ›ii pentru query
    let tipoCondition = '';
    if (entidades?.tipo) {
      tipoCondition = this.buildAssistantSolicitudTipoFilter(
        'tipo',
        entidades.tipo,
      );
    } else {
      // DacÄƒ nu e specificat, cautÄƒ vacaciones (nu asuntos propios)
      tipoCondition = `AND (tipo = ${this.escapeSql('Vacaciones')} OR tipo = ${this.escapeSql('Vacación')})`;
    }

    let mesCondition = '';
    if (entidades?.mes) {
      const meses = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ];
      const mesNombre = entidades.mes.replace('completo_', '');
      const mesIndex = meses.indexOf(mesNombre);

      if (mesIndex !== -1) {
        const ahora = new Date();
        // VerificÄƒ anul curent È™i anul viitor (dacÄƒ suntem Ã®n decembrie È™i Ã®ntrebÄƒm despre ianuarie)
        let anio = ahora.getFullYear();
        if (ahora.getMonth() === 11 && mesIndex === 0) {
          // Suntem Ã®n decembrie È™i Ã®ntrebÄƒm despre ianuarie â†’ anul viitor
          anio = anio + 1;
        }
        const mes = mesIndex + 1;

        // Prima zi a lunii
        const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
        // Ultima zi a lunii
        const ultimoDia = new Date(anio, mes, 0).getDate();
        const fechaFin = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

        // fecha_fin este VARCHAR, deci trebuie sÄƒ convertim la DATE
        // CautÄƒ solicitudes care se suprapun cu luna specificatÄƒ
        // O solicitare se suprapune dacÄƒ: fecha_inicio <= ultima zi a lunii AND (fecha_fin >= prima zi SAU fecha_fin este NULL)
        mesCondition = `AND (
          fecha_inicio IS NOT NULL 
          AND DATE(fecha_inicio) <= ${this.escapeSql(fechaFin)}
          AND (
            fecha_fin IS NULL 
            OR fecha_fin = ''
            OR STR_TO_DATE(fecha_fin, '%Y-%m-%d') >= ${this.escapeSql(fechaInicio)}
            OR fecha_fin >= ${this.escapeSql(fechaInicio)}
          )
        )`;
        this.logger.log(
          `ðŸ“… Query vacaciones para mes: ${fechaInicio} a ${fechaFin} (anio: ${anio})`,
        );
      }
    } else if (
      entidades?.year &&
      /^\d{4}$/.test(String(entidades.year).trim())
    ) {
      const y = String(entidades.year).trim();
      const fechaInicio = `${y}-01-01`;
      const fechaFin = `${y}-12-31`;
      mesCondition = `AND (
          fecha_inicio IS NOT NULL 
          AND DATE(fecha_inicio) <= ${this.escapeSql(fechaFin)}
          AND (
            fecha_fin IS NULL 
            OR fecha_fin = ''
            OR STR_TO_DATE(fecha_fin, '%Y-%m-%d') >= ${this.escapeSql(fechaInicio)}
            OR fecha_fin >= ${this.escapeSql(fechaInicio)}
          )
        )`;
      this.logger.log(
        `ðŸ“… Query vacaciones para anio: ${fechaInicio} a ${fechaFin}`,
      );
    }

    let pendientesCondition = '';
    if (entidades?.soloPendientes) {
      pendientesCondition = `AND (
        LOWER(COALESCE(estado,'')) LIKE '%pendiente%'
        OR LOWER(COALESCE(estado,'')) LIKE '%pending%'
        OR LOWER(COALESCE(estado,'')) LIKE '%espera%'
      )`;
    }

    // Query pentru solicitudes de vacaÈ›ii
    // DacÄƒ nu e specificat mes, returneazÄƒ toate solicitudes de vacaÈ›ii (pentru Ã®ntrebÄƒri de follow-up)
    const query = `
      SELECT 
        id,
        codigo,
        nombre,
        tipo,
        estado,
        fecha_inicio,
        fecha_fin,
        fecha_solicitud
      FROM solicitudes
      WHERE ${rbacCondition}
        ${tipoCondition}
        ${mesCondition}
        ${pendientesCondition}
      ORDER BY fecha_solicitud DESC
      LIMIT 50
    `;

    this.logger.log(`ðŸ” Query vacaciones complet:`);
    this.logger.log(`  - RBAC: ${rbacCondition}`);
    this.logger.log(`  - Tipo: ${tipoCondition}`);
    this.logger.log(`  - Mes: ${mesCondition || 'NINGUNO'}`);
    this.logger.log(`  - Query: ${query}`);

    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    this.logger.log(
      `âœ… Query vacaciones retornÃ³ ${results?.length || 0} resultados`,
    );

    if (results && results.length > 0) {
      this.logger.log(
        `ðŸ“‹ Primeros resultados: ${JSON.stringify(results.slice(0, 3), null, 2)}`,
      );
    }

    return results || [];
  }

  /**
   * Diplomas subidas en la app (Prisma; sin columna `archivo`).
   */
  async queryDiplomasForAssistant(
    userId: string,
    rol: string | null,
    dataScope?: AssistantDataScope,
  ): Promise<any[]> {
    const scope = this.rbacService.effectiveDataScope(rol, dataScope);
    const take = scope === AssistantDataScope.ALL ? 400 : 80;
    const uid = String(userId ?? '').trim();
    try {
      const rows = await this.prisma.diploma.findMany({
        where: scope === AssistantDataScope.ALL ? {} : { empleado_id: uid },
        orderBy: { fecha_subida: 'desc' },
        take,
        select: {
          id: true,
          empleado_id: true,
          nombre_empleado: true,
          nombre_archivo: true,
          fecha_subida: true,
          subido_por: true,
          notas: true,
        },
      });
      return rows || [];
    } catch (e: any) {
      this.logger.warn(`queryDiplomasForAssistant: ${e?.message ?? e}`);
      return [];
    }
  }

  /**
   * Empleados ACTIVO sin fila en `Nominas` que cubra el mes (nombre) y año indicados.
   */
  private async queryEmpleadosActivosSinNominaMes(
    userId: string,
    rol: string | null,
    entidades: { mes?: string; year?: string },
    dataScope?: AssistantDataScope,
  ): Promise<any[]> {
    const rawMes = String(entidades?.mes ?? '')
      .replace(/^completo_/i, '')
      .toLowerCase()
      .trim();
    if (!rawMes) {
      return [];
    }
    const yearStr =
      entidades?.year && /^\d{4}$/.test(String(entidades.year).trim())
        ? String(entidades.year).trim()
        : String(new Date().getFullYear());

    const rbacDe = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'de.CODIGO',
      dataScope,
    );
    const scope = this.rbacService.effectiveDataScope(rol, dataScope);
    const limit = scope === AssistantDataScope.ALL ? 500 : 50;

    const likeMes = this.escapeSql(`%${rawMes}%`);
    const likeYear = this.escapeSql(`%${yearStr}%`);
    const escYearEq = this.escapeSql(yearStr);
    const escMesLabel = this.escapeSql(rawMes);

    const query = `
      SELECT
        CAST(de.CODIGO AS CHAR) AS codigo_empleado,
        de.\`NOMBRE / APELLIDOS\` AS nombre,
        de.ESTADO AS estado,
        'sin_nomina_mes' AS row_kind,
        ${escMesLabel} AS mes_referencia,
        ${escYearEq} AS ano_referencia
      FROM DatosEmpleados de
      WHERE de.ESTADO = 'ACTIVO'
        AND ${rbacDe}
        AND NOT EXISTS (
          SELECT 1 FROM Nominas n
          WHERE CAST(n.codigo_empleado AS CHAR) = CAST(de.CODIGO AS CHAR)
            AND LOWER(CONCAT(' ', COALESCE(n.Mes, ''), ' ', COALESCE(CAST(n.Ano AS CHAR), ''), ' '))
                LIKE LOWER(${likeMes})
            AND (
              TRIM(COALESCE(CAST(n.Ano AS CHAR), '')) = ''
              OR TRIM(COALESCE(CAST(n.Ano AS CHAR), '')) = ${escYearEq}
              OR LOWER(CONCAT(' ', COALESCE(n.Mes, ''), ' ', COALESCE(CAST(n.Ano AS CHAR), ''), ' '))
                  LIKE LOWER(${likeYear})
            )
        )
      ORDER BY de.\`NOMBRE / APELLIDOS\`
      LIMIT ${limit}
    `;

    this.logger.log(
      `🔍 queryEmpleadosActivosSinNominaMes: mes=${rawMes} año=${yearStr}`,
    );
    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    return results || [];
  }

  /**
   * Query pentru NOMINAS (filas existente) o empleados sin nómina para mes/año.
   */
  async queryNominas(
    userId: string,
    rol: string | null,
    entidades?: {
      mes?: string;
      year?: string;
      faltan_nominas?: boolean;
    },
    dataScope?: AssistantDataScope,
  ): Promise<any[]> {
    if (entidades?.faltan_nominas) {
      return this.queryEmpleadosActivosSinNominaMes(
        userId,
        rol,
        entidades,
        dataScope,
      );
    }

    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'codigo_empleado',
      dataScope,
    );

    let mesCondition = '';
    if (entidades?.mes) {
      const mesToken = String(entidades.mes)
        .replace(/^completo_/i, '')
        .toLowerCase();
      mesCondition = `AND LOWER(COALESCE(Mes,'')) LIKE LOWER(${this.escapeSql(`%${mesToken}%`)})`;
    }
    let yearCondition = '';
    if (entidades?.year && /^\d{4}$/.test(String(entidades.year).trim())) {
      yearCondition = `AND TRIM(COALESCE(CAST(Ano AS CHAR), '')) = ${this.escapeSql(String(entidades.year).trim())}`;
    }

    const query = `
      SELECT 
        id,
        nombre,
        Mes,
        Ano,
        fecha_subida,
        codigo_empleado
      FROM Nominas
      WHERE ${rbacCondition}
        ${mesCondition}
        ${yearCondition}
      ORDER BY fecha_subida DESC
      LIMIT 40
    `;

    this.logger.log(`ðŸ” Query nominas: ${query.substring(0, 100)}...`);

    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    return results || [];
  }

  /**
   * Query pentru SOLICITUDES (toate tipurile: vacaciones, bajas, permisos, etc.)
   * Filtre opționale: tipo, soloPendientes, fecha (zi), mes, year — suprapunere interval.
   */
  async querySolicitudes(
    userId: string,
    rol: string | null,
    entidades?: {
      tipo?: string;
      soloPendientes?: boolean;
      fecha?: string;
      mes?: string;
      year?: string;
      proximos_dias?: number;
    },
    dataScope?: AssistantDataScope,
  ): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      's.codigo',
      dataScope,
    );

    let tipoCondition = '';
    if (entidades?.tipo) {
      tipoCondition = this.buildAssistantSolicitudTipoFilter(
        's.tipo',
        entidades.tipo,
      );
    }

    let pendientesCondition = '';
    if (entidades?.soloPendientes) {
      pendientesCondition = `AND (
        LOWER(COALESCE(s.estado,'')) LIKE '%pendiente%'
        OR LOWER(COALESCE(s.estado,'')) LIKE '%pending%'
        OR LOWER(COALESCE(s.estado,'')) LIKE '%espera%'
      )`;
    }

    let periodCondition = '';
    /** true = mes/año/día explícito (lista grande, orden reciente primero). */
    let orderNewestFirst = false;
    const ymd = String(entidades?.fecha ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      periodCondition = `AND (
        s.fecha_inicio IS NOT NULL
        AND TRIM(COALESCE(s.fecha_inicio,'')) <> ''
        AND (
          DATE(STR_TO_DATE(s.fecha_inicio, '%Y-%m-%d')) <= ${this.escapeSql(ymd)}
          OR s.fecha_inicio <= ${this.escapeSql(ymd)}
        )
        AND (
          s.fecha_fin IS NULL
          OR TRIM(COALESCE(s.fecha_fin,'')) = ''
          OR STR_TO_DATE(s.fecha_fin, '%Y-%m-%d') >= ${this.escapeSql(ymd)}
          OR s.fecha_fin >= ${this.escapeSql(ymd)}
        )
      )`;
      orderNewestFirst = true;
      this.logger.log(`📅 querySolicitudes: filtro día ${ymd}`);
    } else if (entidades?.mes) {
      const meses = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ];
      const mesNombre = entidades.mes.replace('completo_', '');
      const mesIndex = meses.indexOf(mesNombre);
      if (mesIndex !== -1) {
        const ahora = new Date();
        let anio = ahora.getFullYear();
        if (ahora.getMonth() === 11 && mesIndex === 0) {
          anio = anio + 1;
        }
        const mesNum = mesIndex + 1;
        const fechaInicio = `${anio}-${String(mesNum).padStart(2, '0')}-01`;
        const ultimoDia = new Date(anio, mesNum, 0).getDate();
        const fechaFin = `${anio}-${String(mesNum).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
        periodCondition = `AND (
          s.fecha_inicio IS NOT NULL
          AND DATE(s.fecha_inicio) <= ${this.escapeSql(fechaFin)}
          AND (
            s.fecha_fin IS NULL
            OR s.fecha_fin = ''
            OR STR_TO_DATE(s.fecha_fin, '%Y-%m-%d') >= ${this.escapeSql(fechaInicio)}
            OR s.fecha_fin >= ${this.escapeSql(fechaInicio)}
          )
        )`;
        orderNewestFirst = true;
        this.logger.log(
          `📅 querySolicitudes: filtro mes ${fechaInicio} .. ${fechaFin}`,
        );
      }
    } else if (
      entidades?.year &&
      /^\d{4}$/.test(String(entidades.year).trim())
    ) {
      const y = String(entidades.year).trim();
      const fechaInicio = `${y}-01-01`;
      const fechaFin = `${y}-12-31`;
      periodCondition = `AND (
        s.fecha_inicio IS NOT NULL
        AND DATE(s.fecha_inicio) <= ${this.escapeSql(fechaFin)}
        AND (
          s.fecha_fin IS NULL
          OR s.fecha_fin = ''
          OR STR_TO_DATE(s.fecha_fin, '%Y-%m-%d') >= ${this.escapeSql(fechaInicio)}
          OR s.fecha_fin >= ${this.escapeSql(fechaInicio)}
        )
      )`;
      orderNewestFirst = true;
      this.logger.log(`📅 querySolicitudes: filtro año ${y}`);
    } else if (
      entidades?.proximos_dias != null &&
      Number.isFinite(Number(entidades.proximos_dias)) &&
      Number(entidades.proximos_dias) >= 1 &&
      Number(entidades.proximos_dias) <= 365
    ) {
      const n = Math.floor(Number(entidades.proximos_dias));
      periodCondition = `AND (
        s.fecha_inicio IS NOT NULL
        AND TRIM(COALESCE(s.fecha_inicio,'')) <> ''
        AND (
          DATE(STR_TO_DATE(s.fecha_inicio, '%Y-%m-%d')) <= DATE_ADD(CURDATE(), INTERVAL ${n - 1} DAY)
          OR s.fecha_inicio <= DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL ${n - 1} DAY), '%Y-%m-%d')
        )
        AND (
          s.fecha_fin IS NULL
          OR TRIM(COALESCE(s.fecha_fin,'')) = ''
          OR STR_TO_DATE(s.fecha_fin, '%Y-%m-%d') >= CURDATE()
          OR s.fecha_fin >= DATE_FORMAT(CURDATE(), '%Y-%m-%d')
        )
      )`;
      orderNewestFirst = false;
      this.logger.log(`📅 querySolicitudes: ventana próximos ${n} días`);
    }

    let defaultNotPastEnded = '';
    if (!periodCondition) {
      defaultNotPastEnded = `AND (
        s.fecha_fin IS NULL
        OR TRIM(COALESCE(s.fecha_fin,'')) = ''
        OR STR_TO_DATE(s.fecha_fin, '%Y-%m-%d') >= CURDATE()
        OR s.fecha_fin >= DATE_FORMAT(CURDATE(), '%Y-%m-%d')
      )`;
    }

    const scope = this.rbacService.effectiveDataScope(rol, dataScope);
    const fullAccess = scope === AssistantDataScope.ALL;
    let limit = 20;
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      limit = fullAccess ? 200 : 50;
    } else if (entidades?.mes && periodCondition) {
      limit = fullAccess ? 150 : 40;
    } else if (entidades?.year && periodCondition) {
      limit = fullAccess ? 150 : 40;
    } else if (
      entidades?.proximos_dias != null &&
      Number(entidades.proximos_dias) >= 1 &&
      periodCondition
    ) {
      limit = fullAccess ? 300 : 80;
    } else {
      limit = fullAccess ? 80 : 20;
    }

    const orderBySql = orderNewestFirst
      ? 's.fecha_inicio DESC, s.fecha_solicitud DESC'
      : 's.fecha_inicio ASC, s.fecha_solicitud DESC';

    const query = `
      SELECT 
        s.id,
        s.codigo,
        COALESCE(
          NULLIF(TRIM(s.nombre), ''),
          NULLIF(TRIM(de.\`NOMBRE / APELLIDOS\`), ''),
          NULLIF(TRIM(de.NOMBRE), ''),
          s.codigo
        ) AS nombre,
        s.tipo,
        s.estado,
        s.fecha_inicio,
        s.fecha_fin,
        s.fecha_solicitud,
        s.tipo_justificante
      FROM solicitudes s
      LEFT JOIN DatosEmpleados de
        ON CAST(de.CODIGO AS CHAR) = CAST(s.codigo AS CHAR)
      WHERE ${rbacCondition}
        ${tipoCondition}
        ${pendientesCondition}
        ${periodCondition}
        ${defaultNotPastEnded}
      ORDER BY ${orderBySql}
      LIMIT ${limit}
    `;

    this.logger.log(`🔍 Query solicitudes: ${query.substring(0, 120)}...`);

    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    return results || [];
  }

  /**
   * Registros en tabla `Ausencias` (misma lógica SQL que n8n «Cron absente»):
   * FECHA puede ser un día o rango "YYYY-MM-DD - YYYY-MM-DD".
   * Ventana por defecto: hoy .. hoy+10 días (intersección), alineado al cron.
   */
  async queryAusenciasCalendarioForAssistant(
    userId: string,
    rol: string | null,
    entidades?: {
      fecha?: string;
      mes?: string;
      year?: string;
      proximos_dias?: number;
    },
    dataScope?: AssistantDataScope,
  ): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'a.CODIGO',
      dataScope,
    );

    const ymd = String(entidades?.fecha ?? '').trim();
    let overlapCondition: string;

    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      const d = this.escapeSql(ymd);
      overlapCondition = `t.fecha_inicio IS NOT NULL AND t.fecha_fin IS NOT NULL
        AND t.fecha_fin >= ${d} AND t.fecha_inicio <= ${d}`;
      this.logger.log(`📅 queryAusenciasCalendario: día ${ymd}`);
    } else if (entidades?.mes) {
      const meses = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ];
      const mesNombre = entidades.mes.replace('completo_', '');
      const mesIndex = meses.indexOf(mesNombre);
      if (mesIndex !== -1) {
        const ahora = new Date();
        let anio = ahora.getFullYear();
        if (ahora.getMonth() === 11 && mesIndex === 0) {
          anio = anio + 1;
        }
        const mesNum = mesIndex + 1;
        const fechaInicio = `${anio}-${String(mesNum).padStart(2, '0')}-01`;
        const ultimoDia = new Date(anio, mesNum, 0).getDate();
        const fechaFin = `${anio}-${String(mesNum).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
        const fi = this.escapeSql(fechaInicio);
        const ff = this.escapeSql(fechaFin);
        overlapCondition = `t.fecha_inicio IS NOT NULL AND t.fecha_fin IS NOT NULL
          AND t.fecha_fin >= ${fi} AND t.fecha_inicio <= ${ff}`;
        this.logger.log(
          `📅 queryAusenciasCalendario: mes ${fechaInicio} .. ${fechaFin}`,
        );
      } else {
        overlapCondition = `t.fecha_fin >= CURDATE()
          AND t.fecha_inicio <= DATE_ADD(CURDATE(), INTERVAL 10 DAY)`;
      }
    } else if (
      entidades?.year &&
      /^\d{4}$/.test(String(entidades.year).trim())
    ) {
      const y = String(entidades.year).trim();
      const fechaInicio = `${y}-01-01`;
      const fechaFin = `${y}-12-31`;
      overlapCondition = `t.fecha_inicio IS NOT NULL AND t.fecha_fin IS NOT NULL
        AND t.fecha_fin >= ${this.escapeSql(fechaInicio)}
        AND t.fecha_inicio <= ${this.escapeSql(fechaFin)}`;
      this.logger.log(`📅 queryAusenciasCalendario: año ${y}`);
    } else if (
      entidades?.proximos_dias != null &&
      Number.isFinite(Number(entidades.proximos_dias)) &&
      Number(entidades.proximos_dias) >= 1 &&
      Number(entidades.proximos_dias) <= 365
    ) {
      const n = Math.floor(Number(entidades.proximos_dias));
      overlapCondition = `t.fecha_inicio IS NOT NULL AND t.fecha_fin IS NOT NULL
        AND t.fecha_fin >= CURDATE()
        AND t.fecha_inicio <= DATE_ADD(CURDATE(), INTERVAL ${n - 1} DAY)`;
      this.logger.log(
        `📅 queryAusenciasCalendario: ventana próximos ${n} días`,
      );
    } else {
      overlapCondition = `t.fecha_fin >= CURDATE()
        AND t.fecha_inicio <= DATE_ADD(CURDATE(), INTERVAL 10 DAY)`;
      this.logger.log(
        `📅 queryAusenciasCalendario: ventana default cron (10 días)`,
      );
    }

    const scopeAus = this.rbacService.effectiveDataScope(rol, dataScope);
    const limit = scopeAus === AssistantDataScope.ALL ? 500 : 100;

    const query = `
SELECT
  t.id,
  t.solicitud_id,
  t.CODIGO,
  t.NOMBRE,
  t.TIPO,
  t.FECHA_RAW,
  t.HORA,
  t.LOCACION,
  t.MOTIVO,
  t.DURACION,
  t.UNIDAD_DURACION,
  t.created_at,
  t.fecha_inicio,
  t.fecha_fin
FROM (
  SELECT
    a.id,
    a.solicitud_id,
    a.CODIGO,
    a.NOMBRE,
    a.TIPO,
    a.FECHA AS FECHA_RAW,
    a.HORA,
    a.LOCACION,
    a.MOTIVO,
    a.DURACION,
    a.UNIDAD_DURACION,
    a.created_at,
    CASE
      WHEN REPLACE(a.FECHA, '- ', ' - ') LIKE '% - %'
        THEN STR_TO_DATE(TRIM(SUBSTRING_INDEX(REPLACE(a.FECHA, '- ', ' - '), ' - ', 1)), '%Y-%m-%e')
      ELSE STR_TO_DATE(a.FECHA, '%Y-%m-%e')
    END AS fecha_inicio,
    CASE
      WHEN REPLACE(a.FECHA, '- ', ' - ') LIKE '% - %'
        THEN STR_TO_DATE(TRIM(SUBSTRING_INDEX(REPLACE(a.FECHA, '- ', ' - '), ' - ', -1)), '%Y-%m-%e')
      ELSE STR_TO_DATE(a.FECHA, '%Y-%m-%e')
    END AS fecha_fin
  FROM Ausencias a
  WHERE ${rbacCondition}
) AS t
WHERE ${overlapCondition}
ORDER BY t.fecha_inicio, t.NOMBRE
LIMIT ${limit}
`;

    this.logger.log(
      `🔍 queryAusenciasCalendario: ${query.substring(0, 100)}...`,
    );
    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    return results || [];
  }

  /**
   * Query pentru DOCUMENTOS
   */
  async queryDocumentos(
    userId: string,
    rol: string | null,
    dataScope?: AssistantDataScope,
  ): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'codigo',
      dataScope,
    );

    const query = `
      SELECT 
        id,
        codigo,
        nombre,
        tipo_documento,
        fecha_subida,
        estado
      FROM InspeccionesDocumentos
      WHERE ${rbacCondition}
      ORDER BY fecha_subida DESC
      LIMIT 20
    `;

    this.logger.log(`ðŸ” Query documentos: ${query.substring(0, 100)}...`);

    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    return results || [];
  }

  /**
   * Comunicados publicados + si el usuario ya los marcó leídos (sin adjuntos binarios).
   * Lista publicărilor este aceeași pentru toți (broadcast); `rol` / `dataScope` nu filtrează rânduri,
   * dar se acceptă în semnătură pentru consistență cu tool-ul assistant.
   */
  async queryComunicadosForAssistant(
    userId: string,
    _rol?: string | null,
    _dataScope?: AssistantDataScope,
  ): Promise<any[]> {
    const uid = String(userId ?? '').trim();
    if (!uid) {
      return [];
    }
    try {
      const rows = await this.prisma.comunicado.findMany({
        where: { publicado: true },
        orderBy: { created_at: 'desc' },
        take: 25,
        select: {
          id: true,
          titulo: true,
          contenido: true,
          autor_id: true,
          created_at: true,
          leidos: {
            where: { user_id: uid },
            select: { read_at: true },
            take: 1,
          },
        },
      });
      return rows.map((r) => {
        const c = String(r.contenido ?? '')
          .replace(/\s+/g, ' ')
          .trim();
        const max = 400;
        const resumen_texto = c.length <= max ? c : `${c.slice(0, max - 1)}…`;
        const leidosArr = r.leidos ?? [];
        const leido_por_mi = leidosArr.length > 0;
        return {
          id: String(r.id),
          titulo: r.titulo,
          resumen_texto,
          autor_id: r.autor_id,
          created_at: r.created_at,
          leido_por_mi,
          leido_en: leido_por_mi ? leidosArr[0].read_at : null,
        };
      });
    } catch (e: any) {
      this.logger.warn(`queryComunicadosForAssistant: ${e?.message ?? e}`);
      return [];
    }
  }

  /**
   * Documentación solicitada al empleado (tabla documentos_solicitados).
   */
  async queryDocumentosSolicitadosForAssistant(
    userId: string,
    rol: string | null,
    entidades?: { soloPendientes?: boolean },
    dataScope?: AssistantDataScope,
  ): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'empleado_id',
      dataScope,
    );
    let extra = '';
    if (entidades?.soloPendientes) {
      extra = `AND LOWER(COALESCE(estado,'')) LIKE '%pendiente%'`;
    }
    const query = `
      SELECT
        id,
        empleado_id,
        tipo_documento,
        estado,
        fecha_solicitud,
        fecha_completado
      FROM documentos_solicitados
      WHERE ${rbacCondition}
        ${extra}
      ORDER BY fecha_solicitud DESC
      LIMIT 30
    `;
    try {
      const results = await this.prisma.$queryRawUnsafe<any[]>(query);
      return results || [];
    } catch (e: any) {
      this.logger.error(
        `queryDocumentosSolicitadosForAssistant: ${e?.message ?? e}`,
      );
      return [];
    }
  }

  /**
   * KB: tÃ©rminos normalizados en AND; sin tÃ©rminos â†’ artÃ­culos recientes.
   * Devuelve meta no sensible para contrato / telemetrÃ­a.
   */
  async queryKbArticles(
    categoria?: string,
    searchTerm?: string,
  ): Promise<{ rows: any[]; meta: KbQueryMeta }> {
    let conditions = 'activo = TRUE';

    if (categoria) {
      conditions += ` AND categoria = ${this.escapeSql(categoria)}`;
    }

    const fragments = normalizeKbSearchTerms(
      searchTerm,
      ASSISTANT_KB_MAX_SEARCH_TERMS,
    );

    for (const frag of fragments) {
      const pat = `%${frag}%`;
      conditions += ` AND (titulo LIKE ${this.escapeSql(pat)} OR contenido LIKE ${this.escapeSql(pat)})`;
    }

    const lim = ASSISTANT_KB_QUERY_LIMIT;
    const firstFrag = fragments[0];
    const orderSql = firstFrag
      ? `(CASE WHEN titulo LIKE ${this.escapeSql(`%${firstFrag}%`)} THEN 0 ELSE 1 END), updated_at DESC`
      : 'updated_at DESC';

    const query = `
      SELECT 
        id,
        titulo,
        contenido,
        categoria,
        tags
      FROM kb_articles
      WHERE ${conditions}
      ORDER BY ${orderSql}
      LIMIT ${lim}
    `;

    this.logger.log(`ðŸ” Query KB: tokens=${fragments.length}, limit=${lim}`);

    const results = (await this.prisma.$queryRawUnsafe<any[]>(query)) || [];
    const meta: KbQueryMeta = {
      searchActive: fragments.length > 0,
      tokenCount: fragments.length,
      resultLimit: lim,
      articleCount: results.length,
    };

    return { rows: results, meta };
  }

  /**
   * Filtru nume angajat aliniat cu EmpleadosService.findEmpleadoByIdentifier / GestoriaService:
   * normalizare underscore și spații, cuvinte cu lungime > 2, AND între LIKE-uri
   * (ordinea în `NOMBRE / APELLIDOS` nu trebuie să coincidă cu textul introdus).
   */
  private buildNombreEmpleadoSqlFilter(
    columnExpr: string,
    nombreRaw: string | undefined,
  ): string {
    if (!nombreRaw?.trim()) {
      return '';
    }
    let nombreNormalizado = nombreRaw
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s'-]/gu, '')
      .trim()
      .slice(0, 80);
    if (nombreNormalizado.length < 2) {
      return '';
    }
    let palabras = nombreNormalizado.split(/\s+/).filter((p) => p.length > 2);
    if (palabras.length === 0) {
      palabras = [nombreNormalizado];
    }
    const col = `UPPER(REPLACE(REPLACE(${columnExpr}, '_', ' '), '  ', ' '))`;
    const parts = palabras.map((palabra) => {
      const p = palabra.toUpperCase();
      return `${col} LIKE ${this.escapeSql(`%${p}%`)}`;
    });
    return `AND (${parts.join(' AND ')})`;
  }

  /**
   * `horario_multicentro` no tiene columna CENTRO: cliente / servicio.
   */
  private buildHorarioMulticentroMesCentroClienteServicioFilterSql(
    centroRaw: string | undefined,
  ): string {
    if (!centroRaw?.trim()) {
      return '';
    }
    const f1 = this.buildCentroTrabajoSqlFilter('CLIENTE', centroRaw);
    const f2 = this.buildCentroTrabajoSqlFilter('SERVICIO', centroRaw);
    const p1 = f1.replace(/^AND\s+/i, '').trim();
    const p2 = f2.replace(/^AND\s+/i, '').trim();
    if (!p1 && !p2) {
      return '';
    }
    if (p1 && p2) {
      return `AND (${p1} OR ${p2})`;
    }
    return p1 ? `AND (${p1})` : `AND (${p2})`;
  }

  /**
   * Filtru centru de lucru: „Bosquepino” trebuie să se potrivească și cu „BOSQUE PINO” / „bosque pino” din DB
   * (compară coloana și textul fără spații, plus LIKE cu %).
   */
  private buildCentroTrabajoSqlFilter(
    columnExpr: string,
    centroRaw: string | undefined,
  ): string {
    if (!centroRaw?.trim()) {
      return '';
    }
    let t = centroRaw
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s'-]/gu, '')
      .trim()
      .slice(0, 80);
    if (t.length < 2) {
      return '';
    }
    const colNoSpace = `REPLACE(UPPER(TRIM(${columnExpr})), ' ', '')`;
    const needleNoSpace = t.replace(/\s+/g, '').toUpperCase();
    return `AND ${colNoSpace} LIKE ${this.escapeSql(`%${needleNoSpace}%`)}`;
  }

  /**
   * Centru pentru plan zilnic: `CENTRO TRABAJO` **sau** rând în `horario_multicentro` (CLIENTE + zi cu ore).
   */
  private buildCentroPlanFilterSql(centroRaw: string | undefined): string {
    if (!centroRaw?.trim()) {
      return '';
    }
    let t = centroRaw
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s'-]/gu, '')
      .trim()
      .slice(0, 80);
    if (t.length < 2) {
      return '';
    }
    const needleNoSpace = t.replace(/\s+/g, '').toUpperCase();
    const likePattern = `%${needleNoSpace}%`;
    const colTrabajo = `REPLACE(UPPER(TRIM(de.\`CENTRO TRABAJO\`)), ' ', '')`;
    const ziCase = `CASE DAY(@fecha_buscar) ${Array.from({ length: 31 }, (_, i) => `WHEN ${i + 1} THEN hm.ZI_${i + 1}`).join(' ')} END`;
    return `AND (
      ${colTrabajo} LIKE ${this.escapeSql(likePattern)}
      OR EXISTS (
        SELECT 1 FROM horario_multicentro hm
        WHERE CAST(hm.CODIGO AS CHAR) = CAST(de.CODIGO AS CHAR)
          AND hm.LUNA = @lunaselectata
          AND REPLACE(UPPER(TRIM(COALESCE(hm.CLIENTE,''))), ' ', '') LIKE ${this.escapeSql(likePattern)}
          AND NULLIF(TRIM(${ziCase}), '') IS NOT NULL
          AND UPPER(TRIM(${ziCase})) NOT IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X','0','0H')
      )
    )`;
  }

  private escapeSql(value: string): string {
    if (!value) return "''";
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  /**
   * Chei canonice din assistant (intent-classifier) → valori `solicitudes.tipo` din app.
   * Altfel: egalitate exactă cu stringul primit (compat înapoi).
   */
  private buildAssistantSolicitudTipoFilter(
    columnRef: string,
    tipo: string,
  ): string {
    const t = String(tipo ?? '').trim();
    if (!t) return '';

    if (t === 'ausencia_justificada') {
      return `AND ${columnRef} = ${this.escapeSql('Ausencias justificada')}`;
    }
    if (t === 'baja') {
      return `AND ${columnRef} = ${this.escapeSql('BAJA_VOLUNTARIA')}`;
    }
    if (t === 'vacaciones') {
      return `AND (${columnRef} = ${this.escapeSql('Vacaciones')} OR ${columnRef} = ${this.escapeSql('Vacación')})`;
    }
    if (t === 'asunto_propio' || t === 'asuntos_propios') {
      return `AND (${columnRef} = ${this.escapeSql('Asunto Propio')} OR ${columnRef} = ${this.escapeSql('Asuntos Propios')})`;
    }

    return `AND ${columnRef} = ${this.escapeSql(t)}`;
  }
}
