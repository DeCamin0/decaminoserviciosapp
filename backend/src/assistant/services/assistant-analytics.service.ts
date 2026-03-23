import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { looksLikeAppHelpDatosPersonales } from '../utils/assistant-app-help.util';
import { AssistantValidatedFaqService } from './assistant-validated-faq.service';

const DEFAULT_RANGE_DAYS = 7;
const FEEDBACK_NEGATIVE_MAX = 100;
/** Máximo de filas de assistant_audit_log a escanear por petición (v1). */
const APP_HELP_AUDIT_SCAN_MAX = 50_000;
const APP_HELP_TOP_LIMIT_DEFAULT = 50;
const APP_HELP_TOP_LIMIT_MAX = 200;
const APP_HELP_MIN_COUNT_DEFAULT = 2;
const APP_HELP_MIN_COUNT_MAX = 1000;
const USER_PREVIEW_MAX = 500;
const ASSISTANT_PREVIEW_MAX = 800;

export type AssistantAnalyticsRange = { from: Date; to: Date };

export type AssistantAnalyticsSummaryResponse = {
  range: {
    from: string;
    to: string;
    /** Semantics documented for API consumers */
    timezoneNote: string;
  };
  messages: {
    userCount: number;
    assistantCount: number;
    /** Counts of assistant rows by response_source (null = legacy / not set) */
    byResponseSource: Record<string, number>;
  };
  feedback: {
    positive: number;
    negative: number;
    total: number;
  };
};

export type AssistantFeedbackNegativeItem = {
  feedbackId: string;
  createdAt: string;
  usuarioId: string;
  messageId: string;
  conversationId: string;
  rating: 'negative';
  comment: string | null;
  responseSource: string | null;
  /** Previous user message in thread before this assistant reply (best-effort) */
  userQuestionPreview: string | null;
  assistantReplyPreview: string;
};

export type AssistantFeedbackNegativeResponse = {
  range: AssistantAnalyticsSummaryResponse['range'];
  items: AssistantFeedbackNegativeItem[];
  limit: number;
};

export type AssistantAppHelpInsightsResponse = {
  range: AssistantAnalyticsSummaryResponse['range'];
  params: {
    limit: number;
    minCount: number;
  };
  filters: {
    segment: 'app_help_datos_personales';
    auditRowsScanned: number;
    auditScanTruncated: boolean;
    auditScanMax: number;
  };
  counts: {
    appHelpTotal: number;
    faqHit: number;
    procedimientosKbEmpty: number;
    appHelpWithoutFaq: number;
  };
  topNormalizedQuestions: Array<{
    normalizedQuestion: string;
    questionHash: string;
    count: number;
    inValidatedFaq: boolean;
  }>;
  topProcedimientosKbEmpty: Array<{
    normalizedQuestion: string;
    questionHash: string;
    count: number;
    inValidatedFaq: boolean;
  }>;
  notes: string[];
};

@Injectable()
export class AssistantAnalyticsService {
  private readonly logger = new Logger(AssistantAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validatedFaq: AssistantValidatedFaqService,
  ) {}

