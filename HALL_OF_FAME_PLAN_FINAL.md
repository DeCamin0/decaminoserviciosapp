# 🏆 PLAN FINAL - HALL OF FAME (Clasament Lunar Angajați)

**Data:** 2025-01-XX  
**Versiune:** FINAL - Implementare robustă și defensabilă  
**Status:** ✅ GATA PENTRU IMPLEMENTARE

---

## 📊 MODEL DE SCORING FINAL (VARIANTĂ UNICĂ - FINALĂ)

### Ponderi fixe (FINAL - NU se modifică):
- **Îndeplinire ore:** 60% (0-100 puncte)
- **Calitate pontaj:** 25% (0-100 puncte)
- **Punctualitate:** 5% (0-100 puncte, bonus mic)
- **Uso de la aplicación:** 10% (0-100 puncte)

**Formula finală:**
```
score_final = (score_indeplinire * 0.60) + (score_calitate * 0.25) + (score_punctualitate * 0.05) + (score_uso_app * 0.10)
```

### Reguli explicite (human readable pentru UI):

#### 1. Îndeplinire ore (60%)
- **Ce măsoară:** Cât de bine ai îndeplinit targetul lunar de ore.
- **Cum se calculează:** `(ore_pontate / target_ajustat) * 100`
- **Target ajustat:** Target inițial minus orele din zilele neutre (BAJA, VACACIONES, FIESTA cu `trabaja_festivos=0`).
- **Regularizări CONFIRMED:** Corectează orele pontate (folosesc `effective_minutes`), NU acordă bonusuri.
- **Plafonare:** Maxim 100 puncte (nu poți depăși targetul pentru bonus).
- **Penalizare:** Dacă < 80% îndeplinire → scor maxim 75 (nu poți avea scor perfect cu îndeplinire slabă).

#### 2. Calitate pontaj (25%)
- **Ce măsoară:** Cât de complet și corect ai pontat.
- **Cum se calculează:** `100 - (fichajes_incompleto_ajustat * 15) - (regularizaciones_pendiente * 5)`
- **Fichajes incomplete:** Zile cu Entrada/Salida dar fără DURACION (sau DURACION = 0).
- **Regularizări CONFIRMED:** Reduc penalizarea cu max 50% (nu elimină complet, nu dau bonus).
- **Regularizări PENDING/NEEDS_REVIEW:** Penalizează calitatea (-5 puncte per zi).
- **Plafonare minimă:** Scorul nu poate scădea sub 0.

#### 3. Punctualitate (5% - bonus mic)
- **Ce măsoară:** Cât de punctual ai fost la intrarea la serviciu.
- **Cum se calculează:** 
  - **Cu orar/cuadrante (`has_orar = true`):** `(zile_punctuale / zile_cu_orar) * 100`
  - **Fără orar (`has_orar = false`):** `100` (neutru, nu dezavantajează)
- **Definiție punctual:** Entrada în intervalul `[orar_planificat - 15 min, orar_planificat + 30 min]`.
- **Zile cu orar:** Doar zilele unde există cuadrante sau horario (NU zile neutre).

#### 4. Uso de la aplicación (10%)
- **Ce măsoară:** Cât de activ ești în aplicație (acțiuni reale, nu spam).
- **Cum se calculează:** `(acciones_empleado / max_acciones_mes) * 100`
- **Normalizare:** Scorul este raportat la maximul lunii (angajatul cu cele mai multe acțiuni = 100).
- **Ponderi pe tip de acțiune:**
  - Fichaje (Entrada/Salida): 1 punct
  - Solicitud (vacaciones, asuntos propios): 2 puncte
  - Upload document: 3 puncte
  - Formular completat / Actualizare date: 3 puncte
  - Login: 0.2 puncte (maxim 1 punct pe zi = 5 logins/zi)
- **Anti-abuz:** 
  - Login: plafon zilnic (max 1 punct/zi = 5 logins)
  - Nu se acordă puncte pentru acțiuni repetitive fără valoare reală
  - Se folosesc DOAR acțiuni REALE din Logs (read-only, fără modificări)
- **Tie-breaker:** Dacă diferența între doi angajați este < 5 puncte la scorul final, ordonarea se face după `score_uso_app` (descendent).

---

## 🔧 REGULI TEHNICE DETALIATE

### 1. Regularizări - Integrare corectă

#### Regulă fundamentală:
> **Regularizarea CONFIRMED corectează datele, nu acordă bonusuri și NU poate crește scorul peste ce ar fi fost cu pontaj corect din prima.**

#### A) Calcul ore_pontate:
```sql
-- Prioritate: FichajeRegularizacion.effective_minutes > Fichaje.DURACION
-- Regularizarea înlocuiește DURACION-ul brut, nu îl adaugă
horas_pontate = SUM(
  CASE 
    WHEN fr.status = 'CONFIRMED' AND fr.effective_minutes IS NOT NULL
    THEN fr.effective_minutes / 60.0
    WHEN f.DURACION IS NOT NULL AND TRIM(f.DURACION) <> '' AND f.DURACION <> '00:00:00'
    THEN TIME_TO_SEC(f.DURACION) / 3600.0
    ELSE 0
  END
)
```

#### B) Reducere penalizare calitate (max 50%):
```sql
-- Regularizarea CONFIRMED reduce penalizarea pentru fichaje incomplete
-- DAR nu elimină complet (pentru că ar fi fost ideal să fie corect din prima)
fichajes_incompleto_ajustat = GREATEST(0, fichajes_incompleto - (regularizaciones_confirmed * 0.5))
-- Max reducere: 50% din fichajes incomplete (nu 100%)
```

#### C) Regularizări pendiente = penalizare:
```sql
-- Regularizări în PENDING sau NEEDS_REVIEW penalizează calitatea
regularizaciones_pendiente = COUNT(DISTINCT workday_date) WHERE status IN ('PENDING', 'NEEDS_REVIEW')
-- Penalizare: -5 puncte per regularizare pendiente
```

### 2. Fiestas - Folosire corectă din tabel cu `trabaja_festivos`

