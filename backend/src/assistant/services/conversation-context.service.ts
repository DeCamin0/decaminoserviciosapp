import { Injectable, Logger } from '@nestjs/common';
import { IntentType, IntentResult } from './intent-classifier.service';

export interface ConversationContext {
  userId: string;
  lastIntent: IntentType | null;
  lastEntities: IntentResult['entidades'] | null;
  lastMessage: string | null;
  lastData: any[] | any | null;
  timestamp: number;
}

@Injectable()
export class ConversationContextService {
  private readonly logger = new Logger(ConversationContextService.name);
  // Stocare context în memorie (poate fi mutat în Redis sau DB pentru producție)
  private contexts: Map<string, ConversationContext> = new Map();
  private readonly TTL = 15 * 60 * 1000; // 15 minute TTL pentru context

  /**
   * Salvează contextul conversației pentru un utilizator
   */
  saveContext(
    userId: string,
    intent: IntentType,
    entities: IntentResult['entidades'] | null,
    message: string,
    data: any[] | any | null,
  ): void {
    const context: ConversationContext = {
      userId,
      lastIntent: intent,
      lastEntities: entities || null,
      lastMessage: message,
      lastData: data,
      timestamp: Date.now(),
    };

    this.contexts.set(userId, context);
    this.logger.log(`💾 Context salvat pentru ${userId}: intent=${intent}, entities=${JSON.stringify(entities)}`);
    
    // Cleanup automat pentru contexte expirate
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

    // Verifică dacă contextul a expirat
    const age = Date.now() - context.timestamp;
    if (age > this.TTL) {
      this.contexts.delete(userId);
      this.logger.log(`⏰ Context expirat pentru ${userId} (age: ${age}ms)`);
      return null;
    }

    return context;
  }

  /**
   * Extrage entități din context pentru întrebări de follow-up
   * Dacă întrebarea curentă nu are entități specifice, folosește entitățile din context
   */
  enrichEntitiesWithContext(
    userId: string,
    currentEntities: IntentResult['entidades'] | null,
    currentIntent: IntentType,
  ): IntentResult['entidades'] | null {
    const context = this.getContext(userId);
    
    if (!context) {
      return currentEntities;
    }

    // Dacă intent-ul curent este diferit de ultimul, nu folosim contextul
    if (context.lastIntent !== currentIntent) {
      this.logger.log(`🔄 Intent diferit (${currentIntent} vs ${context.lastIntent}), nu folosim context`);
      return currentEntities;
    }

    // Dacă avem entități în întrebarea curentă, le folosim (au prioritate)
    if (currentEntities && Object.keys(currentEntities).length > 0) {
      this.logger.log(`✅ Entități în întrebarea curentă, nu folosim context`);
      return currentEntities;
    }

    // Dacă nu avem entități în întrebarea curentă, folosim entitățile din context
    if (context.lastEntities && Object.keys(context.lastEntities).length > 0) {
      this.logger.log(`📋 Folosim entități din context: ${JSON.stringify(context.lastEntities)}`);
      return context.lastEntities;
    }

    return currentEntities;
  }

  /**
   * Verifică dacă o întrebare este un follow-up (nu are entități specifice dar are context)
   */
  isFollowUpQuestion(userId: string, currentIntent: IntentType, currentEntities: IntentResult['entidades'] | null): boolean {
    const context = this.getContext(userId);
    
    if (!context) {
      return false;
    }

    // Dacă intent-ul este același și nu avem entități noi, e probabil un follow-up
    if (context.lastIntent === currentIntent && (!currentEntities || Object.keys(currentEntities).length === 0)) {
      this.logger.log(`🔗 Detectat follow-up pentru ${userId}: intent=${currentIntent}`);
      return true;
    }

    return false;
  }

  /**
   * Șterge contextul pentru un utilizator
   */
  clearContext(userId: string): void {
    this.contexts.delete(userId);
    this.logger.log(`🗑️ Context șters pentru ${userId}`);
  }

  /**
   * Cleanup automat pentru contexte expirate
   */
  private cleanupExpiredContexts(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, context] of this.contexts.entries()) {
      const age = now - context.timestamp;
      if (age > this.TTL) {
        this.contexts.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`🧹 Cleanup: ${cleaned} contexte expirate șterse`);
    }
  }

  /**
   * Obține statistici despre contexte active
   */
  getStats(): { active: number; total: number } {
    const now = Date.now();
    let active = 0;

    for (const context of this.contexts.values()) {
      const age = now - context.timestamp;
      if (age <= this.TTL) {
        active++;
      }
    }

    return {
      active,
      total: this.contexts.size,
    };
  }
}

