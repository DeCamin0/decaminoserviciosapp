import { AssistantDataScope } from '../constants/assistant-data-scope.const';
import { RbacService } from './rbac.service';

describe('RbacService / AssistantDataScope (assistant global)', () => {
  let svc: RbacService;

  beforeEach(() => {
    svc = new RbacService();
  });

  const allRoles = [
    'admin',
    'ADMIN',
    'developer',
    'supervisor',
    'manager',
    'jefe',
  ];

  it.each(allRoles)('resolveDataScope(%s) → ALL', (rol) => {
    expect(svc.resolveDataScope(rol)).toBe(AssistantDataScope.ALL);
  });

  it('resolveDataScope(empleado) → OWN', () => {
    expect(svc.resolveDataScope('empleado')).toBe(AssistantDataScope.OWN);
  });

  it('resolveDataScope(null) → OWN (fail-closed)', () => {
    expect(svc.resolveDataScope(null)).toBe(AssistantDataScope.OWN);
  });

  it('buildRbacCondition: ALL → 1=1', () => {
    expect(svc.buildRbacCondition('100', 'admin', 'CODIGO')).toBe('1=1');
  });

  it('buildRbacCondition: OWN → coloană = userId', () => {
    expect(svc.buildRbacCondition('10000001', 'empleado', 's.codigo')).toBe(
      `s.codigo = '10000001'`,
    );
  });

  it('buildRbacCondition: empleado + explicit ALL ignorat (scope efectiv mereu OWN)', () => {
    expect(
      svc.buildRbacCondition('x', 'empleado', 'CODIGO', AssistantDataScope.ALL),
    ).toBe(`CODIGO = 'x'`);
  });

  it('effectiveDataScope folosește override când e setat', () => {
    expect(svc.effectiveDataScope('admin', AssistantDataScope.OWN)).toBe(
      AssistantDataScope.OWN,
    );
  });

  it('ADMIN: aceleași întrebări → SQL fără restricție pe codigo (smoke)', () => {
    const cond = svc.buildRbacCondition('100', 'admin', 'CODIGO');
    expect(cond).toBe('1=1');
  });

  it('EMPLOYEE: aceleași întrebări → SQL restricționat la propriul cod', () => {
    const cond = svc.buildRbacCondition('10000072', 'empleado', 'empleado_id');
    expect(cond).toBe(`empleado_id = '10000072'`);
  });
});
