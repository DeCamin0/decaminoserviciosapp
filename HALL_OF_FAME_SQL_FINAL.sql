-- ============================================
-- HALL OF FAME - SQL COMPLET EXECUTABIL
-- Reparat toate bug-urile identificate
-- ============================================

SET @lunaselectata = '2025-01';  -- Format: 'YYYY-MM'
SET @ccaa_default = 'ES-MD';
SET @d_first := STR_TO_DATE(CONCAT(@lunaselectata, '-01'), '%Y-%m-%d');
SET @d_last := LAST_DAY(@d_first);

WITH RECURSIVE fechas AS (
  SELECT @d_first AS d
  UNION ALL
  SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM fechas WHERE d < @d_last
),

-- 2. empleado_flags - Flag trabaja_festivos
empleado_flags AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE 
      WHEN LOWER(TRIM(de.TrabajaFestivos)) IN ('si','sí','s','1','true','da','y') THEN 1
      ELSE 0
    END AS trabaja_festivos
  FROM DatosEmpleados de
  WHERE de.ESTADO = 'ACTIVO'
),

-- 3. empleado_ccaa - CCAA pentru fiestas
empleado_ccaa AS (
  SELECT CAST(de.CODIGO AS CHAR) AS empleadoId, @ccaa_default AS ccaa
  FROM DatosEmpleados de
  WHERE de.ESTADO = 'ACTIVO'
),

-- 4. cuadrante_unpivot - Unpivot cuadrante (ZI_1...ZI_31) - COMPLET
cuadrante_unpivot AS (
  SELECT CAST(cq.CODIGO AS CHAR) AS empleadoId, 1 AS dia, cq.CENTRO AS centro_cuadrante, cq.ZI_1 AS val FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 2, cq.CENTRO, cq.ZI_2 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 3, cq.CENTRO, cq.ZI_3 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 4, cq.CENTRO, cq.ZI_4 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 5, cq.CENTRO, cq.ZI_5 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 6, cq.CENTRO, cq.ZI_6 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 7, cq.CENTRO, cq.ZI_7 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 8, cq.CENTRO, cq.ZI_8 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 9, cq.CENTRO, cq.ZI_9 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 10, cq.CENTRO, cq.ZI_10 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 11, cq.CENTRO, cq.ZI_11 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 12, cq.CENTRO, cq.ZI_12 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 13, cq.CENTRO, cq.ZI_13 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 14, cq.CENTRO, cq.ZI_14 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 15, cq.CENTRO, cq.ZI_15 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 16, cq.CENTRO, cq.ZI_16 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 17, cq.CENTRO, cq.ZI_17 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 18, cq.CENTRO, cq.ZI_18 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 19, cq.CENTRO, cq.ZI_19 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 20, cq.CENTRO, cq.ZI_20 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 21, cq.CENTRO, cq.ZI_21 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 22, cq.CENTRO, cq.ZI_22 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 23, cq.CENTRO, cq.ZI_23 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 24, cq.CENTRO, cq.ZI_24 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 25, cq.CENTRO, cq.ZI_25 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 26, cq.CENTRO, cq.ZI_26 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 27, cq.CENTRO, cq.ZI_27 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 28, cq.CENTRO, cq.ZI_28 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 29, cq.CENTRO, cq.ZI_29 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 30, cq.CENTRO, cq.ZI_30 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 31, cq.CENTRO, cq.ZI_31 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
),

-- 5. cuadrante_dia - Ore planificate pe zi din cuadrante (REPARAT: pornesc din fechas)
cuadrante_dia AS (
  SELECT
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    f.d AS fecha,
    DAY(f.d) AS dia,
    CASE WHEN cu.empleadoId IS NOT NULL THEN 1 ELSE 0 END AS tiene_cuadrante,
    ROUND(SUM(
      CASE 
        WHEN UPPER(TRIM(cu.val)) IN ('LIB','LIBRE','L','DESCANSO','FESTIVO','VAC','VACACIONES','BAJA','X') THEN 0
        WHEN TRIM(cu.val) LIKE '%:%-%:%' THEN 
          (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i')) - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i')) + 86400) % 86400) / 3600)
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 
          CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val), '×', -1), 'h', 1) AS DECIMAL(10,2))
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h' THEN 
          CAST(SUBSTRING_INDEX(TRIM(cu.val), 'h', 1) AS DECIMAL(10,2))
        ELSE 0
      END
    ), 2) AS horas_cuadrante_dia
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN cuadrante_unpivot cu ON cu.empleadoId = CAST(de.CODIGO AS CHAR) AND cu.dia = DAY(f.d)
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO, f.d, DAY(f.d)
),

