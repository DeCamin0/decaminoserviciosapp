-- Add dirección de envío fields to PedidosTodos table
ALTER TABLE `PedidosTodos` 
ADD COLUMN `direccion_envio` VARCHAR(500) NULL AFTER `fecha_envio`,
ADD COLUMN `codigo_postal_envio` VARCHAR(20) NULL AFTER `direccion_envio`,
ADD COLUMN `localidad_envio` VARCHAR(200) NULL AFTER `codigo_postal_envio`,
ADD COLUMN `provincia_envio` VARCHAR(200) NULL AFTER `localidad_envio`;
