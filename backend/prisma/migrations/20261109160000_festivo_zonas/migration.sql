ALTER TABLE `fiestas`
  ADD COLUMN `municipio_ine` VARCHAR(10) NOT NULL DEFAULT '' AFTER `ccaa_code`,
  ADD COLUMN `municipio_nombre` VARCHAR(160) NULL AFTER `municipio_ine`;

ALTER TABLE `fiestas` DROP INDEX `uniq_f`;

CREATE UNIQUE INDEX `uniq_f` ON `fiestas` (`date`, `scope`, `ccaa_code`, `municipio_ine`);

CREATE TABLE `festivo_zonas` (
  `ine` VARCHAR(10) NOT NULL,
  `slug` VARCHAR(120) NOT NULL,
  `nombre` VARCHAR(160) NOT NULL,
  `ccaa_slug` VARCHAR(20) NOT NULL DEFAULT 'mad',
  `provincia_slug` VARCHAR(40) NOT NULL DEFAULT 'madrid',
  `ccaa_code` VARCHAR(10) NOT NULL DEFAULT 'ES-MD',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ine`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `fichaje_zona_dia` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(50) NOT NULL,
  `fecha` DATE NOT NULL,
  `municipio_ine` VARCHAR(10) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fichaje_zona_dia` (`codigo`, `fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
