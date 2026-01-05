-- CreateTable
CREATE TABLE `FichajeRegularizacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_codigo` VARCHAR(50) NOT NULL,
    `workday_date` DATE NOT NULL,
    `window_start` DATETIME(0) NOT NULL,
    `window_end` DATETIME(0) NOT NULL,
    `fichaje_ids` TEXT NULL,
    `regularization_type` ENUM('NO_EXTRA', 'DECLARES_EXTRA', 'PUNCH_ERROR', 'AUTO_CLOSE', 'LEGACY') NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'NEEDS_REVIEW', 'REJECTED') NOT NULL,
    `scheduled_minutes` INTEGER NOT NULL,
    `punched_minutes` INTEGER NOT NULL,
    `effective_minutes` INTEGER NULL,
    `reason_code` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `created_by` VARCHAR(50) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `confirmed_at` TIMESTAMP(0) NULL,
    `reviewed_at` TIMESTAMP(0) NULL,
    `reviewed_by` VARCHAR(50) NULL,
    `ip_address` VARCHAR(100) NULL,
    `user_agent` TEXT NULL,

    UNIQUE INDEX `uq_emp_window_start`(`employee_codigo`, `window_start`),
    INDEX `idx_emp_workday`(`employee_codigo`, `workday_date`),
    INDEX `idx_regularizacion_status`(`status`),
    INDEX `idx_workday_date`(`workday_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