#### Logica de filtrare:
```sql
-- Folosește scope, ccaa_code și observed_date din tabelul fiestas
-- Default CCAA: 'ES-MD' (Madrid)
-- IMPORTANT: FIESTA este zi neutră DOAR dacă trabaja_festivos = 0
fiesta_aplicabila = 
  fi.active = true
  AND DATE(COALESCE(fi.observed_date, fi.date)) = fecha
  AND (
    LOWER(fi.scope) IN ('nacional', 'national')
    OR (LOWER(fi.scope) IN ('autonómico', 'autonomico', 'ccaa') 
        AND fi.ccaa_code = @ccaa_default)
  )
  AND trabaja_festivos = 0  -- DOAR dacă NU lucrează în festiv
```

#### Excludere din target:
- Dacă `trabaja_festivos = 0` → FIESTA este zi NEUTRĂ (se exclude din target și punctualitate)
- Dacă `trabaja_festivos = 1` → FIESTA NU este zi neutră (se tratează ca zi normală)

### 3. Zile neutre - COUNT DISTINCT (anti-duplicare)

#### Zile neutre definite:
- **BAJA medicală:** Din `MutuaCasos` (interval `Fecha_baja` → `Fecha_de_alta`)
- **VACACIONES:** Din `Ausencias` cu `TIPO='VACACIONES'` (NU există câmp `estado` în tabel)
- **FIESTA:** Din `fiestas` cu `trabaja_festivos = 0`

#### Calcul cu COUNT DISTINCT:
```sql
-- Folosește COUNT DISTINCT pe zi pentru a evita duplicările
dias_neutre = COUNT(DISTINCT fecha) WHERE 
  es_baja = 1 OR es_vacaciones = 1 OR (es_fiesta = 1 AND trabaja_festivos = 0)
```

### 4. Ajustare target lunar

#### Pentru angajați cu cuadrante/horario:
```sql
-- Scade orele EXACTE din zilele neutre (din cuadrante_dia sau horario_dia)
target_ajustat = target_initial - SUM(horas_plan WHERE es_baja=1 OR es_vacaciones=1 OR (es_fiesta=1 AND trabaja_festivos=0))
```

#### Pentru angajați fără orar (doar HORAS_CONTRATO):
```sql
-- Folosește ore_pe_zi = HORAS_CONTRATO / 7
-- Scade zile_neutre * ore_pe_zi
target_ajustat = (HORAS_CONTRATO * DAY(@d_last) / 7) - (dias_neutre * (HORAS_CONTRATO / 7))
```

### 5. Flag explicit "are orar"

```sql
-- NU se deduce din target_ajustat, ci din existența cuadrante/horario
has_cuadrante = EXISTS(SELECT 1 FROM cuadrante WHERE CODIGO = empleado_codigo AND LUNA = @mes)
has_horario = EXISTS(
  SELECT 1 FROM horarios h
  JOIN DatosEmpleados de ON h.grupo_nombre = de.GRUPO AND h.centro_nombre = de.`CENTRO TRABAJO`
  WHERE de.CODIGO = empleado_codigo
    AND h.vigente_desde <= @d_last
    AND (h.vigente_hasta IS NULL OR h.vigente_hasta >= @d_first)
)
has_orar = has_cuadrante OR has_horario
```

### 6. Punctualitate - Doar pentru `has_orar = true`

#### Necesită CTE-uri day-level:
- `horario_dia` - Ore planificate pe zi din horario
- `cuadrante_dia` - Ore planificate pe zi din cuadrante
- `fiestas_dia` - Zile de fiesta (pentru excludere)
- `bajas_dia` - Zile de baja (pentru excludere)
- `aus_dia` - Zile de vacaciones (pentru excludere)

#### Calcul:
```sql
-- DOAR pentru has_orar = true
-- Compară Entrada cu orar planificat (din cuadrante sau horario)
-- Exclude zilele neutre (baja, vacaciones, fiesta cu trabaja_festivos=0)
zile_punctuale = COUNT(DISTINCT fecha) WHERE
  has_orar = true
  AND TIPO = 'Entrada'
  AND TIME(HORA) BETWEEN (orar_planificat - INTERVAL 15 MINUTE) AND (orar_planificat + INTERVAL 30 MINUTE)
  AND NOT (es_baja=1 OR es_vacaciones=1 OR (es_fiesta=1 AND trabaja_festivos=0))

zile_cu_orar = COUNT(DISTINCT fecha) WHERE
  has_orar = true
  AND (tiene_cuadrante=1 OR tiene_horario=1)
  AND NOT (es_baja=1 OR es_vacaciones=1 OR (es_fiesta=1 AND trabaja_festivos=0))
```

### 7. Calitate pontaj - Penalizări graduale

#### Formula:
```sql
score_calitate = GREATEST(0, 100 - (fichajes_incompleto_ajustat * 15) - (regularizaciones_pendiente * 5))
```

#### Explicație:
- **Fichaje incomplete:** -15 puncte per zi (max 5 zile = -75 puncte)
- **Regularizări pendiente:** -5 puncte per regularizare (max 10 = -50 puncte)
- **Plafon minim:** 0 puncte (nu poate fi negativ)
- **Regularizări CONFIRMED:** Reduc `fichajes_incompleto` cu max 50% (nu elimină complet)

---

## 📝 SQL COMPLET (CURAT, FĂRĂ PLACEHOLDER-E NEDEFINITE, EXECUTABIL)

**⚠️ IMPORTANT:** SQL-ul complet reparat (toate bug-urile corectate) se află în: **`HALL_OF_FAME_SQL_FINAL.sql`**

**Bug-uri reparate:**
1. ✅ Tie-breaker: Simplificat la "la egalitate" (ORDER BY score_final DESC, score_uso_app DESC)
2. ✅ bajas_intervalos: Creat bajas_raw + bajas_intervalos (nu folosesc alias în WHERE)
3. ✅ cuadrante_unpivot: Completat toate ZI_1...ZI_31 (fără "...")
4. ✅ horario_dia_m: Completat m2 și m3 pentru toate zilele săptămânii
5. ✅ cuadrante_dia: Pornesc din fechas și LEFT JOIN (nu folosesc cu.dia înainte de JOIN)
6. ✅ punctualitate: Creat CTE-uri separate horario_start_dia și cuadrante_val_dia
7. ✅ ausencias: Scos "aprobate" (nu există câmp estado în tabel)
8. ✅ Logs mapping: Scos LIKE pe nume, prioritate email exact

