-- AlterTable
ALTER TABLE `presupuestos_firmas` ADD COLUMN `original_pdf_sha256` VARCHAR(64) NULL,
    ADD COLUMN `original_pdf_size_bytes` INTEGER NULL,
    ADD COLUMN `signed_pdf_sha256` VARCHAR(64) NULL,
    ADD COLUMN `signed_pdf_size_bytes` INTEGER NULL;
