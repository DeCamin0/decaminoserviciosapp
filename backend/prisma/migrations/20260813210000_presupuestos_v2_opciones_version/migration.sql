-- Presupuestos V2 Paso 5: opciones/variantes + nueva versión (parent/root)

-- Version lineage
ALTER TABLE `v2_presupuestos`
  ADD COLUMN `parent_id` INTEGER NULL AFTER `serie_id`,
  ADD COLUMN `root_id` INTEGER NULL AFTER `parent_id`;

CREATE INDEX `idx_v2_presup_parent` ON `v2_presupuestos`(`parent_id`);
CREATE INDEX `idx_v2_presup_root` ON `v2_presupuestos`(`root_id`);

ALTER TABLE `v2_presupuestos`
  ADD CONSTRAINT `v2_presupuestos_parent_id_fkey`
    FOREIGN KEY (`parent_id`) REFERENCES `v2_presupuestos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `v2_presupuestos_root_id_fkey`
    FOREIGN KEY (`root_id`) REFERENCES `v2_presupuestos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill root_id = id for existing rows
UPDATE `v2_presupuestos` SET `root_id` = `id` WHERE `root_id` IS NULL;

-- Opciones / variantes under each presupuesto servicio
CREATE TABLE `v2_presupuesto_servicio_opciones` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `presupuesto_servicio_id` INTEGER NOT NULL,
  `etiqueta` VARCHAR(200) NOT NULL DEFAULT 'Opción 1',
  `orden` INTEGER NOT NULL DEFAULT 0,
  `seleccion_tipo` VARCHAR(20) NOT NULL DEFAULT 'ACUMULABLE',
  `descripcion_local` TEXT NULL,
  `codigo_motor` VARCHAR(64) NULL,
  `version_motor` VARCHAR(20) NULL,
  `inputs_json` JSON NULL,
  `resultado_json` JSON NULL,
  `params_usados_json` JSON NULL,
  `calculated_at` TIMESTAMP(0) NULL,
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  INDEX `idx_v2_opcion_servicio`(`presupuesto_servicio_id`, `orden`),
  PRIMARY KEY (`id`),
  CONSTRAINT `v2_presupuesto_servicio_opciones_servicio_fkey`
    FOREIGN KEY (`presupuesto_servicio_id`) REFERENCES `v2_presupuesto_servicios`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate existing lines → Opción única (preserve calc data)
INSERT INTO `v2_presupuesto_servicio_opciones` (
  `presupuesto_servicio_id`,
  `etiqueta`,
  `orden`,
  `seleccion_tipo`,
  `descripcion_local`,
  `codigo_motor`,
  `version_motor`,
  `inputs_json`,
  `resultado_json`,
  `params_usados_json`,
  `calculated_at`,
  `activo`
)
SELECT
  s.`id`,
  'Opción 1',
  0,
  'ACUMULABLE',
  NULL,
  s.`codigo_motor`,
  s.`version_motor`,
  s.`inputs_json`,
  s.`resultado_json`,
  s.`params_usados_json`,
  s.`calculated_at`,
  true
FROM `v2_presupuesto_servicios` s
WHERE NOT EXISTS (
  SELECT 1 FROM `v2_presupuesto_servicio_opciones` o
  WHERE o.`presupuesto_servicio_id` = s.`id`
);
