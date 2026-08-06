-- Tablas nuevas para órdenes de trabajo (Tareas).
-- Ejecutar manualmente en decamino_db / hera / tenants según corresponda.

CREATE TABLE IF NOT EXISTS `tareas_servicio` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(300) NOT NULL,
  `descripcion` TEXT NULL,
  `prioridad` VARCHAR(20) NOT NULL DEFAULT 'normal',
  `estado` VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  `codigo_asignado` VARCHAR(50) NOT NULL,
  `nombre_asignado` VARCHAR(255) NULL,
  `codigo_creador` VARCHAR(50) NOT NULL,
  `nombre_creador` VARCHAR(255) NULL,
  `centro` VARCHAR(300) NULL,
  `zona` VARCHAR(300) NULL,
  `cliente_id` INT NULL,
  `fecha_limite` DATETIME NULL,
  `completado_at` DATETIME NULL,
  `nota_completado` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_tarea_asignado_estado` (`codigo_asignado`, `estado`, `created_at`),
  INDEX `idx_tarea_estado_prio` (`estado`, `prioridad`, `created_at`),
  INDEX `idx_tarea_creador` (`codigo_creador`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tareas_servicio_fotos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tarea_id` INT NOT NULL,
  `storage_key` VARCHAR(700) NOT NULL,
  `storage_bucket` VARCHAR(120) NULL,
  `mime_type` VARCHAR(100) NULL,
  `tamano_bytes` INT NULL,
  `nombre_original` VARCHAR(255) NULL,
  `uploaded_by` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tarea_foto_storage_key` (`storage_key`),
  INDEX `idx_tarea_foto_tarea` (`tarea_id`, `created_at`),
  CONSTRAINT `fk_tarea_foto` FOREIGN KEY (`tarea_id`) REFERENCES `tareas_servicio` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