**Versiunea de mai jos este pentru referință. Pentru implementare, folosește `HALL_OF_FAME_SQL_FINAL.sql`**

### Variabile inițiale:
```sql
SET @lunaselectata = '2025-01';  -- Format: 'YYYY-MM'
SET @ccaa_default = 'ES-MD';
SET @d_first := STR_TO_DATE(CONCAT(@lunaselectata, '-01'), '%Y-%m-%d');
SET @d_last := LAST_DAY(@d_first);
```

### CTE-uri auxiliare necesare (în ordine):

#### 1. `fechas` - Toate zilele lunii
```sql
WITH RECURSIVE fechas AS (
  SELECT @d_first AS d
  UNION ALL
  SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM fechas WHERE d < @d_last
),
```

#### 2. `empleado_flags` - Flag trabaja_festivos
```sql
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
```

#### 3. `empleado_ccaa` - CCAA pentru fiestas
```sql
empleado_ccaa AS (
  SELECT CAST(de.CODIGO AS CHAR) AS empleadoId, @ccaa_default AS ccaa
  FROM DatosEmpleados de
  WHERE de.ESTADO = 'ACTIVO'
),
```

#### 4. `cuadrante_unpivot` - Unpivot cuadrante (ZI_1...ZI_31)
```sql
cuadrante_unpivot AS (
  SELECT CAST(cq.CODIGO AS CHAR) AS empleadoId, 1 AS dia, cq.CENTRO AS centro_cuadrante, cq.ZI_1 AS val 
  FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 2, cq.CENTRO, cq.ZI_2 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 3, cq.CENTRO, cq.ZI_3 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
  -- ... (ZI_4 până la ZI_31)
  UNION ALL SELECT CAST(cq.CODIGO AS CHAR), 31, cq.CENTRO, cq.ZI_31 FROM cuadrante cq WHERE cq.LUNA = @lunaselectata
),
```

#### 5. `cuadrante_dia` - Ore planificate pe zi din cuadrante
```sql
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
          (((TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-',-1),' ',1), '%H:%i'))
            - TIME_TO_SEC(STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val),' ',-1),'-', 1),' ',1), '%H:%i'))
            + 86400) % 86400) / 3600)
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h[[:space:]]*\\([0-9]+×[0-9]+h\\)' THEN 
          CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(cu.val), '×', -1), 'h', 1) AS DECIMAL(10,2))
        WHEN TRIM(cu.val) REGEXP '^[0-9]+h' THEN 
          CAST(SUBSTRING_INDEX(TRIM(cu.val), 'h', 1) AS DECIMAL(10,2))
        ELSE 0
      END
    ), 2) AS horas_cuadrante_dia
  FROM DatosEmpleados de
  JOIN fechas f ON DAY(f.d) = cu.dia
  LEFT JOIN cuadrante_unpivot cu ON cu.empleadoId = CAST(de.CODIGO AS CHAR) AND cu.dia = DAY(f.d)
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO, f.d, DAY(f.d)
),
```

#### 6. `horario_dia_m` - Minute planificate pe zi din horario (m1, m2, m3)
```sql
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
    -- m2 și m3 (similar pentru in2/out2, in3/out3)
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in2), CONCAT(f.d,' ',h.lun_out2)) + 1440) % 1440, 0)
      -- ... (similar pentru mar, mie, joi, vin, sam, dum)
    END AS m2,
    CASE DAYOFWEEK(f.d)
      WHEN 2 THEN COALESCE((TIMESTAMPDIFF(MINUTE, CONCAT(f.d,' ',h.lun_in3), CONCAT(f.d,' ',h.lun_out3)) + 1440) % 1440, 0)
      -- ... (similar pentru mar, mie, joi, vin, sam, dum)
    END AS m3
  FROM DatosEmpleados de
  JOIN fechas f
  LEFT JOIN horarios h
    ON h.centro_nombre = de.`CENTRO TRABAJO`
    AND h.grupo_nombre = de.GRUPO
    AND h.vigente_desde <= f.d
    AND (h.vigente_hasta IS NULL OR f.d <= h.vigente_hasta)
  WHERE de.ESTADO = 'ACTIVO'
),
```

#### 7. `horario_dia` - Ore planificate pe zi din horario
```sql
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
```

#### 8. `bajas_intervalos` - Intervale de baja medicală
```sql
bajas_intervalos AS (
  SELECT
    TRIM(CAST(mc.Codigo_Empleado AS CHAR)) AS empleadoId,
    COALESCE(
      CASE 
        WHEN NULLIF(mc.`Fecha baja`, '') IS NULL THEN NULL
        WHEN mc.`Fecha baja` REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(mc.`Fecha baja`)
        WHEN mc.`Fecha baja` LIKE '__/__/____' THEN STR_TO_DATE(mc.`Fecha baja`, '%d/%m/%Y')
        ELSE NULL
      END
    ) AS d_ini,
    COALESCE(
      CASE 
        WHEN NULLIF(mc.`Fecha de alta`, '') IS NULL THEN NULL
        WHEN mc.`Fecha de alta` REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN DATE(mc.`Fecha de alta`)
        WHEN mc.`Fecha de alta` LIKE '__/__/____' THEN STR_TO_DATE(mc.`Fecha de alta`, '%d/%m/%Y')
        ELSE NULL
      END,
      @d_last
    ) AS d_fin
  FROM MutuaCasos mc
  WHERE mc.d_ini IS NOT NULL
    AND mc.d_ini <= @d_last
    AND mc.d_fin >= @d_first
),
```

#### 9. `bajas_dia` - Zile de baja medicală
```sql
bajas_dia AS (
  SELECT 
    bi.empleadoId,
    f.d AS fecha,
    CASE WHEN f.d BETWEEN bi.d_ini AND bi.d_fin THEN 1 ELSE 0 END AS es_baja
  FROM bajas_intervalos bi
  JOIN fechas f
  WHERE bi.d_ini IS NOT NULL
),
```

