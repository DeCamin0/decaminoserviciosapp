-- Aliniază tickets_ai.updated_at cu Decamino (DEFAULT + ON UPDATE).
-- Pe HERA lipsea default-ul → INSERT din escalation.service eșua cu errno 1364.

ALTER TABLE tickets_ai
  MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
