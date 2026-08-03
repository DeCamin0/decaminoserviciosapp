-- Servicios periódicos: tipos configurables + checks por comunidad/mes
CREATE TABLE IF NOT EXISTS `servicios_periodicos_tipos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(200) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `orden` INT NOT NULL DEFAULT 0,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_sp_tipos_activo_orden` (`activo`, `orden`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `servicios_periodicos_checks` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cliente_id` INT NOT NULL,
  `tipo_id` INT NOT NULL,
  `an` INT NOT NULL,
  `mes` INT NOT NULL,
  `hecho` TINYINT(1) NOT NULL DEFAULT 0,
  `fecha_realizacion` DATE NULL,
  `hecho_por` VARCHAR(100) NULL,
  `nota` VARCHAR(500) NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sp_check_cliente_tipo_an_mes` (`cliente_id`, `tipo_id`, `an`, `mes`),
  INDEX `idx_sp_check_an_mes` (`an`, `mes`),
  INDEX `idx_sp_check_cliente_an` (`cliente_id`, `an`),
  CONSTRAINT `fk_sp_check_tipo` FOREIGN KEY (`tipo_id`) REFERENCES `servicios_periodicos_tipos` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tipos iniciales (solo si la tabla está vacía)
INSERT INTO `servicios_periodicos_tipos` (`nombre`, `activo`, `orden`)
SELECT * FROM (
  SELECT 'Limpieza de cristales' AS nombre, 1 AS activo, 1 AS orden
  UNION ALL SELECT 'Garajes', 1, 2
  UNION ALL SELECT 'Abrillantado', 1, 3
  UNION ALL SELECT 'Limpieza de patio', 1, 4
) AS seed
WHERE (SELECT COUNT(*) FROM `servicios_periodicos_tipos`) = 0;
