import { readFileSync } from 'fs';
import { join } from 'path';
import { UnauthorizedException } from '@nestjs/common';
import {
  empleadosListQueryMode,
  loadEmpleadosForUser,
} from './empleados-list-access';

const scopeFilter = { grupos: ['Limpieza'], includeSelfCodigo: 'C1' };

function deps(scopeResult: unknown) {
  const getAllEmpleados = jest.fn().mockResolvedValue([{ CODIGO: 'ok' }]);
  return {
    getAllEmpleados,
    api: {
      resolveScopeFilter: jest.fn().mockResolvedValue(scopeResult),
      getAllEmpleados,
    },
  };
}

describe('GET /api/empleados list access', () => {
  const controllerSource = readFileSync(
    join(__dirname, '../controllers/empleados.controller.ts'),
    'utf8',
  );

  it('ruta GET listă cere JwtAuthGuard și nu mai acceptă apelul fără token', () => {
    expect(controllerSource).toMatch(
      /@Get\(\)\s+@UseGuards\(JwtAuthGuard\)\s+async getAll/,
    );
    expect(controllerSource).not.toContain('resolveScopeFilterFromAuthHeader');
    expect(controllerSource).toContain('loadEmpleadosForUser');
  });

  it('angajatul obișnuit, fără scope, primește doar propriul CODIGO', async () => {
    const { api, getAllEmpleados } = deps(null);
    await loadEmpleadosForUser(
      { userId: 'E10', role: 'EMPLEADOS', grupo: 'Operario', isManager: false },
      api,
    );
    expect(getAllEmpleados).toHaveBeenCalledWith(null, 'E10');
  });

  it('managerul fără bifa empleados primește doar propriul CODIGO, chiar dacă isManager', async () => {
    const { api, getAllEmpleados } = deps(null);
    await loadEmpleadosForUser(
      { userId: 'M1', role: 'MANAGER', grupo: 'Manager', isManager: true },
      api,
    );
    expect(getAllEmpleados).toHaveBeenCalledWith(null, 'M1');
  });

  it('administratorul și developerul primesc lista completă', async () => {
    const admin = deps(null);
    await loadEmpleadosForUser(
      { userId: 'A1', role: 'ADMIN', grupo: 'Admin', isManager: true },
      admin.api,
    );
    expect(admin.getAllEmpleados).toHaveBeenCalledWith(null);

    const developer = deps(null);
    await loadEmpleadosForUser(
      {
        userId: 'D1',
        role: 'DEVELOPER',
        grupo: 'Developer',
        isManager: true,
      },
      developer.api,
    );
    expect(developer.getAllEmpleados).toHaveBeenCalledWith(null);
  });

  it('supervisor, RRHH și Jefe fără bifă rămân pe propriul cod', async () => {
    for (const grupo of ['Supervisor', 'RRHH', 'Jefe']) {
      const { api, getAllEmpleados } = deps(null);
      await loadEmpleadosForUser(
        { userId: 'S1', role: 'EMPLEADOS', grupo, isManager: false },
        api,
      );
      expect(getAllEmpleados).toHaveBeenCalledWith(null, 'S1');
    }
  });

  it('managerul cu bifa empleados și scope rămâne filtrat', async () => {
    const { api, getAllEmpleados } = deps(scopeFilter);
    await loadEmpleadosForUser(
      { userId: 'C1', role: 'MANAGER', grupo: 'Manager', isManager: true },
      api,
      {
        empleados: true,
        ficharAdmin: false,
        ficharEmpleados: false,
        aprobaciones: false,
        admin: false,
      },
    );
    expect(getAllEmpleados).toHaveBeenCalledWith(scopeFilter);
  });

  it('fără userId nu interoghează lista', async () => {
    const { api, getAllEmpleados } = deps(null);
    await expect(loadEmpleadosForUser({}, api)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(getAllEmpleados).not.toHaveBeenCalled();
  });
});

describe('getAllEmpleados query mode', () => {
  it('onlyCodigo nu cade pe lista completă', () => {
    expect(empleadosListQueryMode(null, 'E9')).toBe('self');
    expect(
      empleadosListQueryMode({ grupos: [], includeSelfCodigo: 'E9' }, 'E9'),
    ).toBe('self');
  });

  it('fără onlyCodigo și fără grupuri păstrează lista completă pentru personalul de conducere', () => {
    expect(empleadosListQueryMode(null, null)).toBe('all');
    expect(
      empleadosListQueryMode({ grupos: [], includeSelfCodigo: 'M1' }, '  '),
    ).toBe('all');
  });

  it('scope-ul pe grup rămâne filtrat', () => {
    expect(empleadosListQueryMode(scopeFilter, null)).toBe('scope');
  });
});
