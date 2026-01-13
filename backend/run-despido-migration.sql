-- Run this SQL script to add Despido Improcedente fields
-- Execute: mysql -h 217.154.102.115 -u facturacion_user -p decamino_db < run-despido-migration.sql

-- AlterTable: Adaugă câmpuri noi în solicitudes pentru Despido Improcedente
ALTER TABLE `solicitudes` 
ADD COLUMN `origen` VARCHAR(50) NULL DEFAULT 'EMPLEADO',
ADD COLUMN `fecha_efectiva` DATE NULL,
ADD COLUMN `comentario_empresa` TEXT NULL,
ADD COLUMN `created_by_user_id` VARCHAR(50) NULL,
ADD COLUMN `enviado_gestoria` BOOLEAN NULL DEFAULT FALSE,
ADD COLUMN `fecha_envio_gestoria` DATETIME(0) NULL;

-- AlterTable: Adaugă fecha_baja_programada în DatosEmpleados
ALTER TABLE `DatosEmpleados` 
ADD COLUMN `fecha_baja_programada` VARCHAR(100) NULL;
