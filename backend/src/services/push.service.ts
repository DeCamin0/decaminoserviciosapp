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
      this.logger.log(
        `🔑 VAPID Public Key (folosit): ${publicKey.substring(0, 30)}...`,
      );
    } else {
      // Generează VAPID keys noi (doar pentru development)
      this.logger.warn(
        '⚠️ VAPID keys nu sunt configurate. Generez keys noi (doar pentru development).',
      );
      this.logger.warn(
        '⚠️ ATENȚIE: Dacă backend-ul se repornește, se vor genera CHEI NOI și toate subscription-urile existente vor deveni INVALIDE!',
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
      this.logger.warn(
        `⚠️ Private Key: ${this.vapidKeys.privateKey.substring(0, 30)}... (ascuns pentru securitate)`,
      );
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
   * Obține informații despre VAPID keys (pentru diagnostic)
   */
  getVapidInfo(): {
    hasKeys: boolean;
    publicKey: string | null;
    source: 'env' | 'generated';
  } {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

    return {
      hasKeys: !!(publicKey && privateKey),
      publicKey: this.vapidKeys?.publicKey || null,
      source: publicKey && privateKey ? 'env' : 'generated',
    };
  }

  /**
   * Obține toate subscription-urile pentru un utilizator (pentru diagnostic)
   */
  async getUserSubscriptions(userId: string) {
    return this.prisma.pushSubscription.findMany({
      where: { userId },
      select: {
        id: true,
        endpoint: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Obține toți utilizatorii care au cel puțin un Push subscription
   * Folosit în Admin Panel pentru a vedea cine este abonat la notificări push
   */
  async getAllSubscribers(): Promise<
    {
      userId: string;
      nombre: string | null;
      centroTrabajo: string | null;
      subscriptionsCount: number;
      lastUpdatedAt: Date | null;
    }[]
  > {
    // 1. Obținem toți userId-urile distincte din PushSubscription
    const grouped = await this.prisma.pushSubscription.groupBy({
      by: ['userId'],
      _count: {
        id: true,
      },
      _max: {
        updatedAt: true,
      },
      orderBy: {
        userId: 'asc',
      },
    });

    if (grouped.length === 0) {
      return [];
    }

    const userIds = grouped.map((g) => g.userId);

    // 2. Obținem informații de bază din tabela DatosEmpleados (modelul User)
    const employees = await this.prisma.user.findMany({
      where: {
        CODIGO: {
          in: userIds,
        },
      },
      select: {
        CODIGO: true,
        NOMBRE_APELLIDOS: true,
        CENTRO_TRABAJO: true,
        ESTADO: true,
      },
    });

    const employeesById = new Map(employees.map((e) => [e.CODIGO, e]));

    // 3. Combinăm informațiile și întoarcem un payload curat pentru frontend
    return grouped.map((g) => {
      const employee = employeesById.get(g.userId);

      return {
        userId: g.userId,
        nombre: employee?.NOMBRE_APELLIDOS || null,
        centroTrabajo: employee?.CENTRO_TRABAJO || null,
        subscriptionsCount: g._count.id,
        lastUpdatedAt: g._max.updatedAt || null,
      };
    });
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
        this.logger.log(
          `✅ Push subscription șters pentru user ${userId}, endpoint: ${endpoint.substring(0, 50)}...`,
        );
      } else {
        // Șterge toate subscription-urile pentru utilizator
        const count = await this.prisma.pushSubscription.count({
          where: { userId },
        });
        await this.prisma.pushSubscription.deleteMany({
          where: { userId },
        });
        this.logger.log(
          `✅ ${count} Push subscription-uri șterse pentru user ${userId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Eroare la ștergerea Push subscription pentru user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Șterge toate subscription-urile invalide pentru un utilizator (după erori VAPID mismatch)
   */
  async deleteInvalidSubscriptions(userId: string): Promise<number> {
    try {
      const count = await this.prisma.pushSubscription.count({
        where: { userId },
      });

      if (count === 0) {
        this.logger.log(`ℹ️ Nu există subscription-uri pentru user ${userId}`);
        return 0;
      }

      await this.prisma.pushSubscription.deleteMany({
        where: { userId },
      });

      this.logger.log(
        `✅ Șterse ${count} subscription-uri invalide pentru user ${userId} (VAPID keys mismatch)`,
      );
      return count;
    } catch (error) {
      this.logger.error(
        `❌ Eroare la ștergerea subscription-urilor invalide pentru user ${userId}:`,
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

      this.logger.log(
        `📤 Încerc să trimit Push notification către user ${userId} (${subscriptions.length} subscription-uri)`,
      );

      // Trimite notificarea către toate subscription-urile
      const results = await Promise.allSettled(
        subscriptions.map(async (subscription, index) => {
          try {
            this.logger.debug(
              `📤 [${index + 1}/${subscriptions.length}] Trimit către endpoint: ${subscription.endpoint.substring(0, 50)}...`,
            );
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
            this.logger.debug(
              `✅ [${index + 1}/${subscriptions.length}] Push notification trimisă cu succes`,
            );
            return true;
          } catch (error: any) {
            // Log detaliat pentru fiecare eroare
            const errorDetails = {
              statusCode: error.statusCode,
              statusCodeText: error.statusCodeText || 'N/A',
              message: error.message,
              body: error.body
                ? typeof error.body === 'string'
                  ? error.body.substring(0, 200)
                  : JSON.stringify(error.body).substring(0, 200)
                : 'N/A',
              endpoint: subscription.endpoint.substring(0, 50) + '...',
            };

            this.logger.error(
              `❌ [${index + 1}/${subscriptions.length}] Eroare la trimiterea Push notification:`,
              JSON.stringify(errorDetails, null, 2),
            );

            // Dacă subscription-ul este invalid (410 Gone), șterge-l
            if (error.statusCode === 410) {
              this.logger.warn(
                `⚠️ Push subscription invalid (410 Gone) pentru user ${userId}, endpoint: ${subscription.endpoint.substring(0, 50)}..., șterg subscription-ul`,
              );
              await this.deleteSubscription(userId, subscription.endpoint);
            }
            // Dacă apare VAPID keys mismatch (400 cu VapidPkHashMismatch sau 401/403), șterge subscription-ul
            else if (
              error.statusCode === 400 &&
              error.body &&
              (typeof error.body === 'string'
                ? error.body.includes('VapidPkHashMismatch')
                : JSON.stringify(error.body).includes('VapidPkHashMismatch'))
            ) {
              this.logger.error(
                `🔑 EROARE CRITICĂ: VAPID keys mismatch (400)! Subscription-ul a fost creat cu alte VAPID keys decât cele folosite acum. Șterg subscription-ul invalid.`,
              );
              await this.deleteSubscription(userId, subscription.endpoint);
            } else if (error.statusCode === 401 || error.statusCode === 403) {
              this.logger.error(
                `🔑 EROARE CRITICĂ: VAPID keys mismatch! StatusCode: ${error.statusCode}. Subscription-ul a fost creat cu alte VAPID keys decât cele folosite acum. Șterg subscription-ul invalid.`,
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
      const failedCount = results.length - successCount;

      // Log detaliat pentru fiecare eșec
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const error = result.reason;
          this.logger.error(
            `❌ Subscription ${index + 1} eșuat: ${error?.message || 'Unknown error'}`,
          );
        }
      });

      if (successCount > 0) {
        this.logger.log(
          `✅ Push notification trimisă către user ${userId} (${successCount}/${subscriptions.length} subscription-uri reușite, ${failedCount} eșuate)`,
        );
        return true;
      } else {
        this.logger.warn(
          `⚠️ Nu s-a putut trimite Push notification către user ${userId} (toate ${subscriptions.length} subscription-urile au eșuat)`,
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

  /**
   * Trimite notificare push către toți utilizatorii activi care au token de push
   */
  async sendPushToAllUsers(notification: {
    title: string;
    message: string;
    data?: any;
    url?: string;
  }): Promise<{ total: number; sent: number; failed: number }> {
    try {
      // Obține toți utilizatorii activi (doar cei cu ESTADO = 'ACTIVO')
      const activeUsers = await this.prisma.$queryRaw<any[]>`
        SELECT DISTINCT CODIGO as codigo
        FROM DatosEmpleados
        WHERE ESTADO = 'ACTIVO'
      `;

      if (activeUsers.length === 0) {
        this.logger.warn('⚠️ Nu există utilizatori activi');
        return { total: 0, sent: 0, failed: 0 };
      }

      // Obține toate subscription-urile pentru toți userii activi
      const userIds = activeUsers.map((u: any) => String(u.codigo));
      const allSubscriptions = await this.prisma.pushSubscription.findMany({
        where: {
          userId: { in: userIds },
        },
      });

      if (allSubscriptions.length === 0) {
        this.logger.warn(
          '⚠️ Nu există Push subscriptions pentru utilizatorii activi',
        );
        return { total: userIds.length, sent: 0, failed: 0 };
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
        allSubscriptions.map(async (subscription) => {
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
            return { success: true, userId: subscription.userId };
          } catch (error: any) {
            // Dacă subscription-ul este invalid (410 Gone), șterge-l
            if (error.statusCode === 410) {
              this.logger.warn(
                `⚠️ Push subscription invalid pentru user ${subscription.userId}, șterg subscription-ul`,
              );
              await this.deleteSubscription(
                subscription.userId,
                subscription.endpoint,
              );
            }
            return { success: false, userId: subscription.userId, error };
          }
        }),
      );

      const sent = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success,
      ).length;
      const failed = results.length - sent;

      this.logger.log(
        `✅ Push notification trimisă către toți utilizatorii: ${sent}/${allSubscriptions.length} subscription-uri (${failed} eșuate)`,
      );

      return {
        total: userIds.length,
        sent,
        failed,
      };
    } catch (error) {
      this.logger.error(
        `❌ Eroare la trimiterea Push notification către toți utilizatorii:`,
        error,
      );
      return { total: 0, sent: 0, failed: 0 };
    }
  }
}
