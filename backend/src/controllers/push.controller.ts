import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PushService } from '../services/push.service';

@Controller('api/push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  /**
   * GET /api/push/vapid-public-key
   * Returnează VAPID public key pentru frontend
   * Public endpoint - nu necesită autentificare
   */
  @Get('vapid-public-key')
  getVapidPublicKey() {
    return {
      publicKey: this.pushService.getVapidPublicKey(),
    };
  }

  /**
   * POST /api/push/subscribe
   * Salvează Push subscription pentru utilizatorul autentificat
   */
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(
    @Req() req: any,
    @Body()
    body: {
      userId?: string;
      subscription: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
    },
  ) {
    try {
      const user = req.user;
      const userId = String(body.userId || user.userId || user.CODIGO || '');

      console.log('[PushController] subscribe called:', {
        bodyUserId: body.userId,
        tokenUserId: user.userId,
        tokenCODIGO: user.CODIGO,
        finalUserId: userId,
        hasSubscription: !!body.subscription,
        hasEndpoint: !!body.subscription?.endpoint,
      });

      if (!userId || userId === '' || userId === 'undefined') {
        throw new BadRequestException('User ID is required');
      }

      if (!body.subscription || !body.subscription.endpoint) {
        throw new BadRequestException('Subscription endpoint is required');
      }

      if (
        !body.subscription.keys ||
        !body.subscription.keys.p256dh ||
        !body.subscription.keys.auth
      ) {
        throw new BadRequestException(
          'Subscription keys (p256dh and auth) are required',
        );
      }

      await this.pushService.saveSubscription(userId, body.subscription);

      return {
        success: true,
        message: 'Push subscription salvat cu succes',
      };
    } catch (error: any) {
      console.error('[PushController] Error in subscribe:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Error saving push subscription: ${error.message}`,
      );
    }
  }

  /**
   * DELETE /api/push/unsubscribe
   * Șterge Push subscription pentru utilizatorul autentificat
   */
  @Delete('unsubscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(@Req() req: any, @Body() body: { endpoint?: string }) {
    const user = req.user;
    const userId = user.userId || user.CODIGO;

    await this.pushService.deleteSubscription(userId, body.endpoint);

    return {
      success: true,
      message: 'Push subscription șters cu succes',
    };
  }
}
