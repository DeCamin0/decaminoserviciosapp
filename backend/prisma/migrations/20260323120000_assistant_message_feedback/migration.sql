-- CreateTable: feedback utilizator pe mesaje assistant (un rând per utilizator per mesaj)
CREATE TABLE `assistant_message_feedback` (
    `id` VARCHAR(36) NOT NULL,
    `message_id` VARCHAR(36) NOT NULL,
    `conversation_id` VARCHAR(36) NOT NULL,
    `usuario_id` VARCHAR(50) NOT NULL,
    `rating` VARCHAR(20) NOT NULL,
    `comment` MEDIUMTEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_assistant_feedback_msg_user`(`message_id`, `usuario_id`),
    INDEX `idx_assistant_feedback_user`(`usuario_id`),
    INDEX `idx_assistant_feedback_conv`(`conversation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `assistant_message_feedback` ADD CONSTRAINT `fk_assistant_feedback_message` FOREIGN KEY (`message_id`) REFERENCES `assistant_messages`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
