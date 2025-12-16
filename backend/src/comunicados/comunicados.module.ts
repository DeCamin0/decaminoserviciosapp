import { Module } from '@nestjs/common';
import { ComunicadosController } from './comunicados.controller';
import { ComunicadosService } from './comunicados.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PushService } from '../services/push.service';

@Module({
  imports: [PrismaModule],
  controllers: [ComunicadosController],
  providers: [ComunicadosService, PushService],
  exports: [ComunicadosService],
})
export class ComunicadosModule {}
