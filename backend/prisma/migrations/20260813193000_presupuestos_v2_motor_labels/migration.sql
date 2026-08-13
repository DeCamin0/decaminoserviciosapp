-- Human-facing motor labels (admin UI). Internal codes unchanged.
UPDATE `v2_motores_calculo` SET
  `label_ui` = 'Coste de personal — Auxiliares',
  `descripcion` = 'Calcula el precio a partir del coste de personal (auxiliares / conserjería).'
WHERE `codigo` = 'auxiliares_coste';

UPDATE `v2_motores_calculo` SET
  `label_ui` = 'Coste de personal — Limpieza',
  `descripcion` = 'Calcula el precio a partir del coste de personal (limpieza).'
WHERE `codigo` = 'limpieza_coste';

UPDATE `v2_motores_calculo` SET
  `label_ui` = 'Precio mensual directo',
  `descripcion` = 'Precio mensual negociado sin IVA (jardinería, cubos, garaje u otros).'
WHERE `codigo` = 'precio_mensual';

UPDATE `v2_motores_calculo` SET
  `label_ui` = 'Piscina',
  `descripcion` = 'Oferta de temporada / mantenimiento invernal de piscina.'
WHERE `codigo` = 'piscina';
