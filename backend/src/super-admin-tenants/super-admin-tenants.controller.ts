import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { TenantRegistryService } from './tenant-registry.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { TenantCryptoService } from './tenant-crypto.service';
import { createTenantSchema, patchTenantSchema } from './dto/create-tenant.dto';
import { TenantApiHealthService } from './tenant-api-health.service';

@SkipThrottle()
@Controller('api/super-admin/tenants')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SuperAdminTenantsController {
  constructor(
    private readonly registry: TenantRegistryService,
    private readonly provisioning: TenantProvisioningService,
    private readonly crypto: TenantCryptoService,
    private readonly tenantHealth: TenantApiHealthService,
  ) {}

  @Get()
  async list() {
    this.registry.assertConfigured();
    const tenants = await this.registry.listTenants();
    const tenantsOut = await Promise.all(
      tenants.map(async (t) => {
        const api_health = await this.tenantHealth.probe(t.api_public_url);
        return { ...t, api_health };
      }),
    );
    return { success: true, tenants: tenantsOut };
  }

  /**
   * Activar / desactivar tenant (solo registry). No corta el tráfico de la API por sí solo.
   */
  @Patch(':id')
  async patchLifecycle(@Param('id') id: string, @Body() body: unknown) {
    this.registry.assertConfigured();
    let parsed;
    try {
      parsed = patchTenantSchema.parse(body);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid body';
      throw new BadRequestException(msg);
    }

    const tenant = await this.registry.getTenant(id);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (
      parsed.api_public_url !== undefined ||
      parsed.environment !== undefined
    ) {
      const api_public_url =
        parsed.api_public_url === undefined
          ? undefined
          : parsed.api_public_url.trim() === ''
            ? null
            : parsed.api_public_url.trim();
      const environment =
        parsed.environment === undefined
          ? undefined
          : parsed.environment.trim() === ''
            ? null
            : parsed.environment.trim();
      await this.registry.updateTenantMeta(id, {
        api_public_url,
        environment,
      });
      if (parsed.status === undefined) {
        const updated = await this.registry.getTenant(id);
        return { success: true, tenant: updated };
      }
    }

    if (parsed.status === 'inactive') {
      if (tenant.status === 'inactive') {
        return { success: true, tenant };
      }
      await this.registry.updateStatus(id, 'inactive', null);
      await this.registry.appendLog(
        id,
        'info',
        'Tenant marcado como inactivo (desde super-admin).',
      );
    } else {
      if (tenant.status !== 'inactive') {
        throw new BadRequestException(
          'Solo se puede activar un tenant que esté inactivo. Si falló el provisionamiento, usa Reintentar.',
        );
      }
      await this.registry.updateStatus(id, 'active', null);
      await this.registry.appendLog(
        id,
        'info',
        'Tenant reactivado (desde super-admin).',
      );
    }

    const updated = await this.registry.getTenant(id);
    return { success: true, tenant: updated };
  }

  @Get(':id/logs')
  async logs(@Param('id') id: string) {
    this.registry.assertConfigured();
    const tenant = await this.registry.getTenant(id);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const logs = await this.registry.listLogs(id, 200);
    return { success: true, logs };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    this.registry.assertConfigured();
    const tenant = await this.registry.getTenant(id);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return { success: true, tenant };
  }

  @Post()
  async create(@Body() body: unknown) {
    this.registry.assertConfigured();
    this.provisioning.assertProvisionEnv();
    let parsed;
    try {
      parsed = createTenantSchema.parse(body);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid body';
      throw new BadRequestException(msg);
    }

    const slug = parsed.client_slug.trim().toLowerCase();
    if (await this.registry.slugExists(slug)) {
      throw new ConflictException(`Slug already exists: ${slug}`);
    }

    let enc: string;
    try {
      const dbPassword = this.provisioning.generateDbPassword();
      enc = this.crypto.encrypt(dbPassword);
      const id = this.registry.newId();
      const database_name = `tenant_${slug}`;
      const database_user = `app_${slug}`;

      await this.registry.insertTenant({
        id,
        name: parsed.client_name.trim(),
        slug,
        timezone: parsed.timezone.trim(),
        notes: parsed.notes?.trim() || null,
        plan: parsed.plan?.trim() || null,
        api_public_url:
          parsed.api_public_url?.trim() && parsed.api_public_url.trim() !== ''
            ? parsed.api_public_url.trim()
            : null,
        environment:
          parsed.environment?.trim() && parsed.environment.trim() !== ''
            ? parsed.environment.trim()
            : null,
        database_name,
        database_user,
        database_password_enc: enc,
      });

      this.provisioning.scheduleProvision(id);

      return {
        success: true,
        tenant_id: id,
        status: 'provisioning',
        database_name,
        database_user,
        /** Shown only in this response; never stored in plain text */
        db_password_once: dbPassword,
        message:
          'Save db_password_once now; it will not be shown again. Provisioning runs in the background.',
      };
    } catch (e: unknown) {
      if (e instanceof ServiceUnavailableException) {
        throw e;
      }
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('TENANT_DB_PASSWORD_ENCRYPTION_KEY')) {
        throw new ServiceUnavailableException(msg);
      }
      throw e;
    }
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    this.registry.assertConfigured();
    this.provisioning.assertProvisionEnv();
    const tenant = await this.registry.getTenant(id);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    if (tenant.status !== 'failed') {
      throw new BadRequestException('Retry only allowed when status is failed');
    }
    await this.registry.updateStatus(id, 'provisioning', null);
    await this.registry.appendLog(id, 'info', 'Manual retry requested');
    this.provisioning.scheduleProvision(id);
    return { success: true, status: 'provisioning' };
  }
}
