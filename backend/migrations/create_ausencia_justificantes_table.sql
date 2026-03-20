-- Tabla para vincular ausencias con sus justificantes (cerere y presencia) por id.
-- No modifica Ausencias, CarpetasDocumentos ni documentos_solicitados.

CREATE TABLE IF NOT EXISTS `ausencia_justificantes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ausencia_id` INT NOT NULL,
  `tipo` VARCHAR(50) NOT NULL COMMENT 'cerere | presencia',
  `doc_id` INT NULL COMMENT 'CarpetasDocumentos.doc_id cuando hay archivo subido',
  `documento_solicitado_id` INT NULL COMMENT 'documentos_solicitados.id para solicitud de presencia',
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  INDEX `idx_ausencia_justificantes_ausencia_id` (`ausencia_id`),
  INDEX `idx_ausencia_justificantes_doc_id` (`doc_id`),
  INDEX `idx_ausencia_justificantes_doc_solicitado_id` (`documento_solicitado_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
