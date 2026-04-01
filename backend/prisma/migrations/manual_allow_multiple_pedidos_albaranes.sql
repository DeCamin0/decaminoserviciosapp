-- Permite mai multe rânduri PedidosAlbaranes per același pedido_uid.
-- Aplică pe ambele baze (decamino_db și hera_facility_db).
-- Numele UNIQUE poate fi `unique_pedido_uid` (SQL manual) sau `PedidosAlbaranes_pedido_uid_key` (Prisma).

ALTER TABLE `PedidosAlbaranes` DROP INDEX `PedidosAlbaranes_pedido_uid_key`;
