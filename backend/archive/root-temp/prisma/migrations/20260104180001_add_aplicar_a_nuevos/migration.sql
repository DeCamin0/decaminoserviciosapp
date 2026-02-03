-- AlterTable: Add aplicar_a_nuevos column to documentos_solicitados
ALTER TABLE `documentos_solicitados` 
ADD COLUMN `aplicar_a_nuevos` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Si true, se aplica automáticamente a futuros empleados activos';

-- Add index for better query performance
CREATE INDEX `idx_documentos_solicitados_aplicar_a_nuevos` ON `documentos_solicitados` (`aplicar_a_nuevos`);

