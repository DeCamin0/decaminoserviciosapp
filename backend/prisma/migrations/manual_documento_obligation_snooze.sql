-- Evidență modal documente obligatorii (soft → hard după 3 Más tarde)
-- Run pe ambele baze:
--   node scripts/run-documento-obligation-snooze-migration.js .env.decamino.local
--   node scripts/run-documento-obligation-snooze-migration.js .env.hera.local

CREATE TABLE IF NOT EXISTS `documento_obligation_snooze` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `codigo_empleado` VARCHAR(50) NOT NULL,
  `apariciones` INT NOT NULL DEFAULT 0,
  `snooze_count` INT NOT NULL DEFAULT 0,
  `last_shown_at` DATETIME NULL,
  `last_snooze_at` DATETIME NULL,
  `hard_locked_at` DATETIME NULL,
  `resolved_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_documento_obligation_codigo` (`codigo_empleado`),
  KEY `idx_documento_obligation_snooze_count` (`snooze_count`),
  KEY `idx_documento_obligation_hard` (`hard_locked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
