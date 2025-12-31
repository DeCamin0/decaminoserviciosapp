import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService, AccessLevel } from './rbac.service';
import { calculateCuadranteHours } from '../../utils/cuadrante-hours-helper';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import * as mysql from 'mysql2/promise';

@Injectable()
export class DataQueryService {
  private readonly logger = new Logger(DataQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  /**
   * Query pentru FICHAJES
   */
  async queryFichajes(
    userId: string,
    rol: string | null,
    entidades?: { codigo?: string; fecha?: string; mes?: string },
  ): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'CODIGO',
    );

    let fechaCondition = '';

    // Verifică dacă e cerut "tot mesul"
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
        const año = ahora.getFullYear();
        const mes = mesIndex + 1; // JavaScript months are 0-indexed, SQL months are 1-indexed

        // Prima zi a lunii
        const fechaInicio = `${año}-${String(mes).padStart(2, '0')}-01`;
        // Ultima zi a lunii
        const ultimoDia = new Date(año, mes, 0).getDate();
        const fechaFin = `${año}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

        fechaCondition = `AND DATE(FECHA) >= ${this.escapeSql(fechaInicio)} AND DATE(FECHA) <= ${this.escapeSql(fechaFin)}`;
        this.logger.log(
          `📅 Query fichajes para mes completo: ${fechaInicio} a ${fechaFin}`,
        );
      } else {
        // Fallback la luna curentă
        const ahora = new Date();
        const año = ahora.getFullYear();
        const mes = ahora.getMonth() + 1;
        const fechaInicio = `${año}-${String(mes).padStart(2, '0')}-01`;
        const ultimoDia = new Date(año, mes, 0).getDate();
        const fechaFin = `${año}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
        fechaCondition = `AND DATE(FECHA) >= ${this.escapeSql(fechaInicio)} AND DATE(FECHA) <= ${this.escapeSql(fechaFin)}`;
        this.logger.log(
          `📅 Query fichajes para mes actual completo: ${fechaInicio} a ${fechaFin}`,
        );
      }
    } else if (entidades?.fecha) {
      fechaCondition = `AND DATE(FECHA) = '${this.escapeSql(entidades.fecha)}'`;
    } else {
      fechaCondition = `AND DATE(FECHA) = CURDATE()`;
    }

    const query = `
      SELECT 
        fichaje_pk,
        CODIGO,
        \`NOMBRE / APELLIDOS\` as nombre_apellidos,
        \`CORREO ELECTRONICO\` as email,
        TIPO,
        HORA,
        DIRECCION,
        FECHA,
        DURACION,
        Estado
      FROM Fichaje
      WHERE ${rbacCondition}
        ${fechaCondition}
      ORDER BY FECHA DESC, HORA DESC
      LIMIT 500
    `;

    this.logger.log(`🔍 Query fichajes: ${query.substring(0, 150)}...`);

    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    return results || [];
  }

  /**
   * Query pentru angajați care ar trebui să lucreze (conform cuadrantelor/horario) dar nu au fichat
   * Folosește aceeași logică ca MonthlyAlertsService pentru a fi consistent
   */
  async queryFichajesFaltantes(
    userId: string,
    rol: string | null,
    fecha?: string,
  ): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'CODIGO',
    );

    // Parsează data sau folosește data curentă
    let fechaDate: Date;
    if (fecha) {
      fechaDate = new Date(fecha);
    } else {
      fechaDate = new Date();
    }

    const año = fechaDate.getFullYear();
    const mes = fechaDate.getMonth() + 1;
    const dia = fechaDate.getDate();
    const fechaFormatted = `${año}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const mesFormatted = `${año}-${String(mes).padStart(2, '0')}`;

    // Folosește aceeași logică ca MonthlyAlertsService.getResumenMensual
    // Query simplificat bazat pe daily_plan și fichaje_dia pentru ziua specificată
    const query = `
      SET @lunaselectata = ${this.escapeSql(mesFormatted)};
      SET @ccaa_default  = 'ES-MD';
      SET @d_first := STR_TO_DATE(CONCAT(@lunaselectata,'-01'), '%Y-%m-%d');
      SET @d_last  := LAST_DAY(@d_first);
      SET @fecha_buscar := ${this.escapeSql(fechaFormatted)};

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
              WHEN TRIM(cu.val) REGEXP '^24h$' THEN 
                -- Format simplu "24h" - probabil e 3 ture de 8h → returnăm 8h per tură
                8
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
        JOIN fechas f ON f.d = @fecha_buscar
        LEFT JOIN horarios h
          ON h.centro_nombre = de.\`CENTRO TRABAJO\`
         AND h.grupo_nombre  = de.\`GRUPO\`
        WHERE de.ESTADO='ACTIVO'
          AND ${rbacCondition.replace('CODIGO', 'de.CODIGO')}
      ),
      horario_dia AS (
        SELECT
          empleadoId,
          fecha,
          ROUND((COALESCE(m1,0) + COALESCE(m2,0) + COALESCE(m3,0))/60, 2) AS horas_horario_dia
        FROM horario_dia_m
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
          @fecha_buscar AS fecha,
          CASE WHEN @fecha_buscar BETWEEN bi.d_ini AND bi.d_fin THEN 1 ELSE 0 END AS es_baja
        FROM bajas_intervalos bi
        WHERE bi.d_ini IS NOT NULL
          AND bi.d_ini <= @fecha_buscar
          AND (bi.d_fin IS NULL OR bi.d_fin >= @fecha_buscar)
      ),
      aus_raw AS (
        SELECT
          CAST(a.CODIGO AS CHAR) AS empleadoId,
          UPPER(TRIM(a.\`TIPO\`)) AS tipo,
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
          @fecha_buscar AS fecha,
          n.empleadoId,
          MAX(CASE WHEN UPPER(n.tipo)='VACACIONES' THEN 1 ELSE 0 END) AS es_vacaciones,
          MAX(CASE WHEN UPPER(n.tipo)<> 'VACACIONES' THEN 1 ELSE 0 END) AS es_ausencia
        FROM aus_norm n
        WHERE n.d_start IS NOT NULL 
          AND n.d_end   IS NOT NULL
          AND @fecha_buscar BETWEEN n.d_start AND n.d_end
        GROUP BY n.empleadoId
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
          AND ${rbacCondition.replace('CODIGO', 'de.CODIGO')}
      ),
      fiestas_dia AS (
        SELECT
          @fecha_buscar AS fecha,
          CAST(de.CODIGO AS CHAR) AS empleadoId,
          CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END AS es_fiesta
        FROM DatosEmpleados de
        LEFT JOIN fiestas f
          ON f.date = @fecha_buscar
         AND f.active = TRUE
         AND (f.scope = 'national' OR (f.scope = 'regional' AND f.ccaa_code = @ccaa_default))
        WHERE de.ESTADO='ACTIVO'
          AND ${rbacCondition.replace('CODIGO', 'de.CODIGO')}
      ),
      daily_plan AS (
        SELECT
          CAST(de.CODIGO AS CHAR) AS empleadoId,
          @fecha_buscar AS fecha,
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
          END AS fuente
        FROM DatosEmpleados de
        LEFT JOIN cuadrante_dia cd
          ON cd.empleadoId = CAST(de.CODIGO AS CHAR) AND cd.fecha = @fecha_buscar
        LEFT JOIN horario_dia hd
          ON hd.empleadoId = CAST(de.CODIGO AS CHAR) AND hd.fecha = @fecha_buscar
        LEFT JOIN bajas_dia bj
          ON bj.empleadoId = CAST(de.CODIGO AS CHAR) AND bj.fecha = @fecha_buscar
        LEFT JOIN fiestas_dia fd2
          ON fd2.empleadoId = CAST(de.CODIGO AS CHAR) AND fd2.fecha = @fecha_buscar
        LEFT JOIN aus_dia au
          ON au.empleadoId = CAST(de.CODIGO AS CHAR) AND au.fecha = @fecha_buscar
        LEFT JOIN empleado_flags tf
          ON tf.empleadoId = CAST(de.CODIGO AS CHAR)
        WHERE de.ESTADO='ACTIVO'
          AND ${rbacCondition.replace('CODIGO', 'de.CODIGO')}
      ),
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
        de.\`CORREO ELECTRONICO\` AS email,
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
        -- Angajați cu cuadrante/horario care nu au fichat
        (dp.horas_plan > 0 AND (COALESCE(fd.horas_fichadas, 0) = 0 OR COALESCE(fd.fichaje_incompleto, 0) = 1))
        OR
        -- Angajați fără cuadrante/horario/centro asignado
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

    this.logger.log(
      `🔍 Query fichajes faltantes (folosind logica MonthlyAlerts): ${query.substring(0, 300)}...`,
    );

    // Prisma nu suportă multiple statements, trebuie să folosim mysql2 direct
    try {
      // Get database connection info from Prisma (same as MonthlyAlertsService)
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

      // Create connection with multipleStatements enabled (same as MonthlyAlertsService)
      const connection = await mysql.createConnection({
        ...connectionConfig,
        multipleStatements: true,
      });

      try {
        // Execute query with multiple statements enabled
        const queryResult = await connection.query(query);

        // mysql2 with multipleStatements returns: [ [rows, fields] ]
        // But with multiple SET statements, the structure is:
        // [ [OkPacket1, OkPacket2, OkPacket3, OkPacket4, [actualRows]], [fields] ]
        let rows: any[] = [];

        if (Array.isArray(queryResult) && queryResult.length >= 1) {
          const firstResult = queryResult[0];

          if (Array.isArray(firstResult)) {
            // Look for the array of actual data rows (should be the last item in firstResult)
            // The first items are OkPackets from SET statements
            for (let i = firstResult.length - 1; i >= 0; i--) {
              const item = firstResult[i];

              // Check if this is an array of data rows (not an OkPacket)
              if (Array.isArray(item) && item.length > 0) {
                const firstRow = item[0];
                // Check if it looks like a data row (has CODIGO or nombre and not fieldCount)
                if (
                  firstRow &&
                  typeof firstRow === 'object' &&
                  ('CODIGO' in firstRow || 'nombre' in firstRow) &&
                  !('fieldCount' in firstRow)
                ) {
                  rows = item;
                  this.logger.log(
                    `✅ Query fichajes faltantes: Found data rows at index ${i}, rows: ${rows.length}`,
                  );
                  break;
                }
              }
            }
          }
        }

        this.logger.log(
          `✅ Query fichajes faltantes retornó ${rows?.length || 0} resultados`,
        );

        // Procesează datele pentru a calcula corect orele pentru ture multiple
        const processedResults = await this.processFichajesFaltantesResults(
          rows || [],
        );

        return processedResults;
      } finally {
        await connection.end();
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error en queryFichajesFaltantes: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Query pentru LISTADO DE EMPLEADOS cu estado, cuadrante, horario, centro
   * @param filtro - Opțional: 'sin_cuadrante', 'sin_horario', 'sin_centro', 'sin_cuadrante_ni_horario', 'sin_centro_ni_cuadrante_ni_horario'
   */
  async queryListadoEmpleados(
    userId: string,
    rol: string | null,
    filtro?: string,
  ): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'CODIGO',
    );

    // Construiește condițiile WHERE pentru filtrare
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
      // AND logic: nu are cuadrante ȘI nu are horario
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
        de.\`CORREO ELECTRONICO\` AS email,
        de.ESTADO AS estado,
        de.\`CENTRO TRABAJO\` AS centro,
        de.\`GRUPO\` AS grupo,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM cuadrante c 
            WHERE CAST(c.CODIGO AS CHAR) = CAST(de.CODIGO AS CHAR)
              AND c.LUNA = DATE_FORMAT(NOW(), '%Y-%m')
          ) THEN 'Sí'
          ELSE 'No'
        END AS tiene_cuadrante,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM horarios h
            WHERE h.centro_nombre = de.\`CENTRO TRABAJO\`
              AND h.grupo_nombre = de.\`GRUPO\`
          ) THEN 'Sí'
          ELSE 'No'
        END AS tiene_horario,
        CASE 
          WHEN de.\`CENTRO TRABAJO\` IS NOT NULL 
            AND TRIM(de.\`CENTRO TRABAJO\`) <> '' 
          THEN 'Sí'
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
        `✅ Query listado empleados retornó ${results?.length || 0} resultados (filtro: ${filtro || 'ninguno'})`,
      );
      return results || [];
    } catch (error: any) {
      this.logger.error(
        `❌ Error en queryListadoEmpleados: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Procesează rezultatele queryFichajesFaltantes pentru a calcula corect orele pentru ture multiple
   */
  private async processFichajesFaltantesResults(
    results: any[],
  ): Promise<any[]> {
    if (!results || results.length === 0) {
      return results;
    }

    this.logger.log(
      `🔄 Processing ${results.length} results for horas recalculation...`,
    );

    // Trebuie să obținem valorile originale din cuadrante pentru a calcula corect orele
    // Pentru fiecare rezultat, trebuie să verificăm dacă are cuadrante sau horario
    const processedResults = await Promise.all(
      results.map(async (result) => {
        // Log pentru debugging - verifică dacă există angajați cu 24h
        if (result.horas_plan && parseFloat(result.horas_plan) >= 24) {
          this.logger.warn(
            `🔍 Found employee with horas_plan >= 24: CODIGO ${result.CODIGO}, horas_plan: ${result.horas_plan}, fuente: ${result.fuente}`,
          );
        }

        if (result.fuente === 'cuadrante' && result.fecha_esperada) {
          // Obține valoarea originală din cuadrante
          const fecha = new Date(result.fecha_esperada);
          const dia = fecha.getDate();
          const mesFormatted = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

          try {
            // Folosește backticks pentru coloana ZI_X (poate conține spații sau caractere speciale)
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
              // Folosește helper-ul JavaScript pentru a calcula corect orele
              const horasCorrectas = calculateCuadranteHours(valOriginal);
              if (horasCorrectas > 0) {
                result.horas_plan = parseFloat(horasCorrectas.toFixed(2));
                this.logger.log(
                  `✅ Recalculated horas_plan for CODIGO ${result.CODIGO}: ${horasAnterioare} → ${result.horas_plan} (original: ${valOriginal})`,
                );
              }
            } else {
              this.logger.warn(
                `⚠️ No cuadrante found for CODIGO ${result.CODIGO}, dia ${dia}, mes ${mesFormatted}`,
              );
            }
          } catch (error: any) {
            this.logger.warn(
              `⚠️ Error processing horas for CODIGO ${result.CODIGO}: ${error.message}`,
            );
          }
        } else if (
          result.fuente === 'horario' &&
          result.horas_plan &&
          parseFloat(result.horas_plan) >= 24
        ) {
          // Pentru horario, dacă e 24h, probabil e 3 ture de 8h → returnăm 8h per tură
          const horasAnterioare = result.horas_plan;
          if (parseFloat(horasAnterioare) === 24) {
            result.horas_plan = 8;
            this.logger.log(
              `✅ Recalculated horas_plan for CODIGO ${result.CODIGO} (horario): ${horasAnterioare} → ${result.horas_plan} (24h = 3×8h)`,
            );
          }
        }
        // Pentru horario normal, calculul este deja corect (suma tuturor turelor)
        return result;
      }),
    );

    this.logger.log(`✅ Processed ${processedResults.length} results`);
    return processedResults;
  }

  /**
   * Query pentru CUADRANTE
   */
  async queryCuadrante(
    userId: string,
    rol: string | null,
    entidades?: { codigo?: string; mes?: string },
  ): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'CODIGO',
    );

    let mesCondition = '';
    if (entidades?.mes) {
      mesCondition = `AND LUNA LIKE ${this.escapeSql(`%${entidades.mes}%`)}`;
    } else {
      // Mes actual
      const mesActual = new Date().toLocaleString('es-ES', { month: 'long' });
      mesCondition = `AND LUNA LIKE ${this.escapeSql(`%${mesActual}%`)}`;
    }

    const query = `
      SELECT 
        id,
        CODIGO,
        EMAIL,
        NOMBRE,
        LUNA,
        CENTRO,
        TotalHoras
      FROM cuadrante
      WHERE ${rbacCondition}
        ${mesCondition}
      ORDER BY LUNA DESC
      LIMIT 10
    `;

    this.logger.log(`🔍 Query cuadrante: ${query.substring(0, 100)}...`);

    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    return results || [];
  }

  /**
   * Query pentru VACACIONES (folosește VacacionesService pentru saldo + query solicitudes)
   */
  async queryVacaciones(
    userId: string,
    rol: string | null,
    entidades?: { mes?: string; tipo?: string },
  ): Promise<any> {
    // Verifică RBAC
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'codigo',
    );

    // Construiește condiții pentru query
    let tipoCondition = '';
    if (entidades?.tipo) {
      tipoCondition = `AND tipo = ${this.escapeSql(entidades.tipo)}`;
    } else {
      // Dacă nu e specificat, caută vacaciones (nu asuntos propios)
      tipoCondition = `AND tipo = 'vacaciones'`;
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
        // Verifică anul curent și anul viitor (dacă suntem în decembrie și întrebăm despre ianuarie)
        let año = ahora.getFullYear();
        if (ahora.getMonth() === 11 && mesIndex === 0) {
          // Suntem în decembrie și întrebăm despre ianuarie → anul viitor
          año = año + 1;
        }
        const mes = mesIndex + 1;

        // Prima zi a lunii
        const fechaInicio = `${año}-${String(mes).padStart(2, '0')}-01`;
        // Ultima zi a lunii
        const ultimoDia = new Date(año, mes, 0).getDate();
        const fechaFin = `${año}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

        // fecha_fin este VARCHAR, deci trebuie să convertim la DATE
        // Caută solicitudes care se suprapun cu luna specificată
        // O solicitare se suprapune dacă: fecha_inicio <= ultima zi a lunii AND (fecha_fin >= prima zi SAU fecha_fin este NULL)
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
          `📅 Query vacaciones para mes: ${fechaInicio} a ${fechaFin} (año: ${año})`,
        );
      }
    }

    // Query pentru solicitudes de vacații
    // Dacă nu e specificat mes, returnează toate solicitudes de vacații (pentru întrebări de follow-up)
    const query = `
      SELECT 
        id,
        codigo,
        nombre,
        email,
        tipo,
        estado,
        fecha_inicio,
        fecha_fin,
        motivo,
        fecha_solicitud
      FROM solicitudes
      WHERE ${rbacCondition}
        ${tipoCondition}
        ${mesCondition}
      ORDER BY fecha_solicitud DESC
      LIMIT 50
    `;

    this.logger.log(`🔍 Query vacaciones complet:`);
    this.logger.log(`  - RBAC: ${rbacCondition}`);
    this.logger.log(`  - Tipo: ${tipoCondition}`);
    this.logger.log(`  - Mes: ${mesCondition || 'NINGUNO'}`);
    this.logger.log(`  - Query: ${query}`);

    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    this.logger.log(
      `✅ Query vacaciones retornó ${results?.length || 0} resultados`,
    );

    if (results && results.length > 0) {
      this.logger.log(
        `📋 Primeros resultados: ${JSON.stringify(results.slice(0, 3), null, 2)}`,
      );
    }

    return results || [];
  }

  /**
   * Query pentru NOMINAS
   */
  async queryNominas(
    userId: string,
    rol: string | null,
    entidades?: { mes?: string },
  ): Promise<any[]> {
    // Nominas nu au CODIGO direct, trebuie să verificăm prin User
    const accessLevel = this.rbacService.getAccessLevel(rol);

    if (accessLevel === AccessLevel.OWN_DATA_ONLY) {
      // Pentru empleado, trebuie să verificăm dacă există nomina asociată
      // Deocamdată returnează toate nominas (va fi filtrat în frontend sau prin alt mecanism)
      this.logger.warn(
        '⚠️ Query nominas pentru empleado - necesită implementare specifică',
      );
    }

    let mesCondition = '';
    if (entidades?.mes) {
      mesCondition = `AND Mes LIKE ${this.escapeSql(`%${entidades.mes}%`)}`;
    }

    const query = `
      SELECT 
        id,
        nombre,
        Mes,
        Ano,
        fecha_subida
      FROM Nominas
      WHERE 1=1
        ${mesCondition}
      ORDER BY fecha_subida DESC
      LIMIT 20
    `;

    this.logger.log(`🔍 Query nominas: ${query.substring(0, 100)}...`);

    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    return results || [];
  }

  /**
   * Query pentru SOLICITUDES (vacaciones, asuntos propios)
   */
  async querySolicitudes(
    userId: string,
    rol: string | null,
    entidades?: { tipo?: string },
  ): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'codigo',
    );

    let tipoCondition = '';
    if (entidades?.tipo) {
      tipoCondition = `AND tipo = ${this.escapeSql(entidades.tipo)}`;
    }

    const query = `
      SELECT 
        id,
        codigo,
        nombre,
        email,
        tipo,
        estado,
        fecha_inicio,
        fecha_fin,
        motivo,
        fecha_solicitud
      FROM solicitudes
      WHERE ${rbacCondition}
        ${tipoCondition}
      ORDER BY fecha_solicitud DESC
      LIMIT 20
    `;

    this.logger.log(`🔍 Query solicitudes: ${query.substring(0, 100)}...`);

    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    return results || [];
  }

  /**
   * Query pentru DOCUMENTOS
   */
  async queryDocumentos(userId: string, rol: string | null): Promise<any[]> {
    const rbacCondition = this.rbacService.buildRbacCondition(
      userId,
      rol,
      'codigo',
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

    this.logger.log(`🔍 Query documentos: ${query.substring(0, 100)}...`);

    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    return results || [];
  }

  /**
   * Query pentru KB Articles (Knowledge Base)
   */
  async queryKbArticles(
    categoria?: string,
    searchTerm?: string,
  ): Promise<any[]> {
    let conditions = 'activo = TRUE';

    if (categoria) {
      conditions += ` AND categoria = ${this.escapeSql(categoria)}`;
    }

    if (searchTerm) {
      conditions += ` AND (titulo LIKE ${this.escapeSql(`%${searchTerm}%`)} OR contenido LIKE ${this.escapeSql(`%${searchTerm}%`)})`;
    }

    const query = `
      SELECT 
        id,
        titulo,
        contenido,
        categoria,
        tags
      FROM kb_articles
      WHERE ${conditions}
      ORDER BY updated_at DESC
      LIMIT 5
    `;

    this.logger.log(`🔍 Query KB articles: ${query.substring(0, 100)}...`);

    const results = await this.prisma.$queryRawUnsafe<any[]>(query);
    return results || [];
  }

  private escapeSql(value: string): string {
    if (!value) return "''";
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  }
}
