-- Add visible column to cuadrante table
-- This column controls whether a cuadrante is visible to employees in "Mi Horario"

ALTER TABLE `cuadrante` 
ADD COLUMN `visible` BOOLEAN NOT NULL DEFAULT true;

-- Update all existing cuadrantes to be visible by default
UPDATE `cuadrante` SET `visible` = true WHERE `visible` IS NULL;
