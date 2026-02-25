-- AlterTable: add cliente_id and lineas_json to informes_factura_config for saving full informe draft (Guardar informe)
ALTER TABLE `informes_factura_config` ADD COLUMN `cliente_id` INTEGER NULL,
ADD COLUMN `lineas_json` JSON NULL;
