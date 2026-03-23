import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ASSISTANT_FAQ_WILDCARD_INTENT,
  AssistantValidatedFaqService,
} from './assistant-validated-faq.service';
import { AssistantValidatedFaqAdminService } from './assistant-validated-faq-admin.service';

describe('AssistantValidatedFaqAdminService', () => {
  const make = () => {
    const findUnique = jest.fn();
    const upsert = jest.fn();
    const prisma = {
      assistantValidatedFaq: { findUnique, upsert },
    };
    const validatedFaq = new AssistantValidatedFaqService(prisma as any);
    const admin = new AssistantValidatedFaqAdminService(
      prisma as any,
      validatedFaq,
    );
    return { admin, findUnique, upsert, validatedFaq };
  };

  it('getByCompositeKey lanza NotFoundException si no hay fila', async () => {
    const { admin, findUnique } = make();
    findUnique.mockResolvedValue(null);
    await expect(
      admin.getByCompositeKey('abc', ASSISTANT_FAQ_WILDCARD_INTENT, 'es'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('upsert rechaza normalizedQuestion vacío', async () => {
    const { admin } = make();
    await expect(
      admin.upsert({
        normalizedQuestion: '   ',
        replyText: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('upsert llama prisma.upsert con question_hash del servicio de hash', async () => {
    const { admin, upsert, validatedFaq } = make();
    upsert.mockResolvedValue({
      id: 'id1',
      question_hash: 'hh',
      normalized_question: 'hola',
      intent: ASSISTANT_FAQ_WILDCARD_INTENT,
      locale: 'es',
      reply_text: 'r',
      active: true,
      priority: 0,
      source_type: 'candidate',
      created_at: new Date(),
      updated_at: new Date(),
    });
    const n = '  Hola  ';
    const hash = validatedFaq.questionHash(
      validatedFaq.normalizeQuestionForHash(n)!,
    );
    const r = await admin.upsert({
      normalizedQuestion: n,
      replyText: 'Respuesta',
      source: 'candidate',
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].where.question_hash_intent_locale).toEqual({
      question_hash: hash,
      intent: ASSISTANT_FAQ_WILDCARD_INTENT,
      locale: 'es',
    });
    expect(r.replyText).toBe('r');
  });
});
