import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const COMMENT_MAX = 4000;

@Injectable()
export class AssistantMessageFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  private isUuid(v: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    );
  }

  /**
   * Salvează feedback pentru un mesaj assistant; verifică că mesajul aparține unei conversații a utilizatorului.
   */
  async submitFeedback(
    userId: string,
    messageId: string,
    rating: string,
    comment: string | undefined,
  ): Promise<{ ok: true; id: string }> {
    if (!userId?.trim()) {
      throw new BadRequestException('Identidad de usuario requerida');
    }
    const mid = (messageId || '').trim();
    if (!mid || !this.isUuid(mid)) {
      throw new BadRequestException('messageId inválido');
    }
    const r = (rating || '').trim().toLowerCase();
    if (r !== 'positive' && r !== 'negative') {
      throw new BadRequestException('rating debe ser "positive" o "negative"');
    }
    let c: string | null = null;
    if (comment != null && String(comment).trim() !== '') {
      const t = String(comment).replace(/\0/g, '').trim();
      if (t.length > COMMENT_MAX) {
        throw new BadRequestException(
          `comment demasiado largo (máx. ${COMMENT_MAX} caracteres)`,
        );
      }
      c = t;
    }

    const msg = await this.prisma.assistantMessage.findUnique({
      where: { id: mid },
      select: {
        id: true,
        role: true,
        conversation_id: true,
        conversation: { select: { usuario_id: true } },
      },
    });
    if (!msg) {
      throw new NotFoundException('Mensaje no encontrado');
    }
    if (msg.role !== 'assistant') {
      throw new BadRequestException(
        'Solo se puede valorar mensajes del asistente',
      );
    }
    if (msg.conversation.usuario_id !== userId) {
      throw new ForbiddenException('No puedes valorar este mensaje');
    }

    try {
      const row = await this.prisma.assistantMessageFeedback.create({
        data: {
          message_id: msg.id,
          conversation_id: msg.conversation_id,
          usuario_id: userId,
          rating: r,
          comment: c,
        },
        select: { id: true },
      });
      return { ok: true, id: row.id };
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(
          'Ya enviaste tu opinión sobre este mensaje',
        );
      }
      // Migración pendiente o BD sin tabla (evita 500 genérico en entornos no migrados)
      if (
        e?.code === 'P2021' ||
        (typeof e?.message === 'string' &&
          e.message.includes('does not exist in the current database'))
      ) {
        throw new ServiceUnavailableException(
          'Valoración no disponible: falta la tabla en la base de datos. Ejecuta `npx prisma migrate deploy` en el backend (o el script prisma-migrate-env para cada cliente).',
        );
      }
      throw e;
    }
  }
}
