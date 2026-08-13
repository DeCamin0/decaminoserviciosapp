-- Presupuestos V2 Paso 5.5: bloques de contenido comercial reutilizables

CREATE TABLE IF NOT EXISTS `v2_contenido_bloques` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(80) NOT NULL,
  `nombre` VARCHAR(200) NOT NULL,
  `categoria` VARCHAR(80) NULL,
  `body_json` JSON NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `orden` INT NOT NULL DEFAULT 0,
  `brand_id` INT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_v2_contenido_bloque_codigo` (`codigo`),
  KEY `idx_v2_bloque_activo_cat` (`activo`, `categoria`),
  KEY `idx_v2_bloque_brand` (`brand_id`),
  CONSTRAINT `fk_v2_bloque_brand` FOREIGN KEY (`brand_id`) REFERENCES `v2_brands` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
