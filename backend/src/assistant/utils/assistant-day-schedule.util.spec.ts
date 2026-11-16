import {
  messageAsksOwnSchedule,
  replyForSingleDaySchedule,
} from './assistant-day-schedule.util';

describe('assistant day schedule', () => {
  it('„tengo” este programul propriu', () => {
    expect(messageAsksOwnSchedule('que horarrio tengo para hoy ?')).toBe(true);
    expect(messageAsksOwnSchedule('horario de Juan hoy')).toBe(false);
  });

  it('hoy cu un rând nu spune luna', () => {
    const text = replyForSingleDaySchedule(
      'que horarrio tengo para hoy ?',
      '2026-11-10',
      [
        {
          nombre: 'ANA',
          valor_celula_cuadrante: 'T1',
          horas_plan: 8,
          centro: 'Centro Norte',
          trabaja_este_dia: 1,
        },
      ],
      'es',
    );
    expect(text).toContain('10/11/2026');
    expect(text).toContain('solo ese día');
    expect(text).toContain('ANA: T1, 8 h — Centro Norte');
    expect(text).not.toContain('mes');
  });

  it('luna întreagă nu primește rezumatul de o zi', () => {
    expect(
      replyForSingleDaySchedule(
        'que horario tengo este mes',
        '2026-11-10',
        [{ nombre: 'ANA' }],
        'es',
      ),
    ).toBeNull();
  });
});
