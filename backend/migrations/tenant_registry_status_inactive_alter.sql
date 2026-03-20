-- Rulează o dată pe baza unde există deja tabela `tenants` (ex. decamino_db).
-- npm run db:tenant-registry-inactive

ALTER TABLE tenants
MODIFY COLUMN status ENUM('provisioning', 'active', 'failed', 'inactive')
  NOT NULL DEFAULT 'provisioning';
