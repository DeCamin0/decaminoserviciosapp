import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(currentUser: any) {
    const userId = currentUser?.userId;
    const grupoFromToken = currentUser?.grupo || currentUser?.GRUPO || null;

    if (!userId) {
      throw new NotFoundException('User not found in token');
    }

    // Fetch user via Prisma
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
    const empleadoNombre =
      user.NOMBRE_APELLIDOS ||
      user.CORREO_ELECTRONICO ||
      user.DNI_NIE ||
      user.CODIGO;

    return {
      success: true,
      user: {
        ...user,
        empleadoId,
        empleadoNombre,
        // aliases for frontend compatibility - folosește empleadoNombre care are fallback-uri
        ['NOMBRE / APELLIDOS']: empleadoNombre || user.NOMBRE_APELLIDOS || null,
        ['CENTRO TRABAJO']: centroTrabajo, // Add CENTRO TRABAJO for chat feature
        email: user.CORREO_ELECTRONICO ?? null,
      },
      permissions,
      avatar,
    };
  }
}
