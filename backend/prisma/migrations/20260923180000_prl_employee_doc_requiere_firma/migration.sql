-- Per-employee signature requirement (snapshot from template + admin toggle)
ALTER TABLE `prl_employee_documents`
  ADD COLUMN `requiere_firma` TINYINT(1) NOT NULL DEFAULT 0
  AFTER `estado`;

UPDATE `prl_employee_documents` ed
INNER JOIN `prl_document_templates` t ON ed.`template_id` = t.`id`
SET ed.`requiere_firma` = IFNULL(t.`requiere_firma`, 0);
