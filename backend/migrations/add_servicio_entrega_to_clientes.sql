-- Add SERVICIO ENTREGA field to Clientes table
-- Migration: 20260122160000_add_servicio_entrega_to_clientes
-- Description: Adaugă câmp pentru serviciu/orar de entrega la clienți

ALTER TABLE `Clientes` 
ADD COLUMN `SERVICIO ENTREGA` VARCHAR(255) NULL AFTER `CuantoPuedeGastar`;