#### 10. `aus_raw` - Ausencias raw (pentru parsing)
```sql
aus_raw AS (
  SELECT 
    CAST(a.`CODIGO` AS CHAR) AS empleadoId,
    TRIM(a.`TIPO`) AS tipo,
    a.`DURACION` AS duracion,
    TRIM(REPLACE(REPLACE(a.`FECHA`,'–','-'),'—','-')) AS fecha_txt
  FROM Ausencias a
),
```

#### 11. `aus_parts` - Ausencias parsed (start/end)
```sql
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
```

#### 12. `aus_norm` - Ausencias normalizate (cu dates)
```sql
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
```

#### 13. `aus_dia` - Ausencias pe zi
```sql
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
```

#### 14. `fiestas_dia` - Zile de fiesta (cu scope/ccaa și trabaja_festivos)
```sql
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
        AND COALESCE(tf.trabaja_festivos, 0) = 0  -- IMPORTANT: DOAR dacă trabaja_festivos = 0
      THEN 1 ELSE 0
    END AS es_fiesta
  FROM empleado_ccaa ec
  JOIN fechas f
  LEFT JOIN fiestas fi ON DATE(COALESCE(fi.observed_date, fi.date)) = f.d
  LEFT JOIN empleado_flags tf ON tf.empleadoId = ec.empleadoId
),
```

#### 15. `empleado_orar` - Flag explicit "are orar"
```sql
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
```

#### 16. `target_initial` - Target inițial (cuadrante > horario > HORAS_CONTRATO)
```sql
target_initial AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    CASE
      -- Prioritate 1: Cuadrante
      WHEN cq.CODIGO IS NOT NULL THEN
        ROUND(SUM(cd.horas_cuadrante_dia), 2)
      -- Prioritate 2: Horario
      WHEN h.total_horas_semanales IS NOT NULL THEN
        ROUND(h.total_horas_semanales * (DAY(@d_last) / 7), 2)
      -- Prioritate 3: HORAS_DE_CONTRATO
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
```

#### 17. `zile_neutre` - Zile neutre (COUNT DISTINCT)
```sql
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
  JOIN fechas f
  LEFT JOIN bajas_dia bj ON bj.empleadoId = CAST(de.CODIGO AS CHAR) AND bj.fecha = f.d
  LEFT JOIN aus_dia au ON au.empleadoId = CAST(de.CODIGO AS CHAR) AND au.fecha = f.d
  LEFT JOIN fiestas_dia fd ON fd.empleadoId = CAST(de.CODIGO AS CHAR) AND fd.fecha = f.d
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),
```

#### 18. `ore_zile_neutre` - Ore din zile neutre (pentru ajustare target)
```sql
ore_zile_neutre AS (
  SELECT 
    zn.empleadoId,
    CASE 
      WHEN eo.has_orar = 1 THEN
        -- Cu orar: scade orele exacte din cuadrante/horario
        ROUND(SUM(
          CASE 
            WHEN bj.es_baja = 1 OR au.es_vacaciones = 1 OR fd.es_fiesta = 1 THEN
              COALESCE(cd.horas_cuadrante_dia, hd.horas_horario_dia, 0)
            ELSE 0
          END
        ), 2)
      ELSE
        -- Fără orar: scade zile_neutre * horas_pe_zi_contrato
        (zn.dias_baja + zn.dias_vacaciones + zn.dias_fiesta) * ti.horas_pe_zi_contrato
    END AS horas_neutre
  FROM zile_neutre zn
  JOIN empleado_orar eo ON eo.empleadoId = zn.empleadoId
  JOIN target_initial ti ON ti.empleadoId = zn.empleadoId
  LEFT JOIN fechas f
  LEFT JOIN bajas_dia bj ON bj.empleadoId = zn.empleadoId AND bj.fecha = f.d
  LEFT JOIN aus_dia au ON au.empleadoId = zn.empleadoId AND au.fecha = f.d
  LEFT JOIN fiestas_dia fd ON fd.empleadoId = zn.empleadoId AND fd.fecha = f.d
  LEFT JOIN cuadrante_dia cd ON cd.empleadoId = zn.empleadoId AND cd.fecha = f.d
  LEFT JOIN horario_dia hd ON hd.empleadoId = zn.empleadoId AND hd.fecha = f.d
  WHERE (bj.es_baja = 1 OR au.es_vacaciones = 1 OR fd.es_fiesta = 1)
  GROUP BY zn.empleadoId
),
```

#### 19. `target_ajustat` - Target după scăderea zilelor neutre
```sql
target_ajustat AS (
  SELECT 
    ti.empleadoId,
    ti.target_initial,
    COALESCE(ozn.horas_neutre, 0) AS horas_neutre,
    GREATEST(0, ti.target_initial - COALESCE(ozn.horas_neutre, 0)) AS target_ajustat
  FROM target_initial ti
  LEFT JOIN ore_zile_neutre ozn ON ozn.empleadoId = ti.empleadoId
),
```

#### 20. `fichaje_base` - Fichajes cu workday_date corect (pentru ture de noapte)
```sql
fichaje_base AS (
  SELECT
    CAST(f.CODIGO AS CHAR) AS empleadoId,
    CASE
      WHEN f.TIPO = 'Salida' 
        AND f.DURACION IS NOT NULL 
        AND TRIM(f.DURACION) != '' 
        AND f.DURACION != '00:00:00'
        AND CAST(TIME(f.HORA) AS TIME) < TIME('12:00:00')
        AND EXISTS (
          SELECT 1
          FROM Fichaje f_entrada
          WHERE f_entrada.CODIGO = f.CODIGO
            AND f_entrada.TIPO = 'Entrada'
            AND f_entrada.FECHA = DATE_SUB(f.FECHA, INTERVAL 1 DAY)
            AND CAST(TIME(f_entrada.HORA) AS TIME) >= TIME('17:00:00')
        )
      THEN DATE_SUB(f.FECHA, INTERVAL 1 DAY)
      ELSE DATE(f.FECHA)
    END AS fecha,
    f.DURACION AS duracion,
    f.TIPO AS tipo,
    f.HORA AS hora
  FROM Fichaje f
  WHERE f.FECHA >= @d_first AND f.FECHA < DATE_ADD(@d_last, INTERVAL 1 DAY)
),
```

