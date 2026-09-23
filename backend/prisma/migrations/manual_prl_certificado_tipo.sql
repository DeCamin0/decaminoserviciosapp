-- Adaugă tipul CERTIFICADO la enum-urile PRL (Decamino + HERA).
-- Usage:
--   node scripts/run-prl-certificado-tipo-migration.js .env.decamino.local
--   node scripts/run-prl-certificado-tipo-migration.js .env.hera.local

ALTER TABLE `prl_document_templates`
  MODIFY COLUMN `tipo_documento` ENUM(
    'EVALUACION_RIESGOS',
    'ACTA_INFORMATIVA',
    'ENTREGA_EPIS',
    'RENUNCIA_RM',
    'MANUAL_TEST',
    'CERTIFICADO'
  ) NOT NULL;

ALTER TABLE `prl_employee_documents`
  MODIFY COLUMN `tipo_documento` ENUM(
    'EVALUACION_RIESGOS',
    'ACTA_INFORMATIVA',
    'ENTREGA_EPIS',
    'RENUNCIA_RM',
    'MANUAL_TEST',
    'CERTIFICADO'
  ) NOT NULL;
