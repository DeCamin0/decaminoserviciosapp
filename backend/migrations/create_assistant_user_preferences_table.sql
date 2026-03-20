-- Preferencias explícitas del asistente (opt-in). Sin inferencia desde conversaciones.
-- Aplicar en ambas bases (Decamino y HERA).

CREATE TABLE IF NOT EXISTS assistant_user_preferences (
  usuario_id VARCHAR(50) NOT NULL PRIMARY KEY,
  opted_in TINYINT(1) NOT NULL DEFAULT 0,
  locale VARCHAR(10) NULL COMMENT 'es|en|ro',
  response_style VARCHAR(20) NULL COMMENT 'short|normal|detailed',
  tone VARCHAR(20) NULL COMMENT 'professional|friendly',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
