import {
  Controller,
  Get,
  Post,
  Delete,
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
  @UseGuards(JwtAuthGuard)
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

  /**
   * DELETE /api/permissions/unused-groups
   * Șterge toate permisiunile pentru grupurile care nu există în tabelul DatosEmpleados
   * Grupurile folosite sunt obținute direct din DatosEmpleados (câmpul GRUPO)
   */
  @Delete('unused-groups')
  @UseGuards(JwtAuthGuard)
  async deleteUnusedGroups() {
    try {
      // Obține toate grupurile unice din DatosEmpleados (câmpul GRUPO)
      const gruposEmpleados = await this.prisma.$queryRawUnsafe<
        Array<{ GRUPO: string }>
      >(
        `
        SELECT DISTINCT \`GRUPO\`
        FROM DatosEmpleados
        WHERE \`GRUPO\` IS NOT NULL 
          AND \`GRUPO\` != ''
          AND TRIM(\`GRUPO\`) != ''
        ORDER BY \`GRUPO\`
        `,
      );

      const usedGroups = gruposEmpleados
        .map((g) => g.GRUPO?.trim())
        .filter(
          (grupo): grupo is string =>
            grupo !== null && grupo !== undefined && grupo !== '',
        );

      if (usedGroups.length === 0) {
        throw new BadRequestException(
          'No groups found in DatosEmpleados. Cannot delete permissions.',
        );
      }

      // Obține toate permisiunile din baza de date
      const allPermissions = await this.prisma.permissions.findMany();

      // Extrage toate grupurile unice din permisiuni
      const allGroupsInDb = new Set<string>();
      allPermissions.forEach((perm) => {
        const parts = perm.grupo_module.split('_');
        if (parts.length >= 1) {
          allGroupsInDb.add(parts[0]);
        }
      });

      // Identifică grupurile nefolosite (care sunt în Permissions dar nu sunt în DatosEmpleados)
      const usedGroupsSet = new Set(usedGroups);
      const unusedGroups = Array.from(allGroupsInDb).filter(
        (group) => !usedGroupsSet.has(group.trim()),
      );

      if (unusedGroups.length === 0) {
        return {
          success: true,
          message:
            'No unused groups found. All groups in Permissions table exist in DatosEmpleados.',
          deleted: 0,
          unusedGroups: [],
          usedGroups: usedGroups,
        };
      }

      // Șterge toate permisiunile pentru grupurile nefolosite
      let deletedCount = 0;
      for (const grupo of unusedGroups) {
        const result = await this.prisma.permissions.deleteMany({
          where: {
            grupo_module: {
              startsWith: grupo + '_',
            },
          },
        });
        deletedCount += result.count;
      }

      return {
        success: true,
        message: `Successfully deleted ${deletedCount} permissions for ${unusedGroups.length} unused groups`,
        deleted: deletedCount,
        unusedGroups: unusedGroups,
        usedGroups: usedGroups,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error deleting unused groups: ${error.message}`,
      );
    }
  }
}
