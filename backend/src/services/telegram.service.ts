import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private botToken: string | null = null;
  private chatId: string | null = null;
  private _isConfigured = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.botToken =
      this.configService.get<string>('TELEGRAM_BOT_TOKEN') || null;
    // Default chat ID from n8n workflow (Cron absente.json)
    this.chatId =
      this.configService.get<string>('TELEGRAM_CHAT_ID') || '-4990173907';

    if (this.botToken && this.chatId) {
      this._isConfigured = true;
      this.logger.log(
        `✅ Telegram service configured (chatId: ${this.chatId})`,
      );
    } else {
      this.logger.warn(
        '⚠️ Telegram not configured. Set TELEGRAM_BOT_TOKEN in .env to enable notifications. Using default chat ID from n8n workflow.',
      );
    }
  }

  /**
   * Verifică dacă Telegram este configurat
   */
  isConfigured(): boolean {
    return this._isConfigured;
  }

  /**
   * Trimite un mesaj pe Telegram
   */
  async sendMessage(message: string): Promise<void> {
    if (!this.isConfigured) {
      this.logger.warn('⚠️ Telegram not configured. Message not sent.');
      return;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'Markdown', // Folosim Markdown ca în n8n workflow (Cron absente.json)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Telegram API error: ${response.status} - ${JSON.stringify(errorData)}`,
        );
      }

      const result = await response.json();
      if (result.ok) {
        this.logger.log(
          `✅ Telegram message sent successfully to chat ${this.chatId}`,
        );
      } else {
        throw new Error(
          `Telegram API returned error: ${JSON.stringify(result)}`,
        );
      }
    } catch (error: any) {
      this.logger.error(`❌ Error sending Telegram message: ${error.message}`);
      // Nu aruncăm eroarea pentru a nu opri flow-ul principal
      // doar logăm eroarea
    }
  }

  /**
   * Trimite o notificare despre o absență nouă
   */
  async sendAusenciaNotification(ausenciaData: {
    codigo: string;
    nombre: string;
    tipo: string;
    fecha: string;
    motivo?: string;
  }): Promise<void> {
    // Folosim Markdown format ca în n8n workflow (Cron absente.json)
    const message = `
🟡 *Nouă absență înregistrată*

👤 *Angajat:* ${ausenciaData.nombre} (${ausenciaData.codigo})
📅 *Tip:* ${ausenciaData.tipo}
📆 *Data:* ${ausenciaData.fecha}
${ausenciaData.motivo ? `📝 *Motiv:* ${ausenciaData.motivo}` : ''}
    `.trim();

    await this.sendMessage(message);
  }
}
