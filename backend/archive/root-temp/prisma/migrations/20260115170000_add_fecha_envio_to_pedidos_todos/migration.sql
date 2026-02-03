-- Add fecha_envio column to PedidosTodos table
ALTER TABLE PedidosTodos 
ADD COLUMN fecha_envio DATETIME NULL 
AFTER estado;
