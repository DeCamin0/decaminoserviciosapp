-- Cita RM: asignable desde Matrix PRL (admin) y panel share (Noemi/Ancara)
ALTER TABLE `prl_employee_documents`
  ADD COLUMN `rm_cita_fecha` DATE NULL DEFAULT NULL
    AFTER `rm_rechazo_motivo`,
  ADD COLUMN `rm_cita_hora` VARCHAR(10) NULL DEFAULT NULL
    AFTER `rm_cita_fecha`,
  ADD COLUMN `rm_cita_asignada_por` VARCHAR(100) NULL DEFAULT NULL
    AFTER `rm_cita_hora`,
  ADD COLUMN `rm_cita_asignada_en` TIMESTAMP NULL DEFAULT NULL
    AFTER `rm_cita_asignada_por`;

CREATE INDEX `idx_prl_emp_doc_rm_cita_fecha`
  ON `prl_employee_documents` (`rm_cita_fecha`);
