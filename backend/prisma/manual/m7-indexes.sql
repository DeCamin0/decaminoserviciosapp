-- M7 — indexuri lipsă. Aplicat la 2026-11-09 pe decamino_db și hera_facility_db
-- (MariaDB 10.3.39). Nu modifică tipul coloanei Fichaje.FECHA.
-- Indexul (CODIGO, FECHA) exista deja și nu a fost recreat.
-- Rulează din nou doar dacă un index lipsește pe o bază nouă.

CREATE INDEX IF NOT EXISTS idx_carpetas_documentos_empleado
  ON CarpetasDocumentos (`id`);

CREATE INDEX IF NOT EXISTS idx_carpetas_documentos_correo
  ON CarpetasDocumentos (`correo_electronico`);

CREATE INDEX IF NOT EXISTS idx_solicitudes_codigo
  ON solicitudes (`codigo`);

CREATE INDEX IF NOT EXISTS idx_solicitudes_email
  ON solicitudes (`email`);

CREATE INDEX IF NOT EXISTS idx_solicitudes_estado_fecha
  ON solicitudes (`estado`, `fecha_solicitud`);
