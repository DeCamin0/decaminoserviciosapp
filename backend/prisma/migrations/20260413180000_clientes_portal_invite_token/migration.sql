-- Enlace único por comunidad para el portal de clientes (QR / URL dedicada).
ALTER TABLE `Clientes`
  ADD COLUMN `portal_invite_token` VARCHAR(64) NULL,
  ADD UNIQUE KEY `uniq_clientes_portal_invite_token` (`portal_invite_token`);
