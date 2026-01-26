-- Script pentru a găsi și șterge documentul "VARIOS DOCUMENTOS MOHAMED AHRAOU.pdf" 
-- care a fost salvat fără angajat asociat (id = 'PENDING' sau detected_empleado_id = NULL)

-- 1. Mai întâi, găsește documentul
SELECT 
  doc_id,
  id,
  detected_empleado_id,
  nombre_archivo,
  nombre_empleado,
  fecha_creacion,
  status,
  source_message_id,
  source_attachment_id
FROM `DocumentosOficiales`
WHERE nombre_archivo LIKE '%VARIOS DOCUMENTOS MOHAMED AHRAOU%'
  AND (id = 'PENDING' OR detected_empleado_id IS NULL OR detected_empleado_id = '')
ORDER BY fecha_creacion DESC;

-- 2. Dacă vrei să ștergi documentul, decomentează următoarea linie și rulează:
-- DELETE FROM `DocumentosOficiales`
-- WHERE nombre_archivo LIKE '%VARIOS DOCUMENTOS MOHAMED AHRAOU%'
--   AND (id = 'PENDING' OR detected_empleado_id IS NULL OR detected_empleado_id = '')
-- LIMIT 1;
