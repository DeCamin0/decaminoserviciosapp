import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TelegramService } from '../services/telegram.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly telegramService: TelegramService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determină status code și mesaj
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message
          : 'Error desconocido';

    // Log detaliat
    const errorMessage =
      typeof message === 'string'
        ? message
        : (message as any).message || JSON.stringify(message);

    this.logger.error(
      `❌ ${request.method} ${request.url} - Status: ${status} - Error: ${errorMessage}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Trimite alertă pe Telegram pentru erori CRITICE
    // Doar pentru erori 500 (server errors) sau erori neașteptate
    if (status >= 500) {
      await this.sendCriticalErrorAlert({
        status,
        message: errorMessage,
        path: request.url,
        method: request.method,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    // Răspunde cu eroare structurată
    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: errorMessage,
    });
  }

  /**
   * Trimite alertă pe Telegram pentru erori critice
   */
  private async sendCriticalErrorAlert(errorInfo: {
    status: number;
    message: string;
    path: string;
    method: string;
    stack?: string;
  }): Promise<void> {
    if (!this.telegramService.isConfigured()) {
      this.logger.warn(
        '⚠️ Telegram not configured - cannot send critical error alert',
      );
      return;
    }

    try {
      // Limitează stack trace la primele 500 caractere
      const stackPreview =
        errorInfo.stack?.substring(0, 500) ||
        'No stack trace available';

      const message = `
🚨 *Error crítico en backend*

❌ *Status:* ${errorInfo.status}
📋 *Método:* ${errorInfo.method}
🔗 *Path:* \`${errorInfo.path}\`
💬 *Mensaje:* ${errorInfo.message.substring(0, 200)}

\`\`\`
${stackPreview}
\`\`\`

⏰ *Timestamp:* ${new Date().toISOString()}
      `.trim();

      await this.telegramService.sendMessage(message);
      this.logger.log('✅ Critical error alert sent to Telegram');
    } catch (error: any) {
      // Nu aruncăm eroarea pentru a nu bloca flow-ul
      this.logger.error(
        `❌ Error sending Telegram alert: ${error.message}`,
      );
    }
  }
}

