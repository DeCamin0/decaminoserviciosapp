-- CreateTable
CREATE TABLE `presupuestos_guardados` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(500) NOT NULL,
    `cliente_id` INTEGER NULL,
    `cliente_nombre` VARCHAR(500) NULL,
    `payload` JSON NOT NULL,
    `created_by` VARCHAR(50) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `idx_presupuestos_guardados_created`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
