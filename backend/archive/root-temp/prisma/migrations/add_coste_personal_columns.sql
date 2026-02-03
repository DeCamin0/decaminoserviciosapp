-- Migration: Add nombre_bd and empleado_encontrado columns to coste_personal
-- Date: 2025-12-28

ALTER TABLE `coste_personal`
  ADD COLUMN `nombre_bd` VARCHAR(255) NULL AFTER `nombre_empleado`,
  ADD COLUMN `empleado_encontrado` TINYINT(1) DEFAULT 1 AFTER `nombre_bd`;

-- Add index for empleado_encontrado
ALTER TABLE `coste_personal`
  ADD INDEX `idx_coste_encontrado` (`empleado_encontrado`);

