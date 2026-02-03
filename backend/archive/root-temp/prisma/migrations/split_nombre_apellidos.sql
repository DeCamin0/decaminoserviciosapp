-- ============================================================================
-- Migration: Split NOMBRE / APELLIDOS into separate columns
-- Target: MariaDB
-- Table: DatosEmpleados
-- 
-- IMPORTANT: This migration is IDEMPOTENT - safe to run multiple times
-- IMPORTANT: Original column `NOMBRE / APELLIDOS` remains INTACT
-- ============================================================================

-- Step 1: Add new columns (idempotent - only if they don't exist)
-- ============================================================================

-- Check and add NOMBRE_APELLIDOS_BACKUP if it doesn't exist
SET @backup_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'DatosEmpleados' 
    AND COLUMN_NAME = 'NOMBRE_APELLIDOS_BACKUP'
);

SET @sql_backup = IF(@backup_exists = 0,
    'ALTER TABLE `DatosEmpleados` ADD COLUMN `NOMBRE_APELLIDOS_BACKUP` VARCHAR(255) NULL',
    'SELECT "Column NOMBRE_APELLIDOS_BACKUP already exists" AS info'
);
PREPARE stmt FROM @sql_backup;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add NOMBRE if it doesn't exist
SET @nombre_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'DatosEmpleados' 
    AND COLUMN_NAME = 'NOMBRE'
);

SET @sql_nombre = IF(@nombre_exists = 0,
    'ALTER TABLE `DatosEmpleados` ADD COLUMN `NOMBRE` VARCHAR(120) NULL',
    'SELECT "Column NOMBRE already exists" AS info'
);
PREPARE stmt FROM @sql_nombre;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add APELLIDO1 if it doesn't exist
SET @apellido1_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'DatosEmpleados' 
    AND COLUMN_NAME = 'APELLIDO1'
);

SET @sql_apellido1 = IF(@apellido1_exists = 0,
    'ALTER TABLE `DatosEmpleados` ADD COLUMN `APELLIDO1` VARCHAR(120) NULL',
    'SELECT "Column APELLIDO1 already exists" AS info'
);
PREPARE stmt FROM @sql_apellido1;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add APELLIDO2 if it doesn't exist
SET @apellido2_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'DatosEmpleados' 
    AND COLUMN_NAME = 'APELLIDO2'
);

SET @sql_apellido2 = IF(@apellido2_exists = 0,
    'ALTER TABLE `DatosEmpleados` ADD COLUMN `APELLIDO2` VARCHAR(120) NULL',
    'SELECT "Column APELLIDO2 already exists" AS info'
);
PREPARE stmt FROM @sql_apellido2;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add NOMBRE_SPLIT_CONFIANZA if it doesn't exist
SET @confianza_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'DatosEmpleados' 
    AND COLUMN_NAME = 'NOMBRE_SPLIT_CONFIANZA'
);

SET @sql_confianza = IF(@confianza_exists = 0,
    'ALTER TABLE `DatosEmpleados` ADD COLUMN `NOMBRE_SPLIT_CONFIANZA` TINYINT NOT NULL DEFAULT 2',
    'SELECT "Column NOMBRE_SPLIT_CONFIANZA already exists" AS info'
);
PREPARE stmt FROM @sql_confianza;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Populate backup column (only if NULL and original has value)
-- ============================================================================
UPDATE `DatosEmpleados`
SET `NOMBRE_APELLIDOS_BACKUP` = `NOMBRE / APELLIDOS`
WHERE `NOMBRE_APELLIDOS_BACKUP` IS NULL 
  AND `NOMBRE / APELLIDOS` IS NOT NULL 
  AND TRIM(`NOMBRE / APELLIDOS`) != '';

-- Step 3: Initialize empty/null cases
-- ============================================================================
UPDATE `DatosEmpleados`
SET
    `NOMBRE` = NULL,
    `APELLIDO1` = NULL,
    `APELLIDO2` = NULL,
    `NOMBRE_SPLIT_CONFIANZA` = 0
