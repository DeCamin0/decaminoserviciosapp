import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminTenantsController } from './super-admin-tenants.controller';
import { TenantRegistryService } from './tenant-registry.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { TenantCryptoService } from './tenant-crypto.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { TenantApiHealthService } from './tenant-api-health.service';

@Module({
  imports: [AuthModule],
  controllers: [SuperAdminTenantsController],
  providers: [
    JwtAuthGuard,
    SuperAdminGuard,
    TenantRegistryService,
    TenantProvisioningService,
    TenantCryptoService,
    TenantApiHealthService,
  ],
})
export class SuperAdminTenantsModule {}
