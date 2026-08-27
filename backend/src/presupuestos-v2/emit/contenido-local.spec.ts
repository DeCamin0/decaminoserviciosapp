import {
  contenidoFingerprint,
  isContenidoPersonalizado,
  resolveContenidoEfectivo,
  cloneContenidoFromPlantilla,
} from './contenido-local.util';

describe('contenido local (5.4)', () => {
  const plantilla = {
    titulo_comercial: 'Auxiliar de Servicios y Limpieza',
    tareas_auxiliares: ['Accesos'],
    tareas_limpieza: ['Zonas comunes'],
    servicios_periodicos: [
      { nombre: 'Cristales', periodicidad: 'semestral', orden: 0 },
    ],
  };

  it('detects personalization when periodico changes', () => {
    const local = {
      ...plantilla,
      servicios_periodicos: [
        { nombre: 'Cristales', periodicidad: 'trimestral', orden: 0 },
      ],
    };
    expect(isContenidoPersonalizado(local, plantilla, 'Aux')).toBe(true);
  });

  it('same content is not personalizado', () => {
    const local = cloneContenidoFromPlantilla(plantilla, 'Aux');
    expect(isContenidoPersonalizado(local, plantilla, 'Aux')).toBe(false);
  });

  it('resolve prefers local over plantilla', () => {
    const efectivo = resolveContenidoEfectivo({
      local: {
        ...plantilla,
        servicios_periodicos: [
          { nombre: 'Cristales', periodicidad: 'trimestral' },
        ],
      },
      plantilla,
      nombre: 'Aux',
    });
    expect(efectivo.servicios_periodicos[0].periodicidad).toBe('trimestral');
  });

  it('resolve falls back to snapshot then plantilla', () => {
    const fromSnap = resolveContenidoEfectivo({
      snapshot: {
        titulo_comercial: 'Desde snapshot',
        servicios_periodicos: [{ nombre: 'Garaje', periodicidad: 'anual' }],
      },
      plantilla,
      nombre: 'Aux',
    });
    expect(fromSnap.titulo_comercial).toBe('Desde snapshot');
    expect(fromSnap.servicios_periodicos[0].nombre).toBe('Garaje');
  });

  it('fingerprint stable regardless of periodico array order', () => {
    const a = contenidoFingerprint({
      ...plantilla,
      servicios_periodicos: [
        { nombre: 'B', periodicidad: 'anual', orden: 1 },
        { nombre: 'A', periodicidad: 'anual', orden: 0 },
      ],
    });
    const b = contenidoFingerprint({
      ...plantilla,
      servicios_periodicos: [
        { nombre: 'A', periodicidad: 'anual', orden: 0 },
        { nombre: 'B', periodicidad: 'anual', orden: 1 },
      ],
    });
    expect(a).toBe(b);
  });
});
