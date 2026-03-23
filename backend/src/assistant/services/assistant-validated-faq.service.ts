import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntentType } from './intent-classifier.service';

/** Intent wildcard pentru rânduri FAQ aplicabile la orice intenție (evită UNIQUE cu NULL). */
export const ASSISTANT_FAQ_WILDCARD_INTENT = '__ANY__';

export type AssistantValidatedFaqMatch = {
  id: string;
  replyText: string;
  priority: number;
};

@Injectable()
export class AssistantValidatedFaqService {
  constructor(private readonly prisma: PrismaService) {}

  /** Normalizare stabilă pentru hash: minuscule, fără diacritice, spații collapse. */
  normalizeQuestionForHash(raw: string): string {
    if (raw == null || typeof raw !== 'string') {
      return '';
    }
    let t = raw.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
    t = t.replace(/\s+/g, ' ');
    return t;
  }

  questionHash(normalized: string): string {
    return createHash('sha256').update(normalized, 'utf8').digest('hex');
  }

  /**
   * Ordine: intenție exactă + hash, apoi wildcard + hash.
   * Locale: `responseLocale` apoi `es`.
   */
  async findMatch(
    intent: IntentType,
    userMessage: string,
    responseLocale: string,
  ): Promise<AssistantValidatedFaqMatch | null> {
    const normalized = this.normalizeQuestionForHash(userMessage);
    if (!normalized) {
      return null;
    }
    const hash = this.questionHash(normalized);
    const locales = this.localeCandidates(responseLocale);

    for (const loc of locales) {
      const row = await this.prisma.assistantValidatedFaq.findFirst({
        where: {
          question_hash: hash,
          intent: String(intent),
          locale: loc,
          active: true,
        },
        orderBy: { priority: 'desc' },
      });
      if (row) {
        return {
          id: row.id,
          replyText: row.reply_text,
          priority: row.priority,
        };
      }
    }

    for (const loc of locales) {
      const row = await this.prisma.assistantValidatedFaq.findFirst({
        where: {
          question_hash: hash,
          intent: ASSISTANT_FAQ_WILDCARD_INTENT,
          locale: loc,
          active: true,
        },
        orderBy: { priority: 'desc' },
      });
      if (row) {
        return {
          id: row.id,
          replyText: row.reply_text,
          priority: row.priority,
        };
      }
    }

    return null;
  }

  private localeCandidates(responseLocale: string): string[] {
    const base = String(responseLocale || 'es')
      .trim()
      .toLowerCase();
    if (base === 'es') {
      return ['es'];
    }
    return [...new Set([base, 'es'])];
  }
}
