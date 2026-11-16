import type {
  EmpleadoGrupoScopeFilter,
  JwtUserLike,
} from './empleado-grupo-scope.service';
import {
  employeeDirectoryProjection,
  emptyEmpleadoModuleFlags,
  projectEmpleadoList,
  resolveDirectoryListAccess,
  type EmpleadoModuleFlags,
} from './empleados-operation-access';

export type EmpleadosListUser = JwtUserLike & { isManager?: boolean };

export type EmpleadosListAccess =
  | { kind: 'all' }
  | { kind: 'scope'; scope: EmpleadoGrupoScopeFilter }
  | { kind: 'self'; codigo: string };

/**
 * Lista fără bife explicite. Admin/Developer rămân pe toată firma.
 * Celelalte grupuri rămân pe propriul cod până primesc o bifă.
 */
export function resolveEmpleadosListAccess(
  user: EmpleadosListUser | null | undefined,
  scope: EmpleadoGrupoScopeFilter | null,
): EmpleadosListAccess {
  return resolveDirectoryListAccess(user, scope, emptyEmpleadoModuleFlags());
}

export type EmpleadosListQueryMode = 'self' | 'scope' | 'all';

/** onlyCodigo are prioritate: lista goală de grupuri nu mai înseamnă toți angajații. */
export function empleadosListQueryMode(
  scope: EmpleadoGrupoScopeFilter | null | undefined,
  onlyCodigo?: string | null,
): EmpleadosListQueryMode {
  if ((onlyCodigo || '').trim()) return 'self';
  if (scope?.grupos?.length) return 'scope';
  return 'all';
}

export async function loadEmpleadosForUser(
  user: EmpleadosListUser | null | undefined,
  deps: {
    resolveScopeFilter: (
      payload: EmpleadosListUser,
    ) => Promise<EmpleadoGrupoScopeFilter | null>;
    getAllEmpleados: (
      scope?: EmpleadoGrupoScopeFilter | null,
      onlyCodigo?: string | null,
    ) => Promise<unknown>;
  },
  flags?: EmpleadoModuleFlags,
) {
  const payload: EmpleadosListUser = {
    userId: user?.userId,
    role: user?.role,
    grupo: user?.grupo,
    isManager: user?.isManager,
  };
  const scope = await deps.resolveScopeFilter(payload);
  const effectiveFlags = flags ?? emptyEmpleadoModuleFlags();
  const access = resolveDirectoryListAccess(payload, scope, effectiveFlags);
  let rows: unknown;
  if (access.kind === 'all') {
    rows = await deps.getAllEmpleados(null);
  } else if (access.kind === 'scope') {
    rows = await deps.getAllEmpleados(access.scope);
  } else {
    rows = await deps.getAllEmpleados(null, access.codigo);
  }
  if (access.kind === 'self') return rows;
  return projectEmpleadoList(
    rows,
    employeeDirectoryProjection(payload, effectiveFlags),
  );
}
