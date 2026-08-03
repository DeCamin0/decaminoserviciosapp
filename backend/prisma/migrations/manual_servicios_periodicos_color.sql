-- Color personalizable por tipo de servicio periódico
ALTER TABLE `servicios_periodicos_tipos`
  ADD COLUMN IF NOT EXISTS `color` VARCHAR(20) NOT NULL DEFAULT '#0ea5e9' AFTER `nombre`;

-- Colores por defecto para tipos seed (por nombre)
UPDATE `servicios_periodicos_tipos` SET `color` = '#0ea5e9' WHERE `nombre` = 'Limpieza de cristales' AND (`color` IS NULL OR `color` = '' OR `color` = '#0ea5e9');
UPDATE `servicios_periodicos_tipos` SET `color` = '#f59e0b' WHERE `nombre` = 'Garajes';
UPDATE `servicios_periodicos_tipos` SET `color` = '#a855f7' WHERE `nombre` = 'Abrillantado';
UPDATE `servicios_periodicos_tipos` SET `color` = '#14b8a6' WHERE `nombre` = 'Limpieza de patio';