-- 6. horario_dia_m - Minute planificate pe zi din horario (m1, m2, m3) - COMPLET
horario_dia_m AS (
  SELECT
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    f.d AS fecha,
    DAY(f.d) AS dia,
    -- m1
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in1), CONCAT(f.d,' ',h.lun_out1)) + 1440) % 1440, 0)
      WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in1), CONCAT(f.d,' ',h.mar_out1)) + 1440) % 1440, 0)
      WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in1), CONCAT(f.d,' ',h.mie_out1)) + 1440) % 1440, 0)
      WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in1), CONCAT(f.d,' ',h.joi_out1)) + 1440) % 1440, 0)
      WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in1), CONCAT(f.d,' ',h.vin_out1)) + 1440) % 1440, 0)
      WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in1), CONCAT(f.d,' ',h.sam_out1)) + 1440) % 1440, 0)
      WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in1), CONCAT(f.d,' ',h.dum_out1)) + 1440) % 1440, 0)
      ELSE 0
    END AS m1,
    -- m2
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in2), CONCAT(f.d,' ',h.lun_out2)) + 1440) % 1440, 0)
      WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in2), CONCAT(f.d,' ',h.mar_out2)) + 1440) % 1440, 0)
      WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in2), CONCAT(f.d,' ',h.mie_out2)) + 1440) % 1440, 0)
      WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in2), CONCAT(f.d,' ',h.joi_out2)) + 1440) % 1440, 0)
      WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in2), CONCAT(f.d,' ',h.vin_out2)) + 1440) % 1440, 0)
      WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in2), CONCAT(f.d,' ',h.sam_out2)) + 1440) % 1440, 0)
      WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in2), CONCAT(f.d,' ',h.dum_out2)) + 1440) % 1440, 0)
      ELSE 0
    END AS m2,
    -- m3
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in3), CONCAT(f.d,' ',h.lun_out3)) + 1440) % 1440, 0)
      WHEN 3 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mar_in3), CONCAT(f.d,' ',h.mar_out3)) + 1440) % 1440, 0)
      WHEN 4 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.mie_in3), CONCAT(f.d,' ',h.mie_out3)) + 1440) % 1440, 0)
      WHEN 5 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.joi_in3), CONCAT(f.d,' ',h.joi_out3)) + 1440) % 1440, 0)
      WHEN 6 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.vin_in3), CONCAT(f.d,' ',h.vin_out3)) + 1440) % 1440, 0)
      WHEN 7 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.sam_in3), CONCAT(f.d,' ',h.sam_out3)) + 1440) % 1440, 0)
      WHEN 1 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.dum_in3), CONCAT(f.d,' ',h.dum_out3)) + 1440) % 1440, 0)
      ELSE 0
    END AS m3
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN horarios h
    ON h.centro_nombre = de.`CENTRO TRABAJO`
    AND h.grupo_nombre = de.GRUPO
    AND h.vigente_desde <= f.d
    AND (h.vigente_hasta IS NULL OR f.d <= h.vigente_hasta)
  WHERE de.ESTADO = 'ACTIVO'
),

-- 7. horario_dia - Ore planificate pe zi din horario
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
    , 2) AS horas_horario_dia
  FROM horario_dia_m
),

-- 8. bajas_raw - Raw bajas (REPARAT: separare bajas_raw + bajas_intervalos)
bajas_raw AS (
  SELECT
    TRIM(CAST(mc.Codigo_Empleado AS CHAR)) AS empleadoId,
    mc.`Fecha baja` AS fecha_baja_raw,
    mc.`Fecha de alta` AS fecha_alta_raw
  FROM MutuaCasos mc
),

