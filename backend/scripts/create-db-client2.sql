-- Creare bază de date pentru Client 2 (HERA FACILITY SERVICES) pe VPS.
-- Rulează pe serverul MySQL (local sau VPS) cu un user care are privilegii CREATE DATABASE.
--
-- Utilizare pe VPS:
--   mysql -u root -p < scripts/create-db-client2.sql
-- sau conectare interactivă:
--   mysql -u root -p
--   source /path/to/backend/scripts/create-db-client2.sql

-- Numele bazei din .env.client2.example
CREATE DATABASE IF NOT EXISTS `hera_facility_db`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Opțional: user dedicat pentru Client 2 (înlocuiește PAROLA_CURATA cu o parolă puternică)
-- După creare, pune în .env Client 2: DB_USERNAME=hera_app, DB_PASSWORD=...
-- CREATE USER IF NOT EXISTS 'hera_app'@'localhost' IDENTIFIED BY 'PAROLA_CURATA';
-- GRANT ALL PRIVILEGES ON hera_facility_db.* TO 'hera_app'@'localhost';
-- FLUSH PRIVILEGES;

SELECT 'Database hera_facility_db created (or already exists).' AS result;
