-- Migración: Cambiar tipo de columna data de JSON a TEXT
-- Ejecuta este script SQL en tu base de datos MariaDB/MySQL

-- Cambia el tipo de columna data de JSON a TEXT
ALTER TABLE `notifications` 
MODIFY COLUMN `data` TEXT NULL COMMENT 'Datos adicionales en formato JSON (enlaces, IDs, etc.)';

-- Verifica que el cambio se aplicó correctamente
-- DESCRIBE notifications;

