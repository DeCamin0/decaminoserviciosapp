-- Script pentru adăugarea permisiunilor pedidos-empleados și pedidos-admin în matrix
-- Format: grupo_module = "Grupo_module" (ex: "Admin_pedidos-admin")

-- Permisiuni pedidos-admin (pentru manageri/admini - acces complet)
-- Acestea permit accesul la toate tab-urile și toate pedidosurile

INSERT INTO `Permissions` (`grupo_module`, `permitted`, `last_updated`, `updated_by`)
VALUES
  -- Admin - pedidos-admin
  ('Admin_pedidos-admin', 'true', CURDATE(), 'admin@decamino.com'),
  
  -- Developer - pedidos-admin
  ('Developer_pedidos-admin', 'true', CURDATE(), 'admin@decamino.com'),
  
  -- Manager - pedidos-admin
  ('Manager_pedidos-admin', 'true', CURDATE(), 'admin@decamino.com'),
  
  -- Supervisor - pedidos-admin (dacă vrei ca supervisorii să aibă acces complet)
  ('Supervisor_pedidos-admin', 'true', CURDATE(), 'admin@decamino.com')
ON DUPLICATE KEY UPDATE
  `permitted` = VALUES(`permitted`),
  `last_updated` = CURDATE(),
  `updated_by` = 'admin@decamino.com';

-- Permisiuni pedidos-empleados (pentru angajații normali - acces limitat)
-- Acestea permit doar tab-ul "Nuevo Pedido" și pedidosurile din comunitatea lor

INSERT INTO `Permissions` (`grupo_module`, `permitted`, `last_updated`, `updated_by`)
VALUES
  -- Empleado - pedidos-empleados (dacă vrei ca toți angajații să aibă acces)
  -- ('Empleado_pedidos-empleados', 'true', CURDATE(), 'admin@decamino.com'),
  
  -- Sau pentru grupuri specifice (exemplu):
  -- ('Auxiliar De Servicios - C_pedidos-empleados', 'true', CURDATE(), 'admin@decamino.com')
ON DUPLICATE KEY UPDATE
  `permitted` = VALUES(`permitted`),
  `last_updated` = CURDATE(),
  `updated_by` = 'admin@decamino.com';

-- NOTĂ: Comentează/decomentează liniile în funcție de ce grupuri vrei să aibă acces
-- Pentru a adăuga pentru un grup specific, folosește formatul: 'NumeGrup_pedidos-empleados'
