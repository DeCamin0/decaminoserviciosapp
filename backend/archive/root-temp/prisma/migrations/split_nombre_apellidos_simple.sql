-- ============================================================================
-- Migration: Split NOMBRE / APELLIDOS into separate columns (Simplified version)
-- Target: MariaDB
-- Table: DatosEmpleados
-- 
-- IMPORTANT: This migration is IDEMPOTENT - safe to run multiple times
-- IMPORTANT: Original column `NOMBRE / APELLIDOS` remains INTACT
-- ============================================================================

-- Step 1: Add new columns (idempotent - using IF NOT EXISTS pattern)
-- ============================================================================

-- Add NOMBRE_APELLIDOS_BACKUP if it doesn't exist
ALTER TABLE `DatosEmpleados` 
ADD COLUMN IF NOT EXISTS `NOMBRE_APELLIDOS_BACKUP` VARCHAR(255) NULL;

-- Add NOMBRE if it doesn't exist
ALTER TABLE `DatosEmpleados` 
ADD COLUMN IF NOT EXISTS `NOMBRE` VARCHAR(120) NULL;

-- Add APELLIDO1 if it doesn't exist
ALTER TABLE `DatosEmpleados` 
ADD COLUMN IF NOT EXISTS `APELLIDO1` VARCHAR(120) NULL;

-- Add APELLIDO2 if it doesn't exist
ALTER TABLE `DatosEmpleados` 
ADD COLUMN IF NOT EXISTS `APELLIDO2` VARCHAR(120) NULL;

-- Add NOMBRE_SPLIT_CONFIANZA if it doesn't exist
ALTER TABLE `DatosEmpleados` 
ADD COLUMN IF NOT EXISTS `NOMBRE_SPLIT_CONFIANZA` TINYINT NOT NULL DEFAULT 2;

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