-- 9. bajas_intervalos - Intervale de baja medicală (REPARAT: nu folosesc alias în WHERE)
bajas_intervalos AS (
  SELECT
    empleadoId,
    CASE 
      WHEN NULLIF(fecha_baja_raw, '') IS NULL THEN NULL
      WHEN fecha_baja_raw REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(fecha_baja_raw)
      WHEN fecha_baja_raw LIKE '__/__/____' THEN STR_TO_DATE(fecha_baja_raw, '%d/%m/%Y')
      ELSE NULL
    END AS d_ini,
    COALESCE(
      CASE 
        WHEN NULLIF(fecha_alta_raw, '') IS NULL THEN NULL
        WHEN fecha_alta_raw REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(fecha_alta_raw)
        WHEN fecha_alta_raw LIKE '__/__/____' THEN STR_TO_DATE(fecha_alta_raw, '%d/%m/%Y')
        ELSE NULL
      END,
      @d_last
    ) AS d_fin
  FROM bajas_raw
  WHERE 
    CASE 
      WHEN NULLIF(fecha_baja_raw, '') IS NULL THEN NULL
      WHEN fecha_baja_raw REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(fecha_baja_raw)
      WHEN fecha_baja_raw LIKE '__/__/____' THEN STR_TO_DATE(fecha_baja_raw, '%d/%m/%Y')
      ELSE NULL
    END IS NOT NULL
    AND 
    CASE 
      WHEN NULLIF(fecha_baja_raw, '') IS NULL THEN NULL
      WHEN fecha_baja_raw REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(fecha_baja_raw)
      WHEN fecha_baja_raw LIKE '__/__/____' THEN STR_TO_DATE(fecha_baja_raw, '%d/%m/%Y')
      ELSE NULL
    END <= @d_last
    AND COALESCE(
      CASE 
        WHEN NULLIF(fecha_alta_raw, '') IS NULL THEN NULL
        WHEN fecha_alta_raw REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(fecha_alta_raw)
        WHEN fecha_alta_raw LIKE '__/__/____' THEN STR_TO_DATE(fecha_alta_raw, '%d/%m/%Y')
        ELSE NULL
      END,
      @d_last
    ) >= @d_first
),

-- 10. bajas_dia - Zile de baja medicală
bajas_dia AS (
  SELECT 
    bi.empleadoId,
    f.d AS fecha,
    CASE WHEN f.d BETWEEN bi.d_ini AND bi.d_fin THEN 1 ELSE 0 END AS es_baja
  FROM bajas_intervalos bi
  CROSS JOIN fechas f
  WHERE bi.d_ini IS NOT NULL
),

-- 11. aus_raw - Ausencias raw (pentru parsing)
aus_raw AS (
  SELECT 
    CAST(a.`CODIGO` AS CHAR) AS empleadoId,
    TRIM(a.`TIPO`) AS tipo,
    a.`DURACION` AS duracion,
    TRIM(REPLACE(REPLACE(a.`FECHA`,'–','-'),'—','-')) AS fecha_txt
  FROM Ausencias a
),

-- 12. aus_parts - Ausencias parsed (start/end)
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

-- 13. aus_norm - Ausencias normalizate (cu dates) - REPARAT: scos "aprobate" (nu există estado)
aus_norm AS (
  SELECT
    empleadoId,
    tipo,
    duracion,
    COALESCE(STR_TO_DATE(start_raw, '%Y-%m-%d'), STR_TO_DATE(start_raw, '%Y-%m-%e')) AS d_start,
    COALESCE(STR_TO_DATE(end_raw, '%Y-%m-%d'), STR_TO_DATE(end_raw, '%Y-%m-%e')) AS d_end,
    CASE
      WHEN UPPER(tipo) = 'VACACIONES' THEN 0
      WHEN UPPER(tipo) LIKE '%ASUNTO PROPIO%' THEN 0
      WHEN UPPER(tipo) LIKE '%PERMISO%' THEN 0
      WHEN UPPER(tipo) LIKE '%BAJA%' THEN 0
      WHEN UPPER(tipo) LIKE '%AUSENCIA INJUSTIFICADA%' THEN 0
      WHEN UPPER(tipo) LIKE '%SALIDA SIN REGRESO%' THEN 1
      WHEN UPPER(tipo) LIKE '%SALIDA CENTRO%' THEN 1
      WHEN UPPER(tipo) LIKE '%ENTRADA CENTRO%' THEN 1
      WHEN duracion IS NOT NULL AND TRIM(duracion) != '' AND duracion != '00:00:00' THEN 1
      ELSE 0
    END AS es_pe_ore
  FROM aus_parts
),

