import { Module } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from '../services/notifications.service';
import { NotificationsController } from '../controllers/notifications.controller';
import { OnlineUsersController } from '../controllers/online-users.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PushService } from '../services/push.service';

@Module({
  imports: [
    JwtModule,
    ConfigModule,
    PrismaModule, // Import PrismaModule for PrismaService (needed by PushService)
  ],
  controllers: [NotificationsController, OnlineUsersController],
  providers: [NotificationsGateway, NotificationsService, PushService],
  exports: [NotificationsGateway, NotificationsService],
})
export class NotificationsModule {}
