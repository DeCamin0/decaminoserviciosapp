-- CreateTable
CREATE TABLE `DatosEmpleados` (
    `CODIGO` VARCHAR(50) NOT NULL,
    `NOMBRE / APELLIDOS` VARCHAR(255) NULL,
    `NACIONALIDAD` VARCHAR(100) NULL,
    `DIRECCION` VARCHAR(700) NULL,
    `D.N.I. / NIE` VARCHAR(50) NULL,
    `SEG. SOCIAL` VARCHAR(50) NULL,
    `N┬║ Cuenta` VARCHAR(100) NULL,
    `TELEFONO` VARCHAR(30) NULL,
    `CORREO ELECTRONICO` VARCHAR(255) NULL,
    `FECHA NACIMIENTO` VARCHAR(100) NULL,
    `FECHA DE ALTA` VARCHAR(100) NULL,
    `CENTRO TRABAJO` VARCHAR(300) NULL,
    `TIPO DE CONTRATO` VARCHAR(300) NULL,
    `SUELDO BRUTO MENSUAL` VARCHAR(300) NULL,
    `HORAS DE CONTRATO` VARCHAR(50) NULL,
    `EMPRESA` VARCHAR(100) NULL,
    `GRUPO` VARCHAR(200) NULL,
    `ESTADO` VARCHAR(50) NULL,
    `FECHA BAJA` VARCHAR(100) NULL,
    `Fecha Antig├╝edad` VARCHAR(100) NULL,
    `Antig├╝edad` VARCHAR(500) NULL,
    `Contrase├▒a` VARCHAR(255) NULL,
    `DerechoPedidos` VARCHAR(100) NULL,
    `TrabajaFestivos` VARCHAR(50) NULL,

    INDEX `idx_datos_dni`(`D.N.I. / NIE`),
    INDEX `idx_datos_empleados_centro`(`CENTRO TRABAJO`),
    INDEX `idx_datos_empleados_estado`(`ESTADO`),
    INDEX `idx_datos_empleados_grupo`(`GRUPO`),
    INDEX `idx_datos_nom`(`NOMBRE / APELLIDOS`),
    INDEX `idx_datos_ss`(`SEG. SOCIAL`),
    PRIMARY KEY (`CODIGO`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permissions` (
    `grupo_module` VARCHAR(100) NOT NULL,
    `permitted` VARCHAR(50) NULL,
    `last_updated` VARCHAR(50) NULL,
    `updated_by` VARCHAR(50) NULL,

    PRIMARY KEY (`grupo_module`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(36) NOT NULL,
    `sender_id` VARCHAR(50) NULL,
    `user_id` VARCHAR(50) NOT NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'info',
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `data` TEXT NULL,
    `grupo` VARCHAR(100) NULL,
    `centro` VARCHAR(100) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `read_at` TIMESTAMP(0) NULL,

    INDEX `idx_sender`(`sender_id`),
    INDEX `idx_user_created`(`user_id`, `created_at`),
    INDEX `idx_user_read`(`user_id`, `read`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `push_subscriptions` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(50) NOT NULL,
    `endpoint` TEXT NOT NULL,
    `p256dh` TEXT NOT NULL,
    `auth` TEXT NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_push_subscription_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_rooms` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `firma_id` BIGINT NOT NULL,
    `tipo` ENUM('centro', 'dm') NOT NULL,
    `centro_id` BIGINT NULL,
    `created_by` BIGINT NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_chat_rooms_firma`(`firma_id`),
    INDEX `idx_chat_rooms_centro`(`centro_id`),
    INDEX `idx_chat_rooms_tipo`(`tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_room_members` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `room_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `rol_in_room` ENUM('member', 'supervisor', 'admin') NOT NULL DEFAULT 'member',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_chat_room_member_user`(`user_id`),
    UNIQUE INDEX `uq_chat_room_member_room_user`(`room_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_messages` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `room_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `message` TEXT NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_chat_messages_room_created`(`room_id`, `created_at`),
    INDEX `idx_chat_messages_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_message_reads` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `message_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `read_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_chat_message_read_message`(`message_id`),
    INDEX `idx_chat_message_read_user`(`user_id`),
    UNIQUE INDEX `uq_chat_message_read_message_user`(`message_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comunicados` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(255) NOT NULL,
    `contenido` TEXT NOT NULL,
    `autor_id` VARCHAR(50) NOT NULL,
    `publicado` BOOLEAN NOT NULL DEFAULT false,
    `archivo` LONGBLOB NULL,
    `nombre_archivo` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_comunicado_publicado_created`(`publicado`, `created_at`),
    INDEX `idx_comunicado_autor`(`autor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comunicados_leidos` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `comunicado_id` BIGINT NOT NULL,
    `user_id` VARCHAR(50) NOT NULL,
    `read_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_comunicado_leido_comunicado`(`comunicado_id`),
    INDEX `idx_comunicado_leido_user`(`user_id`),
    UNIQUE INDEX `uq_comunicado_leido_comunicado_user`(`comunicado_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Avatar` (
    `CODIGO` VARCHAR(50) NOT NULL,
    `NOMBRE` VARCHAR(255) NOT NULL,
    `AVATAR` LONGBLOB NOT NULL,
    `FECHA_SUBIDA` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`CODIGO`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArhivosFacturasRecibidas` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `numar_operatiune` VARCHAR(100) NOT NULL,
    `created_at` VARCHAR(100) NULL DEFAULT 'current_timestamp()',
    `Descripcion` VARCHAR(100) NULL,
    `mimeType` VARCHAR(100) NULL,
    `filename` VARCHAR(300) NULL,
    `file` LONGBLOB NULL,

    UNIQUE INDEX `uq_factura_filename`(`id`, `filename`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ausencias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `solicitud_id` VARCHAR(100) NOT NULL,
    `CODIGO` VARCHAR(50) NOT NULL,
    `NOMBRE` VARCHAR(150) NOT NULL,
    `TIPO` VARCHAR(100) NOT NULL,
    `FECHA` VARCHAR(50) NOT NULL,
    `HORA` TIME(0) NULL,
    `LOCACION` VARCHAR(150) NULL,
    `MOTIVO` TEXT NULL,
    `DURACION` TEXT NULL,
    `UNIDAD_DURACION` VARCHAR(50) NOT NULL DEFAULT 'dias',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_ausencias_cod_fecha`(`CODIGO`, `FECHA`),
    INDEX `idx_ausencias_codigo_tipo_fecha_hora`(`CODIGO`, `TIPO`, `FECHA`, `HORA`),
    UNIQUE INDEX `uk_aus_sol_cod`(`solicitud_id`, `CODIGO`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CarpetasDocumentos` (
    `doc_id` INTEGER NOT NULL AUTO_INCREMENT,
    `id` VARCHAR(50) NOT NULL,
    `correo_electronico` VARCHAR(255) NULL,
    `tipo_documento` VARCHAR(255) NULL,
    `nombre_archivo` VARCHAR(255) NULL,
    `nombre_empleado` VARCHAR(500) NULL,
    `fecha_creacion` VARCHAR(50) NULL DEFAULT (current_timestamp()),
    `archivo` LONGBLOB NULL,

    PRIMARY KEY (`doc_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CatologoProductos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `N├║mero de art├¡culo` VARCHAR(50) NOT NULL,
    `Descripci├│n de art├¡culo` TEXT NOT NULL,
    `Precio por unidad` DECIMAL(10, 4) NOT NULL,
    `fotoproducto` LONGBLOB NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Clientes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `NIF` VARCHAR(30) NULL,
    `NOMBRE O RAZON SOCIAL` VARCHAR(500) NULL,
    `TIPO` VARCHAR(50) NULL,
    `EMAIL` VARCHAR(255) NULL,
    `TELEFONO` VARCHAR(50) NULL,
    `MOVIL` VARCHAR(50) NULL,
    `FAX` VARCHAR(50) NULL,
    `DIRECCION` VARCHAR(500) NULL,
    `CODIGO POSTAL` VARCHAR(20) NULL,
    `POBLACION` VARCHAR(200) NULL,
    `PROVINCIA` VARCHAR(200) NULL,
    `PAIS` VARCHAR(100) NULL,
    `URL` VARCHAR(255) NULL,
    `DESCUENTO POR DEFECTO` DECIMAL(5, 2) NULL,
    `LATITUD` VARCHAR(100) NULL,
    `LONGITUD` VARCHAR(100) NULL,
    `NOTAS PRIVADAS` TEXT NULL,
    `CUENTAS BANCARIAS` TEXT NULL,
    `Fecha Ultima Renovacion` VARCHAR(100) NULL,
    `Fecha Proxima Renovacion` VARCHAR(100) NULL,
    `ESTADO` VARCHAR(100) NULL,
    `CONTRACTO` LONGBLOB NULL,
    `CuantoPuedeGastar` VARCHAR(100) NULL,

    UNIQUE INDEX `NIF`(`NIF`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContratosClientes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_nif` VARCHAR(30) NOT NULL,
    `tipo_contrato` VARCHAR(255) NOT NULL,
    `fecha_subida` VARCHAR(50) NULL DEFAULT (curdate()),
    `fecha_renovacion` VARCHAR(50) NULL,
    `archivo_base64` LONGTEXT NULL,

    UNIQUE INDEX `uniq_cliente_tipo`(`cliente_nif`, `tipo_contrato`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CuadernoIncidencias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha` DATE NULL,
    `hora` TIME(0) NULL,
    `tipo` VARCHAR(100) NULL,
    `ubicacion` VARCHAR(255) NULL,
    `descripcion` TEXT NULL,
    `prioridad` VARCHAR(50) NULL,
    `estado` VARCHAR(50) NULL,
    `observaciones` TEXT NULL,
    `codigo` VARCHAR(50) NULL,
    `nombre` VARCHAR(150) NULL,
    `email` VARCHAR(150) NULL,
    `centroTrabajo` VARCHAR(255) NULL,
    `address` VARCHAR(255) NULL,
    `source` VARCHAR(100) NULL,
    `resolucionFecha` DATE NULL,
    `resolucionHora` TIME(0) NULL,
    `resolucionAuxiliar` VARCHAR(150) NULL,
    `auxiliar` VARCHAR(150) NULL,
    `personaInformada` VARCHAR(150) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentosOficiales` (
    `doc_id` INTEGER NOT NULL AUTO_INCREMENT,
    `id` VARCHAR(50) NOT NULL,
    `correo_electronico` VARCHAR(255) NULL,
    `tipo_documento` VARCHAR(255) NULL,
    `nombre_archivo` VARCHAR(255) NULL,
    `nombre_empleado` VARCHAR(500) NULL,
    `fecha_creacion` VARCHAR(50) NULL DEFAULT (current_timestamp()),
    `archivo` LONGBLOB NULL,
    `Permisso Para Empleado` VARCHAR(50) NULL,

    PRIMARY KEY (`doc_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Facturas` (
    `id` VARCHAR(200) NOT NULL,
    `Serie` VARCHAR(50) NULL,
    `num_factura` VARCHAR(100) NOT NULL,
    `fecha` DATE NOT NULL,
    `cliente_nombre` VARCHAR(255) NULL,
    `cliente_nif` VARCHAR(50) NULL,
    `base_imponible` TEXT NULL,
    `retencion` TEXT NULL,
    `iva` TEXT NULL,
    `total` TEXT NULL,
    `estado` VARCHAR(50) NULL DEFAULT 'emitida',
    `observaciones` TEXT NULL,
    `created_at` TEXT NULL DEFAULT (current_timestamp()),
    `PDF` LONGBLOB NULL,
    `EFactura` LONGBLOB NULL,

    INDEX `fk_serie`(`Serie`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FacturasRecibidas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `magazin` VARCHAR(255) NULL,
    `adresa` VARCHAR(255) NULL,
    `telefon` VARCHAR(50) NULL,
    `cif` VARCHAR(50) NULL,
    `tip_bon` VARCHAR(100) NULL,
    `numar_operatiune` VARCHAR(100) NULL,
    `data` VARCHAR(55) NULL,
    `ora` VARCHAR(55) NULL,
    `produse_text` TEXT NULL,
    `baza_impozabila` TEXT NULL,
    `tva` TEXT NULL,
    `cota_tva` TEXT NULL,
    `total_platit` TEXT NULL,
    `moneda` VARCHAR(10) NULL,
    `metoda_plata` VARCHAR(50) NULL,
    `rest` TEXT NULL,
    `File` LONGBLOB NULL,
    `Estado` VARCHAR(100) NULL,
    `TipoGasto` VARCHAR(100) NULL,
    `Descripcion` TEXT NULL,
    `TipRetencion` VARCHAR(100) NULL,
    `CotaRetencion` VARCHAR(100) NULL,
    `BaseRetencion` VARCHAR(100) NULL,
    `ValorRetencion` VARCHAR(100) NULL,
    `Imputable` VARCHAR(100) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Fichaje` (
    `fichaje_pk` INTEGER NOT NULL AUTO_INCREMENT,
    `CODIGO` VARCHAR(50) NULL,
    `NOMBRE / APELLIDOS` VARCHAR(200) NULL,
    `CORREO ELECTRONICO` VARCHAR(200) NULL,
    `TIPO` VARCHAR(50) NULL,
    `HORA` VARCHAR(50) NULL,
    `DIRECCION` VARCHAR(200) NULL,
    `MODIFICADO_POR` VARCHAR(50) NULL,
    `FECHA` VARCHAR(50) NULL,
    `DURACION` VARCHAR(50) NULL,
    `Estado` VARCHAR(100) NULL,
    `Motivo` VARCHAR(500) NULL,
    `ID` VARCHAR(100) NULL,

    INDEX `idx_fichaje_cod_fecha`(`CODIGO`, `FECHA`),
    PRIMARY KEY (`fichaje_pk`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InspeccionesDocumentos` (
    `id` VARCHAR(50) NOT NULL,
    `tipo_inspeccion` VARCHAR(100) NULL,
    `codigo_empleado` VARCHAR(50) NULL,
    `nombre_empleado` VARCHAR(150) NULL,
    `archivo` LONGBLOB NULL,
    `nombre_archivo` VARCHAR(255) NULL,
    `fecha_subida` VARCHAR(50) NULL DEFAULT (current_timestamp()),
    `Nombre Supervisor` VARCHAR(200) NULL,
    `Centro` VARCHAR(300) NULL,
    `Locacion` VARCHAR(500) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadsDigitalizacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `source` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `category` VARCHAR(100) NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(255) NULL,
    `website` VARCHAR(255) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(120) NULL,
    `country` VARCHAR(80) NULL DEFAULT 'ES',
    `maps_url` TEXT NULL,
    `rating` DECIMAL(3, 2) NULL,
    `reviews` INTEGER NULL,
    `website_need_score` INTEGER NULL,
    `automation_need_score` INTEGER NULL,
    `website_flags` LONGTEXT NULL,
    `automation_flags` LONGTEXT NULL,
    `detected_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_city`(`city`),
    INDEX `idx_email`(`email`),
    INDEX `idx_name_phone`(`name`, `phone`),
    INDEX `idx_scores`(`automation_need_score`, `website_need_score`),
    INDEX `idx_website`(`website`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timestamp` VARCHAR(255) NULL,
    `action` VARCHAR(100) NULL,
    `user` VARCHAR(100) NULL,
    `email` VARCHAR(255) NULL,
    `grupo` VARCHAR(100) NULL,
    `updateby` TEXT NULL,
    `userAgent` TEXT NULL,
    `url` TEXT NULL,
    `sessionId` VARCHAR(255) NULL,
    `ip` VARCHAR(100) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MutuaCasos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `Codigo_Empleado` VARCHAR(64) NULL,
    `NIF` VARCHAR(20) NULL,
    `NASS` VARCHAR(30) NULL,
    `Trabajador` VARCHAR(255) NULL,
    `R├®gimen` VARCHAR(50) NULL,
    `CIF` VARCHAR(20) NULL,
    `CCC` VARCHAR(25) NULL,
    `Raz├│n Social` VARCHAR(255) NULL,
    `Tipo` VARCHAR(100) NULL,
    `Reca├¡da` BOOLEAN NULL,
    `Fecha baja` DATE NULL,
    `Fecha de alta prevista SPS` DATE NULL,
    `Fecha de alta` DATE NULL,
    `D├¡as de baja` INTEGER NULL,
    `D├¡as previstos Servicio P├║blico de Salud` INTEGER NULL,
    `Fecha inicio subrogaci├│n` DATE NULL,
    `Jornadas perdidas desde la subrogaci├│n` INTEGER NULL,
    `Jornadas perdidas fijos discontinuos` INTEGER NULL,
    `Situaci├│n` VARCHAR(100) NULL,
    `Inicio pago delegado` DATE NULL,
    `Fin pago delegado` DATE NULL,
    `Pendiente validaci├│n INSS` BOOLEAN NULL,
    `├Ültima gesti├│n Mutua` DATE NULL,
    `Pr├│xima gesti├│n Mutua` DATE NULL,
    `Demora recepci├│n del parte de baja` INTEGER NULL,
    `├Ültimo Parte de Confirmaci├│n` DATE NULL,
    `C├│digo Nacional de Ocupaci├│n` VARCHAR(50) NULL,
    `Id.Caso` VARCHAR(100) NOT NULL,
    `Id.Posici├│n` VARCHAR(100) NOT NULL,
    `fuente` VARCHAR(50) NULL,
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_mutuacasos_cod`(`Codigo_Empleado`),
    INDEX `idx_mutuacasos_fechas`(`Fecha baja`, `Fecha de alta`),
    UNIQUE INDEX `uk_caso_posicion`(`Id.Caso`, `Id.Posici├│n`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Nominas` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NULL,
    `archivo` LONGBLOB NULL,
    `tipo_mime` VARCHAR(100) NULL,
    `fecha_subida` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `Mes` VARCHAR(100) NULL,
    `Ano` VARCHAR(100) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificariFichaje` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `data` DATE NULL,
    `tip` ENUM('entrada', 'salida') NULL,
    `trimis_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uniq_notif`(`empleado_id`, `data`, `tip`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Paqueteria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(50) NULL,
    `nombre` VARCHAR(150) NULL,
    `email` VARCHAR(150) NULL,
    `centroTrabajo` VARCHAR(150) NULL,
    `address` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `fecha` DATE NOT NULL,
    `hora` TIME(0) NOT NULL,
    `tipo` VARCHAR(50) NULL,
    `empresa` VARCHAR(100) NULL,
    `propietario` VARCHAR(100) NULL,
    `portalPisoLetra` VARCHAR(100) NULL,
    `observaciones` TEXT NULL,
    `estado` VARCHAR(100) NULL,
    `fecha_entrega` DATE NULL,
    `hora_entrega` TIME(0) NULL,
    `entregado_por` TEXT NULL,
    `persona_entrega` TEXT NULL,
    `observacionentrega` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PedidosTodos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pedido_uid` VARCHAR(64) NOT NULL,
    `empleado_id` VARCHAR(50) NULL,
    `empleado_nombre` VARCHAR(255) NULL,
    `empleado_email` VARCHAR(255) NULL,
    `comunidad_id` INTEGER NULL,
    `comunidad_nombre` VARCHAR(255) NULL,
    `comunidad_direccion` VARCHAR(255) NULL,
    `comunidad_codigo_postal` VARCHAR(20) NULL,
    `comunidad_localidad` VARCHAR(100) NULL,
    `comunidad_provincia` VARCHAR(100) NULL,
    `comunidad_telefono` VARCHAR(50) NULL,
    `comunidad_email` VARCHAR(255) NULL,
    `comunidad_nif` VARCHAR(50) NULL,
    `comunidad_limite_gasto` DECIMAL(10, 2) NULL,
    `fecha` DATETIME(0) NULL,
    `moneda` VARCHAR(10) NULL,
    `descuento_global` DECIMAL(10, 3) NULL,
    `impuestos` DECIMAL(10, 3) NULL,
    `subtotal` DECIMAL(10, 3) NULL,
    `iva_total` DECIMAL(10, 3) NULL,
    `total` DECIMAL(10, 3) NULL,
    `limite_excedido` BOOLEAN NULL,
    `exceso_limite` DECIMAL(10, 3) NULL,
    `notas` TEXT NULL,
    `producto_id` INTEGER NULL,
    `numero_articulo` VARCHAR(100) NULL,
    `descripcion` TEXT NULL,
    `cantidad` DECIMAL(10, 3) NULL,
    `precio_unitario` DECIMAL(10, 3) NULL,
    `subtotal_linea` DECIMAL(10, 3) NULL,
    `descuento_linea` DECIMAL(10, 3) NULL,
    `iva_porcentaje` DECIMAL(5, 2) NULL,
    `iva_linea` DECIMAL(10, 3) NULL,
    `total_linea` DECIMAL(10, 3) NULL,
    `creado_en` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PermisosProductos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `producto_id` INTEGER NOT NULL,
    `permitido` BOOLEAN NOT NULL DEFAULT true,
    `fecha_asignacion` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `producto_id`(`producto_id`),
    UNIQUE INDEX `unique_permiso`(`cliente_id`, `producto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Productos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `FAMILIA/SUBFAMILIA` VARCHAR(64) NULL,
    `NOMBRE` VARCHAR(255) NOT NULL,
    `DESCRIPCI├ôN` VARCHAR(50) NULL,
    `NOTAS PRIVADAS` VARCHAR(50) NULL,
    `TIPO DE UNIDAD` VARCHAR(50) NULL,
    `PRODUCTO VISIBLE (ACTIVO)` VARCHAR(50) NULL,
    `C├ôDIGO DE PRODUCTO (SKU)` VARCHAR(50) NULL,
    `REFERENCIA PROVEEDOR` VARCHAR(50) NULL,
    `PRECIO VENTA - BASE IMPONIBLE` VARCHAR(50) NULL,
    `PRECIO VENTA - % DESCUENTO` VARCHAR(50) NULL,
    `PRECIO VENTA - % IVA` VARCHAR(50) NULL,
    `PRECIO VENTA - % RE` VARCHAR(50) NULL,
    `P.V.P.` VARCHAR(50) NULL,
    `COSTE ADQUISICI├ôN - BASE IMPONIBLE` VARCHAR(50) NULL,
    `COSTE ADQUISICI├ôN - % IVA` VARCHAR(50) NULL,
    `COSTE ADQUISICI├ôN - % RE` VARCHAR(50) NULL,
    `COSTE ADQUISICI├ôN TOTAL` VARCHAR(50) NULL,
    `CONTROLAR STOCK` VARCHAR(50) NULL,
    `STOCK ABSOLUTO` VARCHAR(50) NULL,
    `PERMITIR VENDER SIN STOCK` VARCHAR(50) NULL,
    `ACTIVAR ALARMA DE STOCK` VARCHAR(50) NULL,
    `AVISAR CUANDO EL N├ÜMERO DE UNIDADES SEA INFERIOR A` VARCHAR(50) NULL,
    `AVISAR EN EL DASHBOARD` VARCHAR(50) NULL,
    `AVISAR MEDIANTE NOTIFICACI├ôN` VARCHAR(50) NULL,
    `AVISAR MEDIANTE CORREO ELECTR├ôNICO` VARCHAR(50) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Proveedores` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `NIF` VARCHAR(20) NULL,
    `NOMBRE O RAZ├ôN SOCIAL` VARCHAR(255) NULL,
    `EMAIL` VARCHAR(255) NULL,
    `TELEFONO` VARCHAR(50) NULL,
    `M├ôVIL` VARCHAR(50) NULL,
    `FAX` VARCHAR(50) NULL,
    `DIRECCI├ôN` VARCHAR(255) NULL,
    `CODIGO POSTAL` VARCHAR(20) NULL,
    `POBLACI├ôN` VARCHAR(100) NULL,
    `PROVINCIA` VARCHAR(100) NULL,
    `PA├ìS` VARCHAR(100) NULL,
    `URL` VARCHAR(255) NULL,
    `DESCUENTO POR DEFECTO` DECIMAL(5, 2) NULL,
    `LATITUD` VARCHAR(200) NULL,
    `LONGITUD` VARCHAR(200) NULL,
    `NOTAS PRIVADAS` TEXT NULL,
    `CUENTAS BANCARIAS` TEXT NULL,
    `fecha_creacion` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `fecha_actualizacion` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `ESTADO` VARCHAR(100) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SerieFormato` (
    `Serie` VARCHAR(50) NULL,
    `Formato` VARCHAR(255) NULL,

    UNIQUE INDEX `unique_serie`(`Serie`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SignSessions` (
    `sid` VARCHAR(64) NOT NULL,
    `status` ENUM('PENDING', 'SIGNED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `original` LONGBLOB NOT NULL,
    `signed` LONGBLOB NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`sid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SolicitudesCambiosPersonales` (
    `id` VARCHAR(55) NOT NULL,
    `codigo` VARCHAR(55) NULL,
    `NOMBRE` VARCHAR(255) NULL,
    `campo` TEXT NULL,
    `valoare_veche` VARCHAR(255) NULL,
    `valoare_noua` VARCHAR(255) NULL,
    `motiv` VARCHAR(255) NULL,
    `status` VARCHAR(255) NULL DEFAULT 'in asteptare',
    `data_creare` VARCHAR(255) NULL DEFAULT (current_timestamp()),
    `data_aprobare` VARCHAR(255) NULL,
    `CORREO_ELECTRONICO` VARCHAR(200) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TareasDiaria` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `fecha` DATE NOT NULL,
    `hora` TIME(0) NOT NULL,
    `horaEdicion` TIME(0) NULL,
    `descripcion` TEXT NULL,
    `codigo` VARCHAR(20) NOT NULL,
    `nombre` VARCHAR(150) NOT NULL,
    `email` VARCHAR(255) NULL,
    `centroTrabajo` VARCHAR(200) NULL,
    `loc` VARCHAR(100) NULL,
    `locEdicion` VARCHAR(100) NULL,
    `address` VARCHAR(255) NULL,
    `ip` VARCHAR(45) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_codigo`(`codigo`),
    INDEX `idx_email`(`email`),
    INDEX `idx_fecha`(`fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TipoIngreso` (
    `codigo` VARCHAR(10) NOT NULL,
    `descripcion` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tipogasto` (
    `codigo` VARCHAR(10) NOT NULL,
    `descripcion` TEXT NULL,
    `Grupo` TEXT NULL,

    PRIMARY KEY (`codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TiposContrato` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `tipo`(`tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cuadrante` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `CODIGO` VARCHAR(50) NULL,
    `EMAIL` VARCHAR(100) NULL,
    `NOMBRE` VARCHAR(100) NULL,
    `LUNA` VARCHAR(20) NULL,
    `CENTRO` VARCHAR(100) NULL,
    `ZI_1` VARCHAR(50) NULL,
    `ZI_2` VARCHAR(50) NULL,
    `ZI_3` VARCHAR(50) NULL,
    `ZI_4` VARCHAR(50) NULL,
    `ZI_5` VARCHAR(50) NULL,
    `ZI_6` VARCHAR(50) NULL,
    `ZI_7` VARCHAR(50) NULL,
    `ZI_8` VARCHAR(50) NULL,
    `ZI_9` VARCHAR(50) NULL,
    `ZI_10` VARCHAR(50) NULL,
    `ZI_11` VARCHAR(50) NULL,
    `ZI_12` VARCHAR(50) NULL,
    `ZI_13` VARCHAR(50) NULL,
    `ZI_14` VARCHAR(50) NULL,
    `ZI_15` VARCHAR(50) NULL,
    `ZI_16` VARCHAR(50) NULL,
    `ZI_17` VARCHAR(50) NULL,
    `ZI_18` VARCHAR(50) NULL,
    `ZI_19` VARCHAR(50) NULL,
    `ZI_20` VARCHAR(50) NULL,
    `ZI_21` VARCHAR(50) NULL,
    `ZI_22` VARCHAR(50) NULL,
    `ZI_23` VARCHAR(50) NULL,
    `ZI_24` VARCHAR(50) NULL,
    `ZI_25` VARCHAR(50) NULL,
    `ZI_26` VARCHAR(50) NULL,
    `ZI_27` VARCHAR(50) NULL,
    `ZI_28` VARCHAR(50) NULL,
    `ZI_29` VARCHAR(50) NULL,
    `ZI_30` VARCHAR(50) NULL,
    `ZI_31` VARCHAR(50) NULL,
    `TotalHoras` VARCHAR(100) NULL,

    INDEX `idx_cuadrante_luna`(`LUNA`),
    UNIQUE INDEX `unique_codigo_luna`(`CODIGO`, `LUNA`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fiestas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `scope` VARCHAR(100) NOT NULL,
    `ccaa_code` VARCHAR(10) NULL,
    `observed_date` DATE NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,

    INDEX `idx_f_date`(`date`),
    INDEX `idx_f_scope`(`scope`),
    INDEX `idx_fiestas_observed_date`(`observed_date`),
    INDEX `idx_fiestas_scope_ccaa_active`(`scope`, `ccaa_code`, `active`),
    UNIQUE INDEX `uniq_f`(`date`, `scope`, `ccaa_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `horarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(120) NOT NULL,
    `centro_nombre` VARCHAR(255) NULL,
    `grupo_nombre` VARCHAR(255) NULL,
    `vigente_desde` DATE NULL,
    `vigente_hasta` DATE NULL,
    `weekly_break_minutes` INTEGER NULL DEFAULT 0,
    `entry_margin_minutes` INTEGER NULL DEFAULT 0,
    `exit_margin_minutes` INTEGER NULL DEFAULT 0,
    `total_horas_semanales` INTEGER NULL,
    `total_minutos_semanales` INTEGER NULL,
    `lun_in1` TIME(0) NULL,
    `lun_out1` TIME(0) NULL,
    `lun_in2` TIME(0) NULL,
    `lun_out2` TIME(0) NULL,
    `lun_in3` TIME(0) NULL,
    `lun_out3` TIME(0) NULL,
    `mar_in1` TIME(0) NULL,
    `mar_out1` TIME(0) NULL,
    `mar_in2` TIME(0) NULL,
    `mar_out2` TIME(0) NULL,
    `mar_in3` TIME(0) NULL,
    `mar_out3` TIME(0) NULL,
    `mie_in1` TIME(0) NULL,
    `mie_out1` TIME(0) NULL,
    `mie_in2` TIME(0) NULL,
    `mie_out2` TIME(0) NULL,
    `mie_in3` TIME(0) NULL,
    `mie_out3` TIME(0) NULL,
    `joi_in1` TIME(0) NULL,
    `joi_out1` TIME(0) NULL,
    `joi_in2` TIME(0) NULL,
    `joi_out2` TIME(0) NULL,
    `joi_in3` TIME(0) NULL,
    `joi_out3` TIME(0) NULL,
    `vin_in1` TIME(0) NULL,
    `vin_out1` TIME(0) NULL,
    `vin_in2` TIME(0) NULL,
    `vin_out2` TIME(0) NULL,
    `vin_in3` TIME(0) NULL,
    `vin_out3` TIME(0) NULL,
    `sam_in1` TIME(0) NULL,
    `sam_out1` TIME(0) NULL,
    `sam_in2` TIME(0) NULL,
    `sam_out2` TIME(0) NULL,
    `sam_in3` TIME(0) NULL,
    `sam_out3` TIME(0) NULL,
    `dum_in1` TIME(0) NULL,
    `dum_out1` TIME(0) NULL,
    `dum_in2` TIME(0) NULL,
    `dum_out2` TIME(0) NULL,
    `dum_in3` TIME(0) NULL,
    `dum_out3` TIME(0) NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_horarios_centro_grupo`(`centro_nombre`, `grupo_nombre`),
    INDEX `idx_horarios_vigencia`(`vigente_desde`, `vigente_hasta`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `horaspermitidas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `GRUPO` VARCHAR(100) NULL,
    `Horas Anuales` VARCHAR(100) NULL,
    `Horas Mensuales` VARCHAR(100) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grupos_referencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(200) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `grupos_referencia_nombre_key`(`nombre`),
    INDEX `idx_grupos_referencia_activo`(`activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metodos_de_cobro` (
    `id` VARCHAR(50) NOT NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `tipo_metodo` VARCHAR(100) NOT NULL,
    `numero_tarjeta_o_cuenta` VARCHAR(100) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notas_facturas` (
    `titulo` VARCHAR(255) NOT NULL,
    `descripcion` TEXT NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `retenciones_irpf` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `porcentaje` DECIMAL(5, 2) NOT NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `categoria` ENUM('Actual', 'CeutaYMelilla', 'Antiguo') NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solicitudes` (
    `id` VARCHAR(20) NOT NULL,
    `codigo` VARCHAR(50) NULL,
    `nombre` VARCHAR(150) NULL,
    `email` VARCHAR(255) NULL,
    `tipo` VARCHAR(100) NULL,
    `estado` VARCHAR(50) NULL,
    `fecha_inicio` DATE NULL,
    `fecha_fin` VARCHAR(50) NULL,
    `motivo` TEXT NULL,
    `fecha_solicitud` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sent_emails` (
    `id` VARCHAR(36) NOT NULL,
    `sender_id` VARCHAR(50) NOT NULL,
    `recipient_type` VARCHAR(50) NOT NULL,
    `recipient_id` VARCHAR(50) NULL,
    `recipient_email` VARCHAR(255) NOT NULL,
    `recipient_name` VARCHAR(255) NULL,
    `subject` VARCHAR(500) NOT NULL,
    `message` TEXT NOT NULL,
    `additional_message` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'sent',
    `error_message` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `sent_at` TIMESTAMP(0) NULL,

    INDEX `idx_sent_email_sender`(`sender_id`),
    INDEX `idx_sent_email_recipient`(`recipient_type`, `recipient_id`),
    INDEX `idx_sent_email_recipient_email`(`recipient_email`),
    INDEX `idx_sent_email_created`(`created_at`),
    INDEX `idx_sent_email_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_attachments` (
    `id` VARCHAR(36) NOT NULL,
    `email_id` VARCHAR(36) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `file_content` LONGBLOB NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `file_size` INTEGER NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_email_attachment_email`(`email_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `chat_room_members` ADD CONSTRAINT `fk_chat_room_members_room` FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `fk_chat_messages_room` FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `chat_message_reads` ADD CONSTRAINT `fk_chat_message_reads_message` FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `comunicados_leidos` ADD CONSTRAINT `fk_comunicado_leido_comunicado` FOREIGN KEY (`comunicado_id`) REFERENCES `comunicados`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ContratosClientes` ADD CONSTRAINT `fk_cliente_nif` FOREIGN KEY (`cliente_nif`) REFERENCES `Clientes`(`NIF`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PermisosProductos` ADD CONSTRAINT `PermisosProductos_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `Clientes`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PermisosProductos` ADD CONSTRAINT `PermisosProductos_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `CatologoProductos`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `email_attachments` ADD CONSTRAINT `fk_email_attachment_email` FOREIGN KEY (`email_id`) REFERENCES `sent_emails`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