-- 14. aus_dia - Ausencias pe zi
aus_dia AS (
  SELECT 
    f.d AS fecha,
    n.empleadoId,
    MAX(CASE WHEN UPPER(n.tipo)='VACACIONES' AND n.d_start IS NOT NULL AND n.d_end IS NOT NULL THEN 1 ELSE 0 END) AS es_vacaciones,
    MAX(CASE WHEN UPPER(n.tipo)<> 'VACACIONES' AND n.es_pe_ore = 0 AND n.d_start IS NOT NULL AND n.d_end IS NOT NULL THEN 1 ELSE 0 END) AS es_ausencia,
    SUM(CASE WHEN n.es_pe_ore = 1 THEN 
      COALESCE(TIME_TO_SEC(STR_TO_DATE(n.duracion, '%H:%i:%s')) / 3600.0, 0)
      ELSE 0 
    END) AS horas_ausencia_ore
  FROM fechas f
  JOIN aus_norm n
    ON n.d_start IS NOT NULL 
    AND n.d_end IS NOT NULL
    AND f.d BETWEEN n.d_start AND n.d_end
  GROUP BY f.d, n.empleadoId
),

-- 15. fiestas_dia - Zile de fiesta (cu scope/ccaa și trabaja_festivos)
fiestas_dia AS (
  SELECT 
    ec.empleadoId,
    f.d AS fecha,
    CASE 
      WHEN fi.active = 1
        AND DATE(COALESCE(fi.observed_date, fi.date)) = f.d
        AND (
          LOWER(fi.scope) IN ('nacional', 'national')
          OR (LOWER(fi.scope) IN ('autonómico', 'autonomico', 'ccaa') AND fi.ccaa_code = ec.ccaa)
        )
        AND COALESCE(tf.trabaja_festivos, 0) = 0
      THEN 1 ELSE 0
    END AS es_fiesta
  FROM empleado_ccaa ec
  CROSS JOIN fechas f
  LEFT JOIN fiestas fi ON DATE(COALESCE(fi.observed_date, fi.date)) = f.d
  LEFT JOIN empleado_flags tf ON tf.empleadoId = ec.empleadoId
),

-- 16. empleado_orar - Flag explicit "are orar"
empleado_orar AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE WHEN cq.CODIGO IS NOT NULL THEN 1 ELSE 0 END AS has_cuadrante,
    CASE WHEN h.id IS NOT NULL THEN 1 ELSE 0 END AS has_horario,
    CASE 
      WHEN cq.CODIGO IS NOT NULL OR h.id IS NOT NULL THEN 1 
      ELSE 0 
    END AS has_orar
  FROM DatosEmpleados de
  LEFT JOIN cuadrante cq 
    ON cq.CODIGO = de.CODIGO 
    AND cq.LUNA = @lunaselectata
  LEFT JOIN horarios h
    ON h.grupo_nombre = de.GRUPO
    AND h.centro_nombre = de.`CENTRO TRABAJO`
    AND h.vigente_desde <= @d_last
    AND (h.vigente_hasta IS NULL OR h.vigente_hasta >= @d_first)
  WHERE de.ESTADO = 'ACTIVO'
),

-- 17. target_initial - Target inițial (cuadrante > horario > HORAS_CONTRATO)
target_initial AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE
      WHEN cq.CODIGO IS NOT NULL THEN
        ROUND(SUM(cd.horas_cuadrante_dia), 2)
      WHEN h.total_horas_semanales IS NOT NULL THEN
        ROUND(h.total_horas_semanales * (DAY(@d_last) / 7), 2)
      ELSE
        ROUND(COALESCE(CAST(de.`HORAS_DE_CONTRATO` AS DECIMAL(10,2)), 0) * (DAY(@d_last) / 7), 2)
    END AS target_initial,
    CASE 
      WHEN cq.CODIGO IS NULL AND h.id IS NULL THEN
        COALESCE(CAST(de.`HORAS_DE_CONTRATO` AS DECIMAL(10,2)), 0) / 7
      ELSE NULL
    END AS horas_pe_zi_contrato
  FROM DatosEmpleados de
  LEFT JOIN cuadrante cq ON cq.CODIGO = de.CODIGO AND cq.LUNA = @lunaselectata
  LEFT JOIN horarios h ON h.grupo_nombre = de.GRUPO 
    AND h.centro_nombre = de.`CENTRO TRABAJO`
    AND h.vigente_desde <= @d_last 
    AND (h.vigente_hasta IS NULL OR h.vigente_hasta >= @d_first)
  LEFT JOIN cuadrante_dia cd ON cd.empleadoId = CAST(de.CODIGO AS CHAR)
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),