WHERE `NOMBRE / APELLIDOS` IS NULL 
   OR TRIM(`NOMBRE / APELLIDOS`) = '';

-- Step 4: Handle 1 token case (everything is NOMBRE)
-- ============================================================================
UPDATE `DatosEmpleados`
SET
    `NOMBRE` = TRIM(`NOMBRE / APELLIDOS`),
    `APELLIDO1` = NULL,
    `APELLIDO2` = NULL,
    `NOMBRE_SPLIT_CONFIANZA` = 2
WHERE `NOMBRE / APELLIDOS` IS NOT NULL 
  AND TRIM(`NOMBRE / APELLIDOS`) != ''
  AND (LENGTH(TRIM(`NOMBRE / APELLIDOS`)) - LENGTH(REPLACE(TRIM(`NOMBRE / APELLIDOS`), ' ', ''))) = 0
  AND `NOMBRE` IS NULL;

-- Step 5: Handle 2 tokens case (first = NOMBRE, second = APELLIDO1)
-- ============================================================================
UPDATE `DatosEmpleados`
SET
    `NOMBRE` = TRIM(SUBSTRING_INDEX(TRIM(`NOMBRE / APELLIDOS`), ' ', 1)),
    `APELLIDO1` = TRIM(SUBSTRING_INDEX(TRIM(`NOMBRE / APELLIDOS`), ' ', -1)),
    `APELLIDO2` = NULL,
    `NOMBRE_SPLIT_CONFIANZA` = 2
WHERE `NOMBRE / APELLIDOS` IS NOT NULL 
  AND TRIM(`NOMBRE / APELLIDOS`) != ''
  AND (LENGTH(TRIM(`NOMBRE / APELLIDOS`)) - LENGTH(REPLACE(TRIM(`NOMBRE / APELLIDOS`), ' ', ''))) = 1
  AND `NOMBRE` IS NULL;

-- Step 6: Handle 3+ tokens case (complex logic with particle detection)
-- ============================================================================
-- First, set basic split: last token = APELLIDO2, second-to-last = APELLIDO1, rest = NOMBRE
UPDATE `DatosEmpleados`
SET
    `APELLIDO2` = TRIM(SUBSTRING_INDEX(TRIM(`NOMBRE / APELLIDOS`), ' ', -1)),
    `APELLIDO1` = TRIM(SUBSTRING_INDEX(
        SUBSTRING_INDEX(TRIM(`NOMBRE / APELLIDOS`), ' ', -2),
        ' ',
        1
    )),
    `NOMBRE` = TRIM(SUBSTRING_INDEX(
        TRIM(`NOMBRE / APELLIDOS`),
        ' ',
        (LENGTH(TRIM(`NOMBRE / APELLIDOS`)) - LENGTH(REPLACE(TRIM(`NOMBRE / APELLIDOS`), ' ', ''))) - 1
    )),
    `NOMBRE_SPLIT_CONFIANZA` = CASE
        WHEN (LENGTH(TRIM(`NOMBRE / APELLIDOS`)) - LENGTH(REPLACE(TRIM(`NOMBRE / APELLIDOS`), ' ', ''))) >= 4 THEN 1
        ELSE 2
    END
WHERE `NOMBRE / APELLIDOS` IS NOT NULL 
  AND TRIM(`NOMBRE / APELLIDOS`) != ''
  AND (LENGTH(TRIM(`NOMBRE / APELLIDOS`)) - LENGTH(REPLACE(TRIM(`NOMBRE / APELLIDOS`), ' ', ''))) >= 2
  AND `NOMBRE` IS NULL;

-- Step 7: Adjust for particle detection (3+ tokens with particles)
-- ============================================================================
-- If second-to-last token is a particle, include it and the token before in APELLIDO1
UPDATE `DatosEmpleados`
SET
    `APELLIDO1` = CONCAT(
        TRIM(SUBSTRING_INDEX(
            SUBSTRING_INDEX(TRIM(`NOMBRE / APELLIDOS`), ' ', -3),
            ' ',
            1
        )),
        ' ',
        TRIM(SUBSTRING_INDEX(
            SUBSTRING_INDEX(TRIM(`NOMBRE / APELLIDOS`), ' ', -2),
            ' ',
            1
        ))
    ),
    `NOMBRE` = TRIM(SUBSTRING_INDEX(
        TRIM(`NOMBRE / APELLIDOS`),
        ' ',
        (LENGTH(TRIM(`NOMBRE / APELLIDOS`)) - LENGTH(REPLACE(TRIM(`NOMBRE / APELLIDOS`), ' ', ''))) - 2
    )),
    `NOMBRE_SPLIT_CONFIANZA` = 1
