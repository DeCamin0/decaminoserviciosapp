-- Add email ingestion fields to DocumentosOficiales table
-- These fields support the email ingestion workflow: PENDING_REVIEW -> APPROVED -> SENT/ARCHIVED/REJECTED

ALTER TABLE `DocumentosOficiales`
  -- Status workflow: PENDING_REVIEW, APPROVED, SENT, ARCHIVED, REJECTED
  -- Default 'SENT' for existing documents (backward compatible)
  ADD COLUMN `status` VARCHAR(50) DEFAULT 'SENT' NULL,
  
  -- Source email metadata (for idempotency and tracking)
  ADD COLUMN `source_message_id` VARCHAR(255) NULL,
  ADD COLUMN `source_attachment_id` VARCHAR(255) NULL,
  ADD COLUMN `source_mailbox` VARCHAR(255) NULL,
  
  -- Idempotency key: hash(message_id + attachment_id) to prevent duplicates
  ADD COLUMN `idempotency_key` VARCHAR(255) NULL,
  
  -- Auto-detected values (from email subject/filename/PDF content)
  ADD COLUMN `detected_empleado_id` VARCHAR(50) NULL,
  ADD COLUMN `detected_tipo_documento` VARCHAR(255) NULL,
  
  -- Admin-confirmed values (after review)
  ADD COLUMN `confirmed_empleado_id` VARCHAR(50) NULL,
  ADD COLUMN `confirmed_tipo_documento` VARCHAR(255) NULL,
  
  -- Action: send, archive, reject
  ADD COLUMN `action` VARCHAR(50) NULL,
  
  -- Rejection reason (if rejected)
  ADD COLUMN `rejection_reason` TEXT NULL,
  
  -- Approval metadata
  ADD COLUMN `approved_by` VARCHAR(50) NULL,
  ADD COLUMN `approved_at` DATETIME NULL,
  
  -- Distribution metadata
  ADD COLUMN `distributed_at` DATETIME NULL,
  
  -- Additional email metadata (JSON: subject, from, date, etc.)
  ADD COLUMN `ingestion_metadata` JSON NULL;

-- Create indexes for performance
CREATE INDEX `idx_documentos_oficiales_status` ON `DocumentosOficiales` (`status`);
CREATE UNIQUE INDEX `idx_documentos_oficiales_idempotency` ON `DocumentosOficiales` (`idempotency_key`);
CREATE INDEX `idx_documentos_oficiales_source_message` ON `DocumentosOficiales` (`source_message_id`);
CREATE INDEX `idx_documentos_oficiales_pending_review` ON `DocumentosOficiales` (`status`, `fecha_creacion`);
