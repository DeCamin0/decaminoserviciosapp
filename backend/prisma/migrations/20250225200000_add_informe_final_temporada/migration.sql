-- AlterTable: add informe_final_temporada to informes_factura_config (checkbox "Informe final temporada")
ALTER TABLE `informes_factura_config` ADD COLUMN `informe_final_temporada` TINYINT NOT NULL DEFAULT 0;
