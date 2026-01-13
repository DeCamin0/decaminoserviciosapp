-- AlterTable
-- Add codigo_empleado column to Nominas table
ALTER TABLE `Nominas` ADD COLUMN `codigo_empleado` VARCHAR(50) NULL;

-- CreateIndex
-- Add index for codigo_empleado for better query performance
CREATE INDEX `idx_nominas_codigo_empleado` ON `Nominas`(`codigo_empleado`);
