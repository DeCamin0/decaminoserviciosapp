-- Fotos Trabajo: albums + photo metadata (binaries in Cloudflare R2)
-- Safe to re-run: uses IF NOT EXISTS patterns where supported.

CREATE TABLE IF NOT EXISTS `fotos_trabajo_albumes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cliente_id` INT NOT NULL,
  `titulo` VARCHAR(500) NOT NULL,
  `fecha_servicio` DATE NULL,
  `notas` VARCHAR(1000) NULL,
  `creado_por` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ft_album_cliente_created` (`cliente_id`, `created_at`),
  KEY `idx_ft_album_fecha` (`fecha_servicio`),
  CONSTRAINT `fk_ft_album_cliente`
    FOREIGN KEY (`cliente_id`) REFERENCES `Clientes` (`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fotos_trabajo_fotos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `album_id` INT NOT NULL,
  `storage_key` VARCHAR(700) NOT NULL,
  `storage_bucket` VARCHAR(120) NULL,
  `mime_type` VARCHAR(100) NULL,
  `tamano_bytes` INT NULL,
  `nombre_original` VARCHAR(255) NULL,
  `uploaded_by` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ft_foto_storage_key` (`storage_key`),
  KEY `idx_ft_foto_album_created` (`album_id`, `created_at`),
  CONSTRAINT `fk_ft_foto_album`
    FOREIGN KEY (`album_id`) REFERENCES `fotos_trabajo_albumes` (`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `Permissions` (`grupo_module`, `permitted`, `last_updated`, `updated_by`)
VALUES
  ('Supervisor_fotos-trabajo', 'true', NOW(), 'migration'),
  ('Developer_fotos-trabajo', 'true', NOW(), 'migration'),
  ('Manager_fotos-trabajo', 'true', NOW(), 'migration'),
  ('Admin_fotos-trabajo', 'true', NOW(), 'migration');
