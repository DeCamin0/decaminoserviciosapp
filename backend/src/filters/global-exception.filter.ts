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
import { SecurityAlertService } from '../services/security-alert.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly securityAlertService?: SecurityAlertService,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

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

    const errorMessage =
      typeof message === 'string'
        ? message
        : (message as any).message || JSON.stringify(message);

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

    // Security: 403 pe rute sensibile → Telegram (throttle în serviciu)
    if (status === HttpStatus.FORBIDDEN && this.securityAlertService) {
      try {
        const user: any = (request as any).user;
        const userLabel = user
          ? `${user.CODIGO || user.codigo || user.userId || '?'} (${user.GRUPO || user.grupo || user.role || '?'})`
          : undefined;
        this.securityAlertService.recordForbidden({
          method: request.method,
          path: request.url || request.path || '',
          ip: this.clientIp(request),
          userLabel,
          message: errorMessage,
        });
      } catch (e: any) {
        this.logger.warn(
          `Security 403 alert hook failed: ${e?.message || e}`,
        );
      }
    }

    if (status >= 500 && status !== HttpStatus.SERVICE_UNAVAILABLE) {
      await this.sendCriticalErrorAlert({
        status,
        message: errorMessage,
        path: request.url,
        method: request.method,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: errorMessage,
    });
  }

  private clientIp(request: Request): string {
    const xf = request.headers?.['x-forwarded-for'];
    if (typeof xf === 'string' && xf.trim()) {
      return xf.split(',')[0].trim();
    }
    if (Array.isArray(xf) && xf[0]) return String(xf[0]).trim();
    return (
      (request.headers?.['x-real-ip'] as string) ||
      request.ip ||
      (request as any).socket?.remoteAddress ||
      'unknown'
    );
  }

  private async sendCriticalErrorAlert(errorInfo: {
    status: number;
    message: string;
    path: string;
    method: string;
    stack?: string;
  }): Promise<void> {
    const useGeneralBot = this.telegramService.isGeneralConfigured();
    if (!useGeneralBot && !this.telegramService.isConfigured()) {
      this.logger.warn(
        '⚠️ Telegram not configured - cannot send critical error alert',
      );
      return;
    }

    try {
      const stackPreview =
        errorInfo.stack?.substring(0, 500) || 'No stack trace available';

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
      this.logger.error(`❌ Error sending Telegram alert: ${error.message}`);
    }
  }
}
