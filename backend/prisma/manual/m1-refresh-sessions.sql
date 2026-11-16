-- m1: sesiuni de refresh, câte una pe login.
-- Logout revocă rândul. Schimbarea parolei le revocă pe toate ale angajatului.
-- Nu modifică Fichaje și nu șterge date.
-- Aplicat 2026-11-10 pe decamino_db și hera_facility_db.

CREATE TABLE IF NOT EXISTS auth_refresh_sessions (
  id CHAR(36) NOT NULL,
  user_codigo VARCHAR(50) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  impersonation TINYINT(1) NOT NULL DEFAULT 0,
  impersonated_by VARCHAR(50) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_auth_refresh_user (user_codigo),
  KEY idx_auth_refresh_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
