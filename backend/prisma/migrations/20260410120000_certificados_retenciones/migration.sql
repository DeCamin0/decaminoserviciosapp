-- Certificados de retenciones (PDF por empleado), misma estructura que diplomas
CREATE TABLE `certificados_retenciones` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `empleado_id` VARCHAR(50) NOT NULL,
  `nombre_empleado` VARCHAR(500) NOT NULL,
  `nombre_archivo` VARCHAR(255) NOT NULL,
  `archivo` LONGBLOB NOT NULL,
  `fecha_subida` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `subido_por` VARCHAR(50) NOT NULL,
  `notas` TEXT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_cert_retencion_empleado` (`empleado_id`),
  INDEX `idx_cert_retencion_fecha` (`fecha_subida`)
);