-- 18. zile_neutre - Zile neutre (COUNT DISTINCT)
zile_neutre AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    COUNT(DISTINCT CASE 
      WHEN bj.es_baja = 1 THEN f.d
    END) AS dias_baja,
    COUNT(DISTINCT CASE 
      WHEN au.es_vacaciones = 1 THEN f.d
    END) AS dias_vacaciones,
    COUNT(DISTINCT CASE 
      WHEN fd.es_fiesta = 1 THEN f.d
    END) AS dias_fiesta
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN bajas_dia bj ON bj.empleadoId = CAST(de.CODIGO AS CHAR) AND bj.fecha = f.d
  LEFT JOIN aus_dia au ON au.empleadoId = CAST(de.CODIGO AS CHAR) AND au.fecha = f.d
  LEFT JOIN fiestas_dia fd ON fd.empleadoId = CAST(de.CODIGO AS CHAR) AND fd.fecha = f.d
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),

-- 19. ore_zile_neutre - Ore din zile neutre (pentru ajustare target)
ore_zile_neutre AS (
  SELECT 
    zn.empleadoId,
    CASE 
      WHEN eo.has_orar = 1 THEN
        ROUND(SUM(
          CASE 
            WHEN bj.es_baja = 1 OR au.es_vacaciones = 1 OR fd.es_fiesta = 1 THEN
              COALESCE(cd.horas_cuadrante_dia, hd.horas_horario_dia, 0)
            ELSE 0
          END
        ), 2)
      ELSE
        (zn.dias_baja + zn.dias_vacaciones + zn.dias_fiesta) * ti.horas_pe_zi_contrato
    END AS horas_neutre
  FROM zile_neutre zn
  JOIN empleado_orar eo ON eo.empleadoId = zn.empleadoId
  JOIN target_initial ti ON ti.empleadoId = zn.empleadoId
  CROSS JOIN fechas f
  LEFT JOIN bajas_dia bj ON bj.empleadoId = zn.empleadoId AND bj.fecha = f.d
  LEFT JOIN aus_dia au ON au.empleadoId = zn.empleadoId AND au.fecha = f.d
  LEFT JOIN fiestas_dia fd ON fd.empleadoId = zn.empleadoId AND fd.fecha = f.d
  LEFT JOIN cuadrante_dia cd ON cd.empleadoId = zn.empleadoId AND cd.fecha = f.d
  LEFT JOIN horario_dia hd ON hd.empleadoId = zn.empleadoId AND hd.fecha = f.d
  WHERE (bj.es_baja = 1 OR au.es_vacaciones = 1 OR fd.es_fiesta = 1)
  GROUP BY zn.empleadoId
),

-- 20. target_ajustat - Target după scăderea zilelor neutre
target_ajustat AS (
  SELECT 
    ti.empleadoId,
    ti.target_initial,
    ti.horas_pe_zi_contrato,
    GREATEST(0, ti.target_initial - COALESCE(ozn.horas_neutre, 0)) AS target_ajustat,
    COALESCE(ozn.horas_neutre, 0) AS horas_neutre
  FROM target_initial ti
  LEFT JOIN ore_zile_neutre ozn ON ozn.empleadoId = ti.empleadoId
),

-- 21. fichaje_base - Fichajes cu workday_date corect (pentru ture de noapte)
fichaje_base AS (
  SELECT 
    CAST(f.CODIGO AS CHAR) AS empleadoId,
    STR_TO_DATE(f.FECHA, '%Y-%m-%d') AS fecha,
    f.TIPO AS tipo,
    STR_TO_DATE(f.HORA, '%H:%i:%s') AS hora,
    f.DURACION AS duracion,
    CASE 
      WHEN f.TIPO = 'Salida' AND STR_TO_DATE(f.HORA, '%H:%i:%s') < STR_TO_DATE('06:00:00', '%H:%i:%s') THEN
        DATE_ADD(STR_TO_DATE(f.FECHA, '%Y-%m-%d'), INTERVAL 1 DAY)
      ELSE STR_TO_DATE(f.FECHA, '%Y-%m-%d')
    END AS workday_date
  FROM Fichaje f
  WHERE STR_TO_DATE(f.FECHA, '%Y-%m-%d') BETWEEN @d_first AND @d_last
),

-- 22. horas_pontate - Ore pontate (cu regularizări CONFIRMED)
horas_pontate AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    ROUND(SUM(
      CASE 
        WHEN fr.status = 'CONFIRMED' AND fr.effective_minutes IS NOT NULL
        THEN fr.effective_minutes / 60.0
        WHEN f.DURACION IS NOT NULL AND TRIM(f.DURACION) <> '' AND f.DURACION <> '00:00:00'
        THEN TIME_TO_SEC(f.DURACION) / 3600.0
        ELSE 0
      END
    ), 2) AS horas_pontate
  FROM DatosEmpleados de
  LEFT JOIN fichaje_base f ON f.empleadoId = CAST(de.CODIGO AS CHAR) AND f.workday_date BETWEEN @d_first AND @d_last
  LEFT JOIN FichajeRegularizacion fr 
    ON fr.employee_codigo = CAST(de.CODIGO AS CHAR)
    AND fr.workday_date = f.workday_date
    AND fr.status = 'CONFIRMED'
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),

