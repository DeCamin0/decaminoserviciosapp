import { BadRequestException } from '@nestjs/common';
import { AssistantAnalyticsService } from './assistant-analytics.service';

describe('AssistantAnalyticsService', () => {
  const noopFaq = {} as any;

  describe('parseRange', () => {
    it('interpreta YYYY-MM-DD como inicio/fin UTC', () => {
      const svc = new AssistantAnalyticsService({} as any, noopFaq);
      const { from, to } = svc.parseRange('2025-01-10', '2025-01-12');
      expect(from.toISOString()).toBe('2025-01-10T00:00:00.000Z');
      expect(to.toISOString()).toBe('2025-01-12T23:59:59.999Z');
    });

    it('lanza si from > to', () => {
      const svc = new AssistantAnalyticsService({} as any, noopFaq);
      expect(() => svc.parseRange('2025-02-01', '2025-01-01')).toThrow(
        BadRequestException,
      );
    });

    it('sin from ni to: últimos 7 días hasta ahora (aprox)', () => {
      const svc = new AssistantAnalyticsService({} as any, noopFaq);
      const before = Date.now();
      const { from, to } = svc.parseRange(undefined, undefined);
      const after = Date.now();
      expect(to.getTime()).toBeGreaterThanOrEqual(before);
      expect(to.getTime()).toBeLessThanOrEqual(after);
      const spanMs = to.getTime() - from.getTime();
      expect(spanMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
      expect(spanMs).toBeLessThan(8 * 24 * 60 * 60 * 1000);
    });
  });

  describe('getSummary', () => {
    it('agrega counts y byResponseSource', async () => {
      const prisma = {
        assistantMessage: {
          count: jest.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(8),
          groupBy: jest.fn().mockResolvedValue([
            { response_source: 'llm', _count: { _all: 5 } },
            { response_source: null, _count: { _all: 3 } },
          ]),
        },
        assistantMessageFeedback: {
          count: jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(1),
        },
      };
      const svc = new AssistantAnalyticsService(prisma as any, noopFaq);
      const from = new Date('2025-01-01T00:00:00.000Z');
      const to = new Date('2025-01-31T23:59:59.999Z');
      const res = await svc.getSummary(from, to);
      expect(res.messages.userCount).toBe(10);
      expect(res.messages.assistantCount).toBe(8);
      expect(res.messages.byResponseSource).toEqual({ llm: 5, null: 3 });
      expect(res.feedback).toEqual({
        positive: 4,
        negative: 1,
        total: 5,
      });
    });
  });

  describe('getFeedbackNegative', () => {
    it('limita take entre 1 y 100', async () => {
      const prisma = {
        assistantMessageFeedback: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };
      const svc = new AssistantAnalyticsService(prisma as any, noopFaq);
      const from = new Date('2025-01-01T00:00:00.000Z');
      const to = new Date('2025-01-31T23:59:59.999Z');
      await svc.getFeedbackNegative(from, to, 500);
      expect(prisma.assistantMessageFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('parseAppHelpInsightsParams', () => {
    it('defaults y cap limit / minCount', () => {
      const svc = new AssistantAnalyticsService({} as any, noopFaq);
      expect(svc.parseAppHelpInsightsParams(undefined, undefined)).toEqual({
        limit: 50,
        minCount: 2,
      });
      expect(svc.parseAppHelpInsightsParams('200', '1')).toEqual({
        limit: 200,
        minCount: 1,
      });
      expect(svc.parseAppHelpInsightsParams('999', '5000')).toEqual({
        limit: 200,
        minCount: 1000,
      });
    });
  });

  describe('parseAuditDatosJson', () => {
    it('extrae tools y resultCount', () => {
      const svc = new AssistantAnalyticsService({} as any, noopFaq);
      const j = JSON.stringify({
        v: 2,
        tools: ['validated_faq'],
        resultCount: 0,
      });
      expect(svc.parseAuditDatosJson(j)).toEqual({
        tools: ['validated_faq'],
        resultCount: 0,
      });
    });

    it('vacío o inválido → sin tools', () => {
      const svc = new AssistantAnalyticsService({} as any, noopFaq);
      expect(svc.parseAuditDatosJson(null)).toEqual({
        tools: [],
        resultCount: 0,
      });
      expect(svc.parseAuditDatosJson('{bad')).toEqual({
        tools: [],
        resultCount: 0,
      });
    });
  });

  describe('getAppHelpInsights', () => {
    it('cuenta faqHit y procedimientosKbEmpty', async () => {
      const faq = {
        normalizeQuestionForHash: (s: string) => String(s).toLowerCase().trim(),
        questionHash: (n: string) =>
          n.length <= 0 ? 'empty' : `h_${n.split(' ')[0]}`,
      };
      const prisma = {
        assistantAuditLog: {
          findMany: jest.fn().mockResolvedValue([
            {
              mensaje: 'No me deja guardar mi direccion',
              intent_detectado: 'procedimientos',
              datos_consultados: JSON.stringify({
                v: 2,
                tools: ['knowledge_base_articulos'],
                resultCount: 0,
              }),
            },
            {
              mensaje: 'donde estan mis datos personales',
              intent_detectado: 'procedimientos',
              datos_consultados: JSON.stringify({
                v: 2,
                tools: ['validated_faq'],
                resultCount: 0,
              }),
            },
          ]),
        },
        assistantValidatedFaq: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };
      const svc = new AssistantAnalyticsService(prisma as any, faq as any);
      const from = new Date('2025-01-01T00:00:00.000Z');
      const to = new Date('2025-01-31T23:59:59.999Z');
      const res = await svc.getAppHelpInsights(from, to, 20, 1);
      expect(res.counts.appHelpTotal).toBe(2);
      expect(res.counts.faqHit).toBe(1);
      expect(res.counts.appHelpWithoutFaq).toBe(1);
      expect(res.counts.procedimientosKbEmpty).toBe(1);
    });
  });
});
