import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomUUID } from 'crypto';

const TITLE_MAX = 50;
const CONTENT_MAX = 32000;

@Injectable()
export class AssistantConversationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Păstrăm doar text plat, fără payload sensibil. */
  sanitizeContent(raw: string): string {
    if (raw == null || typeof raw !== 'string') {
      return '';
    }
    let t = raw.replace(/\0/g, '').trim();
    t = t.replace(/<[^>]*>/g, '');
    if (t.length > CONTENT_MAX) {
      t = `${t.slice(0, CONTENT_MAX)}…`;
    }
    return t;
  }

  titleFromFirstMessage(userText: string): string {
    const s = this.sanitizeContent(userText).replace(/\s+/g, ' ').trim();
    if (!s) {
      return 'Conversație';
    }
    return s.length <= TITLE_MAX ? s : `${s.slice(0, TITLE_MAX - 1)}…`;
  }

  private isUuid(v: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    );
  }

  /**
   * Salvează mesajul utilizatorului și răspunsul assistant (doar text).
   * @returns id conversație
   */
  async appendExchange(
    userId: string,
    conversationId: string | null | undefined,
    userText: string,
    assistantText: string,
  ): Promise<string> {
    const u = this.sanitizeContent(userText);
    const a = this.sanitizeContent(assistantText);
    if (!u) {
      throw new BadRequestException('Mesaj utilizator gol');
    }

    return this.prisma.$transaction(async (tx) => {
      let convId: string;

      if (conversationId) {
        if (!this.isUuid(conversationId)) {
          throw new BadRequestException('conversationId invalid');
        }
        const existing = await tx.assistantConversation.findFirst({
          where: { id: conversationId, usuario_id: userId },
          select: { id: true },
        });
        if (!existing) {
          throw new NotFoundException(
            'Conversația nu există sau nu îți aparține',
          );
        }
        convId = existing.id;
      } else {
        convId = randomUUID();
        await tx.assistantConversation.create({
          data: {
            id: convId,
            usuario_id: userId,
            title: this.titleFromFirstMessage(u),
          },
        });
      }

      await tx.assistantMessage.create({
        data: {
          id: randomUUID(),
          conversation_id: convId,
          role: 'user',
          content: u,
        },
      });

      if (a) {
        await tx.assistantMessage.create({
          data: {
            id: randomUUID(),
            conversation_id: convId,
            role: 'assistant',
            content: a,
          },
        });
      }

      await tx.assistantConversation.update({
        where: { id: convId },
        data: { updated_at: new Date() },
      });

      return convId;
    });
  }

  async listForUser(userId: string, take = 40) {
    const rows = await this.prisma.assistantConversation.findMany({
      where: { usuario_id: userId },
      orderBy: { updated_at: 'desc' },
      take,
      select: {
        id: true,
        title: true,
        created_at: true,
        updated_at: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  async getMessagesForUser(userId: string, conversationId: string) {
    if (!this.isUuid(conversationId)) {
      throw new BadRequestException('Id conversație invalid');
    }
    const conv = await this.prisma.assistantConversation.findFirst({
      where: { id: conversationId, usuario_id: userId },
      select: { id: true },
    });
    if (!conv) {
      throw new NotFoundException('Conversația nu există sau nu îți aparține');
    }

    const messages = await this.prisma.assistantMessage.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        created_at: true,
      },
    });

    return messages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      createdAt: m.created_at.toISOString(),
    }));
  }

  /** Șterge toate conversațiile utilizatorului (mesajele dispar prin onDelete: Cascade). */
  async deleteAllForUser(
    userId: string,
  ): Promise<{ deletedConversations: number }> {
    const result = await this.prisma.assistantConversation.deleteMany({
      where: { usuario_id: userId },
    });
    return { deletedConversations: result.count };
  }
}
