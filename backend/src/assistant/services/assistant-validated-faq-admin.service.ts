import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ASSISTANT_FAQ_WILDCARD_INTENT,
  AssistantValidatedFaqService,
} from './assistant-validated-faq.service';

export type UpsertValidatedFaqInput = {
  normalizedQuestion?: string;
  replyText?: string;
  intent?: string;
  locale?: string;
  active?: boolean;
  priority?: number;
  /** analytics: candidate | procedimientos_kb_empty */
  source?: string;
};

@Injectable()
export class AssistantValidatedFaqAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validatedFaq: AssistantValidatedFaqService,
  ) {}

  async getByCompositeKey(
    questionHash: string,
    intent: string,
    locale: string,
  ) {
    const h = (questionHash || '').trim();
    const i = (intent || '').trim();
    const l = (locale || '').trim();
    if (!h || !i || !l) {
      throw new BadRequestException(
        'question_hash, intent y locale son obligatorios',
      );
    }
    const row = await this.prisma.assistantValidatedFaq.findUnique({
      where: {
        question_hash_intent_locale: {
          question_hash: h,
          intent: i,
          locale: l,
        },
      },
    });
    if (!row) {
      throw new NotFoundException('No existe FAQ para esa clave');
    }
    return this.toApi(row);
  }

  async upsert(input: UpsertValidatedFaqInput) {
    const rawQ = (input.normalizedQuestion ?? '').trim();
    const reply = (input.replyText ?? '').trim();
    if (!rawQ) {
      throw new BadRequestException('normalizedQuestion es obligatorio');
    }
    if (!reply) {
      throw new BadRequestException('replyText es obligatorio');
    }

    const normalized = this.validatedFaq.normalizeQuestionForHash(rawQ);
    if (!normalized) {
      throw new BadRequestException(
        'Tras normalizar, la pregunta queda vacía; revisa el texto.',
      );
    }

    const questionHash = this.validatedFaq.questionHash(normalized);
    const intent = (input.intent ?? ASSISTANT_FAQ_WILDCARD_INTENT).trim();
    const locale = (input.locale ?? 'es').trim().toLowerCase();

    if (intent.length === 0 || intent.length > 64) {
      throw new BadRequestException('intent inválido (1–64 caracteres)');
    }
    if (locale.length === 0 || locale.length > 16) {
      throw new BadRequestException('locale inválido (1–16 caracteres)');
    }

    const normalizedStored = normalized.slice(0, 512);
    const priority = Number.isFinite(Number(input.priority))
      ? Math.trunc(Number(input.priority))
      : 0;
    const active = input.active !== false;

    const sourceType =
      input.source === 'candidate' || input.source === 'procedimientos_kb_empty'
        ? input.source
        : undefined;

    const row = await this.prisma.assistantValidatedFaq.upsert({
      where: {
        question_hash_intent_locale: {
          question_hash: questionHash,
          intent,
          locale,
        },
      },
      create: {
        id: randomUUID(),
        question_hash: questionHash,
        normalized_question: normalizedStored,
        intent,
        locale,
        reply_text: reply,
        active,
        priority,
        source_type: sourceType ?? null,
      },
      update: {
        normalized_question: normalizedStored,
        reply_text: reply,
        active,
        priority,
        ...(sourceType !== undefined ? { source_type: sourceType } : {}),
      },
    });

    return this.toApi(row);
  }

  private toApi(row: {
    id: string;
    question_hash: string;
    normalized_question: string;
    intent: string;
    locale: string;
    reply_text: string;
    active: boolean;
    priority: number;
    source_type: string | null;
    created_at: Date;
    updated_at: Date;
  }) {
    return {
      id: row.id,
      questionHash: row.question_hash,
      normalizedQuestion: row.normalized_question,
      intent: row.intent,
      locale: row.locale,
      replyText: row.reply_text,
      active: row.active,
      priority: row.priority,
      sourceType: row.source_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
