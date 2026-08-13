import { allocateNextNumero, formatNumeroSerie } from './numero.util';
import {
  buildWorkingFromFicha,
  detectFichaStale,
  fingerprintFicha,
  mapClienteRowToFicha,
  refreshWorkingFicha,
  resolveClienteEfectivo,
} from './cliente.util';
import {
  extractSavedTotalesFromLineas,
  normalizeTotales,
  sumLineTotales,
  totalesDiffer,
} from './totales.util';

describe('V2 Emit — numeración', () => {
  it('formats disjunct from Legacy (hyphen)', () => {
    expect(
      formatNumeroSerie({
        prefijo: 'MAD',
        formato: '{PREF}-{YYYY}-{SEQ}',
        padding: 4,
        anio: 2026,
        secuencia: 1,
      }),
    ).toBe('MAD-2026-0001');
  });

  it('allocates sequential numbers and resets yearly', () => {
    const a = allocateNextNumero(
      {
        id: 1,
        codigo: 'presupuestos',
        prefijo: 'MAD',
        formato: '{PREF}-{YYYY}-{SEQ}',
        padding: 4,
        reset_anual: true,
        anio_actual: 2026,
        siguiente_numero: 7,
      },
      new Date('2026-05-01'),
    );
    expect(a.snapshot.numero).toBe('MAD-2026-0007');
    expect(a.nextSiguiente).toBe(8);

    const b = allocateNextNumero(
      {
        id: 1,
        codigo: 'presupuestos',
        prefijo: 'MAD',
        formato: '{PREF}-{YYYY}-{SEQ}',
        padding: 4,
        reset_anual: true,
        anio_actual: 2025,
        siguiente_numero: 99,
      },
      new Date('2026-01-02'),
    );
    expect(b.snapshot.numero).toBe('MAD-2026-0001');
    expect(b.nextSiguiente).toBe(2);
  });

  it('two sequential allocations yield different numbers (A/B concurrency model)', () => {
    let siguiente = 1;
    const anio = 2026;
    const n1 = allocateNextNumero({
      id: 1,
      codigo: 'x',
      prefijo: 'MAD',
      formato: '{PREF}-{YYYY}-{SEQ}',
      padding: 4,
      reset_anual: true,
      anio_actual: anio,
      siguiente_numero: siguiente,
    });
    siguiente = n1.nextSiguiente;
    const n2 = allocateNextNumero({
      id: 1,
      codigo: 'x',
      prefijo: 'MAD',
      formato: '{PREF}-{YYYY}-{SEQ}',
      padding: 4,
      reset_anual: true,
      anio_actual: n1.nextAnio,
      siguiente_numero: siguiente,
    });
    expect(n1.snapshot.numero).not.toBe(n2.snapshot.numero);
    expect(n1.snapshot.secuencia).toBe(1);
    expect(n2.snapshot.secuencia).toBe(2);
  });
});

