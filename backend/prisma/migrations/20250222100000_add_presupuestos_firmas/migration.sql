-- CreateTable
CREATE TABLE `presupuestos_firmas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `presupuesto_id` INTEGER NOT NULL,
    `fecha_hora` VARCHAR(50) NOT NULL,
    `nombre_comunidad` VARCHAR(500) NOT NULL,
    `cif` VARCHAR(50) NOT NULL,
    `direccion` VARCHAR(1000) NOT NULL,
    `nombre_representante` VARCHAR(255) NOT NULL,
    `cargo` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `telefono` VARCHAR(50) NOT NULL,
    `firma_imagen_base64` LONGTEXT NOT NULL,
    `ip` VARCHAR(100) NULL,
    `user_agent` VARCHAR(500) NULL,
    `pdf_path` VARCHAR(500) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_presupuestos_firmas_presupuesto`(`presupuesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `presupuestos_firmas` ADD CONSTRAINT `presupuestos_firmas_presupuesto_id_fkey` FOREIGN KEY (`presupuesto_id`) REFERENCES `presupuestos_guardados`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
