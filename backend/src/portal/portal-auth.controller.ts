import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PortalAuthService } from './portal-auth.service';

@Controller('api/portal/auth')
export class PortalAuthController {
  constructor(private readonly portalAuthService: PortalAuthService) {}

  @Post('request-code')
  @Throttle({ short: { limit: 8, ttl: 60000 } })
  async requestCode(@Body() body: { email?: string; portal_token?: string }) {
    await this.portalAuthService.requestCode(
      body?.email || '',
      body?.portal_token,
    );
    return { success: true };
  }

  @Post('verify-code')
  @Throttle({ short: { limit: 12, ttl: 60000 } })
  async verifyCode(
    @Body() body: { email?: string; code?: string; portal_token?: string },
  ) {
    const result = await this.portalAuthService.verifyCode(
      body?.email || '',
      body?.code || '',
      body?.portal_token,
    );
    return {
      success: true,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
  }

  /** Portal gestores: administradores con varias comunidades (sin enlace por token en el primer paso). */
  @Post('request-admin-code')
  @Throttle({ short: { limit: 8, ttl: 60000 } })
  async requestAdminCode(@Body() body: { email?: string }) {
    await this.portalAuthService.requestAdminPortalCode(body?.email || '');
    return { success: true };
  }

  @Post('verify-admin-code')
  @Throttle({ short: { limit: 12, ttl: 60000 } })
  async verifyAdminCode(@Body() body: { email?: string; code?: string }) {
    const result = await this.portalAuthService.verifyAdminPortalCode(
      body?.email || '',
      body?.code || '',
    );
    if (result.accessToken) {
      return {
        success: true,
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        portal_token: result.portal_token,
      };
    }
    return {
      success: true,
      selectionToken: result.selectionToken,
      communities: result.communities,
    };
  }

  @Post('select-admin-comunidad')
  @Throttle({ short: { limit: 20, ttl: 60000 } })
  async selectAdminComunidad(
    @Body() body: { selection_token?: string; cliente_id?: number },
  ) {
    const clienteId = Number(body?.cliente_id);
    if (!Number.isFinite(clienteId) || clienteId < 1) {
      throw new BadRequestException('cliente_id no válido');
    }
    const sel = String(body?.selection_token || '').trim();
    if (!sel) {
      throw new BadRequestException('selection_token requerido');
    }
    const result = await this.portalAuthService.selectAdminCommunity(
      sel,
      clienteId,
    );
    return {
      success: true,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
  }
}