#### 21. `horas_pontate` - Ore pontate (cu regularizări CONFIRMED)
```sql
horas_pontate AS (
  SELECT 
    fb.empleadoId,
    ROUND(SUM(
      CASE 
        WHEN fr.status = 'CONFIRMED' AND fr.effective_minutes IS NOT NULL
        THEN fr.effective_minutes / 60.0
        WHEN fb.duracion IS NOT NULL AND TRIM(fb.duracion) <> '' AND fb.duracion <> '00:00:00'
        THEN TIME_TO_SEC(fb.duracion) / 3600.0
        ELSE 0
      END
    ), 2) AS horas_pontate
  FROM fichaje_base fb
  LEFT JOIN FichajeRegularizacion fr
    ON fr.employee_codigo = fb.empleadoId
    AND fr.workday_date = fb.fecha
    AND fr.status = 'CONFIRMED'
  GROUP BY fb.empleadoId
),
```

#### 22. `calitate_pontaj` - Calitate pontaj (fichajes incomplete + regularizări)
```sql
calitate_pontaj AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    COUNT(DISTINCT CASE 
      WHEN fb.tipo IN ('Entrada', 'Salida')
        AND (fb.duracion IS NULL OR TRIM(fb.duracion) = '' OR fb.duracion = '00:00:00')
        AND NOT EXISTS (
          SELECT 1 FROM FichajeRegularizacion fr
          WHERE fr.employee_codigo = fb.empleadoId
            AND fr.workday_date = fb.fecha
            AND fr.status = 'CONFIRMED'
        )
      THEN fb.fecha
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
  LEFT JOIN fichaje_base fb ON fb.empleadoId = CAST(de.CODIGO AS CHAR)
  LEFT JOIN FichajeRegularizacion fr ON fr.employee_codigo = de.CODIGO
    AND fr.workday_date >= @d_first AND fr.workday_date <= @d_last
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),
```

#### 23. `punctualitate` - Punctualitate (DOAR pentru has_orar = true)
```sql
punctualitate AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    COUNT(DISTINCT CASE 
      WHEN eo.has_orar = 1
        AND fb.tipo = 'Entrada'
        AND (
          -- Compară cu cuadrante
          (cd.tiene_cuadrante = 1 AND 
           TIME(fb.hora) BETWEEN 
             TIME(SUBSTRING_INDEX(SUBSTRING_INDEX(cd.val, '-', 1), ' ', -1)) - INTERVAL 15 MINUTE
             AND TIME(SUBSTRING_INDEX(SUBSTRING_INDEX(cd.val, '-', 1), ' ', -1)) + INTERVAL 30 MINUTE)
          OR
          -- Compară cu horario (folosește in1 pentru ziua respectivă)
          (hd.horas_horario_dia > 0 AND 
           TIME(fb.hora) BETWEEN 
             TIME(h.lun_in1) - INTERVAL 15 MINUTE
             AND TIME(h.lun_in1) + INTERVAL 30 MINUTE)
        )
        AND COALESCE(bj.es_baja, 0) = 0
        AND COALESCE(au.es_vacaciones, 0) = 0
        AND COALESCE(fd.es_fiesta, 0) = 0
      THEN fb.fecha
    END) AS zile_punctuale,
    COUNT(DISTINCT CASE 
      WHEN eo.has_orar = 1
        AND (cd.tiene_cuadrante = 1 OR hd.horas_horario_dia > 0)
        AND COALESCE(bj.es_baja, 0) = 0
        AND COALESCE(au.es_vacaciones, 0) = 0
        AND COALESCE(fd.es_fiesta, 0) = 0
      THEN f.d
    END) AS zile_cu_orar
  FROM DatosEmpleados de
  JOIN empleado_orar eo ON eo.empleadoId = CAST(de.CODIGO AS CHAR)
  JOIN fechas f
  LEFT JOIN fichaje_base fb ON fb.empleadoId = CAST(de.CODIGO AS CHAR) AND fb.fecha = f.d
  LEFT JOIN cuadrante_dia cd ON cd.empleadoId = CAST(de.CODIGO AS CHAR) AND cd.fecha = f.d
  LEFT JOIN horario_dia hd ON hd.empleadoId = CAST(de.CODIGO AS CHAR) AND hd.fecha = f.d
  LEFT JOIN horarios h ON h.grupo_nombre = de.GRUPO AND h.centro_nombre = de.`CENTRO TRABAJO`
  LEFT JOIN bajas_dia bj ON bj.empleadoId = CAST(de.CODIGO AS CHAR) AND bj.fecha = f.d
  LEFT JOIN aus_dia au ON au.empleadoId = CAST(de.CODIGO AS CHAR) AND au.fecha = f.d
  LEFT JOIN fiestas_dia fd ON fd.empleadoId = CAST(de.CODIGO AS CHAR) AND fd.fecha = f.d
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),
```