-- 23. calitate_pontaj - Calitate pontaj (fichajes incomplete + regularizări)
calitate_pontaj AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    COUNT(DISTINCT CASE 
      WHEN f.tipo IN ('Entrada', 'Salida') 
        AND (f.DURACION IS NULL OR TRIM(f.DURACION) = '' OR f.DURACION = '00:00:00')
      THEN f.workday_date
    END) AS fichajes_incompleto,
    COUNT(DISTINCT CASE 
      WHEN fr.status = 'CONFIRMED' 
      THEN fr.workday_date
    END) AS regularizaciones_confirmed,
    COUNT(DISTINCT CASE 
      WHEN fr.status IN ('PENDING', 'NEEDS_REVIEW')
      THEN fr.workday_date
    END) AS regularizaciones_pendiente
  FROM DatosEmpleados de
  LEFT JOIN fichaje_base f ON f.empleadoId = CAST(de.CODIGO AS CHAR) AND f.workday_date BETWEEN @d_first AND @d_last
  LEFT JOIN FichajeRegularizacion fr 
    ON fr.employee_codigo = CAST(de.CODIGO AS CHAR)
    AND fr.workday_date = f.workday_date
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),

-- 24. horario_start_dia - Ora de start planificată pe zi din horario (REPARAT: CTE nou pentru punctualitate)
horario_start_dia AS (
  SELECT
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    f.d AS fecha,
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN h.lun_in1
      WHEN 3 THEN h.mar_in1
      WHEN 4 THEN h.mie_in1
      WHEN 5 THEN h.joi_in1
      WHEN 6 THEN h.vin_in1
      WHEN 7 THEN h.sam_in1
      WHEN 1 THEN h.dum_in1
      ELSE NULL
    END AS hora_in_planificata
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN horarios h
    ON h.centro_nombre = de.`CENTRO TRABAJO`
    AND h.grupo_nombre = de.GRUPO
    AND h.vigente_desde <= f.d
    AND (h.vigente_hasta IS NULL OR f.d <= h.vigente_hasta)
  WHERE de.ESTADO = 'ACTIVO'
),

-- 25. cuadrante_val_dia - Valoare cuadrante pe zi (REPARAT: CTE nou pentru punctualitate)
cuadrante_val_dia AS (
  SELECT
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    f.d AS fecha,
    cu.val AS val_cuadrante
  FROM DatosEmpleados de
  CROSS JOIN fechas f
  LEFT JOIN cuadrante_unpivot cu ON cu.empleadoId = CAST(de.CODIGO AS CHAR) AND cu.dia = DAY(f.d)
  WHERE de.ESTADO = 'ACTIVO'
),

