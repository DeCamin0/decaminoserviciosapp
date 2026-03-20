-- Tabele pentru arhiva conversațiilor assistant (ChatBot istoric).
-- Aplica pe AMBELE baze: Decamino și HERA.
--   node scripts/run-assistant-conversations-migration.js .env.decamino.local
--   node scripts/run-assistant-conversations-migration.js .env.hera.local

CREATE TABLE IF NOT EXISTS assistant_conversations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  usuario_id VARCHAR(50) NOT NULL,
  title VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_assistant_conv_user_updated (usuario_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assistant_messages (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  role VARCHAR(20) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_assistant_msg_conv_created (conversation_id, created_at),
  CONSTRAINT fk_assistant_msg_conversation
    FOREIGN KEY (conversation_id) REFERENCES assistant_conversations (id)
    ON DELETE CASCADE
    ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
