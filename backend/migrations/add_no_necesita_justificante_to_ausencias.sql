-- Migration: Add no_necesita_justificante column to Ausencias table
-- Date: 2026-02-01
-- Description: Adds a boolean field to mark ausencias that don't require justificantes

ALTER TABLE `Ausencias`
  ADD COLUMN `no_necesita_justificante` BOOLEAN NOT NULL DEFAULT FALSE
  AFTER `UNIDAD_DURACION`;

-- Add index for better query performance when filtering by this field
CREATE INDEX `idx_ausencias_no_necesita_justificante` ON `Ausencias` (`no_necesita_justificante`);
