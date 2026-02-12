-- Migration pentru crearea tabelului PedidosAlbaranes
-- Tabel dedicat pentru stocarea albaranes (documente de confirmare a livrării comenzilor)

CREATE TABLE IF NOT EXISTS `PedidosAlbaranes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `pedido_uid` VARCHAR(64) NOT NULL,
  `archivo` LONGBLOB NOT NULL,
  `nombre_archivo` VARCHAR(255) NOT NULL,
  `tipo_mime` VARCHAR(100),
  `tamano_bytes` INT,
  `subido_por` VARCHAR(255),
  `subido_en` DATETIME NOT NULL,
  `actualizado_en` DATETIME NOT NULL,
  INDEX `idx_pedido_uid` (`pedido_uid`),
  UNIQUE KEY `unique_pedido_uid` (`pedido_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
