import { Module } from '@nestjs/common';
import { ComunicadosController } from './comunicados.controller';
import { ComunicadosService } from './comunicados.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PushService } from '../services/push.service';
import { ComunicadosStorageService } from '../services/comunicados-storage.service';

@Module({
  imports: [PrismaModule],
  // Debug controller stays in the repo but is not registered: its routes ran ALTER without auth.
  controllers: [ComunicadosController],
  providers: [ComunicadosService, PushService, ComunicadosStorageService],
  exports: [ComunicadosService],
})
export class ComunicadosModule {}
