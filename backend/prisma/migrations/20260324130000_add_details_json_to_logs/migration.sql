-- Add JSON column for full activity details (field changes on user update, etc.)
ALTER TABLE `Logs` ADD COLUMN `details_json` JSON NULL;
