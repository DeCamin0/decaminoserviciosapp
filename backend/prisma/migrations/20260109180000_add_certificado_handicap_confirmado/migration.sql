-- AlterTable
-- Adaugă coloana certificado_handicap_confirmado pentru a stoca confirmarea utilizatorului
-- NULL = nu a răspuns încă, true = are certificat, false = nu are certificat
ALTER TABLE `DatosEmpleados` ADD COLUMN `certificado_handicap_confirmado` TINYINT(1) NULL DEFAULT NULL AFTER `VACACIONES_RESTANTES_ANO_ANTERIOR`;
