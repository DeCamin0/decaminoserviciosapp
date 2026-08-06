-- Certificados de retenciones R2: dual-read metadata (archivo becomes nullable)
ALTER TABLE `certificados_retenciones`
  MODIFY COLUMN `archivo` LONGBLOB NULL,
  ADD COLUMN `storage_key` VARCHAR(700) NULL,
  ADD COLUMN `storage_bucket` VARCHAR(120) NULL,
  ADD COLUMN `tamano_bytes` BIGINT NULL;

CREATE INDEX `idx_cert_retencion_storage_key` ON `certificados_retenciones` (`storage_key`);
