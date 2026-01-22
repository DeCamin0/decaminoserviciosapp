-- Add dirección de envío fields to PedidosTodos table
-- Migration: 20260122140000_add_direccion_envio_to_pedidos
-- Description: Adaugă câmpuri pentru adresă de expediere separată de adresa comunității

ALTER TABLE `PedidosTodos` 
ADD COLUMN `direccion_envio` VARCHAR(500) NULL AFTER `fecha_envio`,
ADD COLUMN `codigo_postal_envio` VARCHAR(20) NULL AFTER `direccion_envio`,
ADD COLUMN `localidad_envio` VARCHAR(200) NULL AFTER `codigo_postal_envio`,
ADD COLUMN `provincia_envio` VARCHAR(200) NULL AFTER `localidad_envio`;
