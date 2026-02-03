-- Migration: Create coste_personal table
-- Date: 2025-12-28

CREATE TABLE IF NOT EXISTS `coste_personal` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo_empleado` VARCHAR(50) NOT NULL,
  `nombre_empleado` VARCHAR(255) NOT NULL,
  `mes` VARCHAR(20) NOT NULL,
  `ano` INT NOT NULL,
  `total` DECIMAL(10,2) DEFAULT 0,
  `neto` DECIMAL(10,2) DEFAULT 0,
  `aportaciones_trabajador` DECIMAL(10,2) DEFAULT 0,
  `irpf` DECIMAL(10,2) DEFAULT 0,
  `enfermedad_devolucion` DECIMAL(10,2) DEFAULT 0,
  `embargos` DECIMAL(10,2) DEFAULT 0,
  `anticipo` DECIMAL(10,2) DEFAULT 0,
  `absentismo_laboral` DECIMAL(10,2) DEFAULT 0,
  `seg_social_empresa` DECIMAL(10,2) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_coste_empleado_mes_ano` (`codigo_empleado`, `mes`, `ano`),
  KEY `idx_coste_codigo` (`codigo_empleado`),
  KEY `idx_coste_mes_ano` (`mes`, `ano`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

