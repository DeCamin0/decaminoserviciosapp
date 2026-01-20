-- AlterTable
-- Adaugă coloana estado pentru a gestiona statusul comenzilor (pendiente, aprobado, rechazado)
ALTER TABLE `PedidosTodos` ADD COLUMN `estado` VARCHAR(50) NULL DEFAULT 'pendiente' AFTER `total_linea`;
