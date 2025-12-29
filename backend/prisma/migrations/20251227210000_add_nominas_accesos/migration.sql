-- CreateTable
CREATE TABLE `NominasAccesos` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nomina_id` INTEGER UNSIGNED NOT NULL,
    `empleado_codigo` VARCHAR(50) NOT NULL,
    `empleado_nombre` VARCHAR(255) NOT NULL,
    `tipo_acceso` VARCHAR(20) NOT NULL,
    `fecha_acceso` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `ip` VARCHAR(100) NULL,
    `user_agent` TEXT NULL,

    INDEX `idx_nomina_empleado`(`nomina_id`, `empleado_codigo`),
    INDEX `idx_fecha_acceso`(`fecha_acceso`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NominasAccesos` ADD CONSTRAINT `NominasAccesos_nomina_id_fkey` FOREIGN KEY (`nomina_id`) REFERENCES `Nominas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

