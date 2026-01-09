-- AlterTable
-- Adaugă coloana codigo_supervisor înainte de "Nombre Supervisor"
ALTER TABLE `InspeccionesDocumentos` ADD COLUMN `codigo_supervisor` VARCHAR(50) NULL AFTER `fecha_subida`;
