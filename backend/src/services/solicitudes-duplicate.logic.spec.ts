import {
  exactDuplicateMessage,
  isExactSolicitudDuplicate,
  solicitudCalendarRange,
} from './solicitudes-duplicate.logic';

const felisa = {
  codigo: '10000072',
  tipo: 'Permiso Retribuido',
  estado: 'Pendiente',
};

describe('solicitud exact duplicate', () => {
  it('Felisa 17-20 y 17-23 no son la misma solicitud', () => {
    const existing = {
      ...felisa,
      id: '1794741233567',
      fecha_inicio: '2026-11-17',
      fecha_fin: '2026-11-20',
    };
    const incoming = {
      ...felisa,
      fecha_inicio: '2026-11-17',
      fecha_fin: '2026-11-23',
    };
    expect(
      solicitudCalendarRange(existing.fecha_inicio, existing.fecha_fin)?.dias,
    ).toBe(4);
    expect(
      solicitudCalendarRange(incoming.fecha_inicio, incoming.fecha_fin)?.dias,
    ).toBe(7);
    expect(isExactSolicitudDuplicate(existing, incoming)).toBe(false);
  });

  it('el mismo intervalo y el mismo número de días es duplicado', () => {
    const existing = {
      ...felisa,
      id: '1794741233567',
      fecha_inicio: new Date('2026-11-16T23:00:00.000Z'),
      fecha_fin: '2026-11-20',
    };
    const incoming = {
      ...felisa,
      fecha_inicio: '2026-11-17',
      fecha_fin: '2026-11-20',
    };
    expect(isExactSolicitudDuplicate(existing, incoming)).toBe(true);
    expect(
      exactDuplicateMessage(
        'Permiso Retribuido',
        '2026-11-17',
        '2026-11-20',
        4,
      ),
    ).toBe(
      'Ya existe una solicitud de Permiso Retribuido con las mismas fechas (17/11/2026 - 20/11/2026, 4 días). No se puede registrar otra igual.',
    );
  });

  it('Ausencias justificada y Ausencia Justificada son la misma solicitud en el mismo día', () => {
    const existing = {
      codigo: '10000072',
      tipo: 'Ausencia Justificada',
      estado: 'Aprobada',
      id: '1',
      fecha_inicio: '2026-11-17',
      fecha_fin: '2026-11-17',
    };
    const incoming = {
      codigo: '10000072',
      tipo: 'Ausencias justificada',
      fecha_inicio: '2026-11-17',
      fecha_fin: '2026-11-17',
    };
    expect(isExactSolicitudDuplicate(existing, incoming)).toBe(true);
    expect(
      isExactSolicitudDuplicate(existing, {
        ...incoming,
        fecha_inicio: '2026-11-18',
        fecha_fin: '2026-11-18',
      }),
    ).toBe(false);
  });

  it('una rechazada o la propia solicitud no bloquean', () => {
    const incoming = {
      ...felisa,
      id: '1794409843907',
      fecha_inicio: '2026-11-17',
      fecha_fin: '2026-11-23',
    };
    expect(
      isExactSolicitudDuplicate(
        { ...incoming, estado: 'Rechazada' },
        { ...incoming, id: undefined },
      ),
    ).toBe(false);
    expect(isExactSolicitudDuplicate(incoming, incoming)).toBe(false);
  });
});
