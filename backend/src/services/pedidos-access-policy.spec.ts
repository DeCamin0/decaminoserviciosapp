import {
  canCreatePedido,
  canReadPedidosNotas,
  canWritePedidosNotas,
  pedidoInScope,
  pedidosScope,
} from './pedidos-access-policy';

const employee = {
  userId: 'E10',
  grupo: 'Operario',
  role: 'EMPLEADOS',
  isManager: false,
};

describe('pedidos access', () => {
  it('fără sesiune sau fără permisiune nu vede și nu creează comenzi', () => {
    expect(
      pedidosScope({
        actor: null,
        pedidosAdmin: true,
        pedidosEmpleados: true,
        pedidosLegacy: true,
      }),
    ).toBe('none');
    expect(
      pedidosScope({
        actor: employee,
        pedidosAdmin: false,
        pedidosEmpleados: false,
        pedidosLegacy: false,
      }),
    ).toBe('none');
    expect(canCreatePedido('none', 'E10', 'E10')).toBe(false);
    expect(canReadPedidosNotas('none')).toBe(false);
  });

  it('admin și pedidos-admin păstrează toate comenzile; managerul fără bifă nu', () => {
    expect(
      pedidosScope({
        actor: { userId: 'A1', grupo: 'Admin', role: 'ADMIN', isManager: true },
        pedidosAdmin: false,
        pedidosEmpleados: false,
        pedidosLegacy: false,
      }),
    ).toBe('all');
    expect(
      pedidosScope({
        actor: {
          userId: 'M1',
          grupo: 'Manager',
          role: 'MANAGER',
          isManager: true,
        },
        pedidosAdmin: false,
        pedidosEmpleados: false,
        pedidosLegacy: false,
      }),
    ).toBe('none');
    expect(
      pedidosScope({
        actor: {
          userId: 'S1',
          grupo: 'Supervisor',
          role: 'EMPLEADOS',
          isManager: false,
        },
        pedidosAdmin: false,
        pedidosEmpleados: false,
        pedidosLegacy: false,
      }),
    ).toBe('none');
    expect(
      pedidosScope({
        actor: employee,
        pedidosAdmin: true,
        pedidosEmpleados: false,
        pedidosLegacy: false,
      }),
    ).toBe('all');
    expect(canCreatePedido('all', 'M1', 'E99')).toBe(true);
    expect(canWritePedidosNotas('all')).toBe(true);
  });

  it('pedidos-empleados vede comenzile proprii și pe cele din centrul lui', () => {
    expect(
      pedidosScope({
        actor: employee,
        pedidosAdmin: false,
        pedidosEmpleados: true,
        pedidosLegacy: false,
      }),
    ).toBe('centro');
    expect(
      pedidosScope({
        actor: employee,
        pedidosAdmin: false,
        pedidosEmpleados: false,
        pedidosLegacy: true,
      }),
    ).toBe('centro');
    expect(
      pedidoInScope('centro', 'E10', 'Centro Norte', {
        empleadoId: 'E10',
        comunidadNombre: 'Alt centru',
      }),
    ).toBe(true);
    expect(
      pedidoInScope('centro', 'E10', 'Centro Norte', {
        empleadoId: 'E20',
        comunidadNombre: 'centro norte',
      }),
    ).toBe(true);
    expect(
      pedidoInScope('centro', 'E10', 'Centro Norte', {
        empleadoId: 'E20',
        comunidadNombre: 'Centro Sur',
      }),
    ).toBe(false);
  });

  it('la creare, utilizatorul de centru nu poate pune alt cod de angajat', () => {
    expect(canCreatePedido('centro', 'E10', 'E10')).toBe(true);
    expect(canCreatePedido('centro', 'E10', 'E20')).toBe(false);
    expect(canCreatePedido('centro', 'E10', '')).toBe(false);
    expect(canWritePedidosNotas('centro')).toBe(false);
    expect(canReadPedidosNotas('centro')).toBe(true);
  });
});
