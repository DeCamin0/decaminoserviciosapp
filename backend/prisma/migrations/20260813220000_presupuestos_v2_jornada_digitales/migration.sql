-- Presupuestos V2 Paso 5.3: jornada on option + servicios digitales on document

ALTER TABLE `v2_presupuesto_servicio_opciones`
  ADD COLUMN `jornada_json` JSON NULL AFTER `descripcion_local`;

ALTER TABLE `v2_presupuestos`
  ADD COLUMN `servicios_digitales_json` JSON NULL AFTER `cliente_overrides_json`,
  ADD COLUMN `snapshot_servicios_digitales_json` JSON NULL AFTER `snapshot_economico_json`;

-- Seed configurable combined commercial service (idempotent)
INSERT INTO `v2_servicios_comerciales` (
  `codigo_interno`,
  `nombre`,
  `descripcion`,
  `categoria`,
  `codigo_motor`,
  `brand_id`,
  `activo`,
  `orden`,
  `defaults_json`,
  `contenido_comercial_json`
)
SELECT
  'auxiliar_limpieza',
  'Auxiliar de Servicios y Limpieza',
  'Misma jornada y persona: tareas de auxiliar/conserjería y de limpieza. Un solo precio comercial.',
  'combinado',
  'auxiliares_coste',
  NULL,
  1,
  15,
  JSON_OBJECT(
    'horasDiarias', 8,
    'diasPorSemana', 5,
    'horasACubrirPorSemana', 39,
    'sinFestivos', true,
    'productosLimpieza', JSON_OBJECT('b', 30, 'c', 12),
    'limpiezaGajare', JSON_OBJECT('b', 300, 'c', 1),
    'acristalado', JSON_OBJECT('b', 125, 'c', 4),
    'cristalero', JSON_OBJECT('b', 90, 'c', 0)
  ),
  JSON_OBJECT(
    'titulo_comercial', 'Auxiliar de Servicios y Limpieza',
    'descripcion_comercial', 'Servicio combinado de auxiliar de servicios y limpieza en la misma jornada.',
    'template_key', 'auxiliar_limpieza',
    'tareas_auxiliares', JSON_ARRAY(
      'Control de accesos y supervisión de personas ajenas a la finca.',
      'Atención y asistencia a residentes.',
      'Rondas preventivas y comunicación de incidencias.'
    ),
    'tareas_limpieza', JSON_ARRAY(
      'Limpieza y mantenimiento de zonas comunes.',
      'Limpieza de portales, escaleras y accesos.',
      'Reposición de consumibles según acuerdo.'
    ),
    'tareas', JSON_ARRAY(),
    'operativa', JSON_ARRAY(
      'Misma persona y misma jornada para auxiliar y limpieza.'
    ),
    'servicios_periodicos', JSON_ARRAY(
      JSON_OBJECT('nombre', 'Cristales', 'periodicidad', 'trimestral', 'descripcion', 'Incluido en el precio', 'orden', 0),
      JSON_OBJECT('nombre', 'Abrillantado', 'periodicidad', 'anual', 'descripcion', 'Incluido en el precio', 'orden', 1),
      JSON_OBJECT('nombre', 'Limpieza de garaje', 'periodicidad', 'anual', 'descripcion', 'Incluido en el precio', 'orden', 2)
    ),
    'condiciones_especificas', JSON_ARRAY()
  )
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `v2_servicios_comerciales` WHERE `codigo_interno` = 'auxiliar_limpieza'
);
