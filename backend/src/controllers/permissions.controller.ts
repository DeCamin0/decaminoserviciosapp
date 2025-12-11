import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/permissions')
export class PermissionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getPermissions(@Query('grupo') grupo?: string) {
    try {
      const rows = await this.prisma.permissions.findMany({
        where: grupo
          ? {
              grupo_module: {
                startsWith: grupo,
              },
            }
          : undefined,
      });

      return {
        success: true,
        count: rows.length,
        permissions: rows,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to load permissions',
      };
    }
  }
}
