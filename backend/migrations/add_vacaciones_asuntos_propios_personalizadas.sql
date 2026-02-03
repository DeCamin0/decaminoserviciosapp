-- Add columns for personalized annual vacation and asuntos propios days per employee
-- If NULL, use convenio values; if set, override convenio for that employee

ALTER TABLE `DatosEmpleados` 
ADD COLUMN `VACACIONES_ANUALES_PERSONALIZADAS` DECIMAL(5,1) NULL DEFAULT NULL 
  COMMENT 'Zile anuale de vacanțe personalizate pentru angajat (dacă NULL, folosește convenio)' 
  AFTER `VACACIONES_RESTANTES_ANO_ANTERIOR`;

ALTER TABLE `DatosEmpleados` 
ADD COLUMN `ASUNTOS_PROPIOS_ANUALES_PERSONALIZADAS` DECIMAL(5,1) NULL DEFAULT NULL 
  COMMENT 'Zile anuale de asuntos propios personalizate pentru angajat (dacă NULL, folosește convenio)' 
  AFTER `VACACIONES_ANUALES_PERSONALIZADAS`;
