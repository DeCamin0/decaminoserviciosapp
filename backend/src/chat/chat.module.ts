import { Module, forwardRef } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { PresenceManager } from './presence-manager.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '../config/config.module';
import { NotificationsModule } from '../gateways/notifications.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule,
    ConfigModule,
    forwardRef(() => NotificationsModule),
  ],
  providers: [ChatService, PresenceManager, ChatGateway],
  controllers: [ChatController],
  exports: [ChatService, PresenceManager, ChatGateway],
})
export class ChatModule {}
