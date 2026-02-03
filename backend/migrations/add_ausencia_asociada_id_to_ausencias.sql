-- Migration: Add ausencia_asociada_id column to Ausencias table
-- Date: 2026-02-03
-- Description: Adds a field to associate two ausencias records (e.g., "Ausencias justificada" with "Salida Sin Regreso")

ALTER TABLE `Ausencias`
  ADD COLUMN `ausencia_asociada_id` INT NULL
  AFTER `no_necesita_justificante`;

-- Add index for better query performance when filtering by this field
CREATE INDEX `idx_ausencias_asociada_id` ON `Ausencias` (`ausencia_asociada_id`);
