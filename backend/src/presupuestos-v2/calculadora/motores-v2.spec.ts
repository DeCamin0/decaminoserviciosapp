import { DEFAULT_CALC_PARAMS } from './tipos';
import { calculateAuxiliaresCoste } from './motores/auxiliares-coste.motor';
import { calculateLimpiezaCoste } from './motores/limpieza-coste.motor';
import { calculatePrecioMensual } from './motores/precio-mensual.motor';
import { calculatePiscina } from './motores/piscina.motor';

/**
 * Golden values reproduced from Legacy formulas in PresupuestosInformesPage.jsx
 * (calcResultadoAuxiliares / calcResultadoLimpieza / oferta precio mensual / piscina).
 */
describe('Presupuestos V2 motors vs Legacy formulas', () => {
  const P = DEFAULT_CALC_PARAMS;

  describe('auxiliares_coste', () => {
    it('matches Legacy defaults (8h×7d, convenio 1221, sin suplementos)', () => {
      const r = calculateAuxiliaresCoste(
        {
          convenioBase: 1221,
          horasDiarias: 8,
          diasPorSemana: 7,
          horasACubrirPorSemana: 168,
          aplicaNocturnidad: false,
          aplicaFinDeSemana: false,
          aplicaServiciosExtra: false,
          aplicaUniformidadAuto: true,
          aplicaGestoriaAuto: true,
          uniformidad: { b: 150, c: 2 },
          gestoria: { b: 120, c: 2 },
          productosLimpieza: { b: 30, c: 12 },
          limpiezaGajare: { b: 300, c: 0 },
          acristalado: { b: 125, c: 0 },
          cristalero: { b: 90, c: 0 },
          cubos: { b: 15, c: 0 },
          telefono: { b: 22, c: 1 },
          vigilancia: { b: 8.4, c: 1 },
          gastosFijoHoras: { b: 1.1, c: 0 },
          beneficioEmpresarial: { b: 0, c: 1 },
          extra: 0,
        },
        P,
      );

      // Manual Legacy steps
      const B4 = 8 * 7;
      const D4 = 1221 * 14;
      const D6 = (D4 / 40) * B4;
      const D8 = D6 / 12;
      const D10 = D8 / 12;
      const D18 = D6 + D8 + D10;
      const D20 = (D6 + D8 + D10) * 0.37;
      const D22 = D18 + D20;
      const numConserjes = 168 / 40;
      const numEmpleados = Math.floor(numConserjes);
      const numUniformes = numEmpleados + 1;
      const D24 = 150 * numUniformes;
      const D26 = 120 * numEmpleados;
      const D28 = 30 * 12;
      const D38 = 22 * 1 * 12;
      const D40 = 8.4 * 1 * 12;
      const D46 = D24 + D26 + D28 + D38 + D40;
      const D48 = (D22 + D46) * 0.21;
      const D50 = D22 + D46 + D48;
      const D52 = D50 / 1.21 / 12;

      expect(r.breakdown.B4).toBe(B4);
      expect(r.breakdown.D4).toBeCloseTo(D4, 8);
      expect(r.breakdown.D6).toBeCloseTo(D6, 8);
      expect(r.breakdown.D8).toBeCloseTo(D8, 8);
      expect(r.breakdown.D10).toBeCloseTo(D10, 8);
      expect(r.breakdown.D22).toBeCloseTo(D22, 8);
      expect(r.breakdown.D46).toBeCloseTo(D46, 8);
      expect(r.breakdown.D48).toBeCloseTo(D48, 8);
      expect(r.breakdown.D50).toBeCloseTo(D50, 8);
      expect(r.breakdown.D52).toBeCloseTo(D52, 8);
      expect(r.totales.mensualidad_sin_iva).toBeCloseTo(D52, 8);
      expect(r.totales.mensualidad_con_iva).toBeCloseTo(D52 * 1.21, 8);
      expect(r.totales.anualidad_sin_iva).toBeCloseTo(D52 * 12, 8);
    });
  });

  describe('limpieza_coste', () => {
    it('matches Legacy defaults including +1.98 pad', () => {
      const r = calculateLimpiezaCoste(
        {
          convenioBase: 1485,
          numOperarias: 2,
          horasPorDiaPorOperaria: 4,
          diasLaborablesSemana: 5,
          serviciosExtraHoras: 12,
          uniformidad: { b: 150, c: 2 },
          gestoria: { b: 120, c: 2 },
          productosLimpieza: { b: 150, c: 12 },
          aplicaLimpiezaGajare: true,
          limpiezaGajare: { b: 450, c: 2 },
          acristalado: { b: 250, c: 1 },
          cristalero: { b: 90, c: 0 },
          cubos: { b: 8, c: 0 },
          telefono: { b: 22, c: 0 },
          vigilancia: { b: 8.4, c: 2 },
          gastosFijoHoras: { b: 1.1 },
          beneficioEmpresarial: { b: 150, c: 1 },
          d48Manual: null,
          extra: 0,
        },
        P,
      );

      const B4 = 2 * 4 * 5;
      const D4 = 1485 * 12;
      const D6 = (D4 / 39) * B4;
      const D8 = (D6 / 12 / 30) * 31;
      const D10 = D8 / 12;
      const D12 = (D6 / 156) * 12;
      const D14 = D6 + D8 + D10 + D12;
      const D16 = (D6 + D8 + D10) * 0.35;
      const D18 = D14 + D16;
      const D20 = 150 * 2;
      const D22 = 120 * 2;
      const D24 = 150 * 12;
      const D26 = 450 * 2;
      const D28 = 250 * 1;
      const D36 = 8.4 * 2 * 12;
      const D38 = 1.1 * B4 * 4.33 * 12;
      const D40 = 150 * 1 * 12;
      const D42 = D20 + D22 + D24 + D26 + D28 + D36 + D38 + D40;
      const D44 = (D18 + D42) * 0.21;
      const D46 = D18 + D42 + D44;
      const D48 = D46 / 1.21 / 12 + 1.98;

      expect(r.breakdown.B4).toBe(B4);
      expect(r.breakdown.D18).toBeCloseTo(D18, 6);
      expect(r.breakdown.D46).toBeCloseTo(D46, 6);
      expect(r.breakdown.D48).toBeCloseTo(D48, 6);
      expect(r.totales.mensualidad_sin_iva).toBeCloseTo(D48, 6);
    });
  });

  describe('precio_mensual', () => {
    it('matches Legacy ×1.21 / ×12', () => {
      const r = calculatePrecioMensual({ precioSinIva: 100, concepto: 'Test' }, P);
      expect(r.totales.mensualidad_sin_iva).toBe(100);
      expect(r.totales.mensualidad_con_iva).toBeCloseTo(121, 8);
      expect(r.totales.anualidad_sin_iva).toBe(1200);
      expect(r.totales.anualidad_con_iva).toBeCloseTo(1452, 8);
    });
  });

  describe('piscina', () => {
    it('treats temporada as monthly base like Legacy oferta', () => {
      const r = calculatePiscina(
        {
          precioSinIva: 500,
          extra: 50,
          incluirInvernalConLona: true,
          precioConLona: 1800,
          incluirInvernalSinLona: false,
          precioSinLona: 1600,
        },
        P,
      );
      expect(r.totales.mensualidad_sin_iva).toBe(550);
      expect(r.totales.anualidad_sin_iva).toBe(500 * 12 + 50 * 12);
      expect(r.breakdown.invernal_con_lona).toBe(1800);
      expect(r.breakdown.invernal_sin_lona).toBe(0);
      expect(r.warnings.some((w) => w.includes('Legacy'))).toBe(true);
    });
  });
});
