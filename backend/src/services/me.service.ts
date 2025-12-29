import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmpleadosService } from './empleados.service';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly empleadosService: EmpleadosService,
  ) {}

  async getMe(currentUser: any) {
    const userId = currentUser?.userId;
    const grupoFromToken = currentUser?.grupo || currentUser?.GRUPO || null;

    if (!userId) {
      throw new NotFoundException('User not found in token');
    }

    // Fetch user via EmpleadosService to get all fields including new split columns
    const empleadoData = await this.empleadosService.getEmpleadoByCodigo(userId);
    
    if (!empleadoData) {
      throw new NotFoundException('User not found');
    }
    
    // Also fetch via Prisma for permissions and other data
    const user = await this.prisma.user.findUnique({
      where: { CODIGO: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Permissions via Prisma
    const grupoKey = grupoFromToken || user.GRUPO || '';
    const permissions = grupoKey
      ? await this.prisma.permissions.findMany({
          where: { grupo_module: { startsWith: grupoKey } },
        })
      : [];

    const avatar = {
      url: null,
      version: null,
    };

    // Fetch CENTRO TRABAJO via raw query (not mapped in Prisma User model)
    let centroTrabajo: string | null = null;
    try {
      const centroRaw = await this.prisma.$queryRaw<any[]>`
        SELECT \`CENTRO TRABAJO\` as centro_trabajo 
        FROM DatosEmpleados 
        WHERE CODIGO = ${userId}
      `;
      centroTrabajo = centroRaw?.[0]?.centro_trabajo || null;
    } catch (error) {
      console.warn('[MeService] Error fetching CENTRO TRABAJO:', error);
      // Continue with null centroTrabajo
    }

    // Normalizează câmpuri canonice pentru frontend (alerte, afișare)
    const empleadoId = user.CODIGO;
    // Use formatted nombre from empleadoData (includes new split columns)
    const empleadoNombre = this.empleadosService.getFormattedNombre(empleadoData);

    // Detect role from GRUPO (consistent with auth.service.ts)
    const grupo = grupoFromToken || user.GRUPO || '';
    let role = 'EMPLEADOS'; // default
    if (grupo === 'Manager' || grupo === 'Supervisor') {
      role = 'MANAGER';
    } else if (grupo === 'Developer') {
      role = 'DEVELOPER';
    } else if (grupo === 'Admin') {
      role = 'ADMIN';
    }

    // Calculate isManager flag (consistent with auth.service.ts login logic)
    // Includes Manager, Supervisor, Developer for manager-level permissions
    const isManager =
      grupo === 'Manager' ||
      grupo === 'Supervisor' ||
      grupo === 'Developer' ||
      grupo === 'Admin';

    return {
      success: true,
      user: {
        ...user,
        ...empleadoData, // Include all fields from empleadoData (including new split columns)
        empleadoId,
        empleadoNombre,
        // aliases for frontend compatibility - folosește empleadoNombre care are fallback-uri
        ['NOMBRE / APELLIDOS']: empleadoNombre || user.NOMBRE_APELLIDOS || null,
        ['CENTRO TRABAJO']: centroTrabajo, // Add CENTRO TRABAJO for chat feature
        email: user.CORREO_ELECTRONICO ?? null,
        // Add computed fields for frontend consistency
        isManager,
        role,
        GRUPO: grupo,
      },
      permissions,
      avatar,
    };
  }
}
