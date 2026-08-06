-- Avatar R2: dual-read metadata (AVATAR becomes nullable after ALTER)
-- Apply on BOTH DBs via:
--   node scripts/run-avatar-r2-migration.js .env.decamino.local
--   node scripts/run-avatar-r2-migration.js .env.hera.local

ALTER TABLE `Avatar`
  MODIFY COLUMN `AVATAR` LONGBLOB NULL,
  ADD COLUMN `storage_key` VARCHAR(700) NULL,
  ADD COLUMN `storage_bucket` VARCHAR(120) NULL,
  ADD COLUMN `tamano_bytes` INT NULL;

CREATE INDEX `idx_avatar_storage_key` ON `Avatar` (`storage_key`);
