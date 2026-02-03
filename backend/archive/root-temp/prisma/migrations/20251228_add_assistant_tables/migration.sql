-- CreateTable: assistant_audit_log
CREATE TABLE `assistant_audit_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `usuario_id` VARCHAR(50) NOT NULL,
  `usuario_nombre` VARCHAR(255) NULL,
  `usuario_rol` VARCHAR(100) NULL,
  `mensaje` TEXT NOT NULL,
  `intent_detectado` VARCHAR(100) NULL,
  `confianza` DECIMAL(3,2) NULL,
  `respuesta` TEXT NULL,
  `escalado` BOOLEAN NOT NULL DEFAULT FALSE,
  `ticket_id` VARCHAR(50) NULL,
  `datos_consultados` TEXT NULL,
  `error` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX `idx_audit_usuario` (`usuario_id`),
  INDEX `idx_audit_intent` (`intent_detectado`),
  INDEX `idx_audit_created` (`created_at`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CreateTable: kb_articles (Knowledge Base)
CREATE TABLE `kb_articles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(255) NOT NULL,
  `contenido` TEXT NOT NULL,
  `categoria` VARCHAR(100) NULL,
  `tags` VARCHAR(500) NULL,
  `activo` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX `idx_kb_categoria` (`categoria`),
  INDEX `idx_kb_activo` (`activo`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CreateTable: tickets_ai (Escalación)
CREATE TABLE `tickets_ai` (
  `id` VARCHAR(50) NOT NULL,
  `usuario_id` VARCHAR(50) NOT NULL,
  `usuario_nombre` VARCHAR(255) NULL,
  `usuario_rol` VARCHAR(100) NULL,
  `mensaje_original` TEXT NOT NULL,
  `intent_detectado` VARCHAR(100) NULL,
  `contexto` TEXT NULL,
  `estado` VARCHAR(50) NOT NULL DEFAULT 'pendiente',
  `prioridad` VARCHAR(20) NOT NULL DEFAULT 'normal',
  `asignado_a` VARCHAR(50) NULL,
  `respuesta_admin` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `resuelto_at` TIMESTAMP NULL,
  
  INDEX `idx_ticket_usuario` (`usuario_id`),
  INDEX `idx_ticket_estado` (`estado`),
  INDEX `idx_ticket_prioridad` (`prioridad`),
  INDEX `idx_ticket_created` (`created_at`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

