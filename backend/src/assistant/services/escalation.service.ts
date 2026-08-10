import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../../services/telegram.service';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * Creează un ticket de escalare
   */
  async createTicket(data: {
    usuario_id: string;
    usuario_nombre: string;
    usuario_rol: string | null;
    mensaje_original: string;
    intent_detectado?: string;
    contexto?: string;
    prioridad?: string;
  }): Promise<string> {
    try {
      const ticketId = `TICKET-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      const query = `
        INSERT INTO tickets_ai (
          id,
          usuario_id,
          usuario_nombre,
          usuario_rol,
          mensaje_original,
          intent_detectado,
          contexto,
          estado,
          prioridad,
          created_at,
          updated_at
        ) VALUES (
          ${this.escapeSql(ticketId)},
          ${this.escapeSql(data.usuario_id)},
          ${this.escapeSql(data.usuario_nombre)},
          ${data.usuario_rol ? this.escapeSql(data.usuario_rol) : 'NULL'},
          ${this.escapeSql(data.mensaje_original)},
          ${data.intent_detectado ? this.escapeSql(data.intent_detectado) : 'NULL'},
          ${data.contexto ? this.escapeSql(data.contexto) : 'NULL'},
          'pendiente',
          ${this.escapeSql(data.prioridad || 'normal')},
          NOW(),
          NOW()
        )
      `;

      await this.prisma.$executeRawUnsafe(query);

      this.logger.log(
        `✅ Ticket creado: ${ticketId} para usuario ${data.usuario_id}`,
      );

      // Notifică admin prin Telegram
      await this.notifyAdmin(ticketId, data);

      return ticketId;
    } catch (error: any) {
      this.logger.error(
        `❌ Error creando ticket: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Notifică admin despre nou ticket
   */
  private async notifyAdmin(ticketId: string, data: any): Promise<void> {
    try {
      const mensaje =
        `🚨 Nuevo ticket de asistente AI\n\n` +
        `📋 ID: ${ticketId}\n` +
        `👤 Usuario: ${data.usuario_nombre} (${data.usuario_id})\n` +
        `🎭 Rol: ${data.usuario_rol || 'N/A'}\n` +
        `💬 Mensaje: ${data.mensaje_original.substring(0, 200)}...\n` +
        `🔍 Intent: ${data.intent_detectado || 'N/A'}\n` +
        `⚡ Prioridad: ${data.prioridad || 'normal'}`;

      await this.telegramService.sendMessage(mensaje);

      this.logger.log(
        `✅ Notificación Telegram enviada para ticket ${ticketId}`,
      );
    } catch (error: any) {
      this.logger.warn(
        `⚠️ Error enviando notificación Telegram: ${error.message}`,
      );
      // No lanzamos error - el ticket ya está creado
    }
  }

  private escapeSql(value: string): string {
    if (!value) return "''";
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  }
}
