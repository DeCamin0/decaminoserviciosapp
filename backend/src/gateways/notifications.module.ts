import { Module, forwardRef } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from '../services/notifications.service';
import { NotificationsController } from '../controllers/notifications.controller';
import { ChatModule } from '../chat/chat.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PushService } from '../services/push.service';

@Module({
  imports: [
    JwtModule,
    ConfigModule,
    PrismaModule, // Import PrismaModule for PrismaService (needed by PushService)
    forwardRef(() => ChatModule), // Import ChatModule to use PresenceManager
  ],
  controllers: [NotificationsController],
  providers: [NotificationsGateway, NotificationsService, PushService],
  exports: [NotificationsGateway, NotificationsService],
})
export class NotificationsModule {}
