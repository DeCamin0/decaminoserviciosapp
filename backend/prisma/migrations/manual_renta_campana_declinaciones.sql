-- Declinaciones explícitas (no quiero la renta con gestoría) — aviso gestoría solo Telegram
-- Ejecutar en las mismas bases que renta_campana_solicitudes, p. ej.:
--   mysql ... < manual_renta_campana_declinaciones.sql

CREATE TABLE IF NOT EXISTS renta_campana_declinaciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_codigo VARCHAR(50) NOT NULL,
  campaign_key VARCHAR(50) NOT NULL DEFAULT 'renta_2025',
  nombre_snapshot VARCHAR(255) NULL,
  created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_renta_campana_decl_user_campaign (user_codigo, campaign_key),
  KEY idx_renta_campana_decl_campaign (campaign_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
