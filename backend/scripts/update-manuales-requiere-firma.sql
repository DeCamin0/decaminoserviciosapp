-- Actualizează template-urile MANUAL_TEST existente pentru a seta requiere_firma = 1
UPDATE prl_document_templates
SET requiere_firma = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE tipo_documento = 'MANUAL_TEST'
  AND requiere_firma = 0;
