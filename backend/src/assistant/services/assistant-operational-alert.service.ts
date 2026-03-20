import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from '../../services/telegram.service';
import {
  assistantMessageSignature,
  assistantTimeBucket15Min,
} from '../utils/assistant-business-signals.util';
import {
  buildAssistantAlertPayload,
  shouldSendTelegramAlertPure,
  type OutcomeEvaluationResult,
} from '../utils/assistant-outcome-eval.util';
import type { BusinessLexiconSignals } from '../utils/assistant-business-signals.util';
import { IntentType } from './intent-classifier.service';

interface StreakEntry {
  windowStart: number;
  count: number;
}

@Injectable()
export class AssistantOperationalAlertService {
  private readonly logger = new Logger(AssistantOperationalAlertService.name);
  private readonly dedupSentAt = new Map<string, number>();
  private readonly similarStreaks = new Map<string, StreakEntry>();
  private readonly STREAK_WINDOW_MS = 15 * 60 * 1000;
  private readonly DEDUP_WINDOW_MS = 15 * 60 * 1000;

  constructor(
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
  ) {}

  isOperationalTelegramEnabled(): boolean {
    const v = String(
      this.configService.get<string>('ASSISTANT_OPS_TELEGRAM') ?? '1',
    )
      .trim()
      .toLowerCase();
    return v !== '0' && v !== 'false' && v !== 'no';
  }

  private clientLabel(): string | null {
    return (
      (this.configService.get<string>('TELEGRAM_CLIENT_LABEL') || '').trim() ||
      null
    );
  }

  /**
   * Incrementează streak pentru mesaje slabe similare (fereastră 15 min).
   */
  recordRecoverableOrUnknownStreak(
    mensaje: string,
    kind: 'recoverable' | 'desconocido',
  ): number {
    const sig = assistantMessageSignature(mensaje);
    const shortCluster = sig.split('|').slice(0, 4).join('|') || 'na';
    const bucket = assistantTimeBucket15Min();
    const key = `${bucket}|${kind}|${shortCluster}`;
    const now = Date.now();
    let e = this.similarStreaks.get(key);
    if (!e || now - e.windowStart > this.STREAK_WINDOW_MS) {
      e = { windowStart: now, count: 0 };
    }
    e.count += 1;
    this.similarStreaks.set(key, e);
    return e.count;
  }

  private isDedupBlocked(key: string, now: number): boolean {
    const last = this.dedupSentAt.get(key);
    return last != null && now - last < this.DEDUP_WINDOW_MS;
  }

  private markDedup(key: string, now: number): void {
    this.dedupSentAt.set(key, now);
    if (this.dedupSentAt.size > 500) {
      const cutoff = now - this.DEDUP_WINDOW_MS * 2;
      for (const [k, t] of this.dedupSentAt) {
        if (t < cutoff) this.dedupSentAt.delete(k);
      }
    }
  }

  async maybeSendAssistantOpsAlert(input: {
    mensaje: string;
    userId: string;
    evaluation: OutcomeEvaluationResult;
    initialIntent: IntentType;
    finalIntent: IntentType;
    recoverySucceeded: boolean;
    queryErrorTicketSent: boolean;
    signals: BusinessLexiconSignals;
    tools: string[];
    resultCount: number;
    recoveryAttempted: boolean;
  }): Promise<{ sent: boolean; reason: string | null }> {
    if (!this.isOperationalTelegramEnabled()) {
      return { sent: false, reason: null };
    }

    let similarCount = 0;
    if (input.evaluation.level === 'recoverable') {
      similarCount = this.recordRecoverableOrUnknownStreak(
        input.mensaje,
        'recoverable',
      );
    } else if (
      input.finalIntent === IntentType.DESCONOCIDO &&
      input.signals.anyBusiness
    ) {
      similarCount = this.recordRecoverableOrUnknownStreak(
        input.mensaje,
        'desconocido',
      );
    }

    const decision = shouldSendTelegramAlertPure({
      evaluation: input.evaluation,
      finalIntent: input.finalIntent,
      recoverySucceeded: input.recoverySucceeded,
      queryErrorTicketSent: input.queryErrorTicketSent,
      signals: input.signals,
      similarFailureCountInWindow: similarCount,
    });

    if (!decision.send || !decision.reason) {
      return { sent: false, reason: null };
    }

    const now = Date.now();
    const sig = assistantMessageSignature(input.mensaje);
    const dedupKey = `${assistantTimeBucket15Min(now)}|${decision.reason}|${sig.slice(0, 80)}`;

    if (this.isDedupBlocked(dedupKey, now)) {
      this.logger.debug(
        `Assistant ops alert deduped key=${dedupKey.slice(0, 60)}…`,
      );
      return { sent: false, reason: decision.reason };
    }

    const text = buildAssistantAlertPayload({
      reason: decision.reason,
      userId: input.userId,
      mensajePreview: input.mensaje,
      initialIntent: input.initialIntent,
      finalIntent: input.finalIntent,
      tools: input.tools,
      resultCount: input.resultCount,
      recoveryAttempted: input.recoveryAttempted,
      recoverySucceeded: input.recoverySucceeded,
      evaluationReasons: input.evaluation.reasons,
      clientLabel: this.clientLabel(),
    });

    try {
      if (this.telegramService.isGeneralConfigured()) {
        await this.telegramService.sendGeneralMessage(text, {
          disableMarkdown: true,
        });
      } else {
        await this.telegramService.sendMessage(text, { disableMarkdown: true });
      }
      this.markDedup(dedupKey, now);
      this.logger.warn(
        `Assistant operational Telegram sent reason=${decision.reason} user=${input.userId}`,
      );
      return { sent: true, reason: decision.reason };
    } catch (e: any) {
      this.logger.warn(`Assistant ops Telegram failed: ${e?.message ?? e}`);
      return { sent: false, reason: decision.reason };
    }
  }
}