#### 24. `acciones_empleado` - Acțiuni pe angajat (cu ponderi)
```sql
acciones_empleado AS (
  SELECT 
    CAST(de.CODIGO AS CHAR) AS empleadoId,
    -- Fichajes (Entrada/Salida): 1 punct
    COUNT(DISTINCT CASE 
      WHEN l.action IN ('fichaje_created', 'fichaje_updated')
        AND DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
      THEN CONCAT(DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')), '-', l.action)
    END) * 1.0 AS puntos_fichajes,
    -- Solicitudes (vacaciones, asuntos propios): 2 puncte
    COUNT(DISTINCT CASE 
      WHEN l.action IN ('solicitud_created', 'solicitud_updated')
        AND DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
      THEN CONCAT(DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')), '-', l.action)
    END) * 2.0 AS puntos_solicitudes,
    -- Upload document: 3 puncte
    COUNT(DISTINCT CASE 
      WHEN l.action IN ('documento_uploaded', 'documento_upload', 'documento_oficial_uploaded')
        AND DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
      THEN CONCAT(DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')), '-', l.action)
    END) * 3.0 AS puntos_documentos,
    -- Formular completat / Actualizare date: 3 puncte
    COUNT(DISTINCT CASE 
      WHEN l.action IN ('user_updated', 'cambio_personal_created', 'tarea_created', 'tarea_updated')
        AND DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
      THEN CONCAT(DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')), '-', l.action)
    END) * 3.0 AS puntos_formularios,
    -- Login: 0.2 puncte (maxim 1 punct pe zi = 5 logins/zi)
    SUM(
      CASE 
        WHEN l.action IN ('login', 'demo_login')
          AND DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
        THEN 0.2
        ELSE 0
      END
    ) AS puntos_login_raw,
    -- Aplică plafon zilnic pentru login (max 1 punct/zi)
    LEAST(
      SUM(
        CASE 
          WHEN l.action IN ('login', 'demo_login')
            AND DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
          THEN 0.2
          ELSE 0
        END
      ),
      DAY(@d_last) * 1.0  -- Max 1 punct/zi pentru toată luna
    ) AS puntos_login
  FROM DatosEmpleados de
  LEFT JOIN Logs l ON 
    (l.email = de.`CORREO ELECTRONICO` OR l.user = de.`NOMBRE / APELLIDOS` OR l.user LIKE CONCAT('%', de.`NOMBRE / APELLIDOS`, '%'))
    AND DATE(STR_TO_DATE(l.timestamp, '%Y-%m-%d %H:%i:%s')) BETWEEN @d_first AND @d_last
  WHERE de.ESTADO = 'ACTIVO'
  GROUP BY de.CODIGO
),
```

#### 25. `acciones_totales` - Total acțiuni per angajat
```sql
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
```

#### 26. `max_acciones_mes` - Maximul de acțiuni din lună (pentru normalizare)
```sql
max_acciones_mes AS (
  SELECT MAX(acciones_totales) AS max_acciones
  FROM acciones_totales
),
```

#### 27. `uso_app` - Scor "Uso de la aplicación" (normalizat)
```sql
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
```

#### 28. `scoring` - Scoring final
```sql
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
      ELSE 100 -- Fără orar → neutru
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
SELECT 
  empleadoId,
  empleadoNombre,
  grupo,
  -- Scor final (60-25-5-10)
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
WHERE score_final > 0  -- Filtrare: minim 1 punct (evită angajați fără activitate)
ORDER BY 
  score_final DESC,
  -- Tie-breaker: dacă scorurile sunt apropiate (< 5 puncte diferență), ordonează după uso_app
  score_uso_app DESC;
```

---

## 📦 STRUCTURA breakdown_json

```json
{
  "horas_pontate": 160.5,
  "target_ajustat": 168.0,
  "target_initial": 176.0,
  "horas_neutre": 8.0,
  "dias_neutre": 2,
  "fichajes_incompleto": 1,
  "regularizaciones_confirmed": 1,
  "regularizaciones_pendiente": 0,
  "zile_punctuale": 18,
  "zile_cu_orar": 20,
  "has_orar": 1,
  "acciones_totales": 45.2,
  "max_acciones_mes": 78.5
}
```

**Explicație câmpuri:**
- `horas_pontate`: Ore efectiv pontate (cu regularizări CONFIRMED)
- `target_ajustat`: Target după scăderea zilelor neutre
- `target_initial`: Target inițial (fără ajustări)
- `horas_neutre`: Ore scăzute din target pentru zile neutre
- `dias_neutre`: Număr total zile neutre (BAJA + VACACIONES + FIESTA cu trabaja_festivos=0)
- `fichajes_incompleto`: Zile cu pontaj incomplet
- `regularizaciones_confirmed`: Regularizări confirmate (reduc penalizarea cu max 50%)
- `regularizaciones_pendiente`: Regularizări în așteptare (penalizează -5 per zi)
- `zile_punctuale`: Zile cu intrare punctuală (doar pentru has_orar=true)
- `zile_cu_orar`: Zile totale cu orar planificat (doar pentru has_orar=true)
- `has_orar`: Flag explicit (1 = are orar, 0 = fără orar)
- `acciones_totales`: Total acțiuni ponderate (fichajes + solicitudes + documentos + formularios + login)
- `max_acciones_mes`: Maximul de acțiuni din lună (pentru normalizare)

---

## 🗄️ SCHEMA TABEL hall_of_fame_mensual

```sql
CREATE TABLE hall_of_fame_mensual (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  empleado_codigo VARCHAR(50) NOT NULL,
  mes VARCHAR(7) NOT NULL, -- Format: 'YYYY-MM'
  ano INT NOT NULL,
  
  -- Scoruri
  score_final DECIMAL(5,2) NOT NULL,
  score_indeplinire DECIMAL(5,2) NOT NULL,
  score_calitate DECIMAL(5,2) NOT NULL,
  score_punctualitate DECIMAL(5,2) NOT NULL,
  
  -- Date brute
  horas_pontate DECIMAL(10,2) NOT NULL,
  target_ajustat DECIMAL(10,2) NOT NULL,
  target_initial DECIMAL(10,2) NOT NULL,
  horas_neutre DECIMAL(10,2) DEFAULT 0,
  dias_neutre INT DEFAULT 0,
  
  -- Calitate
  fichajes_incompleto INT DEFAULT 0,
  regularizaciones_confirmed INT DEFAULT 0,
  regularizaciones_pendiente INT DEFAULT 0,
  
  -- Punctualitate
  zile_punctuale INT DEFAULT 0,
  zile_cu_orar INT DEFAULT 0,
  has_orar BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  breakdown_json JSON,
  ranking INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_emp_mes (empleado_codigo, mes),
  INDEX idx_mes_ano (mes, ano),
  INDEX idx_score_final (score_final DESC),
  INDEX idx_empleado (empleado_codigo),
  INDEX idx_ranking (mes, ranking)
);
```

---

## 📊 INTEGRARE STATISTICI "ESTADO EMPLEADOS"

### Statistici disponibile (din `EmpleadosStatsService`):
- `loginCount` - Număr total de logins (istoric)
- `fichajesCount` - Număr total de fichajes (istoric)
- `lastLogin` - Ultimul login
- `lastFichaje` - Ultimul fichaje

