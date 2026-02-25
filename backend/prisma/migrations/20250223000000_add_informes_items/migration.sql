-- CreateTable
CREATE TABLE `informes_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `item_id` VARCHAR(50) NOT NULL,
    `nombre` VARCHAR(500) NOT NULL,
    `descripcion` TEXT NULL,
    `precio` DECIMAL(12, 2) NOT NULL,
    `observaciones` VARCHAR(500) NULL,
    `activo` TINYINT NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `uniq_informes_items_item_id`(`item_id`),
    INDEX `idx_informes_items_activo`(`activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
