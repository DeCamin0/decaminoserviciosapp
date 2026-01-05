-- Script SQL pentru a adăuga NO_PUNCH în enum-ul FichajeRegularizacionType
-- Rulează: mysql -h 217.154.102.115 -u facturacion_user -p decamino_db < add-no-punch-enum.sql

-- Verifică structura actuală
-- DESCRIBE FichajeRegularizacion;

-- Modifică enum-ul pentru a include NO_PUNCH
ALTER TABLE `FichajeRegularizacion` 
MODIFY COLUMN `regularization_type` ENUM('NO_EXTRA', 'DECLARES_EXTRA', 'PUNCH_ERROR', 'AUTO_CLOSE', 'LEGACY', 'NO_PUNCH') NOT NULL;

-- Verifică modificarea
-- DESCRIBE FichajeRegularizacion;

