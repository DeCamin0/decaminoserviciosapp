import { Injectable, Logger } from '@nestjs/common';
import { IntentType, IntentResult } from './intent-classifier.service';
import {
  ASSISTANT_KB_QUERY_LIMIT,
  ASSISTANT_SESSION_MAX_MESSAGE_SNIPPET_CHARS,
  ASSISTANT_SESSION_MAX_TRACKED_USERS,
  ASSISTANT_SESSION_TTL_MS,
} from '../constants/assistant-session.constants';
import type { SessionDataSummary } from '../types/assistant-memory.types';

/**
 * Memoria de sesión (corta): solo in-process, TTL fijo, sin filas crudas.
 * v2: sustituir backing store (Redis/DB) manteniendo esta interfaz.
 */
export interface ConversationContext {
  schemaVersion: 1;
  userId: string;
  lastIntent: IntentType | null;
  lastEntities: IntentResult['entidades'] | null;
  lastMessageSnippet: string | null;
  lastDataSummary: SessionDataSummary | null;
  updatedAt: number;
}

@Injectable()
export class ConversationContextService {
  private readonly logger = new Logger(ConversationContextService.name);
  private readonly contexts = new Map<string, ConversationContext>();

  private snippetMessage(message: string): string {
    const t = message.trim();
    if (t.length <= ASSISTANT_SESSION_MAX_MESSAGE_SNIPPET_CHARS) {
      return t;
    }
    return `${t.slice(0, ASSISTANT_SESSION_MAX_MESSAGE_SNIPPET_CHARS)}…`;
  }

  private buildDataSummary(
    intent: IntentType,
    data: unknown,
    kbCapped: boolean,
  ): SessionDataSummary | null {
    const source: SessionDataSummary['source'] =
      intent === IntentType.PROCEDIMIENTOS ? 'knowledge_base' : 'live_data';

    if (data === null || data === undefined) {
      return { source, rowCount: 0, cappedByLimit: false };
    }
    if (Array.isArray(data)) {
      return {
        source,
        rowCount: data.length,
        cappedByLimit: kbCapped,
      };
    }
    if (typeof data === 'object' && data !== null) {
      const o = data as Record<string, unknown>;
      if (
        Array.isArray(o.solicitudes) &&
        Array.isArray(o.ausencias_calendario)
      ) {
        return {
          source,
          rowCount: o.solicitudes.length + o.ausencias_calendario.length,
          cappedByLimit: false,
        };
      }
      if (Object.keys(o).length > 0) {
        return { source, rowCount: 1, cappedByLimit: false };
      }
    }
    return { source, rowCount: 0, cappedByLimit: false };
  }

  private evictOldestIfAtCapacity(forUserId: string): void {
    if (this.contexts.size < ASSISTANT_SESSION_MAX_TRACKED_USERS) {
      return;
    }
    if (this.contexts.has(forUserId)) {
      return;
    }
    let oldestId: string | null = null;
    let oldestTs = Infinity;
    for (const [id, ctx] of this.contexts.entries()) {
      if (ctx.updatedAt < oldestTs) {
        oldestTs = ctx.updatedAt;
        oldestId = id;
      }
    }
    if (oldestId) {
      this.contexts.delete(oldestId);
      this.logger.warn(
        `Session context cap (${ASSISTANT_SESSION_MAX_TRACKED_USERS}): evicted user=${oldestId}`,
      );
    }
  }

  /**
   * Salvează contextul conversației pentru un utilizator
   */
  saveContext(
    userId: string,
    intent: IntentType,
    entities: IntentResult['entidades'] | null,
    message: string,
    data: unknown,
  ): void {
    this.evictOldestIfAtCapacity(userId);

    const kbCapped =
      intent === IntentType.PROCEDIMIENTOS &&
      Array.isArray(data) &&
      data.length >= ASSISTANT_KB_QUERY_LIMIT;

    const context: ConversationContext = {
      schemaVersion: 1,
      userId,
      lastIntent: intent,
      lastEntities: entities || null,
      lastMessageSnippet: this.snippetMessage(message),
      lastDataSummary: this.buildDataSummary(intent, data, kbCapped),
      updatedAt: Date.now(),
    };

    this.contexts.set(userId, context);
    const entityKeys =
      entities && typeof entities === 'object'
        ? Object.keys(entities as object).join(',')
        : '';
    this.logger.log(
      `💾 Context user=${userId} intent=${intent} entityKeys=${entityKeys || '-'} summary=${context.lastDataSummary?.rowCount ?? 0} rows`,
    );

    this.cleanupExpiredContexts();
  }

