import {
  AssistantValidatedFaqService,
  ASSISTANT_FAQ_WILDCARD_INTENT,
} from './assistant-validated-faq.service';
import { IntentType } from './intent-classifier.service';

describe('AssistantValidatedFaqService', () => {
  const makeService = () => {
    const findFirst = jest.fn();
    const prisma = {
      assistantValidatedFaq: { findFirst },
    };
    const service = new AssistantValidatedFaqService(prisma as any);
    return { service, findFirst };
  };

  it('normalizeQuestionForHash elimina diacritice și collapse spații', () => {
    const { service } = makeService();
    expect(service.normalizeQuestionForHash('  Cómo  va  Árbol  ')).toBe(
      'como va arbol',
    );
  });

  it('questionHash este determinist', () => {
    const { service } = makeService();
    const n = 'hola mundo';
    expect(service.questionHash(n)).toBe(service.questionHash(n));
    expect(service.questionHash(n)).not.toBe(service.questionHash(`${n}x`));
  });

  it('findMatch: ordine intent exact (ro, es) apoi wildcard (ro, es)', async () => {
    const { service, findFirst } = makeService();
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'row-es',
      reply_text: 'R',
      priority: 1,
    });

    const r = await service.findMatch(IntentType.FICHAJES, 'test', 'ro');
    expect(r?.id).toBe('row-es');
    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(findFirst.mock.calls[0][0].where).toMatchObject({
      intent: IntentType.FICHAJES,
      locale: 'ro',
    });
    expect(findFirst.mock.calls[1][0].where).toMatchObject({
      intent: IntentType.FICHAJES,
      locale: 'es',
    });
  });

  it('findMatch: folosește wildcard când intent exact lipsește', async () => {
    const { service, findFirst } = makeService();
    findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'wild-es',
        reply_text: 'W',
        priority: 0,
      });

    const r = await service.findMatch(IntentType.NOMINAS, 'x', 'de');
    expect(r?.id).toBe('wild-es');
    expect(findFirst).toHaveBeenCalledTimes(4);
    expect(findFirst.mock.calls[2][0].where.intent).toBe(
      ASSISTANT_FAQ_WILDCARD_INTENT,
    );
    expect(findFirst.mock.calls[2][0].where.locale).toBe('de');
  });

  it('findMatch: locale es nu dublează interogări', async () => {
    const { service, findFirst } = makeService();
    findFirst.mockResolvedValueOnce({
      id: 'only',
      reply_text: 'ok',
      priority: 0,
    });
    const r = await service.findMatch(IntentType.PEDIDOS, 'y', 'es');
    expect(r?.replyText).toBe('ok');
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst.mock.calls[0][0].where.locale).toBe('es');
  });
});
