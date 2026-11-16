import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { TelegramService } from '../services/telegram.service';
import { publicHealthBody } from '../services/public-health-body';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  assertHealthTelegramTest,
  type MonitoringActor,
} from '../services/monitoring-message-policy';

/**
 * Health check controller
 * Useful for testing that backend is running and can reach n8n
 */
@Controller('health')
export class HealthController {
  constructor(private readonly telegramService: TelegramService) {}

  @SkipThrottle() // Health checks nu trebuie să fie rate-limited
  @Get()
  getHealth() {
    return publicHealthBody(new Date());
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
   * Mesaj de probă. Necesită sesiune de personal autorizat.
   */
  @SkipThrottle()
  @Get('telegram/test')
  @UseGuards(JwtAuthGuard)
  async testTelegramGet(@CurrentUser() user?: MonitoringActor) {
    assertHealthTelegramTest(user);
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
  async testTelegramPost(
    @CurrentUser() user?: MonitoringActor,
    @Body() body?: { message?: string },
  ) {
    assertHealthTelegramTest(user);
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
