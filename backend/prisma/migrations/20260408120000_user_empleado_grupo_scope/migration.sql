-- Ámbito empleados por usuario (solo gestiona GRUPOs listados). Sin filas = acceso completo como hasta ahora.
CREATE TABLE `user_empleado_grupo_scope` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_codigo` VARCHAR(50) NOT NULL,
  `grupo` VARCHAR(200) NOT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_empleado_grupo_scope` (`user_codigo`, `grupo`),
  KEY `idx_user_empleado_grupo_scope_user` (`user_codigo`)
);