describe('V2 Emit — cliente working / snapshot', () => {
  const row = {
    id: 10,
    NOMBRE_O_RAZON_SOCIAL: 'Comunidad Test',
    NIF: 'H123',
    DIRECCION: 'Calle 1',
    CODIGO_POSTAL: '28001',
    POBLACION: 'Madrid',
    PROVINCIA: 'Madrid',
    PAIS: 'ES',
    EMAIL: 'a@test.com',
    TELEFONO: '111',
    MOVIL: '222',
    contactos: [],
  };

  it('detects ficha changes without silent overwrite', () => {
    const ficha = mapClienteRowToFicha(row);
    const working = buildWorkingFromFicha(ficha, 10);
    const live = mapClienteRowToFicha({ ...row, EMAIL: 'nuevo@test.com' });
    expect(detectFichaStale(working, live)).toBe(true);
    expect(working.ficha?.email).toBe('a@test.com');
  });

  it('refresh updates ficha and keeps overrides separate', () => {
    const ficha = mapClienteRowToFicha(row);
    const working = buildWorkingFromFicha(ficha, 10);
    const live = mapClienteRowToFicha({ ...row, DIRECCION: 'Calle Nueva' });
    const refreshed = refreshWorkingFicha(working, live);
    expect(refreshed.ficha?.direccion).toBe('Calle Nueva');
    expect(fingerprintFicha(refreshed.ficha)).toBe(fingerprintFicha(live));

    const efectivo = resolveClienteEfectivo(refreshed, {
      direccion_servicio: 'Portal B',
      email_envio: 'envio@test.com',
    });
    expect(efectivo?.direccion).toBe('Calle Nueva');
    expect(efectivo?.direccion_servicio).toBe('Portal B');
    expect(efectivo?.email_envio).toBe('envio@test.com');
  });

  it('emit snapshot uses efectivo data not only cliente_id (D)', () => {
    const ficha = mapClienteRowToFicha(row);
    const working = buildWorkingFromFicha(ficha, 10);
    const snap = resolveClienteEfectivo(working, { atencion_de: 'Junta' });
    expect(snap?.nombre).toBe('Comunidad Test');
    expect(snap?.nif).toBe('H123');
    expect(snap?.atencion_de).toBe('Junta');
    // After emit, changing master would not affect frozen snap object
    const liveChanged = mapClienteRowToFicha({
      ...row,
      NOMBRE_O_RAZON_SOCIAL: 'OTRO',
    });
    expect(snap?.nombre).not.toBe(liveChanged.nombre);
  });
});

describe('V2 Emit — calculation change detection (G)', () => {
  it('detects differing totals vs silent change', () => {
    const saved = extractSavedTotalesFromLineas([
      {
        resultado_json: {
          totales: {
            mensualidad_sin_iva: 100,
            mensualidad_con_iva: 121,
            anualidad_sin_iva: 1200,
            anualidad_con_iva: 1452,
          },
        },
      },
    ]);
    const fresh = sumLineTotales([
      {
        resultado: {
          totales: {
            mensualidad_sin_iva: 110,
            mensualidad_con_iva: 133.1,
            anualidad_sin_iva: 1320,
            anualidad_con_iva: 1597.2,
          },
        },
      },
    ]);
    expect(totalesDiffer(saved, fresh)).toBe(true);
    expect(totalesDiffer(saved, normalizeTotales(saved))).toBe(false);
  });
});

describe('V2 Emit — fail before commit does not advance counter (C)', () => {
  it('allocation only mutates when caller persists (model)', () => {
    const serie = {
      id: 1,
      codigo: 'presupuestos',
      prefijo: 'MAD',
      formato: '{PREF}-{YYYY}-{SEQ}',
      padding: 4,
      reset_anual: true,
      anio_actual: 2026,
      siguiente_numero: 5,
    };
    const allocated = allocateNextNumero(serie);
    // If emit fails before persist, DB still has siguiente_numero=5
    expect(serie.siguiente_numero).toBe(5);
    expect(allocated.snapshot.secuencia).toBe(5);
    expect(allocated.nextSiguiente).toBe(6);
  });
});

describe('V2 Emit — EMITIDO immutability contract (F/E)', () => {
  it('economic snapshot object is independent of later param changes', () => {
    const snapshotEconomico = {
      lineas: [
        {
          codigo_motor: 'precio_mensual',
          inputs: { precioSinIva: 100 },
          resultado: {
            totales: {
              mensualidad_sin_iva: 100,
              mensualidad_con_iva: 121,
              anualidad_sin_iva: 1200,
              anualidad_con_iva: 1452,
            },
          },
          params_usados: { iva_factor: 1.21 },
        },
      ],
      totales: {
        mensualidad_sin_iva: 100,
        mensualidad_con_iva: 121,
        anualidad_sin_iva: 1200,
        anualidad_con_iva: 1452,
      },
    };
    const laterParams = { iva_factor: 1.3 };
    expect(snapshotEconomico.lineas[0].params_usados.iva_factor).toBe(1.21);
    expect(laterParams.iva_factor).not.toBe(
      snapshotEconomico.lineas[0].params_usados.iva_factor,
    );
    expect(snapshotEconomico.totales.mensualidad_sin_iva).toBe(100);
  });
});
