-- CreateTable
CREATE TABLE `informes_firmas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `informe_id` INTEGER NOT NULL,
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

    INDEX `idx_informes_firmas_informe`(`informe_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `informes_firmas` ADD CONSTRAINT `informes_firmas_informe_id_fkey` FOREIGN KEY (`informe_id`) REFERENCES `informes_factura_config`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
