-- Create grupos_referencia table for managing group reference list
-- This table is independent from DatosEmpleados and won't affect n8n workflows
CREATE TABLE IF NOT EXISTS `grupos_referencia` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(200) NOT NULL,
  `activo` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_grupos_referencia_nombre` (`nombre`),
  INDEX `idx_grupos_referencia_activo` (`activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial groups from frontend hardcoded list
INSERT INTO `grupos_referencia` (`nombre`, `activo`) VALUES
  ('Administrativ', TRUE),
  ('Auxiliar De Servicios - C', TRUE),
  ('Auxiliar De Servicios - L', TRUE),
  ('Comercial', TRUE),
  ('Developer', TRUE),
  ('Especialista', TRUE),
  ('Informatico', TRUE),
  ('Limpiador', TRUE),
  ('Socorrista', TRUE),
  ('Supervisor', TRUE)
ON DUPLICATE KEY UPDATE `activo` = TRUE;