  /**
   * Obține contextul conversației pentru un utilizator
   */
  getContext(userId: string): ConversationContext | null {
    const context = this.contexts.get(userId);

    if (!context) {
      return null;
    }

    const age = Date.now() - context.updatedAt;
    if (age > ASSISTANT_SESSION_TTL_MS) {
      this.contexts.delete(userId);
      this.logger.log(`⏰ Context expirat pentru ${userId} (age: ${age}ms)`);
      return null;
    }

    return context;
  }

  /**
   * Extrage entități din context pentru întrebări de follow-up
   */
  /** Solo claves que suelen cambiar en un follow-up corto (mes / día / tipo fichajes). */
  private isTemporalEntityPatch(
    e: IntentResult['entidades'] | null | undefined,
  ): boolean {
    if (!e || Object.keys(e).length === 0) {
      return true;
    }
    const allowed = new Set(['mes', 'fecha', 'year', 'tipo']);
    return Object.keys(e).every((k) => allowed.has(k));
  }

  enrichEntitiesWithContext(
    userId: string,
    currentEntities: IntentResult['entidades'] | null,
    currentIntent: IntentType,
  ): IntentResult['entidades'] | null {
    const context = this.getContext(userId);

    if (!context) {
      return currentEntities;
    }

    if (context.lastIntent !== currentIntent) {
      this.logger.log(
        `🔄 Intent diferit (${currentIntent} vs ${context.lastIntent}), nu folosim context`,
      );
      return currentEntities;
    }

    const prev = context.lastEntities || {};
    const cur = currentEntities || {};

    if (Object.keys(cur).length === 0) {
      if (Object.keys(prev).length > 0) {
        this.logger.log(
          `📋 Folosim entități din context (chei): ${Object.keys(prev).join(',')}`,
        );
        return { ...prev };
      }
      return currentEntities;
    }

    if (this.isTemporalEntityPatch(cur)) {
      const merged = { ...prev, ...cur };
      this.logger.log(
        `📋 Merge context + patch temporal: ${Object.keys(merged).join(',')}`,
      );
      return merged;
    }

    this.logger.log(`✅ Entități complete în mesaj, fără merge profund`);
    return { ...cur };
  }

  /**
   * Verifică dacă o întrebare este un follow-up
   */
  isFollowUpQuestion(
    userId: string,
    currentIntent: IntentType,
    currentEntities: IntentResult['entidades'] | null,
  ): boolean {
    const context = this.getContext(userId);

    if (!context) {
      return false;
    }

    if (context.lastIntent !== currentIntent) {
      return false;
    }

    if (!currentEntities || Object.keys(currentEntities).length === 0) {
      this.logger.log(
        `🔗 Detectat follow-up pentru ${userId}: intent=${currentIntent}`,
      );
      return true;
    }

    if (this.isTemporalEntityPatch(currentEntities)) {
      this.logger.log(
        `🔗 Follow-up (patch temporal) pentru ${userId}: intent=${currentIntent}`,
      );
      return true;
    }

    return false;
  }

  clearContext(userId: string): void {
    this.contexts.delete(userId);
    this.logger.log(`🗑️ Context șters pentru ${userId}`);
  }

  private cleanupExpiredContexts(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, context] of this.contexts.entries()) {
      const age = now - context.updatedAt;
      if (age > ASSISTANT_SESSION_TTL_MS) {
        this.contexts.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`🧹 Cleanup: ${cleaned} contexte expirate șterse`);
    }
  }

  getStats(): { active: number; total: number } {
    const now = Date.now();
    let active = 0;

    for (const context of this.contexts.values()) {
      const age = now - context.updatedAt;
      if (age <= ASSISTANT_SESSION_TTL_MS) {
        active++;
      }
    }

    return {
      active,
      total: this.contexts.size,
    };
  }
}
