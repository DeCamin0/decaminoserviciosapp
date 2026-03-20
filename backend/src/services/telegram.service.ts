import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  // Bot pentru gestoria (existent)
  private botToken: string | null = null;
  private chatId: string | null = null;
  private _isConfigured = false;

  // Bot pentru mesaje generale (erori, notificări, etc.)
  private generalBotToken: string | null = null;
  private generalChatId: string | null = null;
  private _isGeneralConfigured = false;

  /** Etichetă client pentru a distinge mesajele (ex: "HERA", "DeCamino"). Opțional din TELEGRAM_CLIENT_LABEL. */
  private clientLabel: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.clientLabel =
      (this.configService.get<string>('TELEGRAM_CLIENT_LABEL') || '').trim() ||
      null;
    // Configurare bot gestoria (existent)
    this.botToken =
      this.configService.get<string>('TELEGRAM_BOT_TOKEN') || null;
    // Default chat ID from n8n workflow (Cron absente.json)
    this.chatId =
      this.configService.get<string>('TELEGRAM_CHAT_ID') || '-4990173907';

    // Log pentru debugging
    const tokenPreview = this.botToken
      ? `${this.botToken.substring(0, 10)}...`
      : 'NULL';
    this.logger.debug(
      `🔍 Telegram gestoria bot config check: token=${!!this.botToken} (${tokenPreview}), chatId=${this.chatId}`,
    );

    if (this.botToken && this.chatId) {
      this._isConfigured = true;
      this.logger.log(
        `✅ Telegram service configured (gestoria bot, chatId: ${this.chatId})`,
      );
    } else {
      this.logger.warn(
        `⚠️ Telegram gestoria bot not configured. Set TELEGRAM_BOT_TOKEN in .env to enable notifications. Using default chat ID from n8n workflow. Current config: botToken=${!!this.botToken}, chatId=${this.chatId}`,
      );
    }

    // Configurare bot general (nou)
    this.generalBotToken =
      this.configService.get<string>('TELEGRAM_BOT_TOKEN_GENERAL') || null;
    this.generalChatId =
      this.configService.get<string>('TELEGRAM_CHAT_ID_GENERAL') || null;

    // Log pentru debugging
    const generalTokenPreview = this.generalBotToken
      ? `${this.generalBotToken.substring(0, 10)}...`
      : 'NULL';
    this.logger.debug(
      `🔍 Telegram general bot config check: token=${!!this.generalBotToken} (${generalTokenPreview}), chatId=${this.generalChatId || 'NULL'}`,
    );

    if (this.generalBotToken && this.generalChatId) {
      this._isGeneralConfigured = true;
      this.logger.log(
        `✅ Telegram general bot configured (chatId: ${this.generalChatId})`,
      );
    } else {
      this.logger.warn(
        '⚠️ Telegram general bot not configured. Set TELEGRAM_BOT_TOKEN_GENERAL and TELEGRAM_CHAT_ID_GENERAL in .env to enable general notifications.',
      );
    }
  }

  /**
   * Verifică dacă Telegram este configurat (bot gestoria)
   */
  isConfigured(): boolean {
    return this._isConfigured;
  }

  /**
   * Verifică dacă bot-ul general este configurat
   */
  isGeneralConfigured(): boolean {
    return this._isGeneralConfigured;
  }

  /**
   * Trimite un mesaj pe Telegram (bot gestoria)
   */
  async sendMessage(
    message: string,
    options?: { disableMarkdown?: boolean },
  ): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        '⚠️ Telegram gestoria bot not configured. Message not sent.',
      );
      return;
    }

    await this._sendMessageInternal(
      this.botToken!,
      this.chatId!,
      message,
      'gestoria',
      { useMarkdown: !options?.disableMarkdown },
    );
  }

  /**
   * Trimite un mesaj pe Telegram (bot general)
   * Folosit pentru erori, notificări generale, etc.
   * @param options.disableMarkdown — true pentru text dinamic (stack, env vars cu _) ca să eviți erori Telegram parse_mode.
   */
  async sendGeneralMessage(
    message: string,
    options?: { disableMarkdown?: boolean },
  ): Promise<void> {
    if (!this.isGeneralConfigured()) {
      this.logger.warn(
        '⚠️ Telegram general bot not configured. Message not sent.',
      );
      return;
    }

    await this._sendMessageInternal(
      this.generalBotToken!,
      this.generalChatId!,
      message,
      'general',
      { useMarkdown: !options?.disableMarkdown },
    );
  }

  /**
   * Metodă internă pentru trimiterea mesajelor
   */
  private async _sendMessageInternal(
    botToken: string,
    chatId: string,
    message: string,
    botType: 'gestoria' | 'general',
    opts: { useMarkdown: boolean } = { useMarkdown: true },
  ): Promise<void> {
    try {
      // Prefix pentru a distinge clientul (ex: [HERA], [DeCamino]) – același chat, mesaje separate
      const text = this.clientLabel
        ? `[${this.clientLabel}]\n\n${message}`
        : message;

      const tokenPreview = botToken
        ? `${botToken.substring(0, 10)}...`
        : 'NULL';
      this.logger.log(
        `📤 Attempting to send Telegram message (${botType} bot, token: ${tokenPreview}, chatId: ${chatId}, message length: ${text.length})`,
      );

      if (!botToken || !chatId) {
        throw new Error(
          `Missing configuration: botToken=${!!botToken}, chatId=${!!chatId}`,
        );
      }

      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      this.logger.debug(
        `📡 Telegram API URL: ${url.replace(botToken, tokenPreview)}`,
      );

      const requestBody: {
        chat_id: string;
        text: string;
        parse_mode?: string;
      } = {
        chat_id: chatId,
        text,
      };
      if (opts.useMarkdown) {
        requestBody.parse_mode = 'Markdown'; // legacy Markdown (n8n / notificări formatate)
      }

      // Adăugăm timeout și signal pentru a evita blocarea
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secunde timeout

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Telegram API request timeout (10s)');
        }
        throw new Error(
          `Telegram API fetch failed: ${fetchError.message || fetchError.toString()}`,
        );
      }

      this.logger.debug(
        `📥 Telegram API response status: ${response.status} ${response.statusText}`,
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = `Telegram API error: ${response.status} - ${JSON.stringify(errorData)}`;
        this.logger.error(
          `❌ ${errorMessage} (${botType} bot, chatId: ${chatId})`,
        );
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (result.ok) {
        this.logger.log(
          `✅ Telegram message sent successfully (${botType} bot, chatId: ${chatId})`,
        );
      } else {
        const errorMessage = `Telegram API returned error: ${JSON.stringify(result)}`;
        this.logger.error(
          `❌ ${errorMessage} (${botType} bot, chatId: ${chatId})`,
        );
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // Log detaliat pentru debugging pe VPS
      this.logger.error(
        `❌ Error sending Telegram message (${botType} bot, chatId: ${chatId}): ${error.message}`,
      );
      this.logger.error(
        `❌ Error stack: ${error.stack || 'No stack trace available'}`,
      );
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
        .replace(/_/g, '\\_')
        .replace(/\*/g, '\\*')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/~/g, '\\~')
        .replace(/`/g, '\\`')
        .replace(/>/g, '\\>')
        .replace(/#/g, '\\#')
        .replace(/\+/g, '\\+')
        // Nu escape-uim liniuța - pentru a păstra formatul datelor (YYYY-MM-DD)
        // .replace(/-/g, '\\-')
        .replace(/=/g, '\\=')
        .replace(/\|/g, '\\|')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\./g, '\\.')
        .replace(/!/g, '\\!')
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
    // Ausencias justificada: detalle para gestoría
    tipo_justificante?: string;
    hora_cita?: string;
    centro_medico?: string;
    descripcion_otro?: string;
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

    // Ausencias justificada: tipo justificante, hora cita, centro, descripción y recordatorio de justificantes
    const isAusenciaJustificada =
      solicitudData.tipo.toLowerCase().includes('ausencia') &&
      solicitudData.tipo.toLowerCase().includes('justificada');
    const detalleJustificadaParts: string[] = [];
    if (isAusenciaJustificada) {
      if (solicitudData.tipo_justificante) {
        detalleJustificadaParts.push(
          `📌 *Tipo justificante:* ${this.escapeMarkdown(solicitudData.tipo_justificante)}`,
        );
      }
      if (solicitudData.hora_cita) {
        detalleJustificadaParts.push(
          `🕐 *Hora cita:* ${this.escapeMarkdown(solicitudData.hora_cita)}`,
        );
      }
      if (solicitudData.centro_medico) {
        detalleJustificadaParts.push(
          `🏥 *Centro médico:* ${this.escapeMarkdown(solicitudData.centro_medico)}`,
        );
      }
      if (solicitudData.descripcion_otro) {
        detalleJustificadaParts.push(
          `📄 *Descripción:* ${this.escapeMarkdown(solicitudData.descripcion_otro)}`,
        );
      }
      detalleJustificadaParts.push(
        `\n📋 *Recordar:* El empleado debe subir el justificante de presencia a la cita (se solicitará tras aprobar).`,
      );
    }
    const detalleJustificadaSection =
      detalleJustificadaParts.length > 0
        ? '\n' + detalleJustificadaParts.join('\n')
        : '';

    const message = `
${actionEmoji} *${actionText}*

👤 *Empleado:* ${nombreEscaped} (${codigoEscaped})
📋 *Tipo:* ${tipoEscaped}${cambioTipoSection}
📆 *Fecha:* ${fechaEscaped}
✅ *Estado:* ${estadoEscaped}
${motivoEscaped ? `📝 *Motivo:* ${motivoEscaped}` : ''}${detalleJustificadaSection}
    `.trim();

    await this.sendMessage(message);
  }
}
