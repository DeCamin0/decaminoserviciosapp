import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Query,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationsService } from '../services/notifications.service';

/**
 * Controller pentru testarea notificărilor
 * Endpoint-uri pentru a trimite notificări de test
 */
@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Obține notificările utilizatorului curent
   */
  @Get()
  async getNotifications(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const notifications = await this.notificationsService.getUserNotifications(
      user.userId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );

    const unreadCount = await this.notificationsService.getUnreadCount(
      user.userId,
    );

    return {
      success: true,
      notifications,
      unreadCount,
    };
  }

  /**
   * Obține numărul de notificări necitite
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: any) {
    const count = await this.notificationsService.getUnreadCount(user.userId);
    return {
      success: true,
      unreadCount: count,
    };
  }

  /**
   * Marchează o notificare ca citită
   */
  @Put(':id/read')
  async markAsRead(
    @CurrentUser() user: any,
    @Param('id') notificationId: string,
  ) {
    const success = await this.notificationsService.markAsRead(
      notificationId,
      user.userId,
    );
    return {
      success,
      message: success
        ? 'Notificare marcată ca citită'
        : 'Notificare nu a fost găsită',
    };
  }

  /**
   * Marchează toate notificările ca citite
   */
  @Put('read-all')
  async markAllAsRead(@CurrentUser() user: any) {
    const count = await this.notificationsService.markAllAsRead(user.userId);
    return {
      success: true,
      message: `${count} notificări marcate ca citite`,
      count,
    };
  }

  /**
   * Șterge o notificare
   */
  @Delete(':id')
  async deleteNotification(
    @CurrentUser() user: any,
    @Param('id') notificationId: string,
  ) {
    const success = await this.notificationsService.deleteNotification(
      notificationId,
      user.userId,
    );
    return {
      success,
      message: success ? 'Notificare ștearsă' : 'Notificare nu a fost găsită',
    };
  }

  /**
   * Verifică dacă utilizatorul poate trimite notificări
   * Doar Developer și Supervisor/Manager pot trimite notificări
   */
  private canUserSendNotifications(user: any): boolean {
    const grupo = user.grupo || user.GRUPO || '';
    return this.notificationsService.canSendNotifications(grupo);
  }

  /**
   * Endpoint de test - trimite notificare către utilizatorul curent
   */
  @Post('test')
  async sendTestNotification(@CurrentUser() user: any) {
    // Verifică permisiunile
    if (!this.canUserSendNotifications(user)) {
      return {
        success: false,
        message:
          'No tienes permiso para enviar notificaciones. Solo supervisores y desarrolladores pueden enviar notificaciones.',
      };
    }

    const testData = {
      senderId: user.userId,
      senderName: user.name || user.email || 'Usuario',
      recipientId: user.userId,
      recipientName: user.name || user.email || 'Usuario',
      timestamp: new Date().toISOString(),
      source: 'test',
      testNotification: true,
    };

    console.log(
      '[NotificationsController] Test notification data:',
      JSON.stringify(testData, null, 2),
    );

    await this.notificationsService.notifyUser(user.userId, user.userId, {
      type: 'info',
      title: 'Notificación de prueba',
      message: `¡Hola ${user.email}! Esta es una notificación de prueba.`,
      data: testData,
    });

    return {
      success: true,
      message: 'Notificare de test trimisă',
    };
  }

  /**
   * Endpoint pentru trimiterea notificărilor către un utilizator specific
   * Folosit de interfața de trimitere notificări
   */
  @Post('send')
  async sendNotification(
    @CurrentUser() currentUser: any,
    @Body()
    body: {
      userId: string;
      title: string;
      message: string;
      type?: 'success' | 'error' | 'warning' | 'info';
      data?: any;
    },
  ) {
    // Verifică permisiunile
    if (!this.canUserSendNotifications(currentUser)) {
      return {
        success: false,
        message:
          'No tienes permiso para enviar notificaciones. Solo supervisores y desarrolladores pueden enviar notificaciones.',
      };
    }

    const { userId, title, message, type = 'info', data } = body;

    console.log(
      '[NotificationsController] Received body:',
      JSON.stringify(body, null, 2),
    );
    console.log('[NotificationsController] Data from body:', data);
    console.log('[NotificationsController] Data type:', typeof data);

    if (!userId) {
      return {
        success: false,
        message: 'userId es obligatorio',
      };
    }

    if (!title || !title.trim()) {
      return {
        success: false,
        message: 'El título es obligatorio',
      };
    }

    if (!message || !message.trim()) {
      return {
        success: false,
        message: 'El mensaje es obligatorio',
      };
    }

    // Trimite data exact cum vine din body (sau null dacă nu există)
    await this.notificationsService.notifyUser(currentUser.userId, userId, {
      type,
      title: title.trim(),
      message: message.trim(),
      data: data, // Trimite exact ce vine, fără default
    });

    return {
      success: true,
      message: `Notificación enviada a ${userId}`,
    };
  }

  /**
   * Endpoint de test - trimite notificare către un utilizator specific (prin userId)
   */
  @Post('test-user')
  async sendTestNotificationToUser(
    @CurrentUser() currentUser: any,
    @Body() body: { userId: string; message?: string },
  ) {
    // Verifică permisiunile
    if (!this.canUserSendNotifications(currentUser)) {
      return {
        success: false,
        message:
          'No tienes permiso para enviar notificaciones. Solo supervisores y desarrolladores pueden enviar notificaciones.',
      };
    }

    const { userId, message } = body;

    if (!userId) {
      return {
        success: false,
        message: 'userId este obligatoriu',
      };
    }

    await this.notificationsService.notifyUser(currentUser.userId, userId, {
      type: 'info',
      title: 'Notificare de test',
      message: message || `Notificare de test pentru utilizatorul ${userId}`,
      data: {}, // Trimite întotdeauna un obiect, chiar dacă e gol
    });

    return {
      success: true,
      message: `Notificare trimisă către utilizatorul ${userId}`,
    };
  }

  /**
   * Endpoint de test - trimite notificare către grupul utilizatorului
   */
  @Post('test-group')
  async sendTestGroupNotification(@CurrentUser() user: any) {
    // Verifică permisiunile
    if (!this.canUserSendNotifications(user)) {
      return {
        success: false,
        message:
          'No tienes permiso para enviar notificaciones. Solo supervisores y desarrolladores pueden enviar notificaciones.',
      };
    }

    const grupo = user.grupo || user.GRUPO;
    if (grupo) {
      await this.notificationsService.notifyGroup(user.userId, grupo, {
        type: 'info',
        title: 'Notificare de grup',
        message: `Notificare pentru grupul ${grupo}`,
      });
    }

    return {
      success: true,
      message: 'Notificare de grup trimisă',
    };
  }

  /**
   * Health check pentru notificări
   */
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      message: 'Notifications service is running',
    };
  }
}
