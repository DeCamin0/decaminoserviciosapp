-- CreateTable: Convenios
CREATE TABLE IF NOT EXISTS `convenios` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(200) NOT NULL,
  `activo` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_convenios_nombre` (`nombre`),
  INDEX `idx_convenios_activo` (`activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CreateTable: ConvenioGrupo
CREATE TABLE IF NOT EXISTS `convenio_grupo` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `convenio_id` INT NOT NULL,
  `grupo_nombre` VARCHAR(200) NOT NULL,
  `activo` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_convenio_grupo_nombre` (`grupo_nombre`),
  INDEX `idx_convenio_grupo_convenio` (`convenio_id`),
  INDEX `idx_convenio_grupo_activo` (`activo`),
  CONSTRAINT `fk_convenio_grupo_convenio` FOREIGN KEY (`convenio_id`) REFERENCES `convenios` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CreateTable: ConvenioConfig
CREATE TABLE IF NOT EXISTS `convenio_config` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `convenio_id` INT NOT NULL,
  `dias_vacaciones_anuales` INT NOT NULL DEFAULT 31,
  `dias_asuntos_propios_anuales` INT NOT NULL DEFAULT 0,
  `activo` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_convenio_config_convenio` (`convenio_id`),
  INDEX `idx_convenio_config_activo` (`activo`),
  CONSTRAINT `fk_convenio_config_convenio` FOREIGN KEY (`convenio_id`) REFERENCES `convenios` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed: Insertar Convenios
INSERT INTO `convenios` (`nombre`, `activo`) VALUES
  ('Limpieza', TRUE),
  ('Servicios Auxiliares', TRUE)
ON DUPLICATE KEY UPDATE `activo` = TRUE;

-- Seed: Insertar ConvenioGrupo (mapeo GRUPO → Convenio)
-- Limpieza
INSERT INTO `convenio_grupo` (`convenio_id`, `grupo_nombre`, `activo`) 
SELECT `id`, 'Auxiliar de servicios - L', TRUE FROM `convenios` WHERE `nombre` = 'Limpieza'
ON DUPLICATE KEY UPDATE `activo` = TRUE;

INSERT INTO `convenio_grupo` (`convenio_id`, `grupo_nombre`, `activo`) 
SELECT `id`, 'Limpieza', TRUE FROM `convenios` WHERE `nombre` = 'Limpieza'
ON DUPLICATE KEY UPDATE `activo` = TRUE;

INSERT INTO `convenio_grupo` (`convenio_id`, `grupo_nombre`, `activo`) 
SELECT `id`, 'Limpiador', TRUE FROM `convenios` WHERE `nombre` = 'Limpieza'
ON DUPLICATE KEY UPDATE `activo` = TRUE;

-- Servicios Auxiliares
INSERT INTO `convenio_grupo` (`convenio_id`, `grupo_nombre`, `activo`) 
SELECT `id`, 'Auxiliar de Servicios C', TRUE FROM `convenios` WHERE `nombre` = 'Servicios Auxiliares'
ON DUPLICATE KEY UPDATE `activo` = TRUE;

INSERT INTO `convenio_grupo` (`convenio_id`, `grupo_nombre`, `activo`) 
SELECT `id`, 'Auxiliar De Servicios - C', TRUE FROM `convenios` WHERE `nombre` = 'Servicios Auxiliares'
ON DUPLICATE KEY UPDATE `activo` = TRUE;

INSERT INTO `convenio_grupo` (`convenio_id`, `grupo_nombre`, `activo`) 
SELECT `id`, 'Auxiliar C', TRUE FROM `convenios` WHERE `nombre` = 'Servicios Auxiliares'
ON DUPLICATE KEY UPDATE `activo` = TRUE;

INSERT INTO `convenio_grupo` (`convenio_id`, `grupo_nombre`, `activo`) 
SELECT `id`, 'Auxiliar de Servicios', TRUE FROM `convenios` WHERE `nombre` = 'Servicios Auxiliares'
ON DUPLICATE KEY UPDATE `activo` = TRUE;

-- Seed: Insertar ConvenioConfig
-- Limpieza: 31 días vacaciones, 6 días asuntos propios
INSERT INTO `convenio_config` (`convenio_id`, `dias_vacaciones_anuales`, `dias_asuntos_propios_anuales`, `activo`)
SELECT `id`, 31, 6, TRUE FROM `convenios` WHERE `nombre` = 'Limpieza'
ON DUPLICATE KEY UPDATE 
  `dias_vacaciones_anuales` = 31,
  `dias_asuntos_propios_anuales` = 6,
  `activo` = TRUE;

-- Servicios Auxiliares: 31 días vacaciones, 0 días asuntos propios
INSERT INTO `convenio_config` (`convenio_id`, `dias_vacaciones_anuales`, `dias_asuntos_propios_anuales`, `activo`)
SELECT `id`, 31, 0, TRUE FROM `convenios` WHERE `nombre` = 'Servicios Auxiliares'
ON DUPLICATE KEY UPDATE 
  `dias_vacaciones_anuales` = 31,
  `dias_asuntos_propios_anuales` = 0,
  `activo` = TRUE;

