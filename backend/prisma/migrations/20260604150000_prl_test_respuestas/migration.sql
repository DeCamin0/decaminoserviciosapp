-- Guardar respuestas detalladas de autoevaluación PRL
ALTER TABLE `prl_employee_documents`
  ADD COLUMN `test_respuestas` JSON NULL AFTER `test_puntuacion`;
