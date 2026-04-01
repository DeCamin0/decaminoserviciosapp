-- Campaña Renta 2025: flag de aviso + tabla de solicitudes
-- Aplicar en ambas bases (Decamino y HERA):
--   node scripts/run-renta-campana-2025-migration.js .env.decamino.local
--   node scripts/run-renta-campana-2025-migration.js .env.hera.local

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS renta_campana_solicitudes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_codigo VARCHAR(50) NOT NULL,
  campaign_key VARCHAR(50) NOT NULL DEFAULT 'renta_2025',
  nombre_snapshot VARCHAR(255) NULL,
  created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_renta_campana_user_campaign (user_codigo, campaign_key),
  KEY idx_renta_campana_campaign (campaign_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
