-- Add horario_entrega and telefono_entrega to PedidosTodos (per order)
-- Run manually if needed: mysql -u ... < migrations/add_horario_telefono_entrega_to_pedidos.sql

ALTER TABLE `PedidosTodos`
ADD COLUMN `horario_entrega` VARCHAR(500) NULL AFTER `provincia_envio`,
ADD COLUMN `telefono_entrega` VARCHAR(50) NULL AFTER `horario_entrega`;
