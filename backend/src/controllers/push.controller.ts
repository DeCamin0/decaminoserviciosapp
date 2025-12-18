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

  /**
   * GET /api/push/debug
   * Endpoint de diagnostic pentru Push notifications
   */
  @Get('debug')
  @UseGuards(JwtAuthGuard)
  async debug(@Req() req: any) {
    const user = req.user;
    const userId = user.userId || user.CODIGO;

    const vapidInfo = this.pushService.getVapidInfo();
    const subscriptions = await this.pushService.getUserSubscriptions(userId);

    return {
      success: true,
      userId,
      vapid: vapidInfo,
      subscriptions: {
        count: subscriptions.length,
        items: subscriptions.map((sub) => ({
          id: sub.id,
          endpoint: sub.endpoint.substring(0, 50) + '...',
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt,
        })),
      },
      recommendations: {
        hasVapidKeys: vapidInfo.hasKeys,
        hasSubscriptions: subscriptions.length > 0,
        shouldRecreateSubscription:
          !vapidInfo.hasKeys && subscriptions.length > 0
            ? 'VAPID keys sunt generate automat la fiecare restart. Recomand să setezi VAPID_PUBLIC_KEY și VAPID_PRIVATE_KEY în .env pentru stabilitate.'
            : null,
      },
    };
  }

  /**
   * GET /api/push/subscribers
   * Returnează lista tuturor utilizatorilor care au Push subscriptions
   * Doar pentru Admin/Developer (prin JwtAuthGuard + verificare simplă de grup)
   */
  @Get('subscribers')
  @UseGuards(JwtAuthGuard)
  async getAllSubscribers(@Req() req: any) {
    const user = req.user;
    const grupo = user?.GRUPO || user?.grupo;

    const isAdmin = grupo === 'Admin';
    const isDeveloper = grupo === 'Developer';

    if (!isAdmin && !isDeveloper) {
      throw new BadRequestException(
        'Acceso restringido. Solo administradores y desarrolladores pueden ver los suscriptores de Push.',
      );
    }

    try {
      const subscribers = await this.pushService.getAllSubscribers();

      return {
        success: true,
        count: subscribers.length,
        items: subscribers,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Error fetching push subscribers: ${error.message}`,
      );
    }
  }

  /**
   * POST /api/push/reset-subscriptions
   * Șterge toate subscription-urile invalide și forțează re-crearea
   */
  @Post('reset-subscriptions')
  @UseGuards(JwtAuthGuard)
  async resetSubscriptions(@Req() req: any) {
    const user = req.user;
    const userId = user.userId || user.CODIGO;

    const deletedCount = await this.pushService.deleteInvalidSubscriptions(userId);

    return {
      success: true,
      message: `Șterse ${deletedCount} subscription-uri invalide pentru user ${userId}`,
      deletedCount,
      nextStep: 'Reîncarcă aplicația pentru a recrea subscription-urile cu VAPID keys corecte',
    };
  }
}