WHERE `NOMBRE / APELLIDOS` IS NOT NULL 
  AND TRIM(`NOMBRE / APELLIDOS`) != ''
  AND (LENGTH(TRIM(`NOMBRE / APELLIDOS`)) - LENGTH(REPLACE(TRIM(`NOMBRE / APELLIDOS`), ' ', ''))) >= 2
  AND LOWER(TRIM(SUBSTRING_INDEX(
        SUBSTRING_INDEX(TRIM(`NOMBRE / APELLIDOS`), ' ', -2),
        ' ',
        1
    ))) IN ('de', 'del', 'la', 'las', 'los', 'da', 'do', 'dos', 'van', 'von', 'y', 'i');

-- Step 8: Verification query
-- ============================================================================
-- Show 20 rows where confidence is not 2 (uncertain or failed splits)
SELECT 
    CODIGO,
    `NOMBRE / APELLIDOS` AS nombre_original,
    NOMBRE_APELLIDOS_BACKUP AS backup,
    NOMBRE,
    APELLIDO1,
    APELLIDO2,
    NOMBRE_SPLIT_CONFIANZA AS confianza,
    CASE 
        WHEN NOMBRE_SPLIT_CONFIANZA = 0 THEN 'Failed (empty/null)'
        WHEN NOMBRE_SPLIT_CONFIANZA = 1 THEN 'Uncertain (particles or 4+ tokens)'
        WHEN NOMBRE_SPLIT_CONFIANZA = 2 THEN 'Confident'
        ELSE 'Unknown'
    END AS confianza_desc
FROM `DatosEmpleados`
WHERE NOMBRE_SPLIT_CONFIANZA != 2
   OR (NOMBRE IS NULL AND `NOMBRE / APELLIDOS` IS NOT NULL AND TRIM(`NOMBRE / APELLIDOS`) != '')
LIMIT 20;

-- ============================================================================
-- ROLLBACK PLAN (SQL comments - do not execute unless needed)
-- ============================================================================
-- 
-- If you need to rollback this migration:
-- 
-- 1. Clear the new columns (optional - they can remain NULL):
--    UPDATE `DatosEmpleados` SET 
--        `NOMBRE` = NULL,
--        `APELLIDO1` = NULL,
--        `APELLIDO2` = NULL,
--        `NOMBRE_SPLIT_CONFIANZA` = 0,
--        `NOMBRE_APELLIDOS_BACKUP` = NULL;
-- 
-- 2. Drop the new columns (if you want to completely remove them):
--    ALTER TABLE `DatosEmpleados` DROP COLUMN `NOMBRE`;
--    ALTER TABLE `DatosEmpleados` DROP COLUMN `APELLIDO1`;
--    ALTER TABLE `DatosEmpleados` DROP COLUMN `APELLIDO2`;
--    ALTER TABLE `DatosEmpleados` DROP COLUMN `NOMBRE_SPLIT_CONFIANZA`;
--    ALTER TABLE `DatosEmpleados` DROP COLUMN `NOMBRE_APELLIDOS_BACKUP`;
-- 
-- 3. Restore from backup (if backup column exists and has values):
--    UPDATE `DatosEmpleados` 
--    SET `NOMBRE / APELLIDOS` = `NOMBRE_APELLIDOS_BACKUP`
--    WHERE `NOMBRE_APELLIDOS_BACKUP` IS NOT NULL;
-- 
-- NOTE: The original column `NOMBRE / APELLIDOS` is NEVER modified by this
--       migration, so no restoration is needed for it.
-- 
-- ============================================================================
