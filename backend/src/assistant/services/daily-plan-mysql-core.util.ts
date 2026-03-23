/**
 * SET + WITH ... daily_plan (same core as fichajes faltantes). No fichaje CTEs.
 */
export function buildDailyPlanMysqlCore(
  escapeSql: (value: string) => string,
  rbacCondition: string,
  fechaFormatted: string,
  mesFormatted: string,
): string {
  return `      SET @lunaselectata = ${escapeSql(mesFormatted)};
      SET @ccaa_default  = 'ES-MD';
      SET @d_first := STR_TO_DATE(CONCAT(@lunaselectata,'-01'), '%Y-%m-%d');
      SET @d_last  := LAST_DAY(@d_first);
      SET @fecha_buscar := ${escapeSql(fechaFormatted)};

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
                -- Pentru moment, calculÄƒm doar prima turÄƒ (pentru compatibilitate)
                -- Logica completÄƒ pentru ture multiple va fi implementatÄƒ Ã®n frontend
                (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i'))
                  - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i'))
                  + 86400) % 86400) / 3600)
              WHEN TRIM(cu.val) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+Ã—[0-9]+h\\)' THEN 
                -- Format "24h (3Ã—8h)" - extrage orele per turÄƒ din parantezÄƒ (8h)
                CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val), 'Ã—', -1), 'h', 1) AS DECIMAL(10,2))
              WHEN TRIM(cu.val) REGEXP '^24h$' THEN 
                -- Format simplu "24h" - probabil e 3 ture de 8h â†’ returnÄƒm 8h per turÄƒ
                8
              WHEN TRIM(cu.val) REGEXP '^[0-9]+h' THEN 
                CAST(SUBSTRING_INDEX(TRIM(cu.val), 'h', 1) AS DECIMAL(10,2))
              ELSE 0
            END
          ,2) AS horas_cuadrante_dia,
          NULLIF(TRIM(CAST(cu.val AS CHAR)), '') AS valor_celula_cuadrante
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
      horario_multicentro_unpivot AS (
        SELECT CAST(hm.CODIGO AS CHAR) AS empleadoId, 1 AS dia, hm.CLIENTE, hm.HORARIO, hm.ZI_1 AS val FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 2, hm.CLIENTE, hm.HORARIO, hm.ZI_2 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 3, hm.CLIENTE, hm.HORARIO, hm.ZI_3 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 4, hm.CLIENTE, hm.HORARIO, hm.ZI_4 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 5, hm.CLIENTE, hm.HORARIO, hm.ZI_5 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 6, hm.CLIENTE, hm.HORARIO, hm.ZI_6 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 7, hm.CLIENTE, hm.HORARIO, hm.ZI_7 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 8, hm.CLIENTE, hm.HORARIO, hm.ZI_8 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 9, hm.CLIENTE, hm.HORARIO, hm.ZI_9 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 10, hm.CLIENTE, hm.HORARIO, hm.ZI_10 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 11, hm.CLIENTE, hm.HORARIO, hm.ZI_11 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 12, hm.CLIENTE, hm.HORARIO, hm.ZI_12 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 13, hm.CLIENTE, hm.HORARIO, hm.ZI_13 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 14, hm.CLIENTE, hm.HORARIO, hm.ZI_14 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 15, hm.CLIENTE, hm.HORARIO, hm.ZI_15 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 16, hm.CLIENTE, hm.HORARIO, hm.ZI_16 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 17, hm.CLIENTE, hm.HORARIO, hm.ZI_17 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 18, hm.CLIENTE, hm.HORARIO, hm.ZI_18 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 19, hm.CLIENTE, hm.HORARIO, hm.ZI_19 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 20, hm.CLIENTE, hm.HORARIO, hm.ZI_20 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 21, hm.CLIENTE, hm.HORARIO, hm.ZI_21 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 22, hm.CLIENTE, hm.HORARIO, hm.ZI_22 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 23, hm.CLIENTE, hm.HORARIO, hm.ZI_23 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 24, hm.CLIENTE, hm.HORARIO, hm.ZI_24 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 25, hm.CLIENTE, hm.HORARIO, hm.ZI_25 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 26, hm.CLIENTE, hm.HORARIO, hm.ZI_26 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 27, hm.CLIENTE, hm.HORARIO, hm.ZI_27 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 28, hm.CLIENTE, hm.HORARIO, hm.ZI_28 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 29, hm.CLIENTE, hm.HORARIO, hm.ZI_29 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 30, hm.CLIENTE, hm.HORARIO, hm.ZI_30 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
        UNION ALL SELECT CAST(hm.CODIGO AS CHAR), 31, hm.CLIENTE, hm.HORARIO, hm.ZI_31 FROM horario_multicentro hm WHERE hm.LUNA = @lunaselectata
      ),
      horario_multicentro_dia AS (
        SELECT
          hmu.empleadoId,
          DATE_ADD(@d_first, INTERVAL (hmu.dia - 1) DAY) AS fecha,
          hmu.dia,
          CASE WHEN hmu.val IS NOT NULL AND TRIM(hmu.val) <> '' AND TRIM(hmu.val) NOT IN ('0','0h','LIBRE') THEN 1 ELSE 0 END AS tiene_horario_multicentro,
          ROUND(
            CASE
              WHEN UPPER(TRIM(hmu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X','0','0h') THEN 0
              WHEN TRIM(hmu.val) LIKE '%:%-%:%' THEN
                (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(hmu.val),' ',-1),'-',-1),' ',1), '%H:%i'))
                  - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(hmu.val),' ',-1),'-', 1),' ',1), '%H:%i'))
                  + 86400) % 86400) / 3600)
              WHEN TRIM(hmu.val) REGEXP '^[0-9]+(\\.[0-9]+)?$' THEN CAST(TRIM(hmu.val) AS DECIMAL(10,2))
              WHEN TRIM(hmu.val) REGEXP '^[0-9]+(\\.[0-9]+)?h$' THEN CAST(SUBSTRING_INDEX(TRIM(hmu.val), 'h', 1) AS DECIMAL(10,2))
              ELSE 0
            END
          ,2) AS horas_horario_multicentro_dia,
          hmu.HORARIO AS horario_tipo,
          hmu.CLIENTE AS cliente
        FROM horario_multicentro_unpivot hmu
        WHERE hmu.val IS NOT NULL AND TRIM(hmu.val) <> '' AND TRIM(hmu.val) NOT IN ('0','0h','LIBRE')
          AND hmu.dia >= 1 AND hmu.dia <= 31
          AND DATE_ADD(@d_first, INTERVAL (hmu.dia - 1) DAY) >= @d_first
          AND DATE_ADD(@d_first, INTERVAL (hmu.dia - 1) DAY) <= @d_last
      ),
      horario_multicentro_dia_best AS (
        SELECT
          empleadoId,
          fecha,
          dia,
          MAX(tiene_horario_multicentro) AS tiene_horario_multicentro,
          MAX(horas_horario_multicentro_dia) AS horas_horario_multicentro_dia
        FROM (
          SELECT
            empleadoId,
            fecha,
            dia,
            tiene_horario_multicentro,
            horas_horario_multicentro_dia,
            CASE
              WHEN UPPER(horario_tipo) LIKE '%NOCHE%' OR UPPER(horario_tipo) LIKE '%T3%' THEN 1
              WHEN UPPER(horario_tipo) LIKE '%DIA%' OR UPPER(horario_tipo) LIKE '%T1%' OR UPPER(horario_tipo) LIKE '%T2%' THEN 2
              ELSE 3
            END AS prioridad
          FROM horario_multicentro_dia
        ) ranked
        GROUP BY empleadoId, fecha, dia
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
          a.DURACION AS duracion,
          TRIM(REPLACE(REPLACE(a.\`FECHA\`,'â€“','-'),'â€”','-')) AS fecha_txt
        FROM Ausencias a
      ),
      aus_parts AS (
        SELECT
          empleadoId,
          tipo,
          duracion,
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
          duracion,
          COALESCE(STR_TO_DATE(start_raw, '%Y-%m-%d'), STR_TO_DATE(start_raw, '%Y-%m-%e')) AS d_start,
          COALESCE(STR_TO_DATE(end_raw,   '%Y-%m-%d'), STR_TO_DATE(end_raw,   '%Y-%m-%e')) AS d_end,
          -- DeterminÄƒ dacÄƒ ausencia este pe ore sau pe zile
          -- Tipuri pe ore: Salida Sin Regreso, Salida Centro, Entrada Centro (au DURACION Ã®n format TIME)
          -- Tipuri pe zile: Vacaciones, Asunto Propio, Permiso, Baja, Ausencia Injustificada
          CASE
            WHEN tipo = 'VACACIONES' THEN 0
            WHEN tipo LIKE '%ASUNTO PROPIO%' THEN 0
            WHEN tipo LIKE '%PERMISO%' THEN 0
            WHEN tipo LIKE '%BAJA%' THEN 0
            WHEN tipo LIKE '%AUSENCIA INJUSTIFICADA%' THEN 0
            WHEN tipo LIKE '%SALIDA SIN REGRESO%' THEN 1
            WHEN tipo LIKE '%SALIDA CENTRO%' THEN 1
            WHEN tipo LIKE '%ENTRADA CENTRO%' THEN 1
            WHEN duracion IS NOT NULL AND TRIM(duracion) != '' AND duracion != '00:00:00' THEN 1
            ELSE 0
          END AS es_pe_ore
        FROM aus_parts
      ),
      aus_dia AS (
        SELECT 
          @fecha_buscar AS fecha,
          n.empleadoId,
          MAX(CASE WHEN n.tipo='VACACIONES' THEN 1 ELSE 0 END) AS es_vacaciones,
          -- es_ausencia = 1 doar pentru ausencias pe zile (nu pe ore)
          MAX(CASE WHEN n.tipo<> 'VACACIONES' AND n.es_pe_ore = 0 THEN 1 ELSE 0 END) AS es_ausencia,
          -- SumÄƒ orele din ausencias pe ore pentru ziua respectivÄƒ
          -- DURACION este TEXT Ã®n MySQL (format "HH:MM:SS"), deci trebuie convertit la TIME
          SUM(CASE WHEN n.es_pe_ore = 1 THEN 
            COALESCE(TIME_TO_SEC(STR_TO_DATE(n.duracion, '%H:%i:%s')) / 3600.0, 0)
            ELSE 0 
          END) AS horas_ausencia_ore
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
            WHEN LOWER(TRIM(de.TrabajaFestivos)) IN ('si','sÃ­','s','1','true','da','y') THEN 1
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
            ELSE GREATEST(
              COALESCE(
                CASE WHEN cd.tiene_cuadrante = 1 THEN cd.horas_cuadrante_dia ELSE NULL END,
                CASE WHEN hmd.tiene_horario_multicentro = 1 THEN hmd.horas_horario_multicentro_dia ELSE NULL END,
                CASE WHEN hd.horas_horario_dia IS NOT NULL THEN hd.horas_horario_dia ELSE NULL END,
                0
              ) - COALESCE(au.horas_ausencia_ore, 0),
              0
            )
          END AS horas_plan,
          CASE
            WHEN bj.es_baja = 1 THEN 'baja_medica'
            WHEN COALESCE(au.es_vacaciones,0) = 1 THEN 'vacaciones'
            WHEN fd2.es_fiesta = 1 AND COALESCE(tf.trabaja_festivos,0) = 0 THEN 'fiesta'
            WHEN COALESCE(au.es_ausencia,0) = 1 THEN 'ausencia'
            WHEN cd.tiene_cuadrante = 1 THEN 'cuadrante'
            WHEN hmd.tiene_horario_multicentro = 1 THEN 'horario_multicentro'
            WHEN hd.horas_horario_dia IS NOT NULL AND hd.horas_horario_dia > 0 THEN 'horario'
            ELSE 'none'
          END AS fuente
        FROM DatosEmpleados de
        LEFT JOIN cuadrante_dia cd
          ON cd.empleadoId = CAST(de.CODIGO AS CHAR) AND cd.fecha = @fecha_buscar
        LEFT JOIN horario_multicentro_dia_best hmd
          ON hmd.empleadoId = CAST(de.CODIGO AS CHAR) AND hmd.fecha = @fecha_buscar
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
      )
`;
}
