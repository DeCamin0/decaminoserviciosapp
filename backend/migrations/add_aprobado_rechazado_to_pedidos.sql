-- Add aprobado/rechazado tracking fields to PedidosTodos table
-- Migration: 20260122150000_add_aprobado_rechazado_to_pedidos
-- Description: Adaugă câmpuri pentru a stoca cine aprobă/respinge pedidos și când

ALTER TABLE `PedidosTodos` 
ADD COLUMN `aprobado_por` VARCHAR(255) NULL AFTER `provincia_envio`,
ADD COLUMN `aprobado_en` DATETIME(0) NULL AFTER `aprobado_por`,
ADD COLUMN `rechazado_por` VARCHAR(255) NULL AFTER `aprobado_en`,
ADD COLUMN `rechazado_en` DATETIME(0) NULL AFTER `rechazado_por`;
