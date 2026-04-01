-- Registry only: add optional public API URL and environment label for super-admin observability.
-- Apply on every database that hosts the `tenants` registry table (see docs/SUPER-ADMIN-TENANTS.md).
-- Rollback: ALTER TABLE tenants DROP COLUMN environment, DROP COLUMN api_public_url;

ALTER TABLE tenants
  ADD COLUMN api_public_url VARCHAR(512) NULL DEFAULT NULL COMMENT 'Public API base URL for health checks' AFTER plan,
  ADD COLUMN environment VARCHAR(32) NULL DEFAULT NULL COMMENT 'e.g. production, staging' AFTER api_public_url;
