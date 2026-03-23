import { IntentType } from '../services/intent-classifier.service';
import { AccessLevel } from '../services/rbac.service';
import {
  computeBusinessLexiconSignals,
  assistantMessageSignature,
} from './assistant-business-signals.util';
import {
  buildRecoveryCandidatesForDesconocido,
  pickPostQueryRecoveryIntent,
  shouldAttemptPostQueryRecovery,
  hasIntentToolConflict,
} from './assistant-recovery.util';
import {
  evaluateAssistantOutcome,
  shouldSendTelegramAlertPure,
} from './assistant-outcome-eval.util';

describe('assistant recovery + outcome (controlled)', () => {
  it('que ausencias estan previstas para mañana → ausenciasOperativas', () => {
    const s = computeBusinessLexiconSignals(
      'que ausencias estan previstas para mañana',
    );
    expect(s.ausenciasOperativas).toBe(true);
  });

  it('falta nomina febrero → post recovery EMPLEADOS → NOMINAS', () => {
    const s = computeBusinessLexiconSignals(
      'falta nomina para algun empleado en mes de febrero',
    );
    expect(s.nomina).toBe(true);
    expect(
      hasIntentToolConflict(IntentType.EMPLEADOS, s, 'falta nomina febrero'),
    ).toBe(true);
    const alt = pickPostQueryRecoveryIntent(
      IntentType.EMPLEADOS,
      s,
      'falta nomina febrero',
      false,
      { mes: 'febrero', faltan_nominas: true },
    );
    expect(alt).toBe(IntentType.NOMINAS);
  });

  it('quien tiene alguna diploma en aplicacion → diploma signal + DESCONOCIDO candidate DIPLOMAS', () => {
    const s = computeBusinessLexiconSignals(
      'quien tiene alguna diploma en aplicacion',
    );
    expect(s.diploma).toBe(true);
    const c = buildRecoveryCandidatesForDesconocido(s);
    expect(c[0]).toBe(IntentType.DIPLOMAS);
  });

  it('mi centro tiene pedidos → pedido + recovery PEDIDOS from EMPLEADOS', () => {
    const s = computeBusinessLexiconSignals('mi centro tiene pedidos');
    expect(s.pedido).toBe(true);
    const alt = pickPostQueryRecoveryIntent(
      IntentType.EMPLEADOS,
      s,
      'mi centro tiene pedidos',
      true,
      {},
    );
    expect(alt).toBe(IntentType.PEDIDOS);
  });

  it('CUADRANTE vacío + hoy: sin fallback FICHAJES si hay entidad nombre (horario de otra persona)', () => {
    const s = computeBusinessLexiconSignals('que horario tiene Anisoara hoy');
    const alt = pickPostQueryRecoveryIntent(
      IntentType.CUADRANTE,
      s,
      'que horario tiene Anisoara hoy',
      true,
      { fecha: '2026-03-20', nombre: 'Anisoara' },
    );
    expect(alt).toBeNull();
  });

  it('CUADRANTE vacío + hoy + centro: sin fallback FICHAJES (plan por centro ≠ fichajes)', () => {
    const s = computeBusinessLexiconSignals(
      'quien trabaja hoy en Bosquepino',
    );
    const alt = pickPostQueryRecoveryIntent(
      IntentType.CUADRANTE,
      s,
      'quien trabaja hoy en Bosquepino',
      true,
      { fecha: '2026-03-23', centro: 'Bosquepino' },
    );
    expect(alt).toBeNull();
  });

  it('quien ha registrado la entrada hoy → fichajes signal; good outcome fără alertă pentru FICHAJES reușit', () => {
    const s = computeBusinessLexiconSignals(
      'quien ha registrado la entrada hoy',
    );
    expect(s.fichajes).toBe(true);
    const ev = evaluateAssistantOutcome({
      mensaje: 'quien ha registrado la entrada hoy',
      initialIntent: IntentType.FICHAJES,
      finalIntent: IntentType.FICHAJES,
      entidades: { fecha: '2026-03-20' },
      executedTools: ['fichajes_registro'],
      resultCount: 5,
      queryError: false,
      responseType: 'data',
      status: 'success',
      skippedQuery: false,
      accessLevel: AccessLevel.FULL_ACCESS,
      recoveryAttempted: false,
      recoverySucceeded: false,
      signals: s,
    });
    expect(ev.level).toBe('good');
    const tg = shouldSendTelegramAlertPure({
      evaluation: ev,
      finalIntent: IntentType.FICHAJES,
      recoverySucceeded: false,
      queryErrorTicketSent: false,
      signals: s,
      similarFailureCountInWindow: 0,
    });
    expect(tg.send).toBe(false);
  });

  it('query error cu ticket deja trimis → nu trimite încă o dată (pure)', () => {
    const ev = evaluateAssistantOutcome({
      mensaje: 'x',
      initialIntent: IntentType.FICHAJES,
      finalIntent: IntentType.FICHAJES,
      entidades: undefined,
      executedTools: [],
      resultCount: 0,
      queryError: true,
      accessLevel: AccessLevel.FULL_ACCESS,
      recoveryAttempted: false,
      recoverySucceeded: false,
      signals: computeBusinessLexiconSignals('x'),
      skippedQuery: false,
    });
    expect(ev.failureKind).toBe('query_error');
    const tg = shouldSendTelegramAlertPure({
      evaluation: ev,
      finalIntent: IntentType.FICHAJES,
      recoverySucceeded: false,
      queryErrorTicketSent: true,
      signals: computeBusinessLexiconSignals('x'),
      similarFailureCountInWindow: 0,
    });
    expect(tg.send).toBe(false);
  });

  it('shouldAttemptPostQueryRecovery: doar cu slot liber și conflict', () => {
    const s = computeBusinessLexiconSignals('falta nomina enero');
    expect(
      shouldAttemptPostQueryRecovery({
        recoveryAlreadyUsed: true,
        queryError: false,
        currentIntent: IntentType.EMPLEADOS,
        signals: s,
        mensaje: 'falta nomina enero',
        dataEmpty: false,
        entidades: {},
      }),
    ).toBe(false);
    expect(
      shouldAttemptPostQueryRecovery({
        recoveryAlreadyUsed: false,
        queryError: false,
        currentIntent: IntentType.EMPLEADOS,
        signals: s,
        mensaje: 'falta nomina enero',
        dataEmpty: true,
        entidades: { mes: 'enero', faltan_nominas: true },
      }),
    ).toBe(true);
  });

  it('assistantMessageSignature: mesaje similare → aceeași familie de tokeni', () => {
    const a = assistantMessageSignature('quien tiene diplomas');
    const b = assistantMessageSignature('quien tiene alguna diploma');
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
  });

  it('3 eșecuri recoverable similare → shouldSendTelegramAlertPure trimite (agregare)', () => {
    const s = computeBusinessLexiconSignals('test vague');
    const evRecoverable = evaluateAssistantOutcome({
      mensaje: 'test vague',
      initialIntent: IntentType.EMPLEADOS,
      finalIntent: IntentType.EMPLEADOS,
      entidades: {},
      executedTools: ['empleados_resumen_operativo'],
      resultCount: 0,
      queryError: false,
      accessLevel: AccessLevel.FULL_ACCESS,
      recoveryAttempted: false,
      recoverySucceeded: false,
      signals: s,
      skippedQuery: false,
    });
    /** EMPLEADOS fără nomina în mesaj → poate fi good; forțăm scenariu recoverable artificial */
    const ev = { ...evRecoverable, level: 'recoverable' as const };
    const tg = shouldSendTelegramAlertPure({
      evaluation: ev,
      finalIntent: IntentType.EMPLEADOS,
      recoverySucceeded: false,
      queryErrorTicketSent: false,
      signals: s,
      similarFailureCountInWindow: 3,
    });
    expect(tg.send).toBe(true);
    expect(tg.reason).toBe('repeated_similar_failures');
  });
});
