-- Presupuestos V2 Paso 4: PDF documentos + storage metadata

CREATE TABLE `v2_presupuesto_documentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `presupuesto_id` INTEGER NOT NULL,
    `tipo` VARCHAR(40) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `es_oficial` BOOLEAN NOT NULL DEFAULT false,
    `storage_key` VARCHAR(500) NULL,
    `storage_bucket` VARCHAR(120) NULL,
    `sha256` VARCHAR(64) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `numero_presupuesto` VARCHAR(64) NULL,
    `template_version` VARCHAR(40) NULL,
    `content_type` VARCHAR(80) NOT NULL DEFAULT 'application/pdf',
    `created_by` VARCHAR(50) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    INDEX `idx_v2_doc_presup`(`presupuesto_id`),
    INDEX `idx_v2_doc_tipo`(`presupuesto_id`, `tipo`, `es_oficial`),
    UNIQUE INDEX `uq_v2_doc_sha`(`presupuesto_id`, `sha256`),
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_v2_doc_presup`
      FOREIGN KEY (`presupuesto_id`) REFERENCES `v2_presupuestos`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
