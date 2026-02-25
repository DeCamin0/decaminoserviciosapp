-- CreateTable
CREATE TABLE `informes_factura_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tasa_iva` DECIMAL(5, 2) NOT NULL DEFAULT 21,
    `tasa_descuento` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `incluir_descripcion` TINYINT NOT NULL DEFAULT 1,
    `filas_articulo` INTEGER NOT NULL DEFAULT 3,
    `titulo_empresa` VARCHAR(500) NULL,
    `direccion_empresa` VARCHAR(500) NULL,
    `cp_poblacion_empresa` VARCHAR(200) NULL,
    `email_empresa` VARCHAR(255) NULL,
    `telefono_empresa` VARCHAR(100) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Insert default row (id=1)
INSERT INTO `informes_factura_config` (`id`, `tasa_iva`, `tasa_descuento`, `incluir_descripcion`, `filas_articulo`, `updated_at`) VALUES (1, 21, 0, 1, 3, CURRENT_TIMESTAMP(0));
