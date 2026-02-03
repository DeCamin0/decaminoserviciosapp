-- Migration: Add NO_PUNCH to FichajeRegularizacionType enum
-- Date: 2026-01-04
-- Description: Adds NO_PUNCH type to support days with scheduled work but no fichajes

-- Modify the enum to include NO_PUNCH
ALTER TABLE `FichajeRegularizacion` 
MODIFY COLUMN `regularization_type` ENUM('NO_EXTRA', 'DECLARES_EXTRA', 'PUNCH_ERROR', 'AUTO_CLOSE', 'LEGACY', 'NO_PUNCH') NOT NULL;

