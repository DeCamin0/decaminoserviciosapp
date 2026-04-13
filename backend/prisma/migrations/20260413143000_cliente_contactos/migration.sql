-- Contactos por cliente/comunidad (portal y notificaciones a nivel de persona, no columnas fijas en Clientes).
CREATE TABLE `cliente_contactos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cliente_id` INT NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `cargo_codigo` VARCHAR(80) NULL,
  `cargo_libre` VARCHAR(200) NULL,
  `email` VARCHAR(255) NULL,
  `telefono` VARCHAR(50) NULL,
  `acceso_portal` TINYINT(1) NOT NULL DEFAULT 0,
  `recibe_notificaciones` TINYINT(1) NOT NULL DEFAULT 0,
  `es_principal` TINYINT(1) NOT NULL DEFAULT 0,
  `estado` VARCHAR(50) NOT NULL DEFAULT 'activo',
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cliente_contacto_cliente` (`cliente_id`),
  KEY `idx_cliente_contacto_cliente_estado` (`cliente_id`, `estado`),
  KEY `idx_cliente_contacto_email` (`email`),
  CONSTRAINT `fk_cliente_contacto_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `Clientes` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
);
