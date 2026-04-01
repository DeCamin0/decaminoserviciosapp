-- Contacto de emergencia (accidente, ausencia no justificada, etc.)
-- Aplicar en AMBAS bases: decamino_db y hera_facility_db (ver .cursor/rules multi-client-databases.mdc)
--
-- mysql -u ... -p decamino_db < manual_contacto_emergencia_datos_empleados.sql
-- mysql -u ... -p hera_facility_db < manual_contacto_emergencia_datos_empleados.sql

ALTER TABLE `DatosEmpleados`
  ADD COLUMN `CONTACTO_EMERGENCIA_NOMBRE` VARCHAR(200) NULL,
  ADD COLUMN `CONTACTO_EMERGENCIA_PARENTESCO` VARCHAR(120) NULL,
  ADD COLUMN `CONTACTO_EMERGENCIA_TELEFONO` VARCHAR(40) NULL,
  ADD COLUMN `CONTACTO_EMERGENCIA_ACTUALIZADO_AT` DATETIME(3) NULL;
