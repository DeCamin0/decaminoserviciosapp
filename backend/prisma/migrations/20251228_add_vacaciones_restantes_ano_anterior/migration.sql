-- AlterTable: Add VACACIONES_RESTANTES_ANO_ANTERIOR column to DatosEmpleados
ALTER TABLE `DatosEmpleados` 
ADD COLUMN `VACACIONES_RESTANTES_ANO_ANTERIOR` DECIMAL(5,1) NULL DEFAULT NULL COMMENT 'Zile de vacanță rămase din anul anterior (manual)';

