-- Presupuestos V2 Paso 2: params + persistencia cálculo en líneas de borrador

CREATE TABLE `v2_parametros_calculo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ambito` VARCHAR(32) NOT NULL,
    `motor_codigo` VARCHAR(64) NOT NULL DEFAULT '',
    `clave` VARCHAR(80) NOT NULL,
    `valor_json` JSON NOT NULL,
    `descripcion` VARCHAR(500) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    UNIQUE INDEX `uq_v2_param_ambito_motor_clave`(`ambito`, `motor_codigo`, `clave`),
    INDEX `idx_v2_param_motor`(`motor_codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `v2_presupuesto_servicios`
    ADD COLUMN `codigo_motor` VARCHAR(64) NULL,
    ADD COLUMN `version_motor` VARCHAR(20) NULL,
    ADD COLUMN `inputs_json` JSON NULL,
    ADD COLUMN `resultado_json` JSON NULL,
    ADD COLUMN `params_usados_json` JSON NULL,
    ADD COLUMN `calculated_at` TIMESTAMP(0) NULL;

-- Parámetros globales / por motor (valores Legacy → config)
INSERT INTO `v2_parametros_calculo` (`ambito`, `motor_codigo`, `clave`, `valor_json`, `descripcion`) VALUES
('global', '', 'iva_factor', '1.21', 'Factor IVA (1 + 21%)'),
('global', '', 'iva_pct', '0.21', 'Porcentaje IVA'),
('global', '', 'meses_anio', '12', 'Meses por año'),
('global', '', 'divisor_hora_anual', '156', 'Divisor €/h derivado (D6/156)'),
('global', '', 'semanas_mes', '4.33', 'Factor semanas/mes gastos fijos'),
('motor', 'auxiliares_coste', 'aux_ss_pct', '0.37', 'SS auxiliares'),
('motor', 'auxiliares_coste', 'aux_pagas', '14', 'Pagas convenio auxiliares'),
('motor', 'auxiliares_coste', 'aux_horas_semana_legal', '40', 'Horas semanales legales auxiliares'),
('motor', 'limpieza_coste', 'limp_ss_pct', '0.35', 'SS limpieza'),
('motor', 'limpieza_coste', 'limp_pagas', '12', 'Pagas convenio limpieza'),
('motor', 'limpieza_coste', 'limp_horas_semana', '39', 'Divisor horas semana limpieza'),
('motor', 'limpieza_coste', 'limp_vacaciones_dia_num', '31', 'Vacaciones: numerador días'),
('motor', 'limpieza_coste', 'limp_vacaciones_dia_den', '30', 'Vacaciones: denominador días'),
('motor', 'limpieza_coste', 'limp_pad_mensual', '1.98', 'Pad mensual Legacy en D48');

-- Defaults inputs por servicio seed (misma lógica Legacy)
UPDATE `v2_servicios_comerciales`
SET `defaults_json` = JSON_OBJECT(
  'convenioBase', 1221,
  'horasDiarias', 8,
  'diasPorSemana', 7,
  'horasACubrirPorSemana', 168
)
WHERE `codigo_interno` = 'auxiliares';

UPDATE `v2_servicios_comerciales`
SET `defaults_json` = JSON_OBJECT(
  'convenioBase', 1485,
  'numOperarias', 2,
  'horasPorDiaPorOperaria', 4,
  'diasLaborablesSemana', 5,
  'serviciosExtraHoras', 12
)
WHERE `codigo_interno` = 'limpieza';

UPDATE `v2_servicios_comerciales`
SET `defaults_json` = JSON_OBJECT('concepto', 'Jardinería', 'precioSinIva', 0)
WHERE `codigo_interno` = 'jardineria';

UPDATE `v2_servicios_comerciales`
SET `defaults_json` = JSON_OBJECT('concepto', 'Gestión cubos de basura', 'precioSinIva', 0)
WHERE `codigo_interno` = 'cubos';

UPDATE `v2_servicios_comerciales`
SET `defaults_json` = JSON_OBJECT('concepto', 'Garaje', 'precioSinIva', 0)
WHERE `codigo_interno` = 'garaje';

UPDATE `v2_servicios_comerciales`
SET `defaults_json` = JSON_OBJECT(
  'concepto', 'Mantenimiento piscina temporada',
  'precioSinIva', 0,
  'precioConLona', 1800,
  'precioSinLona', 1600
)
WHERE `codigo_interno` = 'piscina';
