import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { N8nProxyService } from '../services/n8n-proxy.service';
import { TelegramService } from '../services/telegram.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * Health check controller
 * Useful for testing that backend is running and can reach n8n
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly n8nProxyService: N8nProxyService,
    private readonly telegramService: TelegramService,
  ) {}

  @SkipThrottle() // Health checks nu trebuie să fie rate-limited
  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      n8nBaseUrl: this.n8nProxyService.getBaseUrl(),
    };
  }

  /**
   * GET /health/telegram
   * Verifică configurarea Telegram
   */
  @SkipThrottle()
  @Get('telegram')
  getTelegramConfig() {
    return {
      gestoria: {
        configured: this.telegramService.isConfigured(),
        chatId: this.telegramService.isConfigured()
          ? 'configured'
          : 'not configured',
      },
      general: {
        configured: this.telegramService.isGeneralConfigured(),
        chatId: this.telegramService.isGeneralConfigured()
          ? 'configured'
          : 'not configured',
      },
    };
  }

  /**
   * GET /health/telegram/test
   * Trimite un mesaj de test pe Telegram (GET pentru testare ușoară din browser)
   * Fără autentificare pentru testare rapidă (doar în development)
   */
  @SkipThrottle()
  @Get('telegram/test')
  async testTelegramGet() {
    const testMessage = `🧪 Test Telegram - ${new Date().toLocaleString('es-ES')}`;

    try {
      if (!this.telegramService.isConfigured()) {
        return {
          success: false,
          error: 'Telegram not configured',
          configured: false,
        };
      }

      await this.telegramService.sendMessage(testMessage);
      return {
        success: true,
        message: 'Telegram message sent successfully',
        testMessage,
        configured: this.telegramService.isConfigured(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || error.toString(),
        testMessage,
        configured: this.telegramService.isConfigured(),
      };
    }
  }

  /**
   * POST /health/telegram/test
   * Trimite un mesaj de test pe Telegram (cu mesaj personalizat)
   */
  @SkipThrottle()
  @Post('telegram/test')
  @UseGuards(JwtAuthGuard)
  async testTelegramPost(@Body() body?: { message?: string }) {
    const testMessage =
      body?.message ||
      `🧪 Test Telegram - ${new Date().toLocaleString('es-ES')}`;

    try {
      await this.telegramService.sendMessage(testMessage);
      return {
        success: true,
        message: 'Telegram message sent successfully',
        testMessage,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || error.toString(),
        testMessage,
        configured: this.telegramService.isConfigured(),
      };
    }
  }
}
