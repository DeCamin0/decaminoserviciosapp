-- Control-plane: tabele registry tenants (pot fi în baza aplicației dacă userul MySQL nu poate CREATE DATABASE).
-- Recomandat: npm run db:setup-tenant-registry (folosește DB_NAME din .env).
-- Sau: mysql -h ... -u ... -p decamino_db < migrations/tenant_registry_tables.sql

CREATE TABLE IF NOT EXISTS tenants (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(64) NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  notes TEXT NULL,
  plan VARCHAR(64) NULL,
  database_name VARCHAR(64) NOT NULL,
  database_user VARCHAR(64) NOT NULL,
  database_password_enc TEXT NOT NULL,
  status ENUM('provisioning', 'active', 'failed', 'inactive') NOT NULL DEFAULT 'provisioning',
  last_error TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tenants_slug (slug),
  UNIQUE KEY uq_tenants_database (database_name),
  KEY idx_tenants_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tenant_provision_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  level VARCHAR(16) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tpl_tenant (tenant_id),
  CONSTRAINT fk_tpl_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
