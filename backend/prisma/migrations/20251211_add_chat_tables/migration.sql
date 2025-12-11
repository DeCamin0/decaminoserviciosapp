-- Create chat_rooms
CREATE TABLE `chat_rooms` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `firma_id` BIGINT NOT NULL,
  `tipo` ENUM('centro','dm') NOT NULL,
  `centro_id` BIGINT NULL,
  `created_by` BIGINT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_chat_rooms_firma` (`firma_id`),
  INDEX `idx_chat_rooms_centro` (`centro_id`),
  INDEX `idx_chat_rooms_tipo` (`tipo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create chat_room_members
CREATE TABLE `chat_room_members` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `room_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `rol_in_room` ENUM('member','supervisor','admin') NOT NULL DEFAULT 'member',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_chat_room_member_room_user` (`room_id`, `user_id`),
  INDEX `idx_chat_room_member_user` (`user_id`),
  CONSTRAINT `fk_chat_room_members_room` FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create chat_messages
CREATE TABLE `chat_messages` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `room_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `message` TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_chat_messages_room_created` (`room_id`, `created_at`),
  INDEX `idx_chat_messages_user` (`user_id`),
  CONSTRAINT `fk_chat_messages_room` FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

