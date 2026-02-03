-- Increase TELEFON ENTREGA field size to allow 2 phone numbers
ALTER TABLE `Clientes` 
MODIFY COLUMN `TELEFON ENTREGA` VARCHAR(100) NULL;
