-- Diplomas R2: dual-read metadata (archivo becomes nullable after ALTER)
-- Apply on BOTH DBs via:
--   node scripts/run-diplomas-r2-migration.js .env.decamino.local
--   node scripts/run-diplomas-r2-migration.js .env.hera.local

ALTER TABLE `diplomas`
  MODIFY COLUMN `archivo` LONGBLOB NULL,
  ADD COLUMN `storage_key` VARCHAR(700) NULL,
  ADD COLUMN `storage_bucket` VARCHAR(120) NULL,
  ADD COLUMN `tamano_bytes` INT NULL;

CREATE INDEX `idx_diploma_storage_key` ON `diplomas` (`storage_key`);
