import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import { Notification } from '../entities/notification.entity';
import { User } from '../entities/user.entity';

/**
 * Service pentru gestionarea notificărilor
 * Folosește NotificationsGateway pentru a trimite notificări în timp real
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsGateway: NotificationsGateway,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Trimite notificare către un utilizator specific
   * @param senderId ID-ul utilizatorului care trimite (CODIGO)
   * @param userId ID-ul utilizatorului căruia i se trimite (CODIGO)
   * @param notification Obiectul notificării
   */
  async notifyUser(senderId: string, userId: string, notification: {
    id?: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp?: Date;
    data?: any;
  }) {
    // Obține informațiile utilizatorului căruia i se trimite (pentru grupo și centro)
    let grupo: string | null = null;
    let centro: string | null = null;
    
    try {
      const recipientUser = await this.userRepository.findOne({
        where: { CODIGO: userId },
      });
      
      if (recipientUser) {
        grupo = recipientUser.GRUPO || null;
        centro = recipientUser['CENTRO TRABAJO'] || null;
      }
    } catch (error) {
      console.warn('[NotificationsService] Error fetching user info:', error);
    }

    // Generează ID-ul
    const notificationId = require('crypto').randomUUID();

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
    
    console.log('[NotificationsService] Data to save:', dataValue === null ? 'NULL' : dataValue, 'Original:', notification.data);

    // Salvează folosind manager.query direct cu escape corect
    await this.notificationRepository.manager.query(
      `INSERT INTO notifications (id, sender_id, user_id, type, title, message, \`read\`, data, grupo, centro, created_at, read_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL)`,
      [
        notificationId,
        senderId || null,
        userId,
        notification.type,
        notification.title,
        notification.message,
        0,
        dataValue,
        grupo || null,
        centro || null,
      ]
    );
    
    // Verifică DIRECT din MySQL - verifică EXACT ce e salvat
    const check = await this.notificationRepository.manager.query(
      `SELECT 
        id, 
        data, 
        LENGTH(data) as len, 
        data = '{}' as is_empty_json,
        data IS NULL as is_null,
        QUOTE(data) as data_quoted,
        CONCAT('"', data, '"') as data_with_quotes
      FROM notifications WHERE id = ?`,
      [notificationId]
    );
    console.log('[NotificationsService] ✅ DB VERIFICATION:', JSON.stringify(check[0], null, 2));
    console.log('[NotificationsService] ✅ DATA VALUE IN DB:', check[0]?.data, '| Length:', check[0]?.len, '| Is "{}":', check[0]?.is_empty_json === 1);
    
    // Recuperează pentru WebSocket
    const savedNotification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    const notificationData = {
      id: savedNotification.id,
      type: savedNotification.type,
      title: savedNotification.title,
      message: savedNotification.message,
      content: savedNotification.message,
      timestamp: savedNotification.createdAt,
      read: false,
      data: savedNotification.data,
    };

    // Trimite notificarea în timp real prin WebSocket
    this.notificationsGateway.sendToUser(userId, notificationData);
  }

  /**
   * Trimite notificare către un grup
   * @param senderId ID-ul utilizatorului care trimite (CODIGO)
   * @param grupo Grupul (ex: 'Developer', 'Manager')
   * @param notification Obiectul notificării
   * @param userIds Lista de user IDs din grup (opțional, pentru a salva în BD)
   */
  async notifyGroup(senderId: string, grupo: string, notification: {
    id?: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp?: Date;
    data?: any;
  }, userIds?: string[]) {
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
      const notificationsToSave = userIds.map(userId => ({
        senderId,
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: false,
        grupo,
        data: notification.data || {},
      }));
      await this.notificationRepository.save(notificationsToSave);
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
  async notifyCentro(senderId: string, centro: string, notification: {
    id?: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp?: Date;
    data?: any;
  }, userIds?: string[]) {
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
      const notificationsToSave = userIds.map(userId => ({
        senderId,
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: false,
        centro,
        data: notification.data || {},
      }));
      await this.notificationRepository.save(notificationsToSave);
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
  async getUserNotifications(userId: string, limit: number = 50, offset: number = 0) {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Obține numărul de notificări necitite pentru un utilizator
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, read: false },
    });
  }

  /**
   * Marchează o notificare ca citită
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    // Folosim query builder pentru a actualiza doar read și read_at, fără a afecta data
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ 
        read: true, 
        readAt: new Date() 
      })
      .where('id = :id AND user_id = :userId', { id: notificationId, userId })
      .execute();
    
    return result.affected > 0;
  }

  /**
   * Marchează toate notificările unui utilizator ca citite
   */
  async markAllAsRead(userId: string): Promise<number> {
    // Folosim query builder pentru a actualiza doar read și read_at, fără a afecta data
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ 
        read: true, 
        readAt: new Date() 
      })
      .where('user_id = :userId AND read = :read', { userId, read: false })
      .execute();
    
    return result.affected || 0;
  }

  /**
   * Șterge o notificare
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const result = await this.notificationRepository.delete({
      id: notificationId,
      userId, // Asigură-te că notificarea aparține utilizatorului
    });
    return result.affected > 0;
  }

  /**
   * Exemplu: Notificare când un fichaje este aprobat
   */
  notifyFichajeApproved(senderId: string, userId: string, fichajeData: any) {
    this.notifyUser(senderId, userId, {
      type: 'success',
      title: 'Fichaje aprobat',
      message: `Fichajul tău din ${fichajeData.fecha} a fost aprobat.`,
      data: fichajeData,
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
