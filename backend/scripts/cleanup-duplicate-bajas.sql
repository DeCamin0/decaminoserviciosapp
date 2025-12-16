-- Script pentru ștergerea duplicatelor din MutuaCasos
-- Păstrează doar versiunea normalizată (fără zerouri leading) pentru fiecare Id.Caso + Id.Posición

-- Pas 1: Identifică duplicatele (cazuri cu Id.Caso normalizat identic dar formate diferite)
-- Exemplu: "8420143" vs "0008420143", "1" vs "0001"

-- Pas 2: Șterge duplicatele, păstrând doar cea mai recentă înregistrare pentru fiecare combinație normalizată
DELETE t1 FROM `MutuaCasos` t1
INNER JOIN `MutuaCasos` t2 
WHERE 
  -- Normalizează Id.Caso (elimină zerouri leading)
  TRIM(LEADING '0' FROM t1.`Id.Caso`) = TRIM(LEADING '0' FROM t2.`Id.Caso`)
  AND TRIM(LEADING '0' FROM t1.`Id.Caso`) != '' -- Evită cazurile goale
  -- Normalizează Id.Posición (elimină zerouri leading)
  AND TRIM(LEADING '0' FROM t1.`Id.Posición`) = TRIM(LEADING '0' FROM t2.`Id.Posición`)
  AND TRIM(LEADING '0' FROM t1.`Id.Posición`) != '' -- Evită cazurile goale
  -- Dacă există diferențe în format (unul are zerouri leading, altul nu)
  AND (
    t1.`Id.Caso` != t2.`Id.Caso` 
    OR t1.`Id.Posición` != t2.`Id.Posición`
  )
  -- Păstrează versiunea normalizată (fără zerouri leading) sau cea mai recentă
  AND (
    -- Șterge versiunile cu zerouri leading (dacă există versiune normalizată)
    (t1.`Id.Caso` LIKE '0%' OR t1.`Id.Posición` LIKE '0%')
    OR
    -- Sau șterge versiunea mai veche dacă ambele sunt normalizate
    (t1.`updated_at` < t2.`updated_at`)
  )
  AND t1.id > t2.id; -- Evită ștergerea ambelor înregistrări

-- Pas 3: Actualizează toate înregistrările pentru a avea Id.Caso și Id.Posición normalizate (fără zerouri leading)
UPDATE `MutuaCasos`
SET 
  `Id.Caso` = TRIM(LEADING '0' FROM `Id.Caso`),
  `Id.Posición` = TRIM(LEADING '0' FROM `Id.Posición`)
WHERE 
  `Id.Caso` LIKE '0%' 
  OR `Id.Posición` LIKE '0%';

-- Verificare: arată duplicatele rămase (ar trebui să fie 0)
SELECT 
  TRIM(LEADING '0' FROM `Id.Caso`) as caso_normalizado,
  TRIM(LEADING '0' FROM `Id.Posición`) as posicion_normalizada,
  COUNT(*) as count
FROM `MutuaCasos`
GROUP BY 
  TRIM(LEADING '0' FROM `Id.Caso`),
  TRIM(LEADING '0' FROM `Id.Posición`)
HAVING COUNT(*) > 1;
