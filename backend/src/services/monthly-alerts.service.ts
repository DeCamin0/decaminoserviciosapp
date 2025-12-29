import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as mysql from 'mysql2/promise';

@Injectable()
export class MonthlyAlertsService {
  private readonly logger = new Logger(MonthlyAlertsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyRecords(empleadoId: string, mes: string) {
    if (!empleadoId || !mes) {
      throw new BadRequestException('empleadoId and mes are required');
    }

    // Validate mes format (YYYY-MM)
    const mesRegex = /^\d{4}-\d{2}$/;
    if (!mesRegex.test(mes)) {
      throw new BadRequestException('mes must be in format YYYY-MM');
    }

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT *
      FROM \`Fichaje\` f
      WHERE
        f.\`CODIGO\` = ${empleadoId}
        AND f.\`FECHA\` LIKE CONCAT(${mes}, '%')
      ORDER BY
        f.\`FECHA\` ASC,
        f.\`HORA\` ASC
    `;

    return rows || [];
  }

  async getAnnualRecords(empleadoId: string, ano: string) {
    if (!empleadoId || !ano) {
      throw new BadRequestException('empleadoId and ano are required');
    }

    // Validate ano format (YYYY)
    const anoRegex = /^\d{4}$/;
    if (!anoRegex.test(ano)) {
      throw new BadRequestException('ano must be in format YYYY');
    }

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT *
      FROM \`Fichaje\` f
      WHERE
        f.\`CODIGO\` = ${empleadoId}
        AND f.\`FECHA\` LIKE CONCAT(${ano}, '-%')
      ORDER BY
        f.\`FECHA\` ASC,
        f.\`HORA\` ASC
    `;

    return rows || [];
  }

  async getResumenMensual(mes: string) {
    if (!mes) {
      throw new BadRequestException('mes is required');
    }

    // Validate mes format (YYYY-MM)
    const mesRegex = /^\d{4}-\d{2}$/;
    if (!mesRegex.test(mes)) {
      throw new BadRequestException('mes must be in format YYYY-MM');
    }

    // Execute the same complex SQL query from n8n
    // This returns processed data with detalii_zilnice containing delta, excedente, etc.
    // Note: Using $queryRawUnsafe because the query has variables that need to be set
    const query = `
      SET @lunaselectata = ?;
      SET @ccaa_default  = 'ES-MD';
      SET @d_first := STR_TO_DATE(CONCAT(@lunaselectata,'-01'), '%Y-%m-%d');
      SET @d_last  := LAST_DAY(@d_first);

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
        WHERE de.ESTADO = 'ACTIVO'
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
      ),
      empleado_fechas AS (
        SELECT CAST(de.CODIGO AS CHAR) AS empleadoId, f.d AS fecha, DAY(f.d) AS dia
        FROM DatosEmpleados de
        JOIN fechas f
        WHERE de.ESTADO='ACTIVO'
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
      ORDER BY de.CODIGO;
    `;

    // Note: Prisma's $queryRawUnsafe doesn't support multiple statements
    // We need to use mysql2 directly for this complex query
    // Replace @lunaselectata with the actual value
    const queryWithParams = query.replace(/\?/g, `'${mes}'`);

    try {
      // Get database connection info from Prisma
      const dbUrl =
        process.env.DATABASE_URL ||
        (() => {
          const host = process.env.DB_HOST || 'localhost';
          const port = parseInt(process.env.DB_PORT || '3306');
          const user = process.env.DB_USERNAME || 'root';
          const password = process.env.DB_PASSWORD || '';
          const database = process.env.DB_NAME || 'decaminoservicios';
          return { host, port, user, password, database };
        })();

      // Parse DATABASE_URL if it exists
      let connectionConfig: any;
      if (typeof dbUrl === 'string') {
        const url = new URL(dbUrl);
        connectionConfig = {
          host: url.hostname,
          port: parseInt(url.port || '3306'),
          user: url.username,
          password: decodeURIComponent(url.password),
          database: url.pathname.slice(1),
        };
      } else {
        connectionConfig = dbUrl;
      }

      this.logger.debug('🔍 [MonthlyAlerts] Creating MySQL connection...');
      this.logger.debug(
        `🔍 [MonthlyAlerts] Connection config: ${JSON.stringify({ ...connectionConfig, password: '***' })}`,
      );

      // Create connection with multipleStatements enabled
      const connection = await mysql.createConnection({
        ...connectionConfig,
        multipleStatements: true,
      });

      try {
        this.logger.debug('🔍 [MonthlyAlerts] Executing resumen query...');
        this.logger.debug(`🔍 [MonthlyAlerts] Query mes: ${mes}`);
        this.logger.debug(
          `🔍 [MonthlyAlerts] Query length: ${queryWithParams.length} chars`,
        );

        // Execute query with multiple statements enabled
        // mysql2 returns [rows, fields] for single queries
        // For multiple statements, it returns an array of [rows, fields] pairs
        const queryResult = await connection.query(queryWithParams);

        this.logger.debug(
          '🔍 [MonthlyAlerts] Query result type:',
          Array.isArray(queryResult) ? 'array' : typeof queryResult,
        );
        this.logger.debug(
          '🔍 [MonthlyAlerts] Query result length:',
          Array.isArray(queryResult) ? queryResult.length : 'N/A',
        );

        // mysql2 with multipleStatements returns: [ [rows, fields] ]
        // But with multiple SET statements, the structure is:
        // [ [OkPacket1, OkPacket2, OkPacket3, OkPacket4, [actualRows]], [fields] ]
        let rows: any[] = [];

        if (Array.isArray(queryResult) && queryResult.length >= 1) {
          const firstResult = queryResult[0];

          if (Array.isArray(firstResult)) {
            this.logger.debug(
              `🔍 [MonthlyAlerts] First result is array with ${firstResult.length} items`,
            );

            // Look for the array of actual data rows (should be the last item in firstResult)
            // The first items are OkPackets from SET statements
            for (let i = firstResult.length - 1; i >= 0; i--) {
              const item = firstResult[i];

              // Check if this is an array of data rows (not an OkPacket)
              if (Array.isArray(item) && item.length > 0) {
                const firstRow = item[0];
                // Check if it looks like a data row (has empleadoId and not fieldCount)
                if (
                  firstRow &&
                  typeof firstRow === 'object' &&
                  'empleadoId' in firstRow &&
                  !('fieldCount' in firstRow)
                ) {
                  rows = item;
                  this.logger.debug(
                    `✅ [MonthlyAlerts] Found data rows at index ${i} in first result, rows: ${rows.length}`,
                  );
                  if (rows.length > 0) {
                    this.logger.debug(
                      '🔍 [MonthlyAlerts] First row keys:',
                      Object.keys(rows[0]),
                    );
                    this.logger.debug(
                      '🔍 [MonthlyAlerts] First row sample:',
                      JSON.stringify(rows[0]).substring(0, 300),
                    );
                  }
                  break;
                }
              }
            }

            if (rows.length === 0) {
              this.logger.warn(
                '⚠️ [MonthlyAlerts] No data rows found in first result',
              );
              // Try alternative: maybe the structure is different
              // Check if firstResult itself contains data rows directly
              const potentialRows = firstResult.filter(
                (item) =>
                  Array.isArray(item) &&
                  item.length > 0 &&
                  item[0] &&
                  typeof item[0] === 'object' &&
                  'empleadoId' in item[0] &&
                  !('fieldCount' in item[0]),
              ) as any[][];

              if (potentialRows.length > 0 && Array.isArray(potentialRows[0])) {
                rows = potentialRows[0] as any[];
                this.logger.debug(
                  `✅ [MonthlyAlerts] Found data rows in alternative location, rows: ${rows.length}`,
                );
              } else {
                this.logger.warn(
                  '⚠️ [MonthlyAlerts] Full query result structure:',
                  JSON.stringify(queryResult, null, 2).substring(0, 2000),
                );
              }
            }
          } else if (
            Array.isArray(queryResult[0]) &&
            queryResult[0].length === 2
          ) {
            // Alternative structure: [ [rows, fields] ]
            const [resultRows, fields] = queryResult[0];
            if (
              Array.isArray(resultRows) &&
              Array.isArray(fields) &&
              fields.length > 0
            ) {
              rows = resultRows;
              this.logger.debug(
                `✅ [MonthlyAlerts] Found SELECT result in standard format, rows: ${rows.length}`,
              );
            }
          }
        } else {
          this.logger.warn(
            '⚠️ [MonthlyAlerts] Query result is not an array:',
            typeof queryResult,
          );
        }

        this.logger.debug(
          `✅ [MonthlyAlerts] Extracted ${rows.length} rows from query result`,
        );

        // Filter out any metadata rows (shouldn't be needed, but just in case)
        const dataRows = rows.filter((row) => {
          return (
            row &&
            typeof row === 'object' &&
            'empleadoId' in row &&
            !('fieldCount' in row)
          );
        });

        this.logger.debug(
          `🔍 [MonthlyAlerts] Filtered data rows: ${dataRows.length}`,
        );

        // Parse detalii_zilnice JSON string for each employee
        const parsedResult = dataRows.map((emp) => {
          try {
            return {
              ...emp,
              detalii_zilnice:
                typeof emp.detalii_zilnice === 'string'
                  ? JSON.parse(emp.detalii_zilnice || '[]')
                  : emp.detalii_zilnice || [],
            };
          } catch (e) {
            this.logger.warn(
              `⚠️ [MonthlyAlerts] Error parsing detalii_zilnice for empleado ${emp.empleadoId}:`,
              e.message,
            );
            return {
              ...emp,
              detalii_zilnice: [],
            };
          }
        });

        this.logger.debug(
          `✅ [MonthlyAlerts] Returning ${parsedResult.length} empleados`,
        );
        return parsedResult;
      } catch (queryError) {
        this.logger.error(
          '❌ [MonthlyAlerts] Error executing query:',
          queryError.message,
        );
        this.logger.error('❌ [MonthlyAlerts] Error stack:', queryError.stack);
        throw queryError;
      } finally {
        await connection.end();
      }
    } catch (error) {
      this.logger.error(
        '❌ [MonthlyAlerts] Error executing resumen query:',
        error.message,
      );
      this.logger.error('❌ [MonthlyAlerts] Error stack:', error.stack);
      console.error('Query start:', queryWithParams.substring(0, 500));
      throw new BadRequestException(
        `Error executing resumen query: ${error.message}`,
      );
    }
  }
}
