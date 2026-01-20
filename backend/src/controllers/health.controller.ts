import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { N8nProxyService } from '../services/n8n-proxy.service';

/**
 * Health check controller
 * Useful for testing that backend is running and can reach n8n
 */
@Controller('health')
export class HealthController {
  constructor(private readonly n8nProxyService: N8nProxyService) {}

  @SkipThrottle() // Health checks nu trebuie să fie rate-limited
  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      n8nBaseUrl: this.n8nProxyService.getBaseUrl(),
    };
  }
}
