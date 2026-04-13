import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Filtro para listar/gestionar solo empleados con estos GRUPO (más el propio user_codigo). */
export type EmpleadoGrupoScopeFilter = {
  grupos: string[];
  includeSelfCodigo: string;
};

export type JwtUserLike = {
  userId?: string;
  grupo?: string;
  role?: string;
};

@Injectable()
export class EmpleadoGrupoScopeService {
  private readonly logger = new Logger(EmpleadoGrupoScopeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Admin / Developer: sin restricción por ámbito. */
  bypassesScope(payload: JwtUserLike | undefined | null): boolean {
    if (!payload) return false;
    const g = (payload.grupo || '').trim();
    const r = (payload.role || '').trim().toUpperCase();
    return (
      r === 'ADMIN' || r === 'DEVELOPER' || g === 'Admin' || g === 'Developer'
    );
  }

  canManageScopesInAdmin(payload: JwtUserLike | undefined | null): boolean {
    return this.bypassesScope(payload);
  }

  assertCanManageScopesInAdmin(payload: JwtUserLike | undefined | null): void {
    if (!this.canManageScopesInAdmin(payload)) {
      throw new ForbiddenException(
        'Solo Admin o Developer pueden gestionar el ámbito de empleados.',
      );
    }
  }

  async listGruposForUserCodigo(userCodigo: string): Promise<string[]> {
    const rows = await this.prisma.userEmpleadoGrupoScope.findMany({
      where: { user_codigo: userCodigo },
      select: { grupo: true },
      orderBy: { grupo: 'asc' },
    });
    return rows.map((r) => String(r.grupo || '').trim()).filter(Boolean);
  }

  /**
   * null = mismo comportamiento que antes (lista completa).
   */
  async resolveScopeFilter(
    payload: JwtUserLike | undefined | null,
  ): Promise<EmpleadoGrupoScopeFilter | null> {
    const userId = (payload?.userId || '').trim();
    if (!userId) return null;
    if (this.bypassesScope(payload)) return null;
    const grupos = await this.listGruposForUserCodigo(userId);
    if (grupos.length === 0) return null;
    return { grupos, includeSelfCodigo: userId };
  }

  /** Coordinador con ámbito definido: operaciones masivas de toda la empresa no permitidas. */
  async assertNotMassExportRestricted(
    payload: JwtUserLike | undefined | null,
  ): Promise<void> {
    const f = await this.resolveScopeFilter(payload);
    if (f) {
      throw new ForbiddenException(
        'Esta acción no está disponible con ámbito de empleados restringido.',
      );
    }
  }

  grupoMatches(
    grupoEmpleado: string | null | undefined,
    allowed: string[],
  ): boolean {
    const t = (grupoEmpleado || '').trim();
    if (!t) return false;
    return allowed.some((a) => (a || '').trim() === t);
  }

  /**
   * CODIGOs permitidos para fichajes / horas (mismo criterio que lista empleados con ámbito).
   * null = sin restricción.
   */
  async listAllowedCodigosForPayload(
    payload: JwtUserLike | undefined | null,
  ): Promise<string[] | null> {
    const f = await this.resolveScopeFilter(payload);
    if (!f) return null;
    const inList = Prisma.join(f.grupos.map((g) => Prisma.sql`${g}`));
    const rows = await this.prisma.$queryRaw<{ CODIGO: string | null }[]>`
      SELECT CAST(CODIGO AS CHAR) AS CODIGO FROM DatosEmpleados
      WHERE (TRIM(\`GRUPO\`) IN (${inList}) OR CODIGO = ${f.includeSelfCodigo})
    `;
    return [
      ...new Set(
        rows
          .map((r) => String(r.CODIGO ?? '').trim())
          .filter((c) => c.length > 0),
      ),
    ];
  }

  /** null = sin restricción; si hay filas en user_empleado_grupo_scope, solo esos GRUPO. */
  async listGruposRestrictivosForPayload(
    payload: JwtUserLike | undefined | null,
  ): Promise<string[] | null> {
    if (this.bypassesScope(payload)) return null;
    const userId = (payload?.userId || '').trim();
    if (!userId) return null;
    const grupos = await this.listGruposForUserCodigo(userId);
    if (grupos.length === 0) return null;
    return grupos;
  }

  assertCodigoEnAmbito(allowedCodigos: string[] | null, codigo: string): void {
    if (!allowedCodigos) return;
    const c = String(codigo || '').trim();
    if (!c) {
      throw new ForbiddenException('CODIGO is required');
    }
    const set = new Set(allowedCodigos.map((x) => String(x).trim()));
    if (!set.has(c)) {
      throw new ForbiddenException('No puede gestionar este empleado.');
    }
  }

  assertGrupoEnAmbito(allowedGrupos: string[] | null, grupo: string): void {
    if (!allowedGrupos) return;
    const g = String(grupo || '').trim();
    if (!g) {
      throw new ForbiddenException('grupo is required');
    }
    if (!this.grupoMatches(g, allowedGrupos)) {
      throw new ForbiddenException('No puede gestionar este grupo.');
    }
  }

  assertEmpleadoAccessible(
    scope: EmpleadoGrupoScopeFilter | null,
    targetCodigo: string,
    targetGrupo: string | null | undefined,
  ): void {
    if (!scope) return;
    const codigo = (targetCodigo || '').trim();
    if (codigo === scope.includeSelfCodigo) return;
    if (this.grupoMatches(targetGrupo, scope.grupos)) return;
    this.logger.warn(
      `Ámbito: denegado acceso a empleado ${codigo} (GRUPO=${targetGrupo})`,
    );
    throw new ForbiddenException('No puede gestionar este empleado.');
  }

  async replaceScopesForUser(
    userCodigo: string,
    grupos: string[],
  ): Promise<string[]> {
    const normalized = [
      ...new Set(
        grupos.map((g) => String(g || '').trim()).filter((g) => g.length > 0),
      ),
    ];

    await this.prisma.$transaction(async (tx) => {
      await tx.userEmpleadoGrupoScope.deleteMany({
        where: { user_codigo: userCodigo },
      });
      if (normalized.length > 0) {
        await tx.userEmpleadoGrupoScope.createMany({
          data: normalized.map((grupo) => ({
            user_codigo: userCodigo,
            grupo,
          })),
        });
      }
    });

    return normalized;
  }
}
