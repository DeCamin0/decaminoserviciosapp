-- Un singur rând (id=1): % din mărimea grupului care poate fi în vacanțe simultan aceeași zi.
-- Aplicar en AMBAS bases (Decamino + HERA):
--   node scripts/run-vacaciones-disponibilidad-config-migration.js .env.decamino.local
--   node scripts/run-vacaciones-disponibilidad-config-migration.js .env.hera.local

CREATE TABLE IF NOT EXISTS `vacaciones_disponibilidad_config` (
  `id` INT NOT NULL PRIMARY KEY DEFAULT 1,
  `porcentaje_grupo` DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `vacaciones_disponibilidad_config` (`id`, `porcentaje_grupo`) VALUES (1, 10.00);
