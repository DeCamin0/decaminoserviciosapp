import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { PortalAuthController } from './portal-auth.controller';
import { PortalPublicController } from './portal-public.controller';
import { PortalClienteController } from './portal-cliente.controller';
import { PortalDocumentosAdminController } from './portal-documentos-admin.controller';
import { PortalFacturasLoteController } from './portal-facturas-lote.controller';
import { PortalFacturasLoteService } from './portal-facturas-lote.service';
import { PortalAuthService } from './portal-auth.service';
import { PortalDocumentsService } from './portal-documents.service';
import { PortalJwtStrategy } from './portal-jwt.strategy';
import { PortalJwtOrSelectGuard } from './portal-jwt-or-select.guard';
import { EmailService } from '../services/email.service';
import { PresupuestosGuardadosService } from '../services/presupuestos-guardados.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.portalSecret'),
        signOptions: {
          expiresIn: (configService.get<string>('jwt.portalExpiresIn') ||
            '12h') as StringValue,
        },
      }),
    }),
  ],
  controllers: [
    PortalPublicController,
    PortalAuthController,
    PortalClienteController,
    PortalDocumentosAdminController,
    PortalFacturasLoteController,
  ],
  providers: [
    PortalAuthService,
    PortalDocumentsService,
    PortalFacturasLoteService,
    PortalJwtStrategy,
    PortalJwtOrSelectGuard,
    EmailService,
    PresupuestosGuardadosService,
  ],
})
export class PortalModule {}
