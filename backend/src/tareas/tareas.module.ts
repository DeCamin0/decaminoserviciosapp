import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../gateways/notifications.module';
import { EmpleadoGrupoScopeService } from '../services/empleado-grupo-scope.service';
import { EmailService } from '../services/email.service';
import { SentEmailsService } from '../services/sent-emails.service';
import { TareasController } from './tareas.controller';
import { TareasService } from './tareas.service';

@Module({
  imports: [PrismaModule, StorageModule, NotificationsModule, ConfigModule],
  controllers: [TareasController],
  providers: [
    TareasService,
    EmpleadoGrupoScopeService,
    EmailService,
    SentEmailsService,
  ],
  exports: [TareasService],
})
export class TareasModule {}
