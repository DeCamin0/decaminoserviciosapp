-- DocumentosOficiales R2: dual-read metadata (archivo becomes nullable)
ALTER TABLE `DocumentosOficiales`
  MODIFY COLUMN `archivo` LONGBLOB NULL,
  ADD COLUMN `storage_key` VARCHAR(700) NULL,
  ADD COLUMN `storage_bucket` VARCHAR(120) NULL,
  ADD COLUMN `tamano_bytes` BIGINT NULL;

CREATE INDEX `idx_docs_oficiales_storage_key` ON `DocumentosOficiales` (`storage_key`);
