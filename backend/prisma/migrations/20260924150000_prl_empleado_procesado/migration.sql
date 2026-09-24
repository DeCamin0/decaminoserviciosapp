CREATE TABLE IF NOT EXISTS `prl_empleado_procesado` (
  `empleado_id` VARCHAR(50) NOT NULL,
  `procesado` TINYINT(1) NOT NULL DEFAULT 0,
  `procesado_en` TIMESTAMP NULL DEFAULT NULL,
  `procesado_por` VARCHAR(100) NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empleado_id`),
  INDEX `idx_prl_emp_procesado_flag` (`procesado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
