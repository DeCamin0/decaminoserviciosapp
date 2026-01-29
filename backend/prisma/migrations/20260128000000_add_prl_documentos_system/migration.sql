-- Create PRL Documentos System
-- Sistema de gestión de documentos PRL obligatorios por puesto (GRUPO)

-- Create Enums
-- Note: MySQL doesn't support enums like PostgreSQL, so we'll use VARCHAR with CHECK constraints
-- Prisma will handle the enum mapping in the application layer

-- Create PrlDocumentTemplate table
CREATE TABLE `prl_document_templates` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `grupo_nombre` VARCHAR(200) NOT NULL,
  `tipo_documento` ENUM('EVALUACION_RIESGOS', 'ACTA_INFORMATIVA', 'ENTREGA_EPIS', 'RENUNCIA_RM', 'MANUAL_TEST') NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `archivo` LONGBLOB NOT NULL,
  `nombre_archivo` VARCHAR(255) NOT NULL,
  `requiere_firma` BOOLEAN NOT NULL DEFAULT false,
  `es_renuncia_rm` BOOLEAN NOT NULL DEFAULT false,
  `es_manual_test` BOOLEAN NOT NULL DEFAULT false,
  `version` INTEGER NOT NULL DEFAULT 1,
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create PrlEmployeeDocument table
CREATE TABLE `prl_employee_documents` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `empleado_id` VARCHAR(50) NOT NULL,
  `grupo_nombre` VARCHAR(200) NOT NULL,
  `template_id` INTEGER NOT NULL,
  `tipo_documento` ENUM('EVALUACION_RIESGOS', 'ACTA_INFORMATIVA', 'ENTREGA_EPIS', 'RENUNCIA_RM', 'MANUAL_TEST') NOT NULL,
  `estado` ENUM('PENDIENTE', 'FIRMADO', 'RECHAZADO', 'NO_APLICA', 'INFORMATIVO') NOT NULL DEFAULT 'PENDIENTE',
  
  -- Documento original (template)
  `archivo_original` LONGBLOB NULL,
  `nombre_archivo_original` VARCHAR(255) NULL,
  
  -- Documento firmado (si aplica)
  `archivo_firmado` LONGBLOB NULL,
  `nombre_archivo_firmado` VARCHAR(255) NULL,
  `fecha_firma` TIMESTAMP(0) NULL,
  `ip_firma` VARCHAR(100) NULL,
  
  -- Para Manual + Test
  `test_completado` BOOLEAN NOT NULL DEFAULT false,
  `test_fecha_completado` TIMESTAMP(0) NULL,
  `test_puntuacion` INTEGER NULL,
  `certificado_archivo` LONGBLOB NULL,
  `certificado_nombre` VARCHAR(255) NULL,
  `certificado_fecha` TIMESTAMP(0) NULL,
  
  -- Metadata
  `asignado_por` VARCHAR(50) NOT NULL,
  `asignado_en` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `notas` TEXT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create PrlAuditLog table
CREATE TABLE `prl_audit_logs` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `employee_doc_id` INTEGER NOT NULL,
  `usuario_id` VARCHAR(50) NOT NULL,
  `accion` ENUM('DESCARGADO', 'VISUALIZADO', 'FIRMADO', 'TEST_COMPLETADO', 'CERTIFICADO_UPLOAD', 'RECHAZADO') NOT NULL,
  `ip_address` VARCHAR(100) NULL,
  `user_agent` TEXT NULL,
  `detalles` TEXT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create Foreign Keys
ALTER TABLE `prl_employee_documents` ADD CONSTRAINT `fk_prl_emp_doc_template` FOREIGN KEY (`template_id`) REFERENCES `prl_document_templates` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `prl_audit_logs` ADD CONSTRAINT `fk_prl_audit_emp_doc` FOREIGN KEY (`employee_doc_id`) REFERENCES `prl_employee_documents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Create Indexes for PrlDocumentTemplate
CREATE INDEX `idx_prl_template_grupo` ON `prl_document_templates` (`grupo_nombre`);
CREATE INDEX `idx_prl_template_tipo` ON `prl_document_templates` (`tipo_documento`);
CREATE INDEX `idx_prl_template_activo` ON `prl_document_templates` (`activo`);
CREATE UNIQUE INDEX `idx_prl_template_grupo_tipo` ON `prl_document_templates` (`grupo_nombre`, `tipo_documento`);

-- Create Indexes for PrlEmployeeDocument
CREATE INDEX `idx_prl_emp_doc_empleado` ON `prl_employee_documents` (`empleado_id`);
CREATE INDEX `idx_prl_emp_doc_grupo` ON `prl_employee_documents` (`grupo_nombre`);
CREATE INDEX `idx_prl_emp_doc_template` ON `prl_employee_documents` (`template_id`);
CREATE INDEX `idx_prl_emp_doc_estado` ON `prl_employee_documents` (`estado`);
CREATE INDEX `idx_prl_emp_doc_emp_estado` ON `prl_employee_documents` (`empleado_id`, `estado`);
CREATE INDEX `idx_prl_emp_doc_tipo` ON `prl_employee_documents` (`tipo_documento`);

-- Create Indexes for PrlAuditLog
CREATE INDEX `idx_prl_audit_doc` ON `prl_audit_logs` (`employee_doc_id`);
CREATE INDEX `idx_prl_audit_usuario` ON `prl_audit_logs` (`usuario_id`);
CREATE INDEX `idx_prl_audit_accion` ON `prl_audit_logs` (`accion`);
CREATE INDEX `idx_prl_audit_created` ON `prl_audit_logs` (`created_at`);
