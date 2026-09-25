-- RM approval workflow (PENDIENTE / ACEPTADO / RECHAZADO)
ALTER TABLE `prl_employee_documents`
  ADD COLUMN `rm_aprobacion_estado` VARCHAR(20) NULL DEFAULT NULL
    AFTER `rm_solicitado_en`,
  ADD COLUMN `rm_aprobado_por` VARCHAR(50) NULL DEFAULT NULL
    AFTER `rm_aprobacion_estado`,
  ADD COLUMN `rm_aprobado_en` TIMESTAMP NULL DEFAULT NULL
    AFTER `rm_aprobado_por`,
  ADD COLUMN `rm_rechazo_motivo` TEXT NULL
    AFTER `rm_aprobado_en`;

CREATE INDEX `idx_prl_emp_doc_rm_aprobacion`
  ON `prl_employee_documents` (`rm_aprobacion_estado`);

-- Backfill: existing Quiero RM → PENDIENTE for Aprobaciones
UPDATE `prl_employee_documents`
SET `rm_aprobacion_estado` = 'PENDIENTE'
WHERE `rm_solicitado` = 1
  AND `tipo_documento` = 'RENUNCIA_RM'
  AND (`rm_aprobacion_estado` IS NULL OR `rm_aprobacion_estado` = '');
