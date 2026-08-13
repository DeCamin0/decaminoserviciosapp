import {
  computeDocumentTotales,
  deepCloneJson,
  extractSavedTotalesFromLineas,
  normalizeTotales,
  sumLineTotales,
  sumSelectedOpcionTotales,
  totalesDiffer,
} from './totales.util';

describe('V2 opciones — totales EXCLUSIVE vs ACUMULABLE', () => {
  const t = (m: number) =>
    normalizeTotales({
      mensualidad_sin_iva: m,
      mensualidad_con_iva: m * 1.21,
      anualidad_sin_iva: m * 12,
      anualidad_con_iva: m * 12 * 1.21,
    });

  it('1) single option behaves like legacy sum', () => {
    const doc = computeDocumentTotales([
      {
        nombre: 'Auxiliares',
        opciones: [
          {
            id: 1,
            etiqueta: 'Opción 1',
            seleccion_tipo: 'ACUMULABLE',
            resultado: { totales: t(100) },
          },
        ],
      },
    ]);
    expect(doc.ambiguo).toBe(false);
    expect(doc.totales.mensualidad_sin_iva).toBe(100);
    expect(sumLineTotales([{ resultado: { totales: t(100) } }])).toEqual(
      doc.totales,
    );
  });

  it('2) two EXCLUSIVE options are not summed', () => {
    const doc = computeDocumentTotales([
      {
        nombre: 'Auxiliares',
        opciones: [
          {
            id: 1,
            etiqueta: '6h',
            seleccion_tipo: 'EXCLUSIVE',
            resultado: { totales: t(100) },
          },
          {
            id: 2,
            etiqueta: '8h',
            seleccion_tipo: 'EXCLUSIVE',
            resultado: { totales: t(130) },
          },
        ],
      },
    ]);
    expect(doc.ambiguo).toBe(true);
    expect(doc.totales.mensualidad_sin_iva).toBe(0);
    expect(doc.alternativas[0].opciones).toHaveLength(2);
  });

  it('3) ACUMULABLE options are summed', () => {
    const doc = computeDocumentTotales([
      {
        nombre: 'Piscina',
        opciones: [
          {
            id: 1,
            etiqueta: 'Base',
            seleccion_tipo: 'ACUMULABLE',
            resultado: { totales: t(50) },
          },
          {
            id: 2,
            etiqueta: 'Invernal',
            seleccion_tipo: 'ACUMULABLE',
            resultado: { totales: t(20) },
          },
        ],
      },
    ]);
    expect(doc.ambiguo).toBe(false);
    expect(doc.totales.mensualidad_sin_iva).toBe(70);
  });

  it('4) two servicios with variants — exclusives not cross-summed wrongly', () => {
    const doc = computeDocumentTotales([
      {
        nombre: 'Auxiliares',
        opciones: [
          {
            id: 1,
            etiqueta: 'A',
            seleccion_tipo: 'EXCLUSIVE',
            resultado: { totales: t(100) },
          },
          {
            id: 2,
            etiqueta: 'B',
            seleccion_tipo: 'EXCLUSIVE',
            resultado: { totales: t(120) },
          },
        ],
      },
      {
        nombre: 'Limpieza',
        opciones: [
          {
            id: 3,
            etiqueta: 'Única',
            seleccion_tipo: 'ACUMULABLE',
            resultado: { totales: t(80) },
          },
        ],
      },
    ]);
    expect(doc.ambiguo).toBe(true);
    // Only limpieza counts toward unambiguous total
    expect(doc.totales.mensualidad_sin_iva).toBe(80);
  });

  it('5) independent option totals preserved in extractSaved', () => {
    const saved = extractSavedTotalesFromLineas([
      {
        nombre: 'X',
        opciones: [
          {
            id: 1,
            seleccion_tipo: 'ACUMULABLE',
            resultado_json: { totales: t(10) },
          },
          {
            id: 2,
            seleccion_tipo: 'ACUMULABLE',
            resultado_json: { totales: t(15) },
          },
        ],
      },
    ]);
    expect(saved.mensualidad_sin_iva).toBe(25);
  });

  it('6) future acceptance: sumSelectedOpcionTotales', () => {
    const servicios = [
      {
        opciones: [
          { id: 1, seleccion_tipo: 'EXCLUSIVE', resultado: { totales: t(100) } },
          { id: 2, seleccion_tipo: 'EXCLUSIVE', resultado: { totales: t(130) } },
          { id: 3, seleccion_tipo: 'ACUMULABLE', resultado: { totales: t(10) } },
        ],
      },
    ];
    const accepted = sumSelectedOpcionTotales(servicios, [2, 3]);
    expect(accepted.mensualidad_sin_iva).toBe(140);
  });

  it('7) deepCloneJson is independent (no shallow nested share)', () => {
    const src = { a: { b: 1 }, arr: [{ x: 2 }] };
    const clone = deepCloneJson(src);
    clone.a.b = 99;
    clone.arr[0].x = 88;
    expect(src.a.b).toBe(1);
    expect(src.arr[0].x).toBe(2);
  });

  it('legacy line without opciones still sums', () => {
    const doc = computeDocumentTotales([
      {
        nombre: 'Old',
        resultado_json: { totales: t(40) },
      },
    ]);
    expect(doc.totales.mensualidad_sin_iva).toBe(40);
    expect(doc.ambiguo).toBe(false);
  });

  it('totalesDiffer still works', () => {
    expect(totalesDiffer(t(100), t(110))).toBe(true);
    expect(totalesDiffer(t(100), t(100))).toBe(false);
  });
});
