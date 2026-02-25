import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { InformesFacturaConfigController } from '../controllers/informes-factura-config.controller';
import { InformePdfService } from '../services/informe-pdf.service';
import { EmailService } from '../services/email.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [InformesFacturaConfigController],
  providers: [InformePdfService, EmailService],
  exports: [InformePdfService],
})
export class InformesModule {}
