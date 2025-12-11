import { Module, forwardRef } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from '../services/notifications.service';
import { NotificationsController } from '../controllers/notifications.controller';
import { ChatModule } from '../chat/chat.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    JwtModule,
    ConfigModule,
    forwardRef(() => ChatModule), // Import ChatModule to use PresenceManager
  ],
  controllers: [NotificationsController],
  providers: [NotificationsGateway, NotificationsService],
  exports: [NotificationsGateway, NotificationsService],
})
export class NotificationsModule {}
