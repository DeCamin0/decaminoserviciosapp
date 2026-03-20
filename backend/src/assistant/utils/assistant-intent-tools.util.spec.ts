import { IntentType } from '../services/intent-classifier.service';
import {
  countAssistantDataRows,
  isAssistantTabularExportIntent,
  resolveAssistantTools,
} from './assistant-intent-tools.util';

describe('resolveAssistantTools', () => {
  it('VACACIONES + year → vacaciones_solicitudes', () => {
    expect(
      resolveAssistantTools(IntentType.VACACIONES, { year: '2026' }),
    ).toEqual(['vacaciones_solicitudes']);
  });

  it('VACACIONES + mes → vacaciones_solicitudes', () => {
    expect(
      resolveAssistantTools(IntentType.VACACIONES, {
        mes: 'completo_enero',
      }),
    ).toEqual(['vacaciones_solicitudes']);
  });

  it('FICHAJES normal → fichajes_registro', () => {
    expect(resolveAssistantTools(IntentType.FICHAJES, {})).toEqual([
      'fichajes_registro',
    ]);
    expect(
      resolveAssistantTools(IntentType.FICHAJES, {
        mes: 'completo_marzo',
      }),
    ).toEqual(['fichajes_registro']);
  });

  it('CUADRANTE + fecha → plan_trabajo_dia', () => {
    expect(
      resolveAssistantTools(IntentType.CUADRANTE, {
        fecha: '2026-03-20',
      }),
    ).toEqual(['plan_trabajo_dia']);
  });

  it('PEDIDOS → pedidos_resumen', () => {
    expect(resolveAssistantTools(IntentType.PEDIDOS, {})).toEqual([
      'pedidos_resumen',
    ]);
  });

  it('CUADRANTE fără fecha → cuadrante_mes', () => {
    expect(
      resolveAssistantTools(IntentType.CUADRANTE, {
        mes: 'completo_marzo',
      }),
    ).toEqual(['cuadrante_mes']);
  });

  it('VACACIONES + soloPendientes → vacaciones_solicitudes', () => {
    expect(
      resolveAssistantTools(IntentType.VACACIONES, { soloPendientes: true }),
    ).toEqual(['vacaciones_solicitudes']);
  });

  it('SOLICITUDES → solicitudes_tabla + ausencias_calendario', () => {
    expect(resolveAssistantTools(IntentType.SOLICITUDES, {})).toEqual([
      'solicitudes_tabla',
      'ausencias_calendario',
    ]);
  });

  it('COMUNICADOS → comunicados_list', () => {
    expect(resolveAssistantTools(IntentType.COMUNICADOS, {})).toEqual([
      'comunicados_list',
    ]);
  });

  it('DOCUMENTOS_SOLICITADOS → documentos_solicitados_metadatos', () => {
    expect(
      resolveAssistantTools(IntentType.DOCUMENTOS_SOLICITADOS, {}),
    ).toEqual(['documentos_solicitados_metadatos']);
  });
});

describe('countAssistantDataRows + isAssistantTabularExportIntent', () => {
  it('combo solicitudes + ausencias suma filas', () => {
    expect(
      countAssistantDataRows({
        solicitudes: [1, 2, 3],
        ausencias_calendario: [4, 5],
      }),
    ).toBe(5);
  });

  it('PROCEDIMIENTOS no es export tabular', () => {
    expect(isAssistantTabularExportIntent(IntentType.PROCEDIMIENTOS)).toBe(
      false,
    );
    expect(isAssistantTabularExportIntent(IntentType.SOLICITUDES)).toBe(true);
  });
});
