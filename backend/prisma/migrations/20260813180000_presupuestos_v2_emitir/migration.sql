-- Presupuestos V2 Paso 3: Emitir + snapshots + client working + audit

ALTER TABLE `v2_companies`
    ADD COLUMN `direccion_fiscal` VARCHAR(500) NULL,
    ADD COLUMN `datos_fiscales_json` JSON NULL,
    ADD COLUMN `logo_ref` VARCHAR(255) NULL;

ALTER TABLE `v2_brands`
    ADD COLUMN `logo_ref` VARCHAR(255) NULL,
    ADD COLUMN `config_json` JSON NULL;

ALTER TABLE `v2_presupuestos`
    ADD COLUMN `serie_id` INTEGER NULL,
    ADD COLUMN `cliente_working_json` JSON NULL,
    ADD COLUMN `cliente_overrides_json` JSON NULL,
    ADD COLUMN `snapshot_cliente_json` JSON NULL,
    ADD COLUMN `snapshot_company_json` JSON NULL,
    ADD COLUMN `snapshot_brand_json` JSON NULL,
    ADD COLUMN `snapshot_serie_json` JSON NULL,
    ADD COLUMN `snapshot_economico_json` JSON NULL,
    ADD COLUMN `totales_emitidos_json` JSON NULL,
    ADD COLUMN `emitted_at` TIMESTAMP(0) NULL,
    ADD COLUMN `emitted_by` VARCHAR(50) NULL,
    ADD INDEX `idx_v2_presup_serie`(`serie_id`);

CREATE TABLE `v2_presupuesto_audit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `presupuesto_id` INTEGER NOT NULL,
    `event_type` VARCHAR(80) NOT NULL,
    `payload_json` JSON NULL,
    `actor` VARCHAR(50) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    INDEX `idx_v2_audit_presup`(`presupuesto_id`),
    INDEX `idx_v2_audit_event`(`event_type`, `created_at`),
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_v2_audit_presup`
      FOREIGN KEY (`presupuesto_id`) REFERENCES `v2_presupuestos`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Ensure DeCamino coexistence format uses hyphen (disjunct vs Legacy MADYYYY####)
UPDATE `v2_series_numeracion`
SET `formato` = '{PREF}-{YYYY}-{SEQ}'
WHERE `formato` = '{PREF}{YYYY}-{SEQ}';
