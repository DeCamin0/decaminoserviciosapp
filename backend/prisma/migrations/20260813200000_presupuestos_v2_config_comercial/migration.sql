-- Presupuestos V2 Paso 4.2: contenido comercial + audit config

ALTER TABLE `v2_servicios_comerciales`
  ADD COLUMN `contenido_comercial_json` JSON NULL AFTER `defaults_json`;

CREATE TABLE `v2_config_audit` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `entity_type` VARCHAR(40) NOT NULL,
  `entity_id` VARCHAR(64) NOT NULL,
  `event_type` VARCHAR(80) NOT NULL,
  `payload_json` JSON NULL,
  `actor` VARCHAR(50) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  INDEX `idx_v2_config_audit_entity`(`entity_type`, `entity_id`),
  INDEX `idx_v2_config_audit_event`(`event_type`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed contenido comercial básico (editable desde UI)
UPDATE `v2_servicios_comerciales`
SET `contenido_comercial_json` = JSON_OBJECT(
  'titulo_comercial', 'Auxiliares de servicios',
  'descripcion_comercial', 'Servicio de auxiliares / conserjería para comunidades.',
  'operativa', JSON_ARRAY('Presencia y atención según el horario contratado.', 'Apoyo a la comunidad en las funciones acordadas.'),
  'tareas', JSON_ARRAY(),
  'condiciones_especificas', JSON_ARRAY(),
  'template_key', 'auxiliares'
)
WHERE `codigo_interno` = 'auxiliares';

UPDATE `v2_servicios_comerciales`
SET `contenido_comercial_json` = JSON_OBJECT(
  'titulo_comercial', 'Limpieza',
  'descripcion_comercial', 'Servicio de limpieza de comunidades.',
  'operativa', JSON_ARRAY('Ejecución según frecuencias y zonas contratadas.'),
  'tareas', JSON_ARRAY(),
  'condiciones_especificas', JSON_ARRAY(),
  'template_key', 'limpieza'
)
WHERE `codigo_interno` = 'limpieza';

UPDATE `v2_servicios_comerciales`
SET `contenido_comercial_json` = JSON_OBJECT(
  'titulo_comercial', 'Jardinería',
  'descripcion_comercial', 'Mantenimiento de zonas verdes.',
  'operativa', JSON_ARRAY(),
  'tareas', JSON_ARRAY(),
  'condiciones_especificas', JSON_ARRAY(),
  'template_key', 'jardineria'
)
WHERE `codigo_interno` = 'jardineria';

UPDATE `v2_servicios_comerciales`
SET `contenido_comercial_json` = JSON_OBJECT(
  'titulo_comercial', 'Gestión de cubos',
  'descripcion_comercial', 'Gestión de cubos de basura.',
  'operativa', JSON_ARRAY(),
  'tareas', JSON_ARRAY(),
  'condiciones_especificas', JSON_ARRAY(),
  'template_key', 'cubos'
)
WHERE `codigo_interno` = 'cubos';

UPDATE `v2_servicios_comerciales`
SET `contenido_comercial_json` = JSON_OBJECT(
  'titulo_comercial', 'Limpieza de garaje',
  'descripcion_comercial', 'Limpieza de garajes comunitarios.',
  'operativa', JSON_ARRAY(),
  'tareas', JSON_ARRAY(),
  'condiciones_especificas', JSON_ARRAY(),
  'template_key', 'garaje'
)
WHERE `codigo_interno` = 'garaje';

UPDATE `v2_servicios_comerciales`
SET `contenido_comercial_json` = JSON_OBJECT(
  'titulo_comercial', 'Mantenimiento de piscina',
  'descripcion_comercial', 'Mantenimiento integral de piscina comunitaria (temporada e invierno).',
  'operativa', JSON_ARRAY('Temporada de baño según calendario acordado.', 'Mantenimiento invernal opcional según oferta.'),
  'tareas', JSON_ARRAY(),
  'condiciones_especificas', JSON_ARRAY(),
  'template_key', 'piscina'
)
WHERE `codigo_interno` = 'piscina';