-- 26. punctualitate - Punctualitate (DOAR pentru has_orar = true) - REPARAT: folosesc CTE-uri noi
punctualitate AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    COUNT(DISTINCT CASE 
      WHEN eo.has_orar = 1
        AND fb.tipo = 'Entrada'
        AND (
          -- Compară cu cuadrante
          (cvd.val_cuadrante IS NOT NULL 
           AND TRIM(cvd.val_cuadrante) LIKE '%:%-%:%'
           AND TIME(fb.hora) BETWEEN 
             TIME(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cvd.val_cuadrante),' ',-1),'-', 1),' ',1)) - INTERVAL 15 MINUTE
             AND TIME(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cvd.val_cuadrante),' ',-1),'-', 1),' ',1)) + INTERVAL 30 MINUTE)
          OR
          -- Compară cu horario
          (hsd.hora_in_planificata IS NOT NULL 
           AND TIME(fb.hora) BETWEEN 
             TIME(hsd.hora_in_planificata) - INTERVAL 15 MINUTE
             AND TIME(hsd.hora_in_planificata) + INTERVAL 30 MINUTE)
        )
        AND COALESCE(bj.es_baja, 0) = 0
        AND COALESCE(au.es_vacaciones, 0) = 0
        AND COALESCE(fd.es_fiesta, 0) = 0
      THEN fb.fecha
    END) AS zile_punctuale,
    COUNT(DISTINCT CASE 
      WHEN eo.has_orar = 1
        AND (cvd.val_cuadrante IS NOT NULL OR hsd.hora_in_planificata IS NOT NULL)
        AND COALESCE(bj.es_baja, 0) = 0
        AND COALESCE(au.es_vacaciones, 0) = 0
        AND COALESCE(fd.es_fiesta, 0) = 0
      THEN f.d
    END) AS zile_cu_orar
  FROM DatosEmpleados de
  JOIN empleado_orar eo ON eo.empleadoId = CAST(de.CODIGO AS CHAR)
  CROSS JOIN fechas f
  LEFT JOIN fichaje_base fb ON fb.empleadoId = CAST(de.CODIGO AS CHAR) AND fb.fecha = f.d
  LEFT JOIN cuadrante_val_dia cvd ON cvd.empleadoId = CAST(de.CODIGO AS CHAR) AND cvd.fecha = f.d
  LEFT JOIN horario_start_dia hsd ON hsd.empleadoId = CAST(de.CODIGO AS CHAR) AND hsd.fecha = f.d
  LEFT JOIN bajas_dia bj ON bj.empleadoId = CAST(de.CODIGO AS CHAR) AND bj.fecha = f.d
  LEFT JOIN aus_dia au ON au.empleadoId = CAST(de.CODIGO AS CHAR) AND au.fecha = f.d
  LEFT JOIN fiestas_dia fd ON fd.empleadoId = CAST(de.CODIGO AS CHAR) AND fd.fecha = f.d
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),

