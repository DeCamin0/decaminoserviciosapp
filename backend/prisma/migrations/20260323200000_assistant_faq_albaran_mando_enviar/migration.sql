-- FAQ: «mando / mandar / enviar» + albarán (misma respuesta que subir albarán en Pedidos).
-- Aplicar en ambas bases (Decamino + HERA).

INSERT INTO `assistant_validated_faq` (
  `id`,
  `question_hash`,
  `normalized_question`,
  `intent`,
  `locale`,
  `reply_text`,
  `active`,
  `priority`,
  `answer_source`,
  `created_at`,
  `updated_at`
) VALUES
(
  'a1000001-0000-4000-8000-000000000013',
  'f27f50145d46476e2626606febc6bb0a152e1943192482b874f038573922dea8',
  'como mando un albaran',
  '__ANY__',
  'es',
  'En esta app el **albarán** va ligado al **pedido de material**, no a una sección genérica de Documentos. Abre **Pedidos** (`/pedidos` o `/empleado-pedidos` según tu rol), entra en el **pedido** y usa la acción de **subir/enviar el albarán** (archivo) en ese pedido. No hace falta crear un albarán suelto fuera del pedido.',
  1,
  100,
  'etapa1_seed_albaran_mando',
  CURRENT_TIMESTAMP(0),
  CURRENT_TIMESTAMP(0)
),
(
  'a1000001-0000-4000-8000-000000000014',
  'cb02ea94675dadcbc6cea39dd83fab9a2a8541a9785953b90af022c7d1162aad',
  'como mando un albaran ?',
  '__ANY__',
  'es',
  'En esta app el **albarán** va ligado al **pedido de material**, no a una sección genérica de Documentos. Abre **Pedidos** (`/pedidos` o `/empleado-pedidos` según tu rol), entra en el **pedido** y usa la acción de **subir/enviar el albarán** (archivo) en ese pedido. No hace falta crear un albarán suelto fuera del pedido.',
  1,
  100,
  'etapa1_seed_albaran_mando',
  CURRENT_TIMESTAMP(0),
  CURRENT_TIMESTAMP(0)
),
(
  'a1000001-0000-4000-8000-000000000015',
  'fbb7b4095c3a990b915ebf890506368f96934c452f6dddca9d2940194e951bb3',
  'como mandar un albaran',
  '__ANY__',
  'es',
  'En esta app el **albarán** va ligado al **pedido de material**, no a una sección genérica de Documentos. Abre **Pedidos** (`/pedidos` o `/empleado-pedidos` según tu rol), entra en el **pedido** y usa la acción de **subir/enviar el albarán** (archivo) en ese pedido. No hace falta crear un albarán suelto fuera del pedido.',
  1,
  100,
  'etapa1_seed_albaran_mando',
  CURRENT_TIMESTAMP(0),
  CURRENT_TIMESTAMP(0)
);
