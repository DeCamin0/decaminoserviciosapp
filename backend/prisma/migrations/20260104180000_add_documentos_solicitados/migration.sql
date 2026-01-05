-- CreateTable
CREATE TABLE `documentos_solicitados` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` VARCHAR(50) NOT NULL,
    `tipo_documento` VARCHAR(255) NOT NULL,
    `estado` VARCHAR(50) NOT NULL DEFAULT 'pendiente',
    `fecha_solicitud` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `fecha_completado` TIMESTAMP(0) NULL,
    `solicitado_por` VARCHAR(50) NOT NULL,
    `notas` TEXT NULL,

    INDEX `idx_documentos_solicitados_empleado`(`empleado_id`),
    INDEX `idx_documentos_solicitados_estado`(`estado`),
    INDEX `idx_documentos_solicitados_tipo`(`tipo_documento`),
    INDEX `idx_documentos_solicitados_empleado_estado`(`empleado_id`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

