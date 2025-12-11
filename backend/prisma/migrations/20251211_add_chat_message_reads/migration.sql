-- Create chat_message_reads table for read receipts
CREATE TABLE `chat_message_reads` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `message_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `read_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_chat_message_read_message_user` (`message_id`, `user_id`),
  INDEX `idx_chat_message_read_message` (`message_id`),
  INDEX `idx_chat_message_read_user` (`user_id`),
  CONSTRAINT `fk_chat_message_reads_message` FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

