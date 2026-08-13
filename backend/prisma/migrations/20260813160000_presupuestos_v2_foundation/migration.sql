-- Presupuestos V2 foundation (parallel to Legacy; does not alter Legacy tables)

CREATE TABLE `v2_motores_calculo` (
    `codigo` VARCHAR(64) NOT NULL,
    `label_ui` VARCHAR(200) NOT NULL,
    `descripcion` TEXT NULL,
    `version_motor` VARCHAR(20) NOT NULL DEFAULT '1',
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    PRIMARY KEY (`codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `v2_companies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(64) NOT NULL,
    `legal_name` VARCHAR(500) NOT NULL,
    `cif` VARCHAR(50) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    UNIQUE INDEX `v2_companies_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `v2_brands` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `codigo` VARCHAR(64) NOT NULL,
    `nombre` VARCHAR(200) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    INDEX `idx_v2_brand_company`(`company_id`),
    UNIQUE INDEX `uq_v2_brand_company_codigo`(`company_id`, `codigo`),
    PRIMARY KEY (`id`),
    CONSTRAINT `v2_brands_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `v2_companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `v2_series_numeracion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `brand_id` INTEGER NOT NULL,
    `codigo` VARCHAR(64) NOT NULL,
    `prefijo` VARCHAR(32) NOT NULL,
    `formato` VARCHAR(80) NOT NULL DEFAULT '{PREF}{YYYY}-{SEQ}',
    `padding` INTEGER NOT NULL DEFAULT 4,
    `reset_anual` BOOLEAN NOT NULL DEFAULT true,
    `anio_actual` INTEGER NULL,
    `siguiente_numero` INTEGER NOT NULL DEFAULT 1,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    INDEX `idx_v2_series_brand_activo`(`brand_id`, `activo`),
    UNIQUE INDEX `uq_v2_series_brand_codigo`(`brand_id`, `codigo`),
    PRIMARY KEY (`id`),
    CONSTRAINT `v2_series_numeracion_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `v2_brands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `v2_servicios_comerciales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo_interno` VARCHAR(64) NOT NULL,
    `nombre` VARCHAR(300) NOT NULL,
    `descripcion` TEXT NULL,
    `categoria` VARCHAR(120) NULL,
    `codigo_motor` VARCHAR(64) NOT NULL,
    `brand_id` INTEGER NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `defaults_json` JSON NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    UNIQUE INDEX `uq_v2_servicio_codigo`(`codigo_interno`),
    INDEX `idx_v2_servicio_activo_orden`(`activo`, `orden`),
    INDEX `idx_v2_servicio_motor`(`codigo_motor`),
    INDEX `idx_v2_servicio_brand`(`brand_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `v2_servicios_comerciales_codigo_motor_fkey` FOREIGN KEY (`codigo_motor`) REFERENCES `v2_motores_calculo`(`codigo`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `v2_servicios_comerciales_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `v2_brands`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `v2_presupuestos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estado` VARCHAR(32) NOT NULL DEFAULT 'BORRADOR',
    `numero` VARCHAR(64) NULL,
    `cliente_id` INTEGER NULL,
    `company_id` INTEGER NOT NULL,
    `brand_id` INTEGER NOT NULL,
    `created_by` VARCHAR(50) NULL,
    `updated_by` VARCHAR(50) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    UNIQUE INDEX `v2_presupuestos_numero_key`(`numero`),
    INDEX `idx_v2_presup_estado_updated`(`estado`, `updated_at`),
    INDEX `idx_v2_presup_cliente`(`cliente_id`),
    INDEX `idx_v2_presup_brand`(`brand_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `v2_presupuestos_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `v2_companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `v2_presupuestos_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `v2_brands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `v2_presupuesto_servicios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `presupuesto_id` INTEGER NOT NULL,
    `servicio_comercial_id` INTEGER NOT NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    UNIQUE INDEX `uq_v2_presup_servicio`(`presupuesto_id`, `servicio_comercial_id`),
    INDEX `idx_v2_presup_serv_presup`(`presupuesto_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `v2_presupuesto_servicios_presupuesto_id_fkey` FOREIGN KEY (`presupuesto_id`) REFERENCES `v2_presupuestos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `v2_presupuesto_servicios_servicio_comercial_id_fkey` FOREIGN KEY (`servicio_comercial_id`) REFERENCES `v2_servicios_comerciales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed motors (registry; not commercial services)
INSERT INTO `v2_motores_calculo` (`codigo`, `label_ui`, `descripcion`, `version_motor`, `activo`, `orden`) VALUES
('auxiliares_coste', 'Coste auxiliares (COSTE)', 'Motor de cálculo tipo conserjería / auxiliares', '1', true, 10),
('limpieza_coste', 'Coste limpieza (COSTE)', 'Motor de cálculo tipo limpieza de comunidades', '1', true, 20),
('precio_mensual', 'Precio mensual directo', 'Precio sin IVA negociado + IVA (jardinería, cubos, garaje, extras)', '1', true, 30),
('piscina', 'Piscina', 'Motor temporada / invernal / extras piscina', '1', true, 40);

-- Seed commercial services (editable data; not enums)
INSERT INTO `v2_servicios_comerciales` (`codigo_interno`, `nombre`, `descripcion`, `categoria`, `codigo_motor`, `activo`, `orden`) VALUES
('auxiliares', 'Auxiliares', 'Servicio de auxiliares / conserjería', 'Auxiliares', 'auxiliares_coste', true, 10),
('limpieza', 'Limpieza', 'Limpieza de comunidades', 'Limpieza', 'limpieza_coste', true, 20),
('jardineria', 'Jardinería', 'Mantenimiento de jardinería', 'Exterior', 'precio_mensual', true, 30),
('cubos', 'Cubos', 'Gestión de cubos de basura', 'Exterior', 'precio_mensual', true, 40),
('garaje', 'Garaje', 'Limpieza de garaje', 'Limpieza', 'precio_mensual', true, 50),
('piscina', 'Piscina', 'Mantenimiento de piscina comunitaria', 'Piscina', 'piscina', true, 60);
