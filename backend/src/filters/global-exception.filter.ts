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

    // 503 = adesea feature opțional neconfigurat (ex. tenant registry) — fără stack la ERROR
    if (status === HttpStatus.SERVICE_UNAVAILABLE) {
      this.logger.warn(
        `⚠️ ${request.method} ${request.url} - 503: ${errorMessage}`,
      );
    } else {
      this.logger.error(
        `❌ ${request.method} ${request.url} - Status: ${status} - Error: ${errorMessage}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // Alertă Telegram doar pentru erori server „hard”; exclude 503 (ex. feature neconfigurat, maintenance)
    if (status >= 500 && status !== HttpStatus.SERVICE_UNAVAILABLE) {
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
    // Folosim bot-ul general pentru erori (dacă e configurat)
    // Altfel folosim bot-ul de gestoria ca fallback
    const useGeneralBot = this.telegramService.isGeneralConfigured();
    if (!useGeneralBot && !this.telegramService.isConfigured()) {
      this.logger.warn(
        '⚠️ Telegram not configured - cannot send critical error alert',
      );
      return;
    }

    try {
      // Limitează stack trace la primele 500 caractere
      const stackPreview =
        errorInfo.stack?.substring(0, 500) || 'No stack trace available';

      // Fără parse_mode Markdown: mesajele dinamice conțin adesea _ * ` care rupe entitățile Telegram
      const message = [
        '🚨 Error crítico en backend',
        '',
        `Status: ${errorInfo.status}`,
        `Método: ${errorInfo.method}`,
        `Path: ${errorInfo.path}`,
        `Mensaje: ${errorInfo.message.substring(0, 500)}`,
        '',
        'Stack (preview):',
        stackPreview,
        '',
        `Timestamp: ${new Date().toISOString()}`,
      ].join('\n');

      if (useGeneralBot) {
        await this.telegramService.sendGeneralMessage(message, {
          disableMarkdown: true,
        });
      } else {
        await this.telegramService.sendMessage(message, {
          disableMarkdown: true,
        });
      }
      this.logger.log('✅ Critical error alert sent to Telegram');
    } catch (error: any) {
      // Nu aruncăm eroarea pentru a nu bloca flow-ul
      this.logger.error(`❌ Error sending Telegram alert: ${error.message}`);
    }
  }
}