  /**
   * Parse `from` / `to` query params (YYYY-MM-DD or full ISO-8601).
   * Boundaries: inclusive range in **UTC** (DB timestamps compared as stored).
   */
  parseRange(fromStr?: string, toStr?: string): AssistantAnalyticsRange {
    const now = new Date();
    let to = toStr?.trim() ? this.parseBoundaryDate(toStr.trim(), 'end') : now;
    let from = fromStr?.trim()
      ? this.parseBoundaryDate(fromStr.trim(), 'start')
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException(
        'Parámetros from/to inválidos. Use YYYY-MM-DD o ISO-8601.',
      );
    }
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('from debe ser anterior o igual a to');
    }
    return { from, to };
  }

  private parseBoundaryDate(s: string, kind: 'start' | 'end'): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(
        `${s}T${kind === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`,
      );
      return d;
    }
    const d = new Date(s);
    return d;
  }

  async getSummary(
    from: Date,
    to: Date,
  ): Promise<AssistantAnalyticsSummaryResponse> {
    const [userCount, assistantCount, bySourceRows, fbPos, fbNeg] =
      await Promise.all([
        this.prisma.assistantMessage.count({
          where: {
            role: 'user',
            created_at: { gte: from, lte: to },
          },
        }),
        this.prisma.assistantMessage.count({
          where: {
            role: 'assistant',
            created_at: { gte: from, lte: to },
          },
        }),
        this.prisma.assistantMessage.groupBy({
          by: ['response_source'],
          where: {
            role: 'assistant',
            created_at: { gte: from, lte: to },
          },
          _count: { _all: true },
        }),
        this.prisma.assistantMessageFeedback.count({
          where: {
            rating: 'positive',
            created_at: { gte: from, lte: to },
          },
        }),
        this.prisma.assistantMessageFeedback.count({
          where: {
            rating: 'negative',
            created_at: { gte: from, lte: to },
          },
        }),
      ]);

    const byResponseSource: Record<string, number> = {};
    for (const row of bySourceRows) {
      const key =
        row.response_source == null || String(row.response_source).trim() === ''
          ? 'null'
          : String(row.response_source);
      byResponseSource[key] = row._count._all;
    }

    return {
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        timezoneNote:
          'Los límites from/to se interpretan en UTC cuando se usa YYYY-MM-DD. Las filas se filtran por assistant_messages.created_at / assistant_message_feedback.created_at.',
      },
      messages: {
        userCount,
        assistantCount,
        byResponseSource,
      },
      feedback: {
        positive: fbPos,
        negative: fbNeg,
        total: fbPos + fbNeg,
      },
    };
  }

  async getFeedbackNegative(
    from: Date,
    to: Date,
    limit = 50,
  ): Promise<AssistantFeedbackNegativeResponse> {
    const take = Math.min(
      Math.max(1, Math.floor(Number(limit)) || 50),
      FEEDBACK_NEGATIVE_MAX,
    );

    const rows = await this.prisma.assistantMessageFeedback.findMany({
      where: {
        rating: 'negative',
        created_at: { gte: from, lte: to },
      },
      orderBy: { created_at: 'desc' },
      take,
      include: {
        message: {
          select: {
            id: true,
            conversation_id: true,
            content: true,
            response_source: true,
            created_at: true,
          },
        },
      },
    });

    const items: AssistantFeedbackNegativeItem[] = [];

    for (const f of rows) {
      const am = f.message;
      let userQuestionPreview: string | null = null;
      try {
        const prevUser = await this.prisma.assistantMessage.findFirst({
          where: {
            conversation_id: am.conversation_id,
            role: 'user',
            created_at: { lt: am.created_at },
          },
          orderBy: { created_at: 'desc' },
          select: { content: true },
        });
        if (prevUser?.content) {
          const t = String(prevUser.content).trim();
          userQuestionPreview =
            t.length > USER_PREVIEW_MAX
              ? `${t.slice(0, USER_PREVIEW_MAX)}…`
              : t;
        }
      } catch (e: any) {
        this.logger.warn(
          `feedback-negative: no se pudo cargar pregunta previa (${e?.message ?? e})`,
        );
      }

      const ar = String(am.content ?? '').trim();
      const assistantReplyPreview =
        ar.length > ASSISTANT_PREVIEW_MAX
          ? `${ar.slice(0, ASSISTANT_PREVIEW_MAX)}…`
          : ar;

      items.push({
        feedbackId: f.id,
        createdAt: f.created_at.toISOString(),
        usuarioId: f.usuario_id,
        messageId: f.message_id,
        conversationId: f.conversation_id,
        rating: 'negative',
        comment: f.comment ?? null,
        responseSource: am.response_source ?? null,
        userQuestionPreview,
        assistantReplyPreview,
      });
    }

    return {
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        timezoneNote:
          'Los límites from/to se interpretan en UTC cuando se usa YYYY-MM-DD.',
      },
      items,
      limit: take,
    };
  }

  /**
   * Límites para listas top / minCount (analytics app-help).
   */
  parseAppHelpInsightsParams(
    limitRaw?: string,
    minCountRaw?: string,
  ): { limit: number; minCount: number } {
    let limit = APP_HELP_TOP_LIMIT_DEFAULT;
    if (limitRaw != null && String(limitRaw).trim() !== '') {
      const n = Number.parseInt(String(limitRaw).trim(), 10);
      if (!Number.isFinite(n) || n < 1) {
        throw new BadRequestException('limit debe ser un entero ≥ 1');
      }
      limit = Math.min(n, APP_HELP_TOP_LIMIT_MAX);
    }
    let minCount = APP_HELP_MIN_COUNT_DEFAULT;
    if (minCountRaw != null && String(minCountRaw).trim() !== '') {
      const n = Number.parseInt(String(minCountRaw).trim(), 10);
      if (!Number.isFinite(n) || n < 1) {
        throw new BadRequestException('minCount debe ser un entero ≥ 1');
      }
      minCount = Math.min(n, APP_HELP_MIN_COUNT_MAX);
    }
    return { limit, minCount };
  }

  /**
   * Agrega assistant_audit_log en [from,to] para segmento app-help (misma heurística que el chat).
   */
  async getAppHelpInsights(
    from: Date,
    to: Date,
    limit: number,
    minCount: number,
  ): Promise<AssistantAppHelpInsightsResponse> {
    const rows = await this.prisma.assistantAuditLog.findMany({
      where: {
        created_at: { gte: from, lte: to },
      },
      select: {
        mensaje: true,
        intent_detectado: true,
        datos_consultados: true,
      },
      orderBy: { id: 'desc' },
      take: APP_HELP_AUDIT_SCAN_MAX + 1,
    });

    const auditScanTruncated = rows.length > APP_HELP_AUDIT_SCAN_MAX;
    const toScan = auditScanTruncated
      ? rows.slice(0, APP_HELP_AUDIT_SCAN_MAX)
      : rows;

    let appHelpTotal = 0;
    let faqHit = 0;
    let procedimientosKbEmpty = 0;
    let appHelpWithoutFaq = 0;

    const bucketNoFaq = new Map<
      string,
      { normalizedQuestion: string; count: number }
    >();
    const bucketKbEmpty = new Map<
      string,
      { normalizedQuestion: string; count: number }
    >();

    for (const row of toScan) {
      const mensaje = String(row.mensaje ?? '');
      if (!looksLikeAppHelpDatosPersonales(mensaje)) continue;

      appHelpTotal++;
      const { tools, resultCount } = this.parseAuditDatosJson(
        row.datos_consultados,
      );
      const hasFaq = tools.includes('validated_faq');
      const intent = String(row.intent_detectado ?? '')
        .trim()
        .toLowerCase();

      if (hasFaq) {
        faqHit++;
      } else {
        appHelpWithoutFaq++;
      }

      if (
        intent === 'procedimientos' &&
        tools.includes('knowledge_base_articulos') &&
        resultCount === 0
      ) {
        procedimientosKbEmpty++;
      }

      const normalized = this.validatedFaq.normalizeQuestionForHash(mensaje);
      if (!normalized) continue;
      const qh = this.validatedFaq.questionHash(normalized);

      if (!hasFaq) {
        const prev = bucketNoFaq.get(qh);
        bucketNoFaq.set(qh, {
          normalizedQuestion: normalized,
          count: (prev?.count ?? 0) + 1,
        });
      }

      if (
        intent === 'procedimientos' &&
        tools.includes('knowledge_base_articulos') &&
        resultCount === 0
      ) {
        const prevK = bucketKbEmpty.get(qh);
        bucketKbEmpty.set(qh, {
          normalizedQuestion: normalized,
          count: (prevK?.count ?? 0) + 1,
        });
      }
    }

    const sortTop = (
      m: Map<string, { normalizedQuestion: string; count: number }>,
    ) =>
      [...m.entries()]
        .filter(([, v]) => v.count >= minCount)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit);

    const topNoFaq = sortTop(bucketNoFaq);
    const topKb = sortTop(bucketKbEmpty);

    const hashes = new Set<string>();
    for (const [h] of topNoFaq) hashes.add(h);
    for (const [h] of topKb) hashes.add(h);

    const faqRows =
      hashes.size > 0
        ? await this.prisma.assistantValidatedFaq.findMany({
            where: {
              question_hash: { in: [...hashes] },
              locale: 'es',
              active: true,
            },
            select: { question_hash: true },
          })
        : [];
    const faqHashSet = new Set(faqRows.map((r) => r.question_hash));

    const mapTop = (
      entries: Array<[string, { normalizedQuestion: string; count: number }]>,
    ) =>
      entries.map(([questionHash, v]) => ({
        normalizedQuestion: v.normalizedQuestion,
        questionHash,
        count: v.count,
        inValidatedFaq: faqHashSet.has(questionHash),
      }));

    return {
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        timezoneNote:
          'Filas de assistant_audit_log.created_at en UTC. Segmento app-help = misma heurística looksLikeAppHelpDatosPersonales(mensaje).',
      },
      params: { limit, minCount },
      filters: {
        segment: 'app_help_datos_personales',
        auditRowsScanned: toScan.length,
        auditScanTruncated,
        auditScanMax: APP_HELP_AUDIT_SCAN_MAX,
      },
      counts: {
        appHelpTotal,
        faqHit,
        procedimientosKbEmpty,
        appHelpWithoutFaq,
      },
      topNormalizedQuestions: mapTop(topNoFaq),
      topProcedimientosKbEmpty: mapTop(topKb),
      notes: [
        'faqHit: tools incluye validated_faq en datos_consultados (JSON).',
        'procedimientosKbEmpty: intent procedimientos + knowledge_base_articulos + resultCount 0.',
        'appHelpWithoutFaq: segmento app-help sin FAQ en tools.',
        'Normalización/hash = AssistantValidatedFaqService (misma que FAQ).',
        auditScanTruncated
          ? `Solo se analizaron las últimas ${APP_HELP_AUDIT_SCAN_MAX} filas del rango (orden por id desc).`
          : 'Sin truncado de escaneo.',
      ],
    };
  }

  /** Parsea JSON de `datos_consultados` del audit (v2). */
  parseAuditDatosJson(datos: string | null | undefined): {
    tools: string[];
    resultCount: number;
  } {
    if (datos == null || String(datos).trim() === '') {
      return { tools: [], resultCount: 0 };
    }
    try {
      const o = JSON.parse(String(datos)) as Record<string, unknown>;
      const tools = Array.isArray(o.tools)
        ? (o.tools as unknown[]).map((t) => String(t))
        : [];
      const rc = o.resultCount;
      const resultCount =
        typeof rc === 'number' && Number.isFinite(rc)
          ? rc
          : Number.parseInt(String(rc ?? '0'), 10) || 0;
      return { tools, resultCount };
    } catch {
      return { tools: [], resultCount: 0 };
    }
  }
}
