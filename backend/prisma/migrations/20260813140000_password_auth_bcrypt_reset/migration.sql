-- Additive only: AUTH_VERSION on DatosEmpleados + password_reset_tokens.
-- No DROP / destructive MODIFY on existing auth columns.

ALTER TABLE `DatosEmpleados`
  ADD COLUMN `AUTH_VERSION` INT NOT NULL DEFAULT 0;

CREATE TABLE `password_reset_tokens` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_codigo` VARCHAR(50) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `request_ip` VARCHAR(64) NULL,
  `user_agent` VARCHAR(512) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `password_reset_tokens_token_hash_key` (`token_hash`),
  INDEX `prt_user_idx` (`user_codigo`),
  INDEX `prt_expires_idx` (`expires_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
