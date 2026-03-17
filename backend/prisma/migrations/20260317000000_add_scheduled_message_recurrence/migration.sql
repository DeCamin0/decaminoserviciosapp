-- AlterTable: add recurrence options for scheduled messages (daily / weekly / monthly)
ALTER TABLE `scheduled_messages` ADD COLUMN `recurrence` VARCHAR(20) NULL;
ALTER TABLE `scheduled_messages` ADD COLUMN `recurrence_day_of_week` TINYINT NULL;
ALTER TABLE `scheduled_messages` ADD COLUMN `recurrence_day_of_month` TINYINT NULL;
