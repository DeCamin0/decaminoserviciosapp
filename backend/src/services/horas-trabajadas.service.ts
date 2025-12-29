import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as mysql from 'mysql2/promise';

@Injectable()
export class HorasTrabajadasService {
  private readonly logger = new Logger(HorasTrabajadasService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper pentru a obține configurația de conexiune MySQL
   */
  private async getDbConnectionConfig(): Promise<any> {
    const dbUrl = process.env.DATABASE_URL;

    if (typeof dbUrl === 'string') {
      const url = new URL(dbUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port || '3306'),
        user: url.username,
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        multipleStatements: true,
      };
    }

    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'decaminoservicios',
      multipleStatements: true,
    };
  }

  /**
   * Helper pentru a extrage rândurile de date din rezultatul mysql2
   */
  private extractRowsFromQueryResult(queryResult: any): any[] {
    let rows: any[] = [];

    if (Array.isArray(queryResult) && queryResult.length >= 1) {
      const firstResult = queryResult[0];

      if (Array.isArray(firstResult)) {
        // Caută ultimul array care conține date (nu OkPackets din SET statements)
        for (let i = firstResult.length - 1; i >= 0; i--) {
          const item = firstResult[i];

          if (Array.isArray(item) && item.length > 0) {
            const firstRow = item[0];
            if (
              firstRow &&
              typeof firstRow === 'object' &&
              'empleadoId' in firstRow &&
              !('fieldCount' in firstRow)
            ) {
              rows = item;
              break;
            }
          }
        }
      }
    }

    return rows;
  }

  /**
   * Resumen mensual - toți angajații ACTIVO sau un singur angajat dacă codigo este furnizat
   * Replică logica din n8n: "luna" query + "Code in JavaScript2"
   */
  async getResumenMensual(mes: string, codigo?: string): Promise<any[]> {
    try {
      if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
        throw new BadRequestException('mes must be in format YYYY-MM');
      }

      // SQL query pentru resumen mensual (din n8n "luna")
      // Este identic cu cel din MonthlyAlertsService.getResumenMensual
      const codigoFilter = codigo
        ? `SET @codigo_filtro = '${codigo.replace(/'/g, "''")}';`
        : 'SET @codigo_filtro = NULL;';
      const query = `
        SET @lunaselectata = '${mes}';
        SET @ccaa_default  = 'ES-MD';
        SET @d_first := STR_TO_DATE(CONCAT(@lunaselectata,'-01'), '%Y-%m-%d');
        SET @d_last  := LAST_DAY(@d_first);
        ${codigoFilter}

        WITH RECURSIVE fechas AS (
          SELECT @d_first AS d
          UNION ALL
          SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM fechas WHERE d < @d_last
        ),
        cuadrante_unpivot AS (
          SELECT CAST(cq.CODIGO AS CHAR) AS empleadoId, 1  AS dia, cq.CENTRO AS centro_cuadrante, cq.ZI_1  AS val FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 2 , cq.CENTRO, cq.ZI_2  FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 3 , cq.CENTRO, cq.ZI_3  FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 4 , cq.CENTRO, cq.ZI_4  FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 5 , cq.CENTRO, cq.ZI_5  FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 6 , cq.CENTRO, cq.ZI_6  FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 7 , cq.CENTRO, cq.ZI_7  FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 8 , cq.CENTRO, cq.ZI_8  FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 9 , cq.CENTRO, cq.ZI_9  FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),10 , cq.CENTRO, cq.ZI_10 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),11 , cq.CENTRO, cq.ZI_11 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),12 , cq.CENTRO, cq.ZI_12 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),13 , cq.CENTRO, cq.ZI_13 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),14 , cq.CENTRO, cq.ZI_14 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),15 , cq.CENTRO, cq.ZI_15 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),16 , cq.CENTRO, cq.ZI_16 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),17 , cq.CENTRO, cq.ZI_17 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),18 , cq.CENTRO, cq.ZI_18 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),19 , cq.CENTRO, cq.ZI_19 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),20 , cq.CENTRO, cq.ZI_20 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),21 , cq.CENTRO, cq.ZI_21 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),22 , cq.CENTRO, cq.ZI_22 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),23 , cq.CENTRO, cq.ZI_23 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),24 , cq.CENTRO, cq.ZI_24 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),25 , cq.CENTRO, cq.ZI_25 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),26 , cq.CENTRO, cq.ZI_26 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),27 , cq.CENTRO, cq.ZI_27 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),28 , cq.CENTRO, cq.ZI_28 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),29 , cq.CENTRO, cq.ZI_29 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),30 , cq.CENTRO, cq.ZI_30 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),31 , cq.CENTRO, cq.ZI_31 FROM cuadrante cq WHERE cq.LUNA=@lunaselectata
        ),
        cuadrante_sum AS (
          SELECT
            empleadoId,
            MAX(centro_cuadrante) AS centro_cuadrante,
            ROUND(SUM(
              CASE 
                WHEN UPPER(TRIM(val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
                WHEN TRIM(val) LIKE '%:%-%:%' THEN (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(val),' ',-1),'-',-1),' ',1), '%H:%i'))
                                          - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(val),' ',-1),'-', 1),' ',1), '%H:%i'))
                                          + 86400) % 86400) / 3600)
                WHEN TRIM(val) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 
                  -- Format "24h (3×8h)" - extrage orele per tură din paranteză (8h)
                  CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(val), '×', -1), 'h', 1) AS DECIMAL(10,2))
                WHEN TRIM(val) REGEXP '^[0-9]+h' THEN 
                  CAST(SUBSTRING_INDEX(TRIM(val), 'h', 1) AS DECIMAL(10,2))
                ELSE 0
              END
            ),2) AS horas_cuadrante_mes
          FROM cuadrante_unpivot
          GROUP BY empleadoId
        ),
        cuadrante_dia AS (
          SELECT
            cu.empleadoId,
            DATE_ADD(@d_first, INTERVAL (cu.dia - 1) DAY) AS fecha,
            cu.dia,
            CASE WHEN cu.val IS NOT NULL AND TRIM(cu.val) <> '' THEN 1 ELSE 0 END AS tiene_cuadrante,
            ROUND(
              CASE 
                WHEN UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
                WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN 
                  -- Format "08:00-17:00" sau "09:00-15:00 / 16:00-20:00"
                  -- Pentru moment, calculăm doar prima tură (pentru compatibilitate)
                  -- Logica completă pentru ture multiple va fi implementată în frontend
                  (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i'))
                                           - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i'))
                                           + 86400) % 86400) / 3600)
                WHEN TRIM(cu.val) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 
                  -- Format "24h (3×8h)" - extrage orele per tură din paranteză (8h)
                  CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val), '×', -1), 'h', 1) AS DECIMAL(10,2))
                WHEN TRIM(cu.val) REGEXP '^[0-9]+h' THEN 
                  CAST(SUBSTRING_INDEX(TRIM(cu.val), 'h', 1) AS DECIMAL(10,2))
                ELSE 0
              END
            ,2) AS horas_cuadrante_dia
          FROM cuadrante_unpivot cu
        ),
        horario_dia_m AS (
          SELECT
            CAST(de.CODIGO AS CHAR) AS empleadoId,
            f.d       AS fecha,
            DAY(f.d)  AS dia,
            CASE DAYOFWEEK(f.d)
              WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in1), CONCAT(f.d,' ',h.lun_out1)) + 1440) % 1440, 0)
              WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in1), CONCAT(f.d,' ',h.mar_out1)) + 1440) % 1440, 0)
              WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in1), CONCAT(f.d,' ',h.mie_out1)) + 1440) % 1440, 0)
              WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in1), CONCAT(f.d,' ',h.joi_out1)) + 1440) % 1440, 0)
              WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in1), CONCAT(f.d,' ',h.vin_out1)) + 1440) % 1440, 0)
              WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in1), CONCAT(f.d,' ',h.sam_out1)) + 1440) % 1440, 0)
              WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in1), CONCAT(f.d,' ',h.dum_out1)) + 1440) % 1440, 0)
            END AS m1,
            CASE DAYOFWEEK(f.d)
              WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in2), CONCAT(f.d,' ',h.lun_out2)) + 1440) % 1440, 0)
              WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in2), CONCAT(f.d,' ',h.mar_out2)) + 1440) % 1440, 0)
              WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in2), CONCAT(f.d,' ',h.mie_out2)) + 1440) % 1440, 0)
              WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in2), CONCAT(f.d,' ',h.joi_out2)) + 1440) % 1440, 0)
              WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in2), CONCAT(f.d,' ',h.vin_out2)) + 1440) % 1440, 0)
              WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in2), CONCAT(f.d,' ',h.sam_out2)) + 1440) % 1440, 0)
              WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in2), CONCAT(f.d,' ',h.dum_out2)) + 1440) % 1440, 0)
            END AS m2,
            CASE DAYOFWEEK(f.d)
              WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in3), CONCAT(f.d,' ',h.lun_out3)) + 1440) % 1440, 0)
              WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in3), CONCAT(f.d,' ',h.mar_out3)) + 1440) % 1440, 0)
              WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in3), CONCAT(f.d,' ',h.mie_out3)) + 1440) % 1440, 0)
              WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in3), CONCAT(f.d,' ',h.joi_out3)) + 1440) % 1440, 0)
              WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in3), CONCAT(f.d,' ',h.vin_out3)) + 1440) % 1440, 0)
              WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in3), CONCAT(f.d,' ',h.sam_out3)) + 1440) % 1440, 0)
              WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in3), CONCAT(f.d,' ',h.dum_out3)) + 1440) % 1440, 0)
            END AS m3
          FROM DatosEmpleados de
          JOIN fechas f
          LEFT JOIN horarios h
            ON h.centro_nombre = de.\`CENTRO TRABAJO\`
           AND h.grupo_nombre  = de.\`GRUPO\`
           AND h.vigente_desde <= f.d
           AND (h.vigente_hasta IS NULL OR f.d <= h.vigente_hasta)
          WHERE de.ESTADO='ACTIVO'
          ${codigo ? 'AND de.CODIGO = @codigo_filtro' : ''}
        ),
        horario_dia AS (
          SELECT
            empleadoId,
            fecha,
            dia,
            ROUND(
              CASE 
                WHEN (m1 + m2 + m3) >= 1320 THEN GREATEST(m1, m2, m3) / 60
                ELSE (m1 + m2 + m3) / 60
              END
            ,2) AS horas_horario_dia
          FROM horario_dia_m
        ),
        horario_mes AS (
          SELECT empleadoId, ROUND(SUM(horas_horario_dia),2) AS horas_horario_mes
          FROM horario_dia
          GROUP BY empleadoId
        ),
        empleado_ccaa AS (
          SELECT CAST(de.CODIGO AS CHAR) AS empleadoId, @ccaa_default AS ccaa
          FROM DatosEmpleados de
          WHERE de.ESTADO='ACTIVO'
          ${codigo ? 'AND de.CODIGO = @codigo_filtro' : ''}
        ),
        fiestas_dia AS (
          SELECT 
            ec.empleadoId,
            f.d AS fecha,
            CASE 
              WHEN fi.active=1
               AND DATE(COALESCE(fi.observed_date, fi.date)) = f.d
               AND (
                    LOWER(fi.scope) IN ('nacional','national')
                 OR (LOWER(fi.scope) IN ('autonómico','autonomico','ccaa') AND fi.ccaa_code = ec.ccaa)
               )
              THEN 1 ELSE 0
            END AS es_fiesta
          FROM empleado_ccaa ec
          JOIN fechas f
          LEFT JOIN fiestas fi
            ON DATE(COALESCE(fi.observed_date, fi.date)) = f.d
        ),
        bajas_intervalos AS (
          SELECT
            TRIM(CAST(mc.Codigo_Empleado AS CHAR)) AS empleadoId,
            COALESCE(
              CASE 
                WHEN NULLIF(mc.\`Fecha baja\`, '') IS NULL THEN NULL
                WHEN mc.\`Fecha baja\` REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(mc.\`Fecha baja\`)
                WHEN mc.\`Fecha baja\` LIKE '__/__/____' THEN STR_TO_DATE(mc.\`Fecha baja\`, '%d/%m/%Y')
                ELSE NULL
              END
            ) AS d_ini,
            COALESCE(
              CASE 
                WHEN NULLIF(mc.\`Fecha de alta\`, '') IS NULL THEN NULL
                WHEN mc.\`Fecha de alta\` REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(mc.\`Fecha de alta\`)
                WHEN mc.\`Fecha de alta\` LIKE '__/__/____' THEN STR_TO_DATE(mc.\`Fecha de alta\`, '%d/%m/%Y')
                ELSE NULL
              END,
              @d_last
            ) AS d_fin
          FROM MutuaCasos mc
        ),
        bajas_dia AS (
          SELECT 
            bi.empleadoId,
            f.d AS fecha,
            CASE WHEN f.d BETWEEN bi.d_ini AND bi.d_fin THEN 1 ELSE 0 END AS es_baja
          FROM bajas_intervalos bi
          JOIN fechas f
          WHERE bi.d_ini IS NOT NULL
            AND bi.d_ini <= @d_last
            AND bi.d_fin >= @d_first
        ),
        aus_raw AS (
          SELECT 
            CAST(a.\`CODIGO\` AS CHAR) AS empleadoId,
            TRIM(a.\`TIPO\`)   AS tipo,
            TRIM(REPLACE(REPLACE(a.\`FECHA\`,'–','-'),'—','-')) AS fecha_txt
          FROM Ausencias a
        ),
        aus_parts AS (
          SELECT
            empleadoId,
            tipo,
            CASE 
              WHEN fecha_txt LIKE '% %' 
                THEN TRIM(TRAILING '-' FROM SUBSTRING_INDEX(fecha_txt,' ',1))
              ELSE fecha_txt
            END AS start_raw,
            CASE 
              WHEN fecha_txt LIKE '% %' 
                THEN TRIM(LEADING '-' FROM SUBSTRING_INDEX(fecha_txt,' ',-1))
              ELSE fecha_txt
            END AS end_raw
          FROM aus_raw
        ),
        aus_norm AS (
          SELECT
            empleadoId,
            tipo,
            COALESCE(STR_TO_DATE(start_raw, '%Y-%m-%d'), STR_TO_DATE(start_raw, '%Y-%m-%e')) AS d_start,
            COALESCE(STR_TO_DATE(end_raw,   '%Y-%m-%d'), STR_TO_DATE(end_raw,   '%Y-%m-%e')) AS d_end
          FROM aus_parts
        ),
        aus_dia AS (
          SELECT 
            f.d AS fecha,
            n.empleadoId,
            MAX(CASE WHEN UPPER(n.tipo)='VACACIONES' THEN 1 ELSE 0 END) AS es_vacaciones,
            MAX(CASE WHEN UPPER(n.tipo)<> 'VACACIONES' THEN 1 ELSE 0 END) AS es_ausencia
          FROM fechas f
          JOIN aus_norm n
            ON n.d_start IS NOT NULL 
           AND n.d_end   IS NOT NULL
           AND f.d BETWEEN n.d_start AND n.d_end
          GROUP BY f.d, n.empleadoId
        ),
        empleado_flags AS (
          SELECT
            CAST(de.CODIGO AS CHAR) AS empleadoId,
            CASE 
              WHEN LOWER(TRIM(de.TrabajaFestivos)) IN ('si','sí','s','1','true','da','y') THEN 1
              ELSE 0
            END AS trabaja_festivos
          FROM DatosEmpleados de
          WHERE de.ESTADO='ACTIVO'
          ${codigo ? 'AND de.CODIGO = @codigo_filtro' : ''}
        ),
        empleado_fechas AS (
          SELECT CAST(de.CODIGO AS CHAR) AS empleadoId, f.d AS fecha, DAY(f.d) AS dia
          FROM DatosEmpleados de
          JOIN fechas f
          WHERE de.ESTADO='ACTIVO'
          ${codigo ? 'AND de.CODIGO = @codigo_filtro' : ''}
        ),
        daily_plan AS (
          SELECT
            ef.empleadoId,
            ef.fecha,
            ef.dia,
            CASE
              WHEN bj.es_baja = 1 THEN 0
              WHEN COALESCE(au.es_vacaciones,0) = 1 THEN 0
              WHEN fd2.es_fiesta = 1 AND COALESCE(tf.trabaja_festivos,0) = 0 THEN 0
              WHEN COALESCE(au.es_ausencia,0) = 1 THEN 0
              WHEN cd.tiene_cuadrante = 1 THEN cd.horas_cuadrante_dia
              WHEN hd.horas_horario_dia IS NOT NULL THEN hd.horas_horario_dia
              ELSE 0
            END AS horas_plan,
            CASE
              WHEN bj.es_baja = 1 THEN 'baja_medica'
              WHEN COALESCE(au.es_vacaciones,0) = 1 THEN 'vacaciones'
              WHEN fd2.es_fiesta = 1 AND COALESCE(tf.trabaja_festivos,0) = 0 THEN 'fiesta'
              WHEN COALESCE(au.es_ausencia,0) = 1 THEN 'ausencia'
              WHEN cd.tiene_cuadrante = 1 THEN 'cuadrante'
              WHEN hd.horas_horario_dia IS NOT NULL AND hd.horas_horario_dia > 0 THEN 'horario'
              ELSE 'none'
            END AS fuente,
            COALESCE(bj.es_baja,0)       AS es_baja,
            COALESCE(au.es_vacaciones,0) AS es_vacaciones,
            CASE 
              WHEN COALESCE(au.es_vacaciones,0)=0 THEN COALESCE(au.es_ausencia,0)
              ELSE 0
            END AS es_ausencia,
            COALESCE(fd2.es_fiesta,0)    AS es_fiesta
          FROM empleado_fechas ef
          LEFT JOIN cuadrante_dia cd
            ON cd.empleadoId = ef.empleadoId AND cd.fecha = ef.fecha
          LEFT JOIN horario_dia hd
            ON hd.empleadoId = ef.empleadoId AND hd.fecha = ef.fecha
          LEFT JOIN bajas_dia bj
            ON bj.empleadoId = ef.empleadoId AND bj.fecha = ef.fecha
          LEFT JOIN fiestas_dia fd2
            ON fd2.empleadoId = ef.empleadoId AND fd2.fecha = ef.fecha
          LEFT JOIN aus_dia au
            ON au.empleadoId = ef.empleadoId AND au.fecha = ef.fecha
          LEFT JOIN empleado_flags tf
            ON tf.empleadoId = ef.empleadoId
        ),
        fichaje_base AS (
          SELECT
            CAST(f.CODIGO AS CHAR) AS empleadoId,
            DATE(f.FECHA)          AS fecha,
            f.DURACION             AS duracion
          FROM Fichaje f
          WHERE f.FECHA >= @d_first AND f.FECHA < DATE_ADD(@d_last, INTERVAL 1 DAY)
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
        ),
        fichaje_mes AS (
          SELECT empleadoId, ROUND(SUM(horas_fichadas),2) AS horas_fichadas_mes
          FROM fichaje_dia
          GROUP BY empleadoId
        ),
        combined_json AS (
          SELECT
            dp.empleadoId,
            CONCAT(
              '[',
              GROUP_CONCAT(
                CONCAT(
                  '{"fecha":"', DATE_FORMAT(dp.fecha, '%Y-%m-%d'),
                  '","plan":', CAST(ROUND(dp.horas_plan,2) AS CHAR),
                  ',"plan_fuente":"', dp.fuente, '"',
                  ',"fichado":', CAST(ROUND(COALESCE(fd.horas_fichadas,0),2) AS CHAR),
                  ',"delta":',   CAST(ROUND(COALESCE(fd.horas_fichadas,0) - dp.horas_plan,2) AS CHAR),
                  ',"incompleto":', COALESCE(fd.fichaje_incompleto,0),
                  '}'
                )
                ORDER BY dp.fecha
                SEPARATOR ','
              ),
              ']'
            ) AS detalii_zilnice
          FROM daily_plan dp
          LEFT JOIN fichaje_dia fd
            ON fd.empleadoId = dp.empleadoId AND fd.fecha = dp.fecha
          GROUP BY dp.empleadoId
        ),
        sumar_flags_zile AS (
          SELECT 
            empleadoId,
            SUM(CASE WHEN es_baja=1       THEN 1 ELSE 0 END) AS dias_baja,
            SUM(CASE WHEN es_vacaciones=1 THEN 1 ELSE 0 END) AS dias_vacaciones,
            SUM(CASE WHEN es_ausencia=1   THEN 1 ELSE 0 END) AS dias_ausencia,
            SUM(CASE WHEN es_fiesta=1     THEN 1 ELSE 0 END) AS dias_fiesta
          FROM daily_plan
          GROUP BY empleadoId
        )
        SELECT
          de.CODIGO                               AS empleadoId,
          de.\`NOMBRE / APELLIDOS\`                 AS empleadoNombre,
          de.GRUPO                                AS grupo,
          de.\`CENTRO TRABAJO\`                     AS centro_trabajo,
          de.\`TIPO DE CONTRATO\`                   AS tipo_contrato,
          ROUND(COALESCE(de.\`HORAS DE CONTRATO\`,0),2) AS horas_contrato,
          COALESCE(cs.centro_cuadrante, de.\`CENTRO TRABAJO\`) AS centro_cuadrante,
          CASE 
            WHEN cs.empleadoId IS NOT NULL THEN 'cuadrante'
            WHEN hm.empleadoId IS NOT NULL AND hm.horas_horario_mes > 0 THEN 'horario'
            ELSE 'sin cuadrante y sin horario'
          END AS fuente,
          CASE WHEN cs.empleadoId IS NOT NULL THEN cs.horas_cuadrante_mes END AS horas_cuadrante_mes,
          CASE WHEN cs.empleadoId IS NULL AND hm.horas_horario_mes IS NOT NULL THEN hm.horas_horario_mes END AS horas_horario_mes,
          COALESCE(cs.horas_cuadrante_mes, hm.horas_horario_mes, 0) AS horas_mes,
          ROUND(COALESCE(de.\`HORAS DE CONTRATO\`,0) * (DAY(@d_last)/7), 2) AS horas_contrato_mes,
          COALESCE(fm.horas_fichadas_mes, 0) AS horas_trabajadas_mes,
          hp.\`Horas Mensuales\` AS horas_mensuales_permitidas,
          ROUND( COALESCE(cs.horas_cuadrante_mes, hm.horas_horario_mes, 0)
                - ROUND(COALESCE(de.\`HORAS DE CONTRATO\`,0) * (DAY(@d_last)/7), 2), 2) AS dif_vs_contrato,
          ROUND( COALESCE(cs.horas_cuadrante_mes, hm.horas_horario_mes, 0)
                - COALESCE(hp.\`Horas Mensuales\`, 0), 2) AS dif_vs_permitidas,
          COALESCE(sfz.dias_baja,0)       AS dias_baja,
          COALESCE(sfz.dias_vacaciones,0) AS dias_vacaciones,
          COALESCE(sfz.dias_ausencia,0)   AS dias_ausencia,
          COALESCE(sfz.dias_fiesta,0)     AS dias_fiesta,
          COALESCE(cj.detalii_zilnice, '[]') AS detalii_zilnice
        FROM DatosEmpleados de
        LEFT JOIN cuadrante_sum cs   ON cs.empleadoId = CAST(de.CODIGO AS CHAR)
        LEFT JOIN horario_mes   hm   ON hm.empleadoId = CAST(de.CODIGO AS CHAR)
        LEFT JOIN horaspermitidas hp ON hp.GRUPO      = de.GRUPO
        LEFT JOIN fichaje_mes fm     ON fm.empleadoId = CAST(de.CODIGO AS CHAR)
        LEFT JOIN combined_json  cj  ON cj.empleadoId = CAST(de.CODIGO AS CHAR)
        LEFT JOIN sumar_flags_zile sfz ON sfz.empleadoId = CAST(de.CODIGO AS CHAR)
        WHERE de.ESTADO = 'ACTIVO'
        ${codigo ? `AND de.CODIGO = '${codigo.replace(/'/g, "''")}'` : ''}
        ORDER BY de.CODIGO;
      `;

      const connectionConfig = await this.getDbConnectionConfig();
      const connection = await mysql.createConnection(connectionConfig);

      try {
        const queryResult = await connection.query(query);
        const rows = this.extractRowsFromQueryResult(queryResult);

        // Procesare JavaScript (replică logica din "Code in JavaScript2" din n8n)
        const processedRows = this.processMensualData(rows, mes);

        this.logger.log(
          `✅ Resumen mensual retrieved: ${processedRows.length} empleados (mes: ${mes})`,
        );

        return processedRows;
      } finally {
        await connection.end();
      }
    } catch (error: any) {
      this.logger.error('❌ Error retrieving resumen mensual:', error);
      throw new BadRequestException(
        `Error al obtener resumen mensual: ${error.message}`,
      );
    }
  }

  /**
   * Procesare JavaScript pentru resumen mensual (replică "Code in JavaScript2" din n8n)
   * Optimizat: elimină redundanțe, calculează tot într-un singur pass
   */
  private processMensualData(rows: any[], mes: string): any[] {
    const toNum = (x: any, def = 0): number => {
      if (x === null || x === undefined) return def;
      const n =
        typeof x === 'number' ? x : parseFloat(String(x).replace(',', '.'));
      return Number.isFinite(n) ? n : def;
    };

    const todayMadridParts = (): { y: number; m: number; d: number } => {
      const fmt = new Intl.DateTimeFormat('ro-RO', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = fmt.formatToParts(new Date()).reduce((a, p) => {
        if (p.type !== 'literal') a[p.type] = p.value;
        return a;
      }, {} as any);
      return { y: +parts.year, m: +parts.month, d: +parts.day };
    };

    const yyyymm = (y: number, m: number) =>
      `${y}-${String(m).padStart(2, '0')}`;

    const dayNumberOfZ = (z: any, yyyymm: string): number => {
      if (z.zi != null) return Number(z.zi);
      if (z.dia != null) return Number(z.dia);
      const ds = z.data || z.fecha;
      if (
        typeof ds === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(ds) &&
        ds.startsWith(yyyymm)
      ) {
        return Number(ds.slice(8, 10));
      }
      return 31;
    };

    const today = todayMadridParts();
    const currentYYYYMM = yyyymm(today.y, today.m);
    const lunaSelectata = /^\d{4}-\d{2}$/.test(mes) ? mes : currentYYYYMM;
    const EPS = 0.25;

    return rows.map((emp) => {
      // Parse detalii_zilnice
      let zileAll: any[] = [];
      try {
        zileAll = JSON.parse(emp.detalii_zilnice || '[]');
      } catch {
        zileAll = [];
      }

      // Plan complet lunar (din toate zilele)
      const planFromZileAll = zileAll.reduce(
        (a, z) => a + Number(z.plan ?? 0),
        0,
      );
      const planCuadrante = toNum(emp.horas_cuadrante_mes, planFromZileAll);
      const totalPlanFull = planCuadrante || planFromZileAll;

      // Zile afișate (tăiem la ziua curentă DOAR dacă e luna curentă)
      const cutoff = lunaSelectata === currentYYYYMM ? today.d : 31;
      const zileShown = zileAll.filter(
        (z) => dayNumberOfZ(z, lunaSelectata) <= cutoff,
      );

      // Calcule într-un singur pass: daily + totalTrab + planHastaHoy + exced
      let totalTrab = 0;
      let planHastaHoy = 0;
      let exced = 0;

      const daily = zileShown.map((z) => {
        const plan = Number(z.plan ?? 0);
        const trab = Number(z.fichado ?? 0);

        totalTrab += trab;
        planHastaHoy += plan;

        let ord = 0,
          exc = 0;
        if (trab <= plan) {
          ord = trab;
        } else {
          ord = plan;
          exc = trab - plan;
          exced += exc;
        }
        return {
          ...z,
          ordinarias: +ord.toFixed(2),
          excedente: +exc.toFixed(2),
        };
      });

      const contrato = toNum(emp.horas_contrato_mes, 0);
      const permitidas = toNum(emp.horas_mensuales_permitidas, 0);
      const esPart = ((emp.tipo_contrato || '') as string)
        .toLowerCase()
        .includes('parc');

      // Clasificare
      let totalCompl = 0,
        totalExtra = 0;
      if (contrato > 0) {
        if (esPart) {
          const maxCompl = Math.max(0, contrato - totalPlanFull);
          totalCompl = Math.min(exced, maxCompl);
          totalExtra = Math.max(0, exced - maxCompl);
        } else {
          totalCompl = 0;
          totalExtra = Math.max(0, totalTrab - contrato);
        }
      } else {
        if (permitidas > 0) {
          totalCompl = 0;
          totalExtra = Math.max(0, totalTrab - permitidas);
        } else {
          totalCompl = 0;
          totalExtra = Math.max(0, exced);
        }
      }

      const totalOrdin = totalTrab - totalCompl - totalExtra;

      // Deltas & Statusuri
      const diffPlanHastaHoy = totalTrab - planHastaHoy;
      const diffPlanMensual = totalTrab - totalPlanFull;
      const diffPermitidas = totalTrab - permitidas;

      return {
        ...emp,
        estado_plan_hasta_hoy: diffPlanHastaHoy > EPS ? 'SOBREPASADO' : 'OK',
        estado_plan: diffPlanMensual > EPS ? 'SOBREPASADO' : 'OK',
        estado_permitidas:
          permitidas > 0 && diffPermitidas > EPS ? 'EXCESO' : 'OK',
        total_ordinarias: +totalOrdin.toFixed(2),
        total_complementarias: +totalCompl.toFixed(2),
        total_extraordinarias: +totalExtra.toFixed(2),
        total_trabajadas: +totalTrab.toFixed(2),
        total_plan: +Number(totalPlanFull).toFixed(2),
        total_permitidas: +permitidas.toFixed(2),
        plan_hasta_hoy: +planHastaHoy.toFixed(2),
        diff_plan_hasta_hoy: +diffPlanHastaHoy.toFixed(2),
        diff_plan_mensual: +diffPlanMensual.toFixed(2),
        diff_permitidas: +diffPermitidas.toFixed(2),
        detalii_zilnice: daily,
        luna_selectata: lunaSelectata,
      };
    });
  }

  /**
   * Resumen anual - toți angajații ACTIVO
   * Replică logica din n8n: "query an" + "Code in JavaScript1"
   *
   * PERFORMANCE NOTE: Query-ul procesează multe date (111 angajați × 365 zile) și poate dura ~75-80s.
   * Pentru anii anteriori (care nu se mai schimbă), recomandăm implementarea de caching pentru a reduce timpul de răspuns la <1s.
   * Pentru anul curent, query-ul trebuie să fie în timp real, dar optimizările SQL au redus timpul de la ~82s la ~78s.
   */
  async getResumenAnual(ano: string, codigo?: string): Promise<any[]> {
    try {
      if (!ano || !/^\d{4}$/.test(ano)) {
        throw new BadRequestException('ano must be in format YYYY');
      }

      // SQL query pentru resumen anual (din n8n "query an")
      const codigoFilter = codigo
        ? `SET @codigo_filtro = '${codigo.replace(/'/g, "''")}';`
        : 'SET @codigo_filtro = NULL;';
      const query = `
        SET @ano := CAST('${ano}' AS UNSIGNED);
        SET @ccaa_default := 'ES-MD';
        SET @d_first := STR_TO_DATE(CONCAT(@ano,'-01-01'), '%Y-%m-%d');
        SET @d_last  := STR_TO_DATE(CONCAT(@ano,'-12-31'), '%Y-%m-%d');
        SET SESSION group_concat_max_len = 1000000;
        ${codigoFilter}

        WITH RECURSIVE
        meses AS (
          SELECT DATE_FORMAT(@d_first, '%Y-%m') AS ym, @d_first AS d_first_m, LAST_DAY(@d_first) AS d_last_m
          UNION ALL
          SELECT DATE_FORMAT(DATE_ADD(d_first_m, INTERVAL 1 MONTH), '%Y-%m'),
                 DATE_ADD(d_first_m, INTERVAL 1 MONTH),
                 LAST_DAY(DATE_ADD(d_first_m, INTERVAL 1 MONTH))
          FROM meses
          WHERE d_first_m < STR_TO_DATE(CONCAT(@ano,'-12-01'), '%Y-%m-%d')
        ),
        fechas AS (
          SELECT @d_first AS d
          UNION ALL SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM fechas WHERE d < @d_last
        ),
        cuadrante_unpivot AS (
          SELECT CAST(cq.CODIGO AS CHAR) AS empleadoId, 1 AS dia,  cq.CENTRO AS centro_cuadrante, cq.ZI_1  AS val, ms.ym, ms.d_first_m, ms.d_last_m
            FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 2 ,  cq.CENTRO, cq.ZI_2 ,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 3 ,  cq.CENTRO, cq.ZI_3 ,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 4 ,  cq.CENTRO, cq.ZI_4 ,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 5 ,  cq.CENTRO, cq.ZI_5 ,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 6 ,  cq.CENTRO, cq.ZI_6 ,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 7 ,  cq.CENTRO, cq.ZI_7 ,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 8 ,  cq.CENTRO, cq.ZI_8 ,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 9 ,  cq.CENTRO, cq.ZI_9 ,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),10 ,  cq.CENTRO, cq.ZI_10,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),11 ,  cq.CENTRO, cq.ZI_11,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),12 ,  cq.CENTRO, cq.ZI_12,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),13 ,  cq.CENTRO, cq.ZI_13,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),14 ,  cq.CENTRO, cq.ZI_14,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),15 ,  cq.CENTRO, cq.ZI_15,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),16 ,  cq.CENTRO, cq.ZI_16,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),17 ,  cq.CENTRO, cq.ZI_17,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),18 ,  cq.CENTRO, cq.ZI_18,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),19 ,  cq.CENTRO, cq.ZI_19,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),20 ,  cq.CENTRO, cq.ZI_20,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),21 ,  cq.CENTRO, cq.ZI_21,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),22 ,  cq.CENTRO, cq.ZI_22,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),23 ,  cq.CENTRO, cq.ZI_23,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),24 ,  cq.CENTRO, cq.ZI_24,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),25 ,  cq.CENTRO, cq.ZI_25,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),26 ,  cq.CENTRO, cq.ZI_26,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),27 ,  cq.CENTRO, cq.ZI_27,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),28 ,  cq.CENTRO, cq.ZI_28,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),29 ,  cq.CENTRO, cq.ZI_29,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),30 ,  cq.CENTRO, cq.ZI_30,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
          UNION ALL SELECT CAST(cq.CODIGO AS CHAR),31 ,  cq.CENTRO, cq.ZI_31,  ms.ym, ms.d_first_m, ms.d_last_m FROM cuadrante cq INNER JOIN meses ms ON cq.LUNA = ms.ym WHERE LEFT(cq.LUNA, 4) = CAST(@ano AS CHAR)
        ),
        cuadrante_dia AS (
          SELECT
            cu.empleadoId,
            DATE_ADD(cu.d_first_m, INTERVAL (cu.dia - 1) DAY) AS fecha,
            cu.dia,
            CASE WHEN cu.val IS NOT NULL AND TRIM(cu.val) <> '' THEN 1 ELSE 0 END AS tiene_cuadrante,
            ROUND(
              CASE 
                WHEN DATE_ADD(cu.d_first_m, INTERVAL (cu.dia - 1) DAY) > cu.d_last_m THEN 0
                WHEN UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
                WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN
                  (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i'))
                   -  TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i'))
                   + 86400) % 86400) / 3600)
                WHEN TRIM(cu.val) REGEXP '^[0-9]+:[0-9]{2}$' THEN TIME_TO_SEC(STR_TO_DATE(TRIM(cu.val),'%H:%i'))/3600
                WHEN TRIM(cu.val) REGEXP '^[0-9]+(\\\\.[0-9]+)?$' THEN CAST(TRIM(cu.val) AS DECIMAL(10,2))
                ELSE 0
              END
            ,2) AS horas_cuadrante_dia
          FROM cuadrante_unpivot cu
        ),
        horario_dia_m AS (
          SELECT
            CAST(de.CODIGO AS CHAR) AS empleadoId,
            f.d AS fecha,
            DAY(f.d) AS dia,
            CASE DAYOFWEEK(f.d)
              WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in1), CONCAT(f.d,' ',h.lun_out1)) + 1440) % 1440, 0)
              WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in1), CONCAT(f.d,' ',h.mar_out1)) + 1440) % 1440, 0)
              WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in1), CONCAT(f.d,' ',h.mie_out1)) + 1440) % 1440, 0)
              WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in1), CONCAT(f.d,' ',h.joi_out1)) + 1440) % 1440, 0)
              WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in1), CONCAT(f.d,' ',h.vin_out1)) + 1440) % 1440, 0)
              WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in1), CONCAT(f.d,' ',h.sam_out1)) + 1440) % 1440, 0)
              WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in1), CONCAT(f.d,' ',h.dum_out1)) + 1440) % 1440, 0)
            END AS m1,
            CASE DAYOFWEEK(f.d)
              WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in2), CONCAT(f.d,' ',h.lun_out2)) + 1440) % 1440, 0)
              WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in2), CONCAT(f.d,' ',h.mar_out2)) + 1440) % 1440, 0)
              WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in2), CONCAT(f.d,' ',h.mie_out2)) + 1440) % 1440, 0)
              WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in2), CONCAT(f.d,' ',h.joi_out2)) + 1440) % 1440, 0)
              WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in2), CONCAT(f.d,' ',h.vin_out2)) + 1440) % 1440, 0)
              WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in2), CONCAT(f.d,' ',h.sam_out2)) + 1440) % 1440, 0)
              WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in2), CONCAT(f.d,' ',h.dum_out2)) + 1440) % 1440, 0)
            END AS m2,
            CASE DAYOFWEEK(f.d)
              WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in3), CONCAT(f.d,' ',h.lun_out3)) + 1440) % 1440, 0)
              WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in3), CONCAT(f.d,' ',h.mar_out3)) + 1440) % 1440, 0)
              WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in3), CONCAT(f.d,' ',h.mie_out3)) + 1440) % 1440, 0)
              WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in3), CONCAT(f.d,' ',h.joi_out3)) + 1440) % 1440, 0)
              WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in3), CONCAT(f.d,' ',h.vin_out3)) + 1440) % 1440, 0)
              WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in3), CONCAT(f.d,' ',h.sam_out3)) + 1440) % 1440, 0)
              WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in3), CONCAT(f.d,' ',h.dum_out3)) + 1440) % 1440, 0)
            END AS m3
          FROM DatosEmpleados de
          JOIN fechas f
          LEFT JOIN horarios h
            ON h.centro_nombre = de.\`CENTRO TRABAJO\`
           AND h.grupo_nombre  = de.\`GRUPO\`
           AND (h.vigente_desde IS NULL OR h.vigente_desde <= f.d)
           AND (h.vigente_hasta IS NULL OR f.d <= h.vigente_hasta)
          WHERE de.ESTADO = 'ACTIVO'
          ${codigo ? 'AND de.CODIGO = @codigo_filtro' : ''}
        ),
        horario_dia AS (
          SELECT empleadoId, fecha, dia,
                 ROUND(CASE WHEN (m1+m2+m3) >= 1320 THEN GREATEST(m1,m2,m3)/60 ELSE (m1+m2+m3)/60 END,2) AS horas_horario_dia
          FROM horario_dia_m
        ),
        empleado_ccaa AS (
          SELECT CAST(de.CODIGO AS CHAR) AS empleadoId, @ccaa_default AS ccaa
          FROM DatosEmpleados de
          WHERE de.ESTADO='ACTIVO'
          ${codigo ? 'AND de.CODIGO = @codigo_filtro' : ''}
        ),
        fiestas_dia AS (
          SELECT ec.empleadoId, f.d AS fecha,
                 CASE 
                   WHEN fi.active=1
                    AND DATE(COALESCE(fi.observed_date, fi.date)) = f.d
                    AND (LOWER(fi.scope) IN ('nacional','national')
                      OR (LOWER(fi.scope) IN ('autonómico','autonomico','ccaa') AND fi.ccaa_code = ec.ccaa))
                   THEN 1 ELSE 0
                 END AS es_fiesta
          FROM empleado_ccaa ec
          JOIN fechas f
          LEFT JOIN fiestas fi ON DATE(COALESCE(fi.observed_date, fi.date)) = f.d
        ),
        empleado_flags AS (
          SELECT CAST(de.CODIGO AS CHAR) AS empleadoId,
                 CASE WHEN LOWER(TRIM(de.TrabajaFestivos)) IN ('si','sí','s','1','true','da','y') THEN 1 ELSE 0 END AS trabaja_festivos
          FROM DatosEmpleados de
          WHERE de.ESTADO='ACTIVO'
          ${codigo ? 'AND de.CODIGO = @codigo_filtro' : ''}
        ),
        bajas_intervalos AS (
          SELECT TRIM(CAST(mc.Codigo_Empleado AS CHAR)) AS empleadoId,
                 COALESCE(
                   CASE 
                     WHEN NULLIF(mc.\`Fecha baja\`, '') IS NULL THEN NULL
                     WHEN mc.\`Fecha baja\` REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(mc.\`Fecha baja\`)
                     WHEN mc.\`Fecha baja\` LIKE '__/__/____' THEN STR_TO_DATE(mc.\`Fecha baja\`, '%d/%m/%Y')
                     ELSE NULL
                   END
                 ) AS d_ini,
                 COALESCE(
                   CASE 
                     WHEN NULLIF(mc.\`Fecha de alta\`, '') IS NULL THEN NULL
                     WHEN mc.\`Fecha de alta\` REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(mc.\`Fecha de alta\`)
                     WHEN mc.\`Fecha de alta\` LIKE '__/__/____' THEN STR_TO_DATE(mc.\`Fecha de alta\`, '%d/%m/%Y')
                     ELSE NULL
                   END,
                   @d_last
                 ) AS d_fin
          FROM MutuaCasos mc
        ),
        bajas_dia AS (
          SELECT bi.empleadoId, f.d AS fecha,
                 CASE WHEN f.d BETWEEN bi.d_ini AND bi.d_fin THEN 1 ELSE 0 END AS es_baja
          FROM bajas_intervalos bi
          JOIN fechas f
          WHERE bi.d_ini IS NOT NULL
            AND bi.d_ini <= @d_last
            AND bi.d_fin >= @d_first
        ),
        aus_raw AS (
          SELECT CAST(a.\`CODIGO\` AS CHAR) AS empleadoId,
                 TRIM(a.\`TIPO\`)           AS tipo,
                 TRIM(REPLACE(REPLACE(a.\`FECHA\`,'–','-'),'—','-')) AS fecha_txt
          FROM Ausencias a
        ),
        aus_parts AS (
          SELECT empleadoId,
                 tipo,
                 CASE 
                   WHEN fecha_txt LIKE '% %' THEN TRIM(TRAILING '-' FROM SUBSTRING_INDEX(fecha_txt,' ',1))
                   ELSE fecha_txt
                 END AS start_raw,
                 CASE 
                   WHEN fecha_txt LIKE '% %' THEN TRIM(LEADING '-'  FROM SUBSTRING_INDEX(fecha_txt,' ',-1))
                   ELSE fecha_txt
                 END AS end_raw
          FROM aus_raw
        ),
        aus_norm AS (
          SELECT empleadoId, tipo,
                 COALESCE(STR_TO_DATE(start_raw, '%Y-%m-%d'), STR_TO_DATE(start_raw, '%Y-%m-%e')) AS d_start,
                 COALESCE(STR_TO_DATE(end_raw,   '%Y-%m-%d'), STR_TO_DATE(end_raw,   '%Y-%m-%e')) AS d_end
          FROM aus_parts
        ),
        aus_dia AS (
          SELECT an.empleadoId, f.d AS fecha,
                 MAX(CASE WHEN UPPER(an.tipo)='VACACIONES' THEN 1 ELSE 0 END) AS es_vacaciones,
                 MAX(CASE WHEN UPPER(an.tipo)<> 'VACACIONES' THEN 1 ELSE 0 END) AS es_ausencia
          FROM aus_norm an
          JOIN fechas f
            ON an.d_start IS NOT NULL
           AND an.d_end   IS NOT NULL
           AND f.d BETWEEN an.d_start AND an.d_end
          GROUP BY an.empleadoId, f.d
        ),
        empleado_fechas AS (
          SELECT CAST(de.CODIGO AS CHAR) AS empleadoId, f.d AS fecha, DAY(f.d) AS dia
          FROM DatosEmpleados de
          JOIN fechas f
          WHERE de.ESTADO='ACTIVO'
          ${codigo ? 'AND de.CODIGO = @codigo_filtro' : ''}
        ),
        daily_plan AS (
          SELECT
            ef.empleadoId,
            ef.fecha,
            ef.dia,
            CASE
              WHEN bj.es_baja = 1 THEN 0
              WHEN COALESCE(au.es_vacaciones,0) = 1 THEN 0
              WHEN fd2.es_fiesta = 1 AND COALESCE(tf.trabaja_festivos,0) = 0 THEN 0
              WHEN COALESCE(au.es_ausencia,0) = 1 THEN 0
              WHEN cd.tiene_cuadrante = 1 THEN cd.horas_cuadrante_dia
              WHEN hd.horas_horario_dia IS NOT NULL THEN hd.horas_horario_dia
              ELSE 0
            END AS horas_plan,
            CASE
              WHEN bj.es_baja = 1 THEN 'baja_medica'
              WHEN COALESCE(au.es_vacaciones,0) = 1 THEN 'vacaciones'
              WHEN fd2.es_fiesta = 1 AND COALESCE(tf.trabaja_festivos,0) = 0 THEN 'fiesta'
              WHEN COALESCE(au.es_ausencia,0) = 1 THEN 'ausencia'
              WHEN cd.tiene_cuadrante = 1 THEN 'cuadrante'
              WHEN hd.horas_horario_dia IS NOT NULL AND hd.horas_horario_dia > 0 THEN 'horario'
              ELSE 'none'
            END AS fuente,
            COALESCE(bj.es_baja,0)        AS es_baja,
            COALESCE(au.es_vacaciones,0)  AS es_vacaciones,
            CASE WHEN COALESCE(au.es_vacaciones,0)=0 THEN COALESCE(au.es_ausencia,0) ELSE 0 END AS es_ausencia,
            COALESCE(fd2.es_fiesta,0)     AS es_fiesta
          FROM empleado_fechas ef
          LEFT JOIN cuadrante_dia cd
            ON cd.empleadoId = ef.empleadoId AND cd.fecha = ef.fecha
          LEFT JOIN horario_dia hd
            ON hd.empleadoId = ef.empleadoId AND hd.fecha = ef.fecha
          LEFT JOIN bajas_dia bj
            ON bj.empleadoId = ef.empleadoId AND bj.fecha = ef.fecha
          LEFT JOIN fiestas_dia fd2
            ON fd2.empleadoId = ef.empleadoId AND fd2.fecha = ef.fecha
          LEFT JOIN aus_dia au
            ON au.empleadoId = ef.empleadoId AND au.fecha = ef.fecha
          LEFT JOIN empleado_flags tf
            ON tf.empleadoId = ef.empleadoId
        ),
        fichaje_base AS (
          SELECT CAST(f.CODIGO AS CHAR) AS empleadoId, DATE(f.FECHA) AS fecha, f.DURACION AS duracion
          FROM Fichaje f
          WHERE f.FECHA >= @d_first AND f.FECHA < DATE_ADD(@d_last, INTERVAL 1 DAY)
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
          SELECT he.empleadoId, he.fecha,
                 ROUND(COALESCE(SUM(fd.dur_secs),0)/3600,2) AS horas_fichadas
          FROM fichaje_has_events he
          LEFT JOIN fichaje_with_duration fd
            ON fd.empleadoId = he.empleadoId AND fd.fecha = he.fecha
          GROUP BY he.empleadoId, he.fecha
        ),
        fichaje_anual AS (
          SELECT empleadoId, ROUND(SUM(horas_fichadas),2) AS horas_trabajadas_anual
          FROM fichaje_dia
          GROUP BY empleadoId
        ),
        plan_mes AS (
          SELECT dp.empleadoId,
                 DATE_FORMAT(dp.fecha, '%Y-%m') AS ym,
                 ROUND(SUM(dp.horas_plan),2) AS horas_plan_mes,
                 ROUND(SUM(CASE WHEN dp.fuente='cuadrante' THEN dp.horas_plan ELSE 0 END),2) AS horas_cuadrante_mes,
                 ROUND(SUM(CASE WHEN dp.fuente='horario'   THEN dp.horas_plan ELSE 0 END),2) AS horas_horario_mes,
                 SUM(CASE WHEN dp.fuente='cuadrante' THEN 1 ELSE 0 END) AS cnt_cuadrante,
                 SUM(CASE WHEN dp.fuente='horario'   THEN 1 ELSE 0 END) AS cnt_horario
          FROM daily_plan dp
          GROUP BY dp.empleadoId, DATE_FORMAT(dp.fecha, '%Y-%m')
        ),
        plan_mes_fuente AS (
          SELECT pm.*,
                 CASE
                   WHEN pm.cnt_cuadrante > 0 AND pm.cnt_horario = 0 THEN 'cuadrante'
                   WHEN pm.cnt_cuadrante = 0 AND pm.cnt_horario > 0 THEN 'horario'
                   WHEN pm.cnt_cuadrante > 0 AND pm.cnt_horario > 0 THEN 'mixto'
                   ELSE 'none'
                 END AS fuente_mes
          FROM plan_mes pm
        ),
        plan_anual AS (
          SELECT empleadoId,
                 ROUND(SUM(horas_plan_mes),2)      AS horas_plan_anual,
                 ROUND(SUM(horas_cuadrante_mes),2) AS horas_cuadrante_anual,
                 ROUND(SUM(horas_horario_mes),2)   AS horas_horario_anual,
                 SUM(CASE WHEN fuente_mes='cuadrante' THEN 1 ELSE 0 END) AS meses_con_cuadrante,
                 SUM(CASE WHEN fuente_mes='horario'   THEN 1 ELSE 0 END) AS meses_con_horario,
                 SUM(CASE WHEN fuente_mes='mixto'     THEN 1 ELSE 0 END) AS meses_mixtos
          FROM plan_mes_fuente
          GROUP BY empleadoId
        ),
        sumar_flags_zile AS (
          SELECT 
            empleadoId,
            SUM(CASE WHEN es_baja=1 THEN 1 ELSE 0 END)        AS dias_baja,
            SUM(CASE WHEN es_vacaciones=1 THEN 1 ELSE 0 END)  AS dias_vacaciones,
            SUM(CASE WHEN es_ausencia=1 THEN 1 ELSE 0 END)    AS dias_ausencia,
            SUM(CASE WHEN es_fiesta=1 THEN 1 ELSE 0 END)      AS dias_fiesta
          FROM daily_plan
          GROUP BY empleadoId
        ),
        resumen_mensual AS (
          SELECT empleadoId,
                 CONCAT(
                   '[',
                   GROUP_CONCAT(
                     CONCAT(
                       '{"ym":"', ym,
                       '","horas_plan_mes":',     CAST(horas_plan_mes      AS CHAR),
                       ',"horas_cuadrante_mes":', CAST(horas_cuadrante_mes AS CHAR),
                       ',"horas_horario_mes":',   CAST(horas_horario_mes   AS CHAR),
                       ',"fuente_mes":"',         fuente_mes, '"',
                       '}'
                     ) ORDER BY ym SEPARATOR ','
                   ),
                   ']'
                 ) AS resumen_mensual
          FROM plan_mes_fuente
          GROUP BY empleadoId
        ),
        contrato_factor AS (
          SELECT SUM(DAY(d_last_m)/7) AS factor FROM meses
        ),
        centro_cuadrante_max AS (
          SELECT empleadoId, MAX(centro_cuadrante) AS centro_cuadrante
          FROM cuadrante_unpivot
          GROUP BY empleadoId
        )
        SELECT
          de.CODIGO                               AS empleadoId,
          de.\`NOMBRE / APELLIDOS\`                 AS empleadoNombre,
          de.GRUPO                                AS grupo,
          de.\`CENTRO TRABAJO\`                     AS centro_trabajo,
          de.\`TIPO DE CONTRATO\`                   AS tipo_contrato,
          ROUND(COALESCE(de.\`HORAS DE CONTRATO\`,0),2) AS horas_contrato,
          COALESCE(ccm.centro_cuadrante, de.\`CENTRO TRABAJO\`) AS centro_cuadrante,
          CASE
            WHEN COALESCE(pa.meses_mixtos,0) > 0
              OR (COALESCE(pa.meses_con_cuadrante,0) > 0 AND COALESCE(pa.meses_con_horario,0) > 0) THEN 'mixto'
            WHEN COALESCE(pa.meses_con_cuadrante,0) > 0 AND COALESCE(pa.meses_con_horario,0) = 0 THEN 'cuadrante'
            WHEN COALESCE(pa.meses_con_horario,0) > 0 AND COALESCE(pa.meses_con_cuadrante,0) = 0 THEN 'horario'
            ELSE 'sin cuadrante y sin horario'
          END AS fuente_anual,
          COALESCE(pa.horas_plan_anual, 0)        AS horas_plan_anual,
          COALESCE(pa.horas_cuadrante_anual, 0)   AS horas_cuadrante_anual,
          COALESCE(pa.horas_horario_anual, 0)     AS horas_horario_anual,
          ROUND(COALESCE(de.\`HORAS DE CONTRATO\`,0) * COALESCE((SELECT factor FROM contrato_factor), 52.14), 2) AS horas_contrato_anual,
          COALESCE(fa.horas_trabajadas_anual, 0)  AS horas_trabajadas_anual,
          hp.\`Horas Mensuales\`                    AS horas_mensuales_permitidas,
          hp.\`Horas Anuales\`                      AS horas_anuales_permitidas,
          COALESCE(hp.\`Horas Anuales\`, COALESCE(hp.\`Horas Mensuales\`,0)*12, 0) AS horas_permitidas_interval,
          COALESCE(sfz.dias_baja,0)        AS dias_baja,
          COALESCE(sfz.dias_vacaciones,0)  AS dias_vacaciones,
          COALESCE(sfz.dias_ausencia,0)    AS dias_ausencia,
          COALESCE(sfz.dias_fiesta,0)      AS dias_fiesta,
          COALESCE(rm.resumen_mensual, '[]')      AS resumen_mensual,
          COALESCE(pa.meses_con_cuadrante,0)      AS meses_con_cuadrante,
          COALESCE(pa.meses_con_horario,0)        AS meses_con_horario,
          COALESCE(pa.meses_mixtos,0)             AS meses_mixtos
        FROM DatosEmpleados de
        LEFT JOIN plan_anual          pa ON pa.empleadoId = CAST(de.CODIGO AS CHAR)
        LEFT JOIN fichaje_anual       fa ON fa.empleadoId = CAST(de.CODIGO AS CHAR)
        LEFT JOIN horaspermitidas     hp ON hp.GRUPO     = de.GRUPO
        LEFT JOIN resumen_mensual     rm ON rm.empleadoId = CAST(de.CODIGO AS CHAR)
        LEFT JOIN sumar_flags_zile    sfz ON sfz.empleadoId = CAST(de.CODIGO AS CHAR)
        LEFT JOIN centro_cuadrante_max ccm ON ccm.empleadoId = CAST(de.CODIGO AS CHAR)
        WHERE de.ESTADO = 'ACTIVO'
        ${codigo ? `AND de.CODIGO = '${codigo.replace(/'/g, "''")}'` : ''}
        ORDER BY de.CODIGO;
      `;

      const connectionConfig = await this.getDbConnectionConfig();
      const connection = await mysql.createConnection(connectionConfig);

      try {
        const startTime = Date.now();
        this.logger.log(
          `🔍 [Resumen Anual] Starting SQL query execution for ano: ${ano}`,
        );

        const queryResult = await connection.query(query);
        const sqlTime = Date.now() - startTime;
        this.logger.log(
          `⏱️  [Resumen Anual] SQL query completed in ${sqlTime}ms`,
        );

        const extractStartTime = Date.now();
        const rows = this.extractRowsFromQueryResult(queryResult);
        const extractTime = Date.now() - extractStartTime;
        this.logger.log(
          `⏱️  [Resumen Anual] Data extraction completed in ${extractTime}ms, rows: ${rows.length}`,
        );

        // Procesare JavaScript (replică logica din "Code in JavaScript1" din n8n)
        const processStartTime = Date.now();
        const processedRows = this.processAnualData(rows, ano);
        const processTime = Date.now() - processStartTime;
        this.logger.log(
          `⏱️  [Resumen Anual] JavaScript processing completed in ${processTime}ms`,
        );

        const totalTime = Date.now() - startTime;
        this.logger.log(
          `✅ Resumen anual retrieved: ${processedRows.length} empleados (ano: ${ano}) - Total time: ${totalTime}ms (SQL: ${sqlTime}ms, Extract: ${extractTime}ms, Process: ${processTime}ms)`,
        );

        return processedRows;
      } finally {
        await connection.end();
      }
    } catch (error: any) {
      this.logger.error('❌ Error retrieving resumen anual:', error);
      throw new BadRequestException(
        `Error al obtener resumen anual: ${error.message}`,
      );
    }
  }

  /**
   * Procesare JavaScript pentru resumen anual (replică "Code in JavaScript1" din n8n)
   */
  private processAnualData(rows: any[], ano: string): any[] {
    const toNum = (x: any, def = 0): number => {
      if (x === null || x === undefined) return def;
      const n =
        typeof x === 'number' ? x : parseFloat(String(x).replace(',', '.'));
      return Number.isFinite(n) ? n : def;
    };

    const todayMadrid = (): {
      y: number;
      m: number;
      d: number;
      ymd: string;
    } => {
      const fmt = new Intl.DateTimeFormat('ro-RO', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const p = fmt.formatToParts(new Date()).reduce((a, p) => {
        if (p.type !== 'literal') a[p.type] = p.value;
        return a;
      }, {} as any);
      const y = +p.year,
        m = +p.month,
        d = +p.day;
      return {
        y,
        m,
        d,
        ymd: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      };
    };

    const today = todayMadrid();
    const selectedYear = ano;
    const isCurrentYear = selectedYear && selectedYear === String(today.y);
    const EPS = 0.25;

    return rows.map((emp) => {
      // Agregate ANUALE din SQL
      const planAnSQL = toNum(emp.horas_plan_anual, 0);
      const totalPlanAnual = planAnSQL;

      const totalTrabAnual = toNum(emp.horas_trabajadas_anual, 0);

      const contratoAnual = toNum(emp.horas_contrato_anual, 0);
      const permitidasAnual = toNum(
        emp.horas_anuales_permitidas,
        toNum(
          emp.horas_permitidas_interval,
          toNum(emp.horas_mensuales_permitidas, 0) * 12,
        ),
      );

      // Plan până azi (dacă anul curent, altfel folosim total plan)
      const planHastaHoy =
        isCurrentYear && planAnSQL > 0
          ? planAnSQL // Pentru simplitate, folosim total plan (în SQL nu avem zile pentru resumen anual)
          : totalPlanAnual;

      // Deltas & statusuri
      const diffPlanHastaHoy = totalTrabAnual - planHastaHoy;
      const diffPlanIntervalo = totalTrabAnual - totalPlanAnual;
      const diffPermitidasAn = totalTrabAnual - permitidasAnual;

      const estado_plan_hasta = isCurrentYear
        ? diffPlanHastaHoy > EPS
          ? 'SOBREPASADO'
          : 'OK'
        : 'N/A';

      const estado_plan = diffPlanIntervalo > EPS ? 'SOBREPASADO' : 'OK';
      const estado_permitidas =
        permitidasAnual > 0 && diffPermitidasAn > EPS ? 'EXCESO' : 'OK';

      // Excedente: diferența dintre totalTrabAnual și totalPlanAnual
      const exced = Math.max(0, totalTrabAnual - totalPlanAnual);

      // Clasificare (ordin/complementar/extra) anual
      const esPart = ((emp.tipo_contrato || '') as string)
        .toLowerCase()
        .includes('parc');

      let totalCompl = 0,
        totalExtra = 0;
      if (contratoAnual > 0) {
        if (esPart) {
          const maxCompl = Math.max(0, contratoAnual - totalPlanAnual);
          totalCompl = Math.min(exced, maxCompl);
          totalExtra = Math.max(0, exced - maxCompl);
        } else {
          totalCompl = 0;
          totalExtra = Math.max(0, totalTrabAnual - contratoAnual);
        }
      } else {
        if (permitidasAnual > 0) {
          totalCompl = 0;
          totalExtra = Math.max(0, totalTrabAnual - permitidasAnual);
        } else {
          totalCompl = 0;
          totalExtra = Math.max(0, exced);
        }
      }
      const totalOrdin = totalTrabAnual - totalCompl - totalExtra;

      return {
        ...emp,
        modo: 'anual',
        ano_selectado: selectedYear,
        total_ordinarias: +totalOrdin.toFixed(2),
        total_complementarias: +totalCompl.toFixed(2),
        total_extraordinarias: +totalExtra.toFixed(2),
        total_trabajadas: +totalTrabAnual.toFixed(2),
        total_trabajadas_anual: +totalTrabAnual.toFixed(2),
        total_plan: +totalPlanAnual.toFixed(2),
        total_plan_anual: +totalPlanAnual.toFixed(2),
        total_permitidas: +permitidasAnual.toFixed(2),
        total_permitidas_anual: +permitidasAnual.toFixed(2),
        total_contrato_anual: +contratoAnual.toFixed(2),
        plan_hasta_hoy: +planHastaHoy.toFixed(2),
        diff_plan_hasta_hoy: +diffPlanHastaHoy.toFixed(2),
        diff_plan_intervalo: +diffPlanIntervalo.toFixed(2),
        diff_permitidas: +diffPermitidasAn.toFixed(2),
        estado_plan_hasta_hoy: estado_plan_hasta,
        estado_plan: estado_plan,
        estado_permitidas: estado_permitidas,
        meses_con_cuadrante: toNum(emp.meses_con_cuadrante, 0),
        meses_con_horario: toNum(emp.meses_con_horario, 0),
        meses_mixtos: toNum(emp.meses_mixtos, 0),
      };
    });
  }

  /**
   * Detalle anual - 1 angajat cu detalii zilnice
   * TODO: Implementare completă (momentan returnează array gol)
   */
  async getDetalleAnual(ano: string, codigo: string): Promise<any> {
    this.logger.warn(
      `⚠️ getDetalleAnual not yet implemented (ano: ${ano}, codigo: ${codigo})`,
    );
    // TODO: Implementare completă
    return [];
  }
}
