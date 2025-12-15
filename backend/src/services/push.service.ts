import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Service pentru gestionarea Push Notifications
 * Folosește web-push pentru a trimite notificări când aplicația este închisă
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private vapidKeys: { publicKey: string; privateKey: string } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.initializeVapidKeys();
  }

  /**
   * Inițializează VAPID keys pentru Push API
   */
  private initializeVapidKeys() {
    // Încearcă să obțină VAPID keys din environment variables
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

    if (publicKey && privateKey) {
      this.vapidKeys = { publicKey, privateKey };
      webpush.setVapidDetails(
        'mailto:admin@decaminoservicios.com', // Contact email pentru VAPID
        publicKey,
        privateKey,
      );
      this.logger.log('✅ VAPID keys configurate din environment variables');
    } else {
      // Generează VAPID keys noi (doar pentru development)
      this.logger.warn(
        '⚠️ VAPID keys nu sunt configurate. Generez keys noi (doar pentru development).',
      );
      this.logger.warn(
        '⚠️ Pentru producție, setează VAPID_PUBLIC_KEY și VAPID_PRIVATE_KEY în .env',
      );
      this.vapidKeys = webpush.generateVAPIDKeys();
      webpush.setVapidDetails(
        'mailto:admin@decaminoservicios.com',
        this.vapidKeys.publicKey,
        this.vapidKeys.privateKey,
      );
      this.logger.log('🔑 VAPID keys generate:');
      this.logger.log(`Public Key: ${this.vapidKeys.publicKey}`);
      this.logger.log(`Private Key: ${this.vapidKeys.privateKey}`);
    }
  }

  /**
   * Obține VAPID public key pentru frontend
   */
  getVapidPublicKey(): string {
    if (!this.vapidKeys) {
      this.initializeVapidKeys();
    }
    return this.vapidKeys!.publicKey;
  }

  /**
   * Salvează Push subscription pentru un utilizator
   */
  async saveSubscription(
    userId: string,
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    },
  ): Promise<void> {
    try {
      // Șterge subscription-urile vechi pentru același endpoint (pentru a evita duplicate-urile)
      await this.prisma.pushSubscription.deleteMany({
        where: {
          userId,
          endpoint: subscription.endpoint,
        },
      });

      // Salvează subscription-ul nou
      await this.prisma.pushSubscription.create({
        data: {
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      });

      this.logger.log(`✅ Push subscription salvat pentru user ${userId}`);
    } catch (error) {
      this.logger.error(
        `❌ Eroare la salvarea Push subscription pentru user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Șterge Push subscription pentru un utilizator
   */
  async deleteSubscription(userId: string, endpoint?: string): Promise<void> {
    try {
      if (endpoint) {
        await this.prisma.pushSubscription.deleteMany({
          where: {
            userId,
            endpoint,
          },
        });
      } else {
        // Șterge toate subscription-urile pentru utilizator
        await this.prisma.pushSubscription.deleteMany({
          where: { userId },
        });
      }
      this.logger.log(`✅ Push subscription șters pentru user ${userId}`);
    } catch (error) {
      this.logger.error(
        `❌ Eroare la ștergerea Push subscription pentru user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Trimite notificare push către un utilizator
   */
  async sendPushNotification(
    userId: string,
    notification: {
      title: string;
      message: string;
      data?: any;
      url?: string;
    },
  ): Promise<boolean> {
    try {
      // Obține toate subscription-urile pentru utilizator
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId },
      });

      if (subscriptions.length === 0) {
        this.logger.warn(
          `⚠️ Nu există Push subscriptions pentru user ${userId}`,
        );
        return false;
      }

      const payload = JSON.stringify({
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        url: notification.url,
        timestamp: new Date().toISOString(),
      });

      // Trimite notificarea către toate subscription-urile
      const results = await Promise.allSettled(
        subscriptions.map(async (subscription) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth,
                },
              },
              payload,
            );
            return true;
          } catch (error: any) {
            // Dacă subscription-ul este invalid (410 Gone), șterge-l
            if (error.statusCode === 410) {
              this.logger.warn(
                `⚠️ Push subscription invalid pentru user ${userId}, șterg subscription-ul`,
              );
              await this.deleteSubscription(userId, subscription.endpoint);
            }
            throw error;
          }
        }),
      );

      const successCount = results.filter(
        (r) => r.status === 'fulfilled',
      ).length;

      if (successCount > 0) {
        this.logger.log(
          `✅ Push notification trimisă către user ${userId} (${successCount}/${subscriptions.length} subscription-uri)`,
        );
        return true;
      } else {
        this.logger.warn(
          `⚠️ Nu s-a putut trimite Push notification către user ${userId}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error(
        `❌ Eroare la trimiterea Push notification către user ${userId}:`,
        error,
      );
      return false;
    }
  }
}
