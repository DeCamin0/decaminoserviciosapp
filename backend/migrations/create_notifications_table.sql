-- Migración: Crear tabla de notificaciones
-- Ejecuta este script SQL en tu base de datos MariaDB/MySQL

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY COMMENT 'ID único de la notificación (UUID)',
  `sender_id` VARCHAR(50) NULL COMMENT 'Código del empleado que envía la notificación (CODIGO)',
  `user_id` VARCHAR(50) NOT NULL COMMENT 'Código del empleado que recibe la notificación (CODIGO de DatosEmpleados)',
  `type` VARCHAR(20) NOT NULL DEFAULT 'info' COMMENT 'Tipo de notificación: success, error, warning, info',
  `title` VARCHAR(255) NOT NULL COMMENT 'Título de la notificación',
  `message` TEXT NOT NULL COMMENT 'Mensaje de la notificación',
  `read` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Indica si la notificación ha sido leída',
  `data` TEXT NULL COMMENT 'Datos adicionales en formato JSON (enlaces, IDs, etc.)',
  `grupo` VARCHAR(100) NULL COMMENT 'Grupo al que se envió la notificación (si es notificación de grupo)',
  `centro` VARCHAR(100) NULL COMMENT 'Centro de trabajo al que se envió (si es notificación de centro)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación de la notificación',
  `read_at` TIMESTAMP NULL COMMENT 'Fecha y hora en que se marcó como leída',
  INDEX `idx_sender` (`sender_id`) COMMENT 'Índice para búsquedas por remitente',
  INDEX `idx_user_read` (`user_id`, `read`) COMMENT 'Índice para búsquedas rápidas por usuario y estado de lectura',
  INDEX `idx_user_created` (`user_id`, `created_at`) COMMENT 'Índice para ordenar notificaciones por usuario y fecha'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Tabla para almacenar las notificaciones de los usuarios en tiempo real';
