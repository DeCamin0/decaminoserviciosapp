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
   * @returns id conversație și id mesaj assistant (pentru feedback UI), dacă există răspuns salvat
   */
  async appendExchange(
    userId: string,
    conversationId: string | null | undefined,
    userText: string,
    assistantText: string,
    assistantResponseSource?: string | null,
  ): Promise<{ conversationId: string; assistantMessageId: string | null }> {
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

      let assistantMessageId: string | null = null;
      if (a) {
        assistantMessageId = randomUUID();
        await tx.assistantMessage.create({
          data: {
            id: assistantMessageId,
            conversation_id: convId,
            role: 'assistant',
            content: a,
            ...(assistantResponseSource != null &&
            String(assistantResponseSource).trim() !== ''
              ? { response_source: String(assistantResponseSource).trim() }
              : {}),
          },
        });
      }

      await tx.assistantConversation.update({
        where: { id: convId },
        data: { updated_at: new Date() },
      });

      return { conversationId: convId, assistantMessageId };
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

  /**
   * Admin: angajați care au cel puțin o conversație archivată (ordenat după ultima activitate).
   */
  async listEmpleadosWithArchivedConversations(maxRows = 500): Promise<
    Array<{
      codigo: string;
      nombre: string;
      estado: string | null;
      conversationCount: number;
      lastActivity: string | null;
    }>
  > {
    const grouped = await this.prisma.assistantConversation.groupBy({
      by: ['usuario_id'],
      _count: { id: true },
      _max: { updated_at: true },
    });
    const sorted = [...grouped].sort(
      (a, b) =>
        (b._max.updated_at?.getTime() ?? 0) -
        (a._max.updated_at?.getTime() ?? 0),
    );
    const sliced = sorted.slice(0, Math.max(1, Math.min(maxRows, 2000)));
    const codigos = sliced.map((g) => g.usuario_id);
    if (codigos.length === 0) {
      return [];
    }
    const users = await this.prisma.user.findMany({
      where: { CODIGO: { in: codigos } },
      select: {
        CODIGO: true,
        NOMBRE_APELLIDOS: true,
        ESTADO: true,
      },
    });
    const map = new Map(users.map((u) => [u.CODIGO, u]));
    return sliced.map((g) => ({
      codigo: g.usuario_id,
      nombre: map.get(g.usuario_id)?.NOMBRE_APELLIDOS?.trim() || g.usuario_id,
      estado: map.get(g.usuario_id)?.ESTADO ?? null,
      conversationCount: g._count.id,
      lastActivity: g._max.updated_at?.toISOString() ?? null,
    }));
  }
}
