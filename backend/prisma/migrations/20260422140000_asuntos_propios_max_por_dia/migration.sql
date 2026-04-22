CREATE TABLE `asuntos_propios_disponibilidad_config` (
  `id` INT NOT NULL,
  `max_personas_dia` INT NOT NULL DEFAULT 3,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

INSERT INTO `asuntos_propios_disponibilidad_config` (`id`, `max_personas_dia`) VALUES (1, 3);