-- 27. acciones_empleado - Acțiuni pe angajat (cu ponderi) - REPARAT: scos LIKE pe nume
acciones_empleado AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    -- Fichajes (Entrada/Salida): 1 punct
    COUNT(DISTINCT CASE 
      WHEN l.action IN ('fichaje_created', 'fichaje_updated')
        AND DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
        AND l.email = de.`CORREO ELECTRONICO`
      THEN CONCAT(DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')), '-', l.action)
    END) * 1.0 AS puntos_fichajes,
    -- Solicitudes (vacaciones, asuntos propios): 2 puncte
    COUNT(DISTINCT CASE 
      WHEN l.action IN ('solicitud_created', 'solicitud_updated')
        AND DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
        AND l.email = de.`CORREO ELECTRONICO`
      THEN CONCAT(DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')), '-', l.action)
    END) * 2.0 AS puntos_solicitudes,
    -- Upload document: 3 puncte
    COUNT(DISTINCT CASE 
      WHEN l.action IN ('documento_uploaded', 'documento_upload', 'documento_oficial_uploaded')
        AND DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
        AND l.email = de.`CORREO ELECTRONICO`
      THEN CONCAT(DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')), '-', l.action)
    END) * 3.0 AS puntos_documentos,
    -- Formular completat / Actualizare date: 3 puncte
    COUNT(DISTINCT CASE 
      WHEN l.action IN ('user_updated', 'cambio_personal_created', 'tarea_created', 'tarea_updated')
        AND DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
        AND l.email = de.`CORREO ELECTRONICO`
      THEN CONCAT(DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')), '-', l.action)
    END) * 3.0 AS puntos_formularios,
    -- Login: 0.2 puncte (maxim 1 punct pe zi = 5 logins/zi)
    LEAST(
      SUM(
        CASE 
          WHEN l.action IN ('login', 'demo_login')
            AND DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
            AND l.email = de.`CORREO ELECTRONICO`
          THEN 0.2
          ELSE 0
        END
      ),
      DAY(@d_last) * 1.0
    ) AS puntos_login
  FROM DatosEmpleados de
  LEFT JOIN Logs l ON l.email = de.`CORREO ELECTRONICO`
    AND DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),

-- 28. acciones_totales - Total acțiuni per angajat
acciones_totales AS (
  SELECT 
    empleadoId,
    COALESCE(puntos_fichajes, 0) + 
    COALESCE(puntos_solicitudes, 0) + 
    COALESCE(puntos_documentos, 0) + 
    COALESCE(puntos_formularios, 0) + 
    COALESCE(puntos_login, 0) AS acciones_totales
  FROM acciones_empleado
),

-- 29. max_acciones_mes - Maximul de acțiuni din lună (pentru normalizare)
max_acciones_mes AS (
  SELECT MAX(acciones_totales) AS max_acciones
  FROM acciones_totales
),

-- 30. uso_app - Scor "Uso de la aplicación" (normalizat)
uso_app AS (
  SELECT 
    at.empleadoId,
    at.acciones_totales,
    CASE 
      WHEN mam.max_acciones > 0 THEN
        (at.acciones_totales / mam.max_acciones) * 100
      ELSE 0
    END AS score_uso_app
  FROM acciones_totales at
  CROSS JOIN max_acciones_mes mam
),

-- 31. scoring - Scoring final
scoring AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    de.`NOMBRE / APELLIDOS` AS empleadoNombre,
    de.GRUPO AS grupo,
    -- KPI 1: Îndeplinire ore (0-100)
    CASE 
      WHEN ta.target_ajustat > 0 AND (hp.horas_pontate / ta.target_ajustat) < 0.8 THEN
        LEAST(75, (hp.horas_pontate / ta.target_ajustat) * 100)
      WHEN ta.target_ajustat > 0 THEN
        LEAST(100, (hp.horas_pontate / ta.target_ajustat) * 100)
      ELSE 0
    END AS score_indeplinire,
    -- KPI 2: Calitate pontaj (0-100)
    GREATEST(0, 100 - 
      (GREATEST(0, cp.fichajes_incompleto - (cp.regularizaciones_confirmed * 0.5)) * 15) - 
      (cp.regularizaciones_pendiente * 5)
    ) AS score_calitate,
    -- KPI 3: Punctualitate (0-100, doar cu orar)
    CASE 
      WHEN eo.has_orar = 1 AND p.zile_cu_orar > 0 THEN
        (p.zile_punctuale / p.zile_cu_orar) * 100
      ELSE 100
    END AS score_punctualitate,
    -- KPI 4: Uso de la aplicación (0-100, normalizat)
    COALESCE(ua.score_uso_app, 0) AS score_uso_app,
    -- Breakdown JSON
    JSON_OBJECT(
      'horas_pontate', COALESCE(hp.horas_pontate, 0),
      'target_ajustat', ta.target_ajustat,
      'target_initial', ta.target_initial,
      'horas_neutre', ta.horas_neutre,
      'dias_neutre', COALESCE(zn.dias_baja, 0) + COALESCE(zn.dias_vacaciones, 0) + COALESCE(zn.dias_fiesta, 0),
      'fichajes_incompleto', COALESCE(cp.fichajes_incompleto, 0),
      'regularizaciones_confirmed', COALESCE(cp.regularizaciones_confirmed, 0),
      'regularizaciones_pendiente', COALESCE(cp.regularizaciones_pendiente, 0),
      'zile_punctuale', COALESCE(p.zile_punctuale, 0),
      'zile_cu_orar', COALESCE(p.zile_cu_orar, 0),
      'has_orar', eo.has_orar,
      'acciones_totales', COALESCE(ua.acciones_totales, 0),
      'max_acciones_mes', COALESCE(mam.max_acciones, 0)
    ) AS breakdown_json
  FROM DatosEmpleados de
  JOIN empleado_orar eo ON eo.empleadoId = CAST(de.CODIGO AS CHAR)
  JOIN target_ajustat ta ON ta.empleadoId = CAST(de.CODIGO AS CHAR)
  LEFT JOIN horas_pontate hp ON hp.empleadoId = CAST(de.CODIGO AS CHAR)
  LEFT JOIN calitate_pontaj cp ON cp.empleadoId = CAST(de.CODIGO AS CHAR)
  LEFT JOIN zile_neutre zn ON zn.empleadoId = CAST(de.CODIGO AS CHAR)
  LEFT JOIN punctualitate p ON p.empleadoId = CAST(de.CODIGO AS CHAR)
  LEFT JOIN uso_app ua ON ua.empleadoId = CAST(de.CODIGO AS CHAR)
  CROSS JOIN max_acciones_mes mam
  WHERE de.ESTADO = 'ACTIVO'
)

-- SELECT FINAL - REPARAT: tie-breaker simplificat la egalitate
SELECT 
  empleadoId,
  empleadoNombre,
  grupo,
  ROUND(
    (score_indeplinire * 0.60) + 
    (score_calitate * 0.25) + 
    (score_punctualitate * 0.05) + 
    (score_uso_app * 0.10),
    2
  ) AS score_final,
  score_indeplinire,
  score_calitate,
  score_punctualitate,
  score_uso_app,
  breakdown_json
FROM scoring
WHERE score_final > 0
ORDER BY 
  score_final DESC,
  score_uso_app DESC;  -- Tie-breaker: la egalitate, ordonează după uso_app

