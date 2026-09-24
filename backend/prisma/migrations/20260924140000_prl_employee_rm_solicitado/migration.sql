-- Employee requested medical checkup (instead of signing Renuncia RM)
ALTER TABLE `prl_employee_documents`
  ADD COLUMN `rm_solicitado` TINYINT(1) NOT NULL DEFAULT 0
  AFTER `requiere_firma`,
  ADD COLUMN `rm_solicitado_en` TIMESTAMP NULL DEFAULT NULL
  AFTER `rm_solicitado`;
