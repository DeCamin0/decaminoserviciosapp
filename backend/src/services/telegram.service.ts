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
    if (!this.isConfigured()) {
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
   * IMPORTANT: Toate mesajele Telegram trebuie să fie în spaniolă
   */
  async sendAusenciaNotification(ausenciaData: {
    codigo: string;
    nombre: string;
    tipo: string;
    fecha: string;
    motivo?: string;
  }): Promise<void> {
    // Folosim Markdown format ca în n8n workflow (Cron absente.json)
    // IMPORTANT: Totul în spaniolă
    const message = `
🟡 *Nueva ausencia registrada*

👤 *Empleado:* ${ausenciaData.nombre} (${ausenciaData.codigo})
📅 *Tipo:* ${ausenciaData.tipo}
📆 *Fecha:* ${ausenciaData.fecha}
${ausenciaData.motivo ? `📝 *Motivo:* ${ausenciaData.motivo}` : ''}
    `.trim();

    await this.sendMessage(message);
  }

  /**
   * Escape-uiește caracterele speciale Markdown pentru Telegram
   * Nu escape-uiește liniuța `-` pentru a păstra formatul datelor (YYYY-MM-DD)
   */
  private escapeMarkdown(text: string): string {
    if (!text) return text;
    // Escape-uiește caracterele speciale Markdown: _ * [ ] ( ) ~ ` > # + = | { } . !
    // NU escape-uim liniuța `-` pentru a păstra formatul datelor
    return (
      text
        .replace(/\_/g, '\\_')
        .replace(/\*/g, '\\*')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/\~/g, '\\~')
        .replace(/\`/g, '\\`')
        .replace(/\>/g, '\\>')
        .replace(/\#/g, '\\#')
        .replace(/\+/g, '\\+')
        // Nu escape-uim liniuța - pentru a păstra formatul datelor (YYYY-MM-DD)
        // .replace(/\-/g, '\\-')
        .replace(/\=/g, '\\=')
        .replace(/\|/g, '\\|')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\./g, '\\.')
        .replace(/\!/g, '\\!')
    );
  }

  /**
   * Trimite o notificare despre o solicitare nouă/actualizată
   * IMPORTANT: Toate mesajele Telegram trebuie să fie în spaniolă
   */
  async sendSolicitudNotification(solicitudData: {
    codigo: string;
    nombre: string;
    tipo: string;
    fecha: string;
    estado: string;
    motivo?: string;
    accion: 'create' | 'update' | 'delete';
    tipoAnterior?: string;
    tipoNuevo?: string;
  }): Promise<void> {
    // Folosim Markdown format
    // IMPORTANT: Totul în spaniolă
    let actionEmoji = '';
    let actionText = '';

    if (solicitudData.accion === 'create') {
      actionEmoji = '🟢';
      actionText = 'Nueva solicitud creada';
    } else if (
      solicitudData.accion === 'update' &&
      solicitudData.tipoAnterior &&
      solicitudData.tipoNuevo
    ) {
      actionEmoji = '🔄';
      actionText = 'Ausencia convertida';
    } else if (solicitudData.accion === 'update') {
      actionEmoji = '🔵';
      actionText = 'Solicitud actualizada';
    } else {
      actionEmoji = '🔴';
      actionText = 'Solicitud eliminada';
    }

    const cambioTipoSection =
      solicitudData.tipoAnterior && solicitudData.tipoNuevo
        ? `\n🔄 *Cambio de tipo:*\n   De "${this.escapeMarkdown(solicitudData.tipoAnterior)}" a "${this.escapeMarkdown(solicitudData.tipoNuevo)}"\n`
        : '';

    // Escape-uiește valorile pentru a evita erorile de parsing Markdown
    const tipoEscaped = this.escapeMarkdown(solicitudData.tipo);
    const nombreEscaped = this.escapeMarkdown(solicitudData.nombre);
    const codigoEscaped = this.escapeMarkdown(solicitudData.codigo);
    const fechaEscaped = this.escapeMarkdown(solicitudData.fecha);
    const estadoEscaped = this.escapeMarkdown(solicitudData.estado);
    const motivoEscaped = solicitudData.motivo
      ? this.escapeMarkdown(solicitudData.motivo)
      : '';

    const message = `
${actionEmoji} *${actionText}*

👤 *Empleado:* ${nombreEscaped} (${codigoEscaped})
📋 *Tipo:* ${tipoEscaped}${cambioTipoSection}
📆 *Fecha:* ${fechaEscaped}
✅ *Estado:* ${estadoEscaped}
${motivoEscaped ? `📝 *Motivo:* ${motivoEscaped}` : ''}
    `.trim();

    await this.sendMessage(message);
  }
}
