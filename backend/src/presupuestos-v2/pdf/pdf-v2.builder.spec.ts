import {
  buildPresupuestoV2Pdf,
  groupOpcionesForPdfPresentation,
} from './pdf-v2.builder';
import { computeDocumentTotales, normalizeTotales } from '../emit/totales.util';

const t = (m: number) =>
  normalizeTotales({
    mensualidad_sin_iva: m,
    mensualidad_con_iva: m * 1.21,
    anualidad_sin_iva: m * 12,
    anualidad_con_iva: m * 12 * 1.21,
  });

const op = (etiqueta: string, tipo: string, m: number) => ({
  etiqueta,
  seleccion_tipo: tipo,
  totales: t(m),
  resultado: { totales: t(m) },
});

describe('groupOpcionesForPdfPresentation', () => {
  it('2 alternativas → solo Elija una opción', () => {
    const sections = groupOpcionesForPdfPresentation([
      op('6h', 'EXCLUSIVE', 1500),
      op('8h', 'EXCLUSIVE', 1900),
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe('Elija una opción');
    expect(sections[0].opciones).toHaveLength(2);
    expect(sections[0].pricePrefix).toBe('');
  });

  it('1 alternativa + 2 extras → dos secciones', () => {
    const sections = groupOpcionesForPdfPresentation([
      op('4h', 'EXCLUSIVE', 100),
      op('Cristales', 'ACUMULABLE', 20),
      op('Garaje', 'ACUMULABLE', 15),
    ]);
    expect(sections.map((s) => s.heading)).toEqual([
      'Elija una opción',
      'Extras opcionales',
    ]);
    expect(sections[0].opciones).toHaveLength(1);
    expect(sections[1].opciones).toHaveLength(2);
    expect(sections[1].pricePrefix).toBe('+');
  });

  it('2 alternativas + 3 extras → dos secciones', () => {
    const sections = groupOpcionesForPdfPresentation([
      op('A', 'EXCLUSIVE', 100),
      op('B', 'EXCLUSIVE', 120),
      op('E1', 'ACUMULABLE', 10),
      op('E2', 'ACUMULABLE', 20),
      op('E3', 'ACUMULABLE', 30),
    ]);
    expect(sections).toHaveLength(2);
    expect(sections[0].heading).toBe('Elija una opción');
    expect(sections[0].opciones).toHaveLength(2);
    expect(sections[1].heading).toBe('Extras opcionales');
    expect(sections[1].opciones).toHaveLength(3);
  });

  it('una sola opción → sin heading comercial', () => {
    const sections = groupOpcionesForPdfPresentation([
      op('Única', 'ACUMULABLE', 80),
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBeNull();
    expect(sections[0].showLabels).toBe(false);
  });

  it('todas extras → solo Extras opcionales', () => {
    const sections = groupOpcionesForPdfPresentation([
      op('Temporada', 'ACUMULABLE', 50),
      op('Invernal', 'ACUMULABLE', 20),
      op('Recuperación', 'ACUMULABLE', 15),
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe('Extras opcionales');
    expect(sections[0].pricePrefix).toBe('+');
  });

  it('headings never use EXCLUSIVE/ACUMULABLE jargon', () => {
    const sections = groupOpcionesForPdfPresentation([
      op('A', 'EXCLUSIVE', 1),
      op('X', 'ACUMULABLE', 2),
    ]);
    const joined = sections.map((s) => s.heading || '').join(' ');
    expect(joined).not.toMatch(/EXCLUSIVE|ACUMULABLE/i);
  });
});

describe('totales with presentation cases (unchanged algorithm)', () => {
  it('2 alternativas: ambiguo, total 0 from exclusives', () => {
    const doc = computeDocumentTotales([
      {
        nombre: 'C',
        opciones: [op('A', 'EXCLUSIVE', 100), op('B', 'EXCLUSIVE', 120)],
      },
    ]);
    expect(doc.ambiguo).toBe(true);
    expect(doc.totales.mensualidad_sin_iva).toBe(0);
  });

  it('1 alternativa + 2 extras: suma todos (exclusive única + extras)', () => {
    const doc = computeDocumentTotales([
      {
        nombre: 'L',
        opciones: [
          op('4h', 'EXCLUSIVE', 100),
          op('C', 'ACUMULABLE', 20),
          op('G', 'ACUMULABLE', 15),
        ],
      },
    ]);
    expect(doc.ambiguo).toBe(false);
    expect(doc.totales.mensualidad_sin_iva).toBe(135);
  });

  it('2 alternativas + 3 extras: solo extras en total neambiguu', () => {
    const doc = computeDocumentTotales([
      {
        nombre: 'S',
        opciones: [
          op('A', 'EXCLUSIVE', 100),
          op('B', 'EXCLUSIVE', 120),
          op('E1', 'ACUMULABLE', 10),
          op('E2', 'ACUMULABLE', 20),
          op('E3', 'ACUMULABLE', 30),
        ],
      },
    ]);
    expect(doc.ambiguo).toBe(true);
    expect(doc.totales.mensualidad_sin_iva).toBe(60);
  });
});

describe('Presupuestos V2 PDF builder smoke', () => {
  it('builds mixed alternativas+extras PDF', async () => {
    const buf = await buildPresupuestoV2Pdf({
      mode: 'EMITIDO',
      numero: 'MAD-2026-0001',
      emittedAt: '2026-08-13T12:00:00.000Z',
      company: { legal_name: 'Test Company SL', cif: 'B000' },
      brand: { nombre: 'Test Brand', config: { brandColor: '#B91C1C' } },
      cliente: { nombre: 'Cliente Demo' },
      lineas: [
        {
          nombre: 'Conserjería',
          opciones: [
            op('6 horas', 'EXCLUSIVE', 1500),
            op('8 horas', 'EXCLUSIVE', 1900),
            op('Control fines de semana', 'ACUMULABLE', 250),
          ],
        },
      ],
      totales: t(250),
      totalesAmbiguo: true,
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('builds BORRADOR PDF', async () => {
    const buf = await buildPresupuestoV2Pdf({
      mode: 'BORRADOR',
      numero: null,
      emittedAt: null,
      company: { legal_name: 'Co' },
      brand: { nombre: 'Brand' },
      cliente: null,
      lineas: [],
      totales: t(0),
    });
    expect(buf.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('Guadalajara-like combined service PDF with full operativa', async () => {
    const buf = await buildPresupuestoV2Pdf({
      mode: 'BORRADOR',
      numero: null,
      emittedAt: null,
      validezDias: 60,
      company: { legal_name: 'De Camino Servicios Auxiliares S.L.', cif: 'B123' },
      brand: {
        nombre: 'De Camino',
        config: {
          brandColor: '#B91C1C',
          presentacion: [
            'Estimado/a Sr./Sra.:',
            'Propuesta de servicios para su comunidad.',
          ],
          garantia_intro:
            'garantiza el cumplimiento de las siguientes obligaciones.',
          garantia_bloques: [
            {
              titulo: 'Responsabilidad Civil',
              texto: 'Seguro de RC en 600.000 €.',
            },
          ],
          condiciones_intro: 'Acuerdo vinculante entre las partes.',
          condiciones_secciones: [
            {
              titulo: '1. Inicio y duración',
              parrafos: ['Duración inicial 12 meses.'],
            },
          ],
        },
      },
      cliente: {
        nombre: 'CP Avenida de Guadalajara 34',
        direccion: 'Av. de Guadalajara 34',
      },
      lineas: [
        {
          nombre: 'Auxiliar de Servicios y Limpieza',
          contenido_comercial: {
            titulo_comercial: 'Auxiliar de Servicios y Limpieza',
            template_key: 'auxiliar_limpieza',
            tareas_auxiliares: [
              'Control de accesos y supervisión de personas ajenas a la finca.',
              'Supervisión y seguimiento de trabajos realizados por proveedores.',
              'Atención y asistencia a residentes que requieran su presencia.',
              'Realización de rondas preventivas en diferentes horarios.',
              'Comunicación inmediata de desperfectos o averías a la administración.',
              'Aviso a servicios técnicos o de emergencia cuando sea necesario.',
              'Apoyo en situaciones de molestias o incidencias vecinales.',
              'Supervisión básica de instalaciones comunes.',
              'Sustitución de bombillas y luminarias (material a cargo de la comunidad).',
              'Revisión y limpieza básica de rejillas de desagüe obstruidas.',
              'Conocimiento de la ubicación de llaves de corte de agua, luz y gas.',
              'Información periódica a la Junta de Gobierno.',
            ],
            tareas_limpieza: [
              'Frecuencia diaria: Barrido y fregado de suelos',
              'Frecuencia diaria: Limpieza de escaleras interiores',
              'Frecuencia diaria: Limpieza de ascensor',
              'Frecuencia alterna: Limpieza de puerta de acceso',
              'Frecuencia alterna: Desempolvado de puntos de luz',
            ],
            servicios_periodicos: [
              { nombre: 'Cristales', periodicidad: 'trimestral' },
              { nombre: 'Abrillantado', periodicidad: 'anual' },
              { nombre: 'Limpieza de garaje', periodicidad: 'anual' },
            ],
          },
          opciones: [
            {
              etiqueta: '39h/semana',
              seleccion_tipo: 'EXCLUSIVE',
              jornada: {
                horas_semana: 39,
                festivos_incluidos: false,
                tramos: [
                  {
                    dias_label: 'Lunes a jueves',
                    hora_inicio: '08:00',
                    hora_fin: '16:00',
                  },
                  {
                    dias_label: 'Viernes',
                    hora_inicio: '08:00',
                    hora_fin: '15:00',
                  },
                ],
              },
              totales: t(2800),
              resultado: { totales: t(2800) },
            },
            {
              etiqueta: '30h/semana',
              seleccion_tipo: 'EXCLUSIVE',
              jornada: { horas_semana: 30, festivos_incluidos: false, tramos: [] },
              totales: t(2200),
              resultado: { totales: t(2200) },
            },
          ],
        },
      ],
      serviciosDigitales: [
        {
          nombre: 'Vecindario',
          precio_referencia_mensual: 25,
          descuento_pct: 100,
          precio_final_mensual: 0,
          incluido: true,
          activo: true,
        },
      ],
      totales: t(2800),
      totalesAmbiguo: true,
    });
    expect(buf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(4000);
  });

  it('shows Pendiente de cálculo when option has no resultado', async () => {
    const buf = await buildPresupuestoV2Pdf({
      mode: 'BORRADOR',
      numero: null,
      emittedAt: null,
      company: { legal_name: 'Co' },
      brand: { nombre: 'Brand', config: {} },
      cliente: { nombre: 'C' },
      lineas: [
        {
          nombre: 'Limpieza',
          opciones: [
            {
              etiqueta: 'Opción 1',
              seleccion_tipo: 'ACUMULABLE',
              // no totales / resultado
            },
          ],
        },
      ],
      totales: t(0),
    });
    expect(buf.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });
});
