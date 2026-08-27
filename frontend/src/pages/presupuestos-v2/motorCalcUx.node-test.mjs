/**
 * Node smoke tests for display-only UX helpers.
 * Run: node --test src/pages/presupuestos-v2/motorCalcUx.node-test.mjs
 * (from frontend/)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  auxiliaresHeadcount,
  limpiezaB4,
  pairSubtotalBeneficio,
  pairSubtotalGastosFijoLimp,
  pairSubtotalMensualAnual,
  pairSubtotalSimple,
} from './motorCalcUx.js';

describe('motorCalcUx display helpers', () => {
  it('uniformidad auto mirrors motor headcount rules', () => {
    const hd = auxiliaresHeadcount(
      {
        horasACubrirPorSemana: 168,
        aplicaUniformidadAuto: true,
        aplicaGestoriaAuto: true,
        uniformidad: { b: 150, c: 99 },
        gestoria: { b: 120, c: 99 },
      },
      null,
    );
    // 168/40 = 4.2 → floor 4 empleados; uniformes 5; gestoría 4
    assert.equal(hd.numEmpleados, 4);
    assert.equal(hd.numUniformes, 5);
    assert.equal(hd.numEmpleadosGestoria, 4);
    assert.equal(hd.costeUnif, 150 * 5);
    assert.equal(hd.costeGest, 120 * 4);
  });

  it('ignores manual C when auto is on (cost uses computed counts)', () => {
    const hd = auxiliaresHeadcount(
      {
        horasACubrirPorSemana: 80,
        aplicaUniformidadAuto: true,
        uniformidad: { b: 150, c: 999 },
      },
      null,
    );
    assert.equal(hd.numUniformes, 3); // floor(2)+1
    assert.notEqual(hd.numUniformes, 999);
  });

  it('acristalado subtotal is B×C (not ×12)', () => {
    const s = pairSubtotalSimple(125, 4, 'acristalados', 'D32', null);
    assert.equal(s.product, 500);
    assert.match(s.text, /500/);
  });

  it('telefono subtotal is B×C×12', () => {
    const s = pairSubtotalMensualAnual(22, 1, 'líneas', 'D38', null);
    assert.equal(s.product, 264);
  });

  it('beneficio is €/mes × cantidad × 12 (not percent)', () => {
    const s = pairSubtotalBeneficio(150, 1, 'D40', null);
    assert.equal(s.product, 1800);
    assert.match(s.text, /€\/mes/);
  });

  it('limpieza gastos fijo uses B4, not pair C', () => {
    const B4 = limpiezaB4(
      { numOperarias: 2, horasPorDiaPorOperaria: 4, diasLaborablesSemana: 5 },
      null,
    );
    assert.equal(B4, 40);
    const s = pairSubtotalGastosFijoLimp(1.1, B4, null);
    assert.equal(s.product, 1.1 * 40 * 4.33 * 12);
  });

  it('prefers resultado.breakdown when present', () => {
    const s = pairSubtotalSimple(125, 4, 'acristalados', 'D32', {
      breakdown: { D32: 999 },
    });
    assert.equal(s.product, 999);
  });
});
