-- CreateTable: leads (MVP lead generation, Spain / public directories)
CREATE TABLE `leads` (
    `id` VARCHAR(36) NOT NULL,
    `company_name` VARCHAR(500) NOT NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(64) NULL,
    `website` VARCHAR(500) NULL,
    `category` VARCHAR(120) NOT NULL,
    `country` VARCHAR(8) NOT NULL DEFAULT 'ES',
    `province` VARCHAR(120) NULL,
    `city` VARCHAR(120) NULL,
    `source_name` VARCHAR(64) NOT NULL,
    `source_url` TEXT NULL,
    `scraped_at` DATETIME(0) NULL,
    `dedupe_key` VARCHAR(191) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'new',
    `notes` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `leads_dedupe_key_key`(`dedupe_key`),
    INDEX `idx_leads_country_province_city`(`country`, `province`, `city`),
    INDEX `idx_leads_category`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
