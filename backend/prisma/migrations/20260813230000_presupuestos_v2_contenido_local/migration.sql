-- Presupuestos V2 Paso 5.4: contenido comercial local por línea de presupuesto

ALTER TABLE `v2_presupuesto_servicios`
  ADD COLUMN `contenido_comercial_json` JSON NULL AFTER `version_motor`;

-- Backfill from catalog template (existing lines start as plantilla copy)
UPDATE `v2_presupuesto_servicios` ps
INNER JOIN `v2_servicios_comerciales` sc ON sc.id = ps.servicio_comercial_id
SET ps.contenido_comercial_json = sc.contenido_comercial_json
WHERE ps.contenido_comercial_json IS NULL
  AND sc.contenido_comercial_json IS NOT NULL;
