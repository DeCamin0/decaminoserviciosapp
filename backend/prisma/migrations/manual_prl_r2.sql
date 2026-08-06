-- PRL R2: dual-read/write metadata (blobs become nullable)
-- Apply on BOTH DBs via:
--   node scripts/run-prl-r2-migration.js .env.decamino.local
--   node scripts/run-prl-r2-migration.js .env.hera.local

ALTER TABLE `prl_document_templates`
  MODIFY COLUMN `archivo` LONGBLOB NULL,
  ADD COLUMN `storage_key` VARCHAR(700) NULL,
  ADD COLUMN `storage_bucket` VARCHAR(120) NULL,
  ADD COLUMN `tamano_bytes` INT NULL;

CREATE INDEX `idx_prl_template_storage_key` ON `prl_document_templates` (`storage_key`);

ALTER TABLE `prl_employee_documents`
  MODIFY COLUMN `archivo_original` LONGBLOB NULL,
  MODIFY COLUMN `archivo_firmado` LONGBLOB NULL,
  ADD COLUMN `storage_key_original` VARCHAR(700) NULL,
  ADD COLUMN `storage_bucket_original` VARCHAR(120) NULL,
  ADD COLUMN `tamano_bytes_original` INT NULL,
  ADD COLUMN `storage_key_firmado` VARCHAR(700) NULL,
  ADD COLUMN `storage_bucket_firmado` VARCHAR(120) NULL,
  ADD COLUMN `tamano_bytes_firmado` INT NULL;

CREATE INDEX `idx_prl_emp_doc_storage_key_original` ON `prl_employee_documents` (`storage_key_original`);
CREATE INDEX `idx_prl_emp_doc_storage_key_firmado` ON `prl_employee_documents` (`storage_key_firmado`);
