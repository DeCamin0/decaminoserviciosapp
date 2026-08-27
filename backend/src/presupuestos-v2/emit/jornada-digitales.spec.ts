import {
  applyJornadaToMotorInputs,
  formatJornadaLines,
  hoursBetween,
  normalizeJornada,
} from './jornada.util';
import {
  DEFAULT_VECINDARIO,
  resolveServicioDigital,
  sumDigitalesCobrables,
} from './digitales.util';
import { normalizeContenidoComercial } from '../config/config-catalog';
import { groupOpcionesForPdfPresentation } from '../pdf/pdf-v2.builder';

describe('jornada util', () => {
  it('formats Guadalajara-like jornada', () => {
    const j = normalizeJornada({
      horas_semana: 39,
      festivos_incluidos: false,
      tramos: [
        {
          dias_label: 'Lunes a jueves',
          dias: ['L', 'M', 'X', 'J'],
          hora_inicio: '08:00',
          hora_fin: '16:00',
        },
        {
          dias_label: 'Viernes',
          dias: ['V'],
          hora_inicio: '08:00',
          hora_fin: '15:00',
        },
      ],
    });
    expect(hoursBetween('08:00', '16:00')).toBe(8);
    expect(hoursBetween('08:00', '15:00')).toBe(7);
    const lines = formatJornadaLines(j!);
    expect(lines[0]).toContain('39');
    expect(lines.some((l) => /Sin festivos/i.test(l))).toBe(true);
  });

  it('syncs jornada into motor inputs', () => {
    const j = normalizeJornada({
      horas_semana: 39,
      festivos_incluidos: false,
      tramos: [
        {
          dias_label: 'Lunes a jueves',
          dias: ['L', 'M', 'X', 'J'],
          hora_inicio: '08:00',
          hora_fin: '16:00',
        },
        {
          dias_label: 'Viernes',
          dias: ['V'],
          hora_inicio: '08:00',
          hora_fin: '15:00',
        },
      ],
    });
    const inputs = applyJornadaToMotorInputs(
      { productosLimpieza: { b: 30, c: 12 } },
      j,
    );
    expect(inputs.horasACubrirPorSemana).toBe(39);
    expect(inputs.sinFestivos).toBe(true);
    expect(inputs.diasPorSemana).toBe(5);
    expect(inputs.productosLimpieza).toEqual({ b: 30, c: 12 });
  });
});

describe('digitales util', () => {
  it('Vecindario 100% = incluido, no suma', () => {
    const r = resolveServicioDigital({ ...DEFAULT_VECINDARIO });
    expect(r.incluido).toBe(true);
    expect(r.precio_final_mensual).toBe(0);
    expect(sumDigitalesCobrables([r]).mensualidad_sin_iva).toBe(0);
  });

  it('0% discount is cobrable', () => {
    const r = resolveServicioDigital({
      ...DEFAULT_VECINDARIO,
      descuento_pct: 0,
      precio_referencia_mensual: 25,
    });
    expect(r.incluido).toBe(false);
    expect(r.precio_final_mensual).toBe(25);
    expect(sumDigitalesCobrables([r]).mensualidad_sin_iva).toBe(25);
  });

  it('50% discount', () => {
    const r = resolveServicioDigital({
      ...DEFAULT_VECINDARIO,
      descuento_pct: 50,
      precio_referencia_mensual: 25,
    });
    expect(r.precio_final_mensual).toBe(12.5);
  });
});

describe('contenido combinado', () => {
  it('normalizes tareas split + periodicos', () => {
    const cc = normalizeContenidoComercial({
      titulo_comercial: 'Auxiliar de Servicios y Limpieza',
      template_key: 'auxiliar_limpieza',
      tareas_auxiliares: ['Accesos'],
      tareas_limpieza: ['Portal'],
      servicios_periodicos: [
        { nombre: 'Cristales', periodicidad: 'trimestral', orden: 0 },
        { nombre: 'Garaje', periodicidad: 'anual', orden: 1 },
      ],
    });
    expect(cc.tareas_auxiliares).toEqual(['Accesos']);
    expect(cc.tareas_limpieza).toEqual(['Portal']);
    expect(cc.servicios_periodicos).toHaveLength(2);
  });
});

describe('variantes on combined service presentation', () => {
  it('two exclusive opciones → Elija una opción', () => {
    const sections = groupOpcionesForPdfPresentation([
      {
        etiqueta: '39h',
        seleccion_tipo: 'EXCLUSIVE',
        jornada: { horas_semana: 39 },
      },
      {
        etiqueta: '30h',
        seleccion_tipo: 'EXCLUSIVE',
        jornada: { horas_semana: 30 },
      },
    ]);
    expect(sections[0].heading).toBe('Elija una opción');
    expect(sections[0].opciones).toHaveLength(2);
  });
});
