-- CarpetasDocumentos R2: dual-read metadata (archivo becomes nullable)
ALTER TABLE `CarpetasDocumentos`
  MODIFY COLUMN `archivo` LONGBLOB NULL,
  ADD COLUMN `storage_key` VARCHAR(700) NULL,
  ADD COLUMN `storage_bucket` VARCHAR(120) NULL,
  ADD COLUMN `tamano_bytes` BIGINT NULL;

CREATE INDEX `idx_carpetas_storage_key` ON `CarpetasDocumentos` (`storage_key`);
