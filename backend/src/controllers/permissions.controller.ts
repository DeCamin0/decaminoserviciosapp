import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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

  /**
   * POST endpoint pentru salvare/actualizare permisiuni
   * Acceptă array de permisiuni: [{ grupo_module, permitted, last_updated, updated_by }]
   * Folosește upsert pentru a crea sau actualiza permisiuni
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async savePermissions(@Body() body: any) {
    try {
      // Verifică dacă body este array sau obiect cu array
      const permissionsArray = Array.isArray(body)
        ? body
        : body.permissions || body.data || [];

      if (!Array.isArray(permissionsArray) || permissionsArray.length === 0) {
        throw new BadRequestException('Permissions array is required');
      }

      // Validează structura fiecărei permisiuni
      for (const perm of permissionsArray) {
        if (!perm.grupo_module) {
          throw new BadRequestException(
            'grupo_module is required for each permission',
          );
        }
      }

      // Salvează/actualizează fiecare permisiune folosind upsert
      const results = [];
      for (const perm of permissionsArray) {
        const result = await this.prisma.permissions.upsert({
          where: {
            grupo_module: perm.grupo_module,
          },
          update: {
            permitted: String(perm.permitted || 'false'),
            last_updated:
              perm.last_updated || new Date().toISOString().split('T')[0],
            updated_by: perm.updated_by || 'admin@decamino.com',
          },
          create: {
            grupo_module: perm.grupo_module,
            permitted: String(perm.permitted || 'false'),
            last_updated:
              perm.last_updated || new Date().toISOString().split('T')[0],
            updated_by: perm.updated_by || 'admin@decamino.com',
          },
        });
        results.push(result);
      }

      return {
        success: true,
        message: `Successfully saved ${results.length} permissions`,
        count: results.length,
        permissions: results,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error saving permissions: ${error.message}`,
      );
    }
  }
}
