import { Module } from '@nestjs/common';
import { VacacionesController } from '../controllers/vacaciones.controller';
import { VacacionesService } from '../services/vacaciones.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VacacionesController],
  providers: [VacacionesService],
  exports: [VacacionesService],
})
export class VacacionesModule {}

