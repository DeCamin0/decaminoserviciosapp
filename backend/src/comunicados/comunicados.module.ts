import { Module } from '@nestjs/common';
import { ComunicadosController } from './comunicados.controller';
import { ComunicadosDebugController } from './comunicados-debug.controller';
import { ComunicadosService } from './comunicados.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PushService } from '../services/push.service';

@Module({
  imports: [PrismaModule],
  controllers: [ComunicadosController, ComunicadosDebugController],
  providers: [ComunicadosService, PushService],
  exports: [ComunicadosService],
})
export class ComunicadosModule {}
