-- Create MaterialesDocumentos table for storing albaranes/facturas from "Entrega de Materiales" inspections
-- This table stores documents (albaranes/facturas) associated with material deliveries

CREATE TABLE `MaterialesDocumentos` (
  `doc_id` INTEGER NOT NULL AUTO_INCREMENT,
  `inspeccion_id` VARCHAR(50) NOT NULL,
  `material_index` INTEGER NOT NULL,
  `tipo_documento` VARCHAR(50) NULL,
  `nombre_archivo` VARCHAR(255) NULL,
  `archivo` LONGBLOB NULL,
  `fecha_creacion` VARCHAR(50) NULL DEFAULT (current_timestamp()),
  `codigo_empleado` VARCHAR(50) NULL,
  `nombre_empleado` VARCHAR(150) NULL,
  `descripcion_material` VARCHAR(500) NULL,

  PRIMARY KEY (`doc_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create indexes for performance
CREATE INDEX `idx_materiales_inspeccion` ON `MaterialesDocumentos` (`inspeccion_id`);
CREATE INDEX `idx_materiales_empleado` ON `MaterialesDocumentos` (`codigo_empleado`);
