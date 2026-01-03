import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MonitoringService } from '../services/monitoring.service';
import { TelegramService } from '../services/telegram.service';

/**
 * Controller pentru raportarea erorilor din frontend
 * și verificări manuale de health
 */
@Controller('api/monitoring')
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * Endpoint pentru raportarea erorilor din frontend
   * Poate fi apelat din frontend când apare o eroare critică
   */
  @Post('frontend-error')
  async reportFrontendError(
    @Body()
    errorData: {
      message: string;
      stack?: string;
      url?: string;
      userAgent?: string;
      userId?: string;
      timestamp?: string;
    },
  ) {
    if (!this.telegramService.isConfigured()) {
      return { success: false, message: 'Telegram not configured' };
    }

    try {
      const message = `
🚨 *Error crítico en frontend*

❌ *Mensaje:* ${errorData.message}
🔗 *URL:* ${errorData.url || 'N/A'}
👤 *Usuario:* ${errorData.userId || 'Anónimo'}
🌐 *User Agent:* ${errorData.userAgent?.substring(0, 100) || 'N/A'}

\`\`\`
${errorData.stack?.substring(0, 500) || 'No stack trace'}
\`\`\`

⏰ *Timestamp:* ${errorData.timestamp || new Date().toISOString()}
      `.trim();

      await this.telegramService.sendMessage(message);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Manual health check
   */
  @Post('health-check')
  @UseGuards(JwtAuthGuard)
  async performHealthCheck() {
    return await this.monitoringService.performHealthCheck();
  }
}

