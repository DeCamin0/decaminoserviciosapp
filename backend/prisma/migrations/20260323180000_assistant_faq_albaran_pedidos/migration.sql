-- FAQ validada: subir albarán en contexto Pedidos (no Documentos genéricos).
-- Aplicar en ambas bases (Decamino + HERA) según reglas multi-client.

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
  'a1000001-0000-4000-8000-000000000011',
  'b7ba3b397d9cc39177aad22e271a6f648ae72eee30d47b4de95e54948e29d6d5',
  'como subo un albaran',
  '__ANY__',
  'es',
  'El **albarán** se sube en **Pedidos de material**, no en Documentos genéricos. Abre **Pedidos** (`/pedidos` o `/empleado-pedidos` según tu rol), localiza el **pedido** concreto y usa la acción de **subir albarán** en ese pedido (archivo asociado al pedido). Tras subirlo, el pedido puede pasar a estado entregado según la lógica de la app.',
  1,
  100,
  'etapa1_seed_albaran',
  CURRENT_TIMESTAMP(0),
  CURRENT_TIMESTAMP(0)
),
(
  'a1000001-0000-4000-8000-000000000012',
  '6da34c26c25dd80969edb668540e829e5dc8dd55834bd361f848cf4db8985e43',
  'como subo un albaran ?',
  '__ANY__',
  'es',
  'El **albarán** se sube en **Pedidos de material**, no en Documentos genéricos. Abre **Pedidos** (`/pedidos` o `/empleado-pedidos` según tu rol), localiza el **pedido** concreto y usa la acción de **subir albarán** en ese pedido (archivo asociado al pedido). Tras subirlo, el pedido puede pasar a estado entregado según la lógica de la app.',
  1,
  100,
  'etapa1_seed_albaran',
  CURRENT_TIMESTAMP(0),
  CURRENT_TIMESTAMP(0)
);
