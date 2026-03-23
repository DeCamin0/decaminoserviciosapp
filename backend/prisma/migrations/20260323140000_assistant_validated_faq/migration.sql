-- FAQ validate înainte de LLM + proveniență mesaj assistant
CREATE TABLE `assistant_validated_faq` (
    `id` VARCHAR(36) NOT NULL,
    `question_hash` VARCHAR(64) NOT NULL,
    `normalized_question` VARCHAR(512) NOT NULL,
    `intent` VARCHAR(64) NOT NULL,
    `locale` VARCHAR(16) NOT NULL,
    `reply_text` TEXT NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `answer_source` VARCHAR(120) NULL,
    `source_type` VARCHAR(64) NULL,
    `is_high_risk` BOOLEAN NULL,
    `response_type` VARCHAR(64) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `uq_assistant_validated_faq_hash_intent_locale`(`question_hash`, `intent`, `locale`),
    INDEX `idx_assistant_faq_intent_active`(`intent`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `assistant_messages` ADD COLUMN `response_source` VARCHAR(32) NULL;