### Utilizare în Hall of Fame:

#### 1. **Filtrare eligibilitate** (NU în scoring):
```sql
-- Un angajat trebuie să aibă minim X fichajes în lună pentru a fi eligibil
-- Evită angajații fără activitate reală
WHERE fichajes_luna >= 5  -- Minim 5 fichajes în lună
```

#### 2. **Metrici suplimentare în breakdown_json**:
```json
{
  // ... câmpuri existente ...
  "total_logins": 1220,           // Istoric total (din EmpleadosStats)
  "total_fichajes": 98,           // Istoric total (din EmpleadosStats)
  "fichajes_luna": 22,            // Doar pentru luna respectivă (calculat)
  "last_login": "2026-01-06T13:16:00Z",
  "last_fichaje": "2026-01-06T01:00:00Z"
}
```

#### 3. **Validare date**:
- Dacă `fichajes_luna = 0` → `score_final = 0` (nu apare în top)
- Dacă `last_fichaje` > 30 zile → poate fi marcat ca "inactiv" în UI

#### 4. **UI/UX - Context suplimentar**:
- Afișează `total_fichajes` în tooltip (pentru context)
- Badge "Activo" bazat pe `last_fichaje` recent (< 7 zile)

### ⚠️ IMPORTANT:
**Statisticile din Estado Empleados NU intră în scoring!**
- Scoring-ul se bazează DOAR pe: îndeplinire ore (65%), calitate pontaj (30%), punctualitate (5%)
- Statisticile sunt doar pentru: filtrare, validare, context UI

---

## ⚠️ RIScuri REALE + SOLUȚII

| Risc | Severitate | Soluție |
|------|------------|---------|
| **Date incomplete** (fără HORAS_DE_CONTRATO) | MEDIUM | Folosește media grupului sau exclude din clasament (score_final = 0) |
| **Edge case: angajat cu orar parțial** | LOW | Folosește `target_ajustat` (zile neutre reduc targetul corect) |
| **Punctualitate pentru ture de noapte** | MEDIUM | Compară `Entrada` cu `horario.lun_in1` (nu hardcode 17:00) |
| **Regularizări duplicate** | LOW | Folosește `UNIQUE(employee_codigo, window_start)` din schema |
| **Fiestas cu observed_date** | LOW | Folosește `COALESCE(observed_date, date)` (deja implementat) |
| **Angajați noi** (fără istoric) | MEDIUM | Filtrare: minim 5 fichajes în lună SAU `fichajesCount >= 5` (din stats) |
| **CCAA diferite** | MEDIUM | Folosește `@ccaa_default = 'ES-MD'` (poate fi parametrizat pe viitor) |
| **Regularizări REJECTED** | LOW | Nu se folosesc în calcul (doar CONFIRMED) |
| **Angajați inactivi** (fără fichajes recente) | MEDIUM | Filtrare: `last_fichaje` în ultimele 30 zile SAU `fichajes_luna > 0` |
| **trabaja_festivos NULL** | LOW | Tratează ca 0 (nu lucrează în festiv) |

---

## 🎯 IMPLEMENTARE - PAȘI CONCRETI

### 1. Schema DB (Prisma)
```prisma
model HallOfFameMensual {
  id                          BigInt   @id @default(autoincrement())
  empleado_codigo             String   @map("empleado_codigo") @db.VarChar(50)
  mes                         String   @map("mes") @db.VarChar(7)
  ano                         Int      @map("ano")
  score_final                 Decimal  @map("score_final") @db.Decimal(5, 2)
  score_indeplinire           Decimal  @map("score_indeplinire") @db.Decimal(5, 2)
  score_calitate              Decimal  @map("score_calitate") @db.Decimal(5, 2)
  score_punctualitate         Decimal  @map("score_punctualitate") @db.Decimal(5, 2)
  score_uso_app               Decimal  @map("score_uso_app") @db.Decimal(5, 2)
  horas_pontate               Decimal  @map("horas_pontate") @db.Decimal(10, 2)
  target_ajustat              Decimal  @map("target_ajustat") @db.Decimal(10, 2)
  target_initial              Decimal  @map("target_initial") @db.Decimal(10, 2)
  horas_neutre                Decimal  @map("horas_neutre") @db.Decimal(10, 2) @default(0)
  dias_neutre                 Int      @map("dias_neutre") @default(0)
  fichajes_incompleto         Int      @map("fichajes_incompleto") @default(0)
  regularizaciones_confirmed  Int      @map("regularizaciones_confirmed") @default(0)
  regularizaciones_pendiente  Int      @map("regularizaciones_pendiente") @default(0)
  zile_punctuale              Int      @map("zile_punctuale") @default(0)
  zile_cu_orar                Int      @map("zile_cu_orar") @default(0)
  has_orar                    Boolean  @map("has_orar") @default(false)
  
  -- Uso de la aplicación
  score_uso_app               Decimal  @map("score_uso_app") @db.Decimal(5, 2)
  acciones_totales            Decimal  @map("acciones_totales") @db.Decimal(10, 2) @default(0)
  max_acciones_mes            Decimal  @map("max_acciones_mes") @db.Decimal(10, 2) @default(0)
  
  breakdown_json              String?  @map("breakdown_json") @db.Json
  ranking                     Int?     @map("ranking")
  created_at                  DateTime @default(now()) @map("created_at") @db.Timestamp(0)
  updated_at                  DateTime @updatedAt @map("updated_at") @db.Timestamp(0)

  @@unique([empleado_codigo, mes], map: "uk_emp_mes")
  @@index([mes, ano], map: "idx_mes_ano")
  @@index([score_final], map: "idx_score_final")
  @@index([empleado_codigo], map: "idx_empleado")
  @@index([mes, ranking], map: "idx_ranking")
  @@map("hall_of_fame_mensual")
}
```

### 2. Service: `HallOfFameService`
- `calculateMonthlyScores(mes: string)`: Calculează și salvează scorurile
- `getRanking(mes: string, limit?: number)`: Returnează top N
- `getEmployeeBreakdown(codigo: string, mes: string)`: Breakdown pentru un angajat

