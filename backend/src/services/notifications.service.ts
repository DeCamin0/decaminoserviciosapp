import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';
import {
  getNotificationInventory,
  NotificationKindMeta,
} from '../notifications/notification-kinds';

/**
 * Service pentru gestionarea notificărilor
 * Folosește NotificationsGateway pentru a trimite notificări în timp real
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationsGateway: NotificationsGateway,
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  /**
   * Trimite notificare către un utilizator specific
   * @param senderId ID-ul utilizatorului care trimite (CODIGO)
   * @param userId ID-ul utilizatorului căruia i se trimite (CODIGO)
   * @param notification Obiectul notificării
   */
  async notifyUser(
    senderId: string,
    userId: string,
    notification: {
      id?: string;
      type: 'success' | 'error' | 'warning' | 'info';
      title: string;
      message: string;
      timestamp?: Date;
      data?: any;
    },
  ) {
    // Obține informațiile utilizatorului căruia i se trimite (pentru grupo și centro)
    let grupo: string | null = null;
    let centro: string | null = null;

    try {
      const recipientUser = await this.prisma.user.findUnique({
        where: { CODIGO: userId },
      });

      if (recipientUser) {
        grupo = recipientUser.GRUPO || null;
        // campo cu spațiu în DB, nu îl mapăm acum în Prisma (placeholder null)
        centro = null;
      }
    } catch (error) {
      console.warn('[NotificationsService] Error fetching user info:', error);
    }

    // Generează ID-ul
    const notificationId = randomUUID();

    // Serializează data ca JSON string - dacă nu există, salvează NULL (ca created_at)
    let dataValue: string | null = null;
    if (notification.data !== undefined && notification.data !== null) {
      if (typeof notification.data === 'string') {
        // Dacă e deja string JSON, folosește-l direct
        dataValue = notification.data;
      } else {
        // Serializează obiectul ca JSON
        dataValue = JSON.stringify(notification.data);
      }
    }

    await this.prisma.notification.create({
      data: {
        id: notificationId,
        senderId: senderId || null,
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: false,
        data: dataValue,
        grupo: grupo || null,
        centro: centro || null,
      },
    });

    const savedNotification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    const parsedData =
      savedNotification?.data && typeof savedNotification.data === 'string'
        ? (() => {
            try {
              return JSON.parse(savedNotification.data);
            } catch {
              return savedNotification.data;
            }
          })()
        : savedNotification?.data;

    const notificationData = savedNotification
      ? {
          id: savedNotification.id,
          type: savedNotification.type as any,
          title: savedNotification.title,
          message: savedNotification.message,
          content: savedNotification.message,
          timestamp: savedNotification.createdAt,
          read: savedNotification.read ?? false,
          data: parsedData,
        }
      : null;

    // Trimite notificarea în timp real prin WebSocket
    if (notificationData) {
      this.notificationsGateway.sendToUser(userId, notificationData);
    }

    // Trimite și prin Push API (pentru notificări când aplicația este închisă)
    // Push API funcționează chiar dacă utilizatorul nu este online prin WebSocket
    try {
      await this.pushService.sendPushNotification(userId, {
        title: notification.title,
        message: notification.message,
        data: notification.data,
        url: notification.data?.url,
      });
    } catch (error) {
      // Nu aruncăm eroare dacă Push API eșuează - notificarea a fost deja trimisă prin WebSocket
      this.logger.warn(
        `⚠️ Eroare la trimiterea Push notification către user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Trimite notificare către un grup
   * @param senderId ID-ul utilizatorului care trimite (CODIGO)
   * @param grupo Grupul (ex: 'Developer', 'Manager')
   * @param notification Obiectul notificării
   * @param userIds Lista de user IDs din grup (opțional, pentru a salva în BD)
   */
  async notifyGroup(
    senderId: string,
    grupo: string,
    notification: {
      id?: string;
      type: 'success' | 'error' | 'warning' | 'info';
      title: string;
      message: string;
      timestamp?: Date;
      data?: any;
    },
    userIds?: string[],
  ) {
    const notificationData = {
      id: notification.id || `notif-${Date.now()}-${Math.random()}`,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      content: notification.message,
      timestamp: notification.timestamp || new Date(),
      read: false,
      data: notification.data,
    };

    // Dacă avem lista de utilizatori, salvăm notificarea pentru fiecare
    if (userIds && userIds.length > 0) {
      const notificationsToSave = userIds.map((userId) => ({
        id: randomUUID(),
        senderId: senderId || null,
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: false,
        grupo,
        centro: null,
        data:
          notification.data === undefined || notification.data === null
            ? null
            : typeof notification.data === 'string'
              ? notification.data
              : JSON.stringify(notification.data),
      }));
      await this.prisma.notification.createMany({
        data: notificationsToSave,
      });
    }

    // Trimite notificarea în timp real prin WebSocket
    this.notificationsGateway.sendToGroup(grupo, notificationData);
  }

  /**
   * Trimite notificare către un centru de lucru
   * @param senderId ID-ul utilizatorului care trimite (CODIGO)
   * @param centro Centrul de lucru
   * @param notification Obiectul notificării
   * @param userIds Lista de user IDs din centru (opțional, pentru a salva în BD)
   */
  async notifyCentro(
    senderId: string,
    centro: string,
    notification: {
      id?: string;
      type: 'success' | 'error' | 'warning' | 'info';
      title: string;
      message: string;
      timestamp?: Date;
      data?: any;
    },
    userIds?: string[],
  ) {
    const notificationData = {
      id: notification.id || `notif-${Date.now()}-${Math.random()}`,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      content: notification.message,
      timestamp: notification.timestamp || new Date(),
      read: false,
      data: notification.data,
    };

    // Dacă avem lista de utilizatori, salvăm notificarea pentru fiecare
    if (userIds && userIds.length > 0) {
      const notificationsToSave = userIds.map((userId) => ({
        id: randomUUID(),
        senderId: senderId || null,
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: false,
        centro,
        grupo: null,
        data:
          notification.data === undefined || notification.data === null
            ? null
            : typeof notification.data === 'string'
              ? notification.data
              : JSON.stringify(notification.data),
      }));
      await this.prisma.notification.createMany({
        data: notificationsToSave,
      });
    }

    // Normalizează numele centrului pentru room
    const normalizedCentro = centro.replace(/\s+/g, '_');
    this.notificationsGateway.sendToCentro(normalizedCentro, notificationData);
  }

  /**
   * Obține notificările pentru un utilizator
   * @param userId ID-ul utilizatorului
   * @param limit Numărul maxim de notificări
   * @param offset Offset pentru paginare
   */
  async getUserNotifications(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Obține numărul de notificări necitite pentru un utilizator
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  /**
   * Marchează o notificare ca citită
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true, readAt: new Date() },
    });

    return result.count > 0;
  }

  /**
   * Marchează toate notificările unui utilizator ca citite
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });

    return result.count || 0;
  }

  /**
   * Șterge o notificare
   */
  async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId,
      },
    });
    return result.count > 0;
  }

  /**
   * Inventar central: toate tipurile de notificări cunoscute în app.
   */
  getNotificationInventory(): NotificationKindMeta[] {
    return getNotificationInventory();
  }

  /**
   * Historial admin: reminder-uri de fichaje trimise (in-app / push).
   */
  async listFichajeReminders(options?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    q?: string;
  }): Promise<{
    total: number;
    items: Array<{
      id: string;
      userId: string;
      nombre: string | null;
      title: string;
      message: string;
      type: string;
      read: boolean;
      readAt: Date | null;
      createdAt: Date;
      tipo: string | null;
      horario: string | null;
      estado: string | null;
      centro: string | null;
      grupo: string | null;
    }>;
  }> {
    const limit = Math.min(Math.max(Number(options?.limit) || 50, 1), 200);
    const offset = Math.max(Number(options?.offset) || 0, 0);

    const escape = (v: string) =>
      `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

    const whereParts = [
      `(n.data LIKE '%"kind":"FICHAJE_REMINDER"%' OR n.data LIKE '%FICHAJE_REMINDER%')`,
    ];

    if (options?.startDate && /^\d{4}-\d{2}-\d{2}$/.test(options.startDate)) {
      whereParts.push(`DATE(n.created_at) >= ${escape(options.startDate)}`);
    }
    if (options?.endDate && /^\d{4}-\d{2}-\d{2}$/.test(options.endDate)) {
      whereParts.push(`DATE(n.created_at) <= ${escape(options.endDate)}`);
    }
    if (options?.q && String(options.q).trim()) {
      const q = String(options.q).trim();
      whereParts.push(
        `(n.user_id LIKE ${escape(`%${q}%`)} OR e.\`NOMBRE / APELLIDOS\` LIKE ${escape(`%${q}%`)} OR n.title LIKE ${escape(`%${q}%`)} OR n.message LIKE ${escape(`%${q}%`)})`,
      );
    }

    const whereSql = whereParts.join(' AND ');

    try {
      const countRows = await this.prisma.$queryRawUnsafe<
        Array<{ total: number }>
      >(
        `SELECT COUNT(*) AS total
         FROM notifications n
         LEFT JOIN \`DatosEmpleados\` e ON TRIM(e.\`CODIGO\`) = TRIM(n.user_id)
         WHERE ${whereSql}`,
      );
      const total = Number(countRows?.[0]?.total || 0);

      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          userId: string;
          nombre: string | null;
          title: string;
          message: string;
          type: string;
          readFlag: number | boolean;
          readAt: Date | null;
          createdAt: Date;
          data: string | null;
        }>
      >(
        `SELECT
           n.id AS id,
           n.user_id AS userId,
           e.\`NOMBRE / APELLIDOS\` AS nombre,
           n.title AS title,
           n.message AS message,
           n.type AS type,
           n.\`read\` AS readFlag,
           n.read_at AS readAt,
           n.created_at AS createdAt,
           n.data AS data
         FROM notifications n
         LEFT JOIN \`DatosEmpleados\` e ON TRIM(e.\`CODIGO\`) = TRIM(n.user_id)
         WHERE ${whereSql}
         ORDER BY n.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
      );

      const items = (rows || []).map((r) => {
        let parsed: any = null;
        if (r.data) {
          try {
            parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
          } catch {
            parsed = null;
          }
        }
        return {
          id: r.id,
          userId: r.userId,
          nombre: r.nombre || null,
          title: r.title,
          message: r.message,
          type: r.type,
          read: Boolean(r.readFlag),
          readAt: r.readAt ?? null,
          createdAt: r.createdAt,
          tipo: parsed?.tipo ?? null,
          horario: parsed?.horario ?? null,
          estado: parsed?.estado ?? null,
          centro: parsed?.centro ?? null,
          grupo: parsed?.grupo ?? null,
        };
      });

      return { total, items };
    } catch (err: any) {
      this.logger.error(`listFichajeReminders failed: ${err?.message || err}`);
      return { total: 0, items: [] };
    }
  }

  /**
   * Exemplu: Notificare când un fichaje este aprobat
   */
  notifyFichajeApproved(senderId: string, userId: string, fichajeData: any) {
    this.notifyUser(senderId, userId, {
      type: 'success',
      title: 'Fichaje aprobat',
      message: `Fichajul tău din ${fichajeData.fecha} a fost aprobat.`,
      data: { ...fichajeData, kind: 'FICHAJE_APPROVED' },
    });
  }

  /**
   * Exemplu: Notificare când un pedido este actualizat
   */
  notifyPedidoUpdated(senderId: string, userId: string, pedidoData: any) {
    this.notifyUser(senderId, userId, {
      type: 'info',
      title: 'Pedido actualizat',
      message: `Status-ul pedido-ului ${pedidoData.id} a fost actualizat.`,
      data: pedidoData,
    });
  }

  /**
   * Exemplu: Notificare pentru toți managerii
   */
  notifyManagers(senderId: string, message: string) {
    this.notifyGroup(senderId, 'Manager', {
      type: 'info',
      title: 'Notificare pentru manageri',
      message: message,
    });
  }

  /**
   * Verifică dacă un utilizator poate trimite notificări
   * Doar Developer și Supervisor/Manager pot trimite notificări
   */
  canSendNotifications(grupo: string): boolean {
    const allowedGroups = ['Developer', 'Supervisor', 'Manager', 'Admin'];
    return allowedGroups.includes(grupo);
  }
}
