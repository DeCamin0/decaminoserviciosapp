-- Nóminas R2 etapa 1: dual-read metadata (archivo LONGBLOB remains for legacy rows)
-- Apply on BOTH DBs: decamino_db and hera_facility_db
--
--   node scripts/run-nominas-r2-migration.js .env.decamino.local
--   node scripts/run-nominas-r2-migration.js .env.hera.local

ALTER TABLE `Nominas`
  ADD COLUMN `storage_key` VARCHAR(700) NULL,
  ADD COLUMN `storage_bucket` VARCHAR(120) NULL,
  ADD COLUMN `tamano_bytes` INT NULL;

CREATE INDEX `idx_nominas_storage_key` ON `Nominas` (`storage_key`);
