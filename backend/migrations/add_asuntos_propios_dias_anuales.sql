-- Días anuales de Asuntos Propios (toda la empresa), configurable desde el modal de bloqueo.
-- Antes estaba hardcodeado a 6 en el frontend.
--
-- Aplicar:
--   node scripts/run-asuntos-propios-config-migration.js .env.decamino.local
--   node scripts/run-asuntos-propios-config-migration.js .env.hera.local
-- (el script también seed-ea asuntos-propios en Access Matrix)

ALTER TABLE asuntos_propios_disponibilidad_config
  ADD COLUMN dias_anuales INT NOT NULL DEFAULT 6
  COMMENT 'Días de Asunto Propio por empleado/año (global empresa)';

INSERT INTO asuntos_propios_disponibilidad_config (id, max_personas_dia, dias_anuales)
VALUES (1, 3, 6)
ON DUPLICATE KEY UPDATE id = id;
