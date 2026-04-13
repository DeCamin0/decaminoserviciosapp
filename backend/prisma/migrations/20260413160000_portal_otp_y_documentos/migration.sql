-- OTP portal + documentación general + facturas/inspecciones manuales por cliente (MVP área clientes).

CREATE TABLE `portal_otp_challenges` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `contacto_id` INT NOT NULL,
  `code_hash` VARCHAR(64) NOT NULL,
  `expires_at` TIMESTAMP(0) NOT NULL,
  `consumed_at` TIMESTAMP(0) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_portal_otp_contacto_consumed` (`contacto_id`, `consumed_at`),
  CONSTRAINT `fk_portal_otp_contacto` FOREIGN KEY (`contacto_id`) REFERENCES `cliente_contactos` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE TABLE `portal_documentos_generales` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tipo_documento` VARCHAR(120) NOT NULL,
  `nombre_documento` VARCHAR(500) NOT NULL,
  `mime_type` VARCHAR(100) NULL,
  `archivo` LONGBLOB NOT NULL,
  `fecha_subida` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_validez` DATE NULL,
  `estado` VARCHAR(50) NOT NULL DEFAULT 'activo',
  `created_by` VARCHAR(50) NULL,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_portal_doc_gen_estado_tipo` (`estado`, `tipo_documento`)
);

CREATE TABLE `cliente_facturas_manuales` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cliente_id` INT NOT NULL,
  `numero_factura` VARCHAR(100) NULL,
  `nombre_archivo` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NULL,
  `archivo` LONGBLOB NOT NULL,
  `fecha_emision` DATE NOT NULL,
  `fecha_vencimiento` DATE NULL,
  `importe` DECIMAL(12, 2) NULL,
  `estado` VARCHAR(50) NOT NULL DEFAULT 'pendiente',
  `observaciones` TEXT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cliente_fact_manual_cli_estado` (`cliente_id`, `estado`),
  CONSTRAINT `fk_cliente_fact_manual_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `Clientes` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE TABLE `cliente_inspeccion_documentos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cliente_id` INT NOT NULL,
  `titulo` VARCHAR(500) NOT NULL,
  `centro_trabajo` VARCHAR(500) NULL,
  `nombre_archivo` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NULL,
  `archivo` LONGBLOB NOT NULL,
  `fecha_informe` DATE NULL,
  `estado` VARCHAR(50) NOT NULL DEFAULT 'activo',
  `observaciones` TEXT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cli_insp_doc_cli_est` (`cliente_id`, `estado`),
  CONSTRAINT `fk_cli_insp_doc_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `Clientes` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
);
