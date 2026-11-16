-- Anunțul de alta al angajatului, separat de alta oficială a mutuei.
-- Rulează pe decamino_db și pe hera_facility_db.
ALTER TABLE `MutuaCasos`
  ADD COLUMN `alta_anunciada` DATE NULL DEFAULT NULL AFTER `Fecha de alta`;