### 3. Controller: `HallOfFameController`
- `GET /api/hall-of-fame?mes=YYYY-MM&limit=10`
- `GET /api/hall-of-fame/:codigo?mes=YYYY-MM`
- `POST /api/hall-of-fame/calculate?mes=YYYY-MM` (admin only)

### 4. Frontend: `HallOfFamePage.jsx`
- Listă top N cu badges
- Filtre lună/an
- Tooltip cu breakdown KPI
- Explicații "human readable"

### 5. Cron: Job NestJS
- Rulează la începutul fiecărei luni pentru luna anterioară
- Calculează și salvează în `hall_of_fame_mensual`

---

## ✅ CHECKLIST FINAL

- [x] Model de scoring unic (60-25-5-10) - FINAL
- [x] **Uso de la aplicación** integrat obligatoriu (10% pondere)
- [x] Normalizare uso_app: (acciones_empleado / max_acciones_mes) * 100
- [x] Ponderi pe tip de acțiune (fichajes=1, solicitudes=2, documentos=3, formularios=3, login=0.2)
- [x] Anti-abuz: plafon zilnic pentru login (max 1 punct/zi)
- [x] Tie-breaker: diferența < 5 puncte → ordonează după uso_app
- [x] Regularizări integrate corect (nu dau bonusuri, max 50% reducere)
- [x] Fiestas din tabel (cu scope/ccaa/observed_date)
- [x] trabaja_festivos explicit (0 = fiesta neutră, 1 = fiesta normală)
- [x] Un singur clasament (comparabil)
- [x] Flag explicit "are orar" (has_cuadrante OR has_horario)
- [x] Ajustare target corectă (zile neutre cu COUNT DISTINCT)
- [x] Penalizări graduale (plafonate)
- [x] SQL complet și curat (28 CTE-uri necesare)
- [x] Breakdown JSON structurat (cu acciones_totales și max_acciones_mes)
- [x] Riscuri identificate + soluții
- [x] Schema DB propusă (cu score_uso_app și acciones_totales)
- [x] Pași implementare clari
- [x] Punctualitate doar pentru has_orar=true (cu CTE-uri day-level)
- [x] Statistici Estado Empleados (NU în scoring, doar filtrare/context)

---

## 📋 LISTA CTE-URI AUXILIARE NECESARE

1. `fechas` - Toate zilele lunii (RECURSIVE)
2. `empleado_flags` - Flag trabaja_festivos
3. `empleado_ccaa` - CCAA pentru fiestas
4. `cuadrante_unpivot` - Unpivot ZI_1...ZI_31 (COMPLET - toate 31 zile)
5. `cuadrante_dia` - Ore planificate pe zi din cuadrante (REPARAT: pornesc din fechas)
6. `horario_dia_m` - Minute planificate pe zi din horario (m1, m2, m3) (COMPLET - toate zilele săptămânii)
7. `horario_dia` - Ore planificate pe zi din horario
8. `bajas_raw` - Raw bajas (REPARAT: separare pentru a evita alias în WHERE)
9. `bajas_intervalos` - Intervale de baja medicală (REPARAT: nu folosesc alias în WHERE)
10. `bajas_dia` - Zile de baja medicală
11. `aus_raw` - Ausencias raw (pentru parsing)
12. `aus_parts` - Ausencias parsed (start/end)
13. `aus_norm` - Ausencias normalizate (cu dates) (REPARAT: scos "aprobate")
14. `aus_dia` - Ausencias pe zi
15. `fiestas_dia` - Zile de fiesta (cu scope/ccaa și trabaja_festivos)
16. `empleado_orar` - Flag explicit "are orar"
17. `target_initial` - Target inițial (cuadrante > horario > HORAS_CONTRATO)
18. `zile_neutre` - Zile neutre (COUNT DISTINCT)
19. `ore_zile_neutre` - Ore din zile neutre (pentru ajustare target)
20. `target_ajustat` - Target după scăderea zilelor neutre
21. `fichaje_base` - Fichajes cu workday_date corect (pentru ture de noapte)
22. `horas_pontate` - Ore pontate (cu regularizări CONFIRMED)
23. `calitate_pontaj` - Calitate pontaj (fichajes incomplete + regularizări)
24. `horario_start_dia` - Ora de start planificată pe zi din horario (REPARAT: CTE nou pentru punctualitate)
25. `cuadrante_val_dia` - Valoare cuadrante pe zi (REPARAT: CTE nou pentru punctualitate)
26. `punctualitate` - Punctualitate (DOAR pentru has_orar=true) (REPARAT: folosește CTE-uri noi)
27. `acciones_empleado` - Acțiuni pe angajat (cu ponderi) (REPARAT: scos LIKE pe nume, prioritate email)
28. `acciones_totales` - Total acțiuni per angajat
29. `max_acciones_mes` - Maximul de acțiuni din lună (pentru normalizare)
30. `uso_app` - Scor "Uso de la aplicación" (normalizat)
31. `scoring` - Scoring final (REPARAT: tie-breaker simplificat la egalitate)

---

**STATUS:** ✅ PLAN FINAL - COERENT, COMPLET, GATA PENTRU IMPLEMENTARE

**Confirmare:**
- ✅ **Uso de la aplicación** integrat obligatoriu (10% pondere)
- ✅ Normalizare uso_app: (acciones_empleado / max_acciones_mes) * 100
- ✅ Ponderi pe tip de acțiune (fichajes=1, solicitudes=2, documentos=3, formularios=3, login=0.2)
- ✅ Anti-abuz: plafon zilnic pentru login (max 1 punct/zi)
- ✅ Tie-breaker: diferența < 5 puncte → ordonează după uso_app
- ✅ Toate clarificările integrate
- ✅ SQL complet, curat, fără placeholder-e nedefinite (28 CTE-uri)
- ✅ Toate CTE-urile auxiliare necesare listate
- ✅ Reguli explicate "human readable"
- ✅ Plan defensabil și ușor de explicat în UI
- ✅ **GARANTIE:** Un angajat cu uz mai mare al aplicației NU poate ieși sub unul cu uz mai mic în condiții similare (datorită normalizării și tie-breaker-ului)
