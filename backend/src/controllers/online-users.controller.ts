import {
  Controller,
  Get,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationsGateway } from '../gateways/notifications.gateway';

/**
 * Endpoint simplu pentru a obține lista utilizatorilor online (via WebSocket)
 * Folosit în special în Admin / Gestión de Empleados pentru badge Online/Offline
 */
@Controller('api/online-users')
@UseGuards(JwtAuthGuard)
export class OnlineUsersController {
  constructor(private readonly notificationsGateway: NotificationsGateway) {}

  @Get()
  async getOnlineUsers(@CurrentUser() user: any) {
    const grupo = user?.GRUPO || user?.grupo || '';

    const allowedGroups = ['Admin', 'Developer', 'Manager', 'Supervisor'];
    if (!allowedGroups.includes(grupo)) {
      throw new BadRequestException(
        'Acceso restringido. Solo administradores, desarrolladores, managers y supervisores pueden ver el estado online.',
      );
    }

    const onlineUserIds = this.notificationsGateway.getOnlineUserIds();

    return {
      success: true,
      count: onlineUserIds.length,
      items: onlineUserIds.map((userId) => ({ userId })),
    };
  }
}


