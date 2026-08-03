-- Flag servicios_periodicos en Clientes + asignación de tipos por comunidad
ALTER TABLE `Clientes`
  ADD COLUMN `servicios_periodicos` TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS `servicios_periodicos_cliente_tipos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cliente_id` INT NOT NULL,
  `tipo_id` INT NOT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sp_cli_tipo` (`cliente_id`, `tipo_id`),
  INDEX `idx_sp_cli_tipo_cliente` (`cliente_id`),
  INDEX `idx_sp_cli_tipo_tipo` (`tipo_id`),
  CONSTRAINT `fk_sp_cli_tipo_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `Clientes` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_sp_cli_tipo_tipo` FOREIGN KEY (`tipo_id`) REFERENCES `servicios_periodicos_tipos` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
