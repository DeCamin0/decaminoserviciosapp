-- OTP por email para portal de gestores (varias comunidades sin portal_token en el primer paso).
CREATE TABLE `portal_otp_email_challenges` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email_norm` VARCHAR(255) NOT NULL,
  `code_hash` VARCHAR(64) NOT NULL,
  `expires_at` TIMESTAMP(0) NOT NULL,
  `consumed_at` TIMESTAMP(0) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  KEY `idx_portal_otp_email_consumed` (`email_norm`, `consumed_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
