import { Module } from '@nestjs/common';
import { InformesFacturaConfigController } from '../controllers/informes-factura-config.controller';
import { InformePdfService } from '../services/informe-pdf.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InformesFacturaConfigController],
  providers: [InformePdfService],
  exports: [InformePdfService],
})
export class InformesModule {}
