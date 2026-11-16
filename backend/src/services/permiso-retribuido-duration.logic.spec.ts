import {
  canConfirmPermisoDuracion,
  classifySlot,
  collapseTemplates,
  decidePermisoSave,
  eachIsoDate,
  evaluatePermisoRange,
  lunaMatches,
  madridIsoDate,
  presentPermisoDuration,
  presentRegisteredDuration,
  resolveLuna,
  slotFromMonthRows,
  weekdayPrefix,
  type DayScheduleInput,
} from './permiso-retribuido-duration.logic';

function fill(
  inicio: string,
  fin: string,
  patch: (date: string) => Partial<DayScheduleInput>,
): DayScheduleInput[] {
  return eachIsoDate(inicio, fin).map((date) => ({
    date,
    cuadrante: 'missing',
    multicentro: 'missing',
    horario: 'missing',
    holiday: 'none',
    ...patch(date),
  }));
}

function weekdayWork(date: string): 'work' | 'off' {
  const day = weekdayPrefix(date);
  return day === 'sam' || day === 'dum' ? 'off' : 'work';
}

describe('Permiso Retribuido duration', () => {
  it('1. Felisa 17-23 nov 2026, lunes a viernes, son 5 días', () => {
    const inicio = '2026-11-17';
    const fin = '2026-11-23';
    const result = evaluatePermisoRange({
      inicio,
      fin,
      trabajaFestivos: false,
      days: fill(inicio, fin, (date) => ({ horario: weekdayWork(date) })),
    });
    expect(result.calendarDays).toBe(7);
    expect(result.workingDays).toBe(5);
    expect(result.status).toBe('calculated');
    expect(result.headline).toBe('5 días laborables');
    expect(result.intervalo).toBe('Intervalo: 7 días naturales');
    expect(result.workDates).toEqual([
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-23',
    ]);
  });

  it('2. trabaja el sábado y libra el miércoles', () => {
    const inicio = '2026-11-16';
    const fin = '2026-11-22';
    const result = evaluatePermisoRange({
      inicio,
      fin,
      trabajaFestivos: false,
      days: fill(inicio, fin, (date) => ({
        horario:
          date === '2026-11-18'
            ? 'off'
            : date === '2026-11-21'
              ? 'work'
              : weekdayPrefix(date) === 'dum'
                ? 'off'
                : 'work',
      })),
    });
    expect(result.workDates).toContain('2026-11-21');
    expect(result.offDates).toContain('2026-11-18');
    expect(result.workingDays).toBe(5);
  });

  it('3. trabaja el domingo', () => {
    const result = evaluatePermisoRange({
      inicio: '2026-11-22',
      fin: '2026-11-22',
      trabajaFestivos: false,
      days: fill('2026-11-22', '2026-11-22', () => ({ horario: 'work' })),
    });
    expect(weekdayPrefix('2026-11-22')).toBe('dum');
    expect(result.workingDays).toBe(1);
  });

  it('4. programa variable en el cuadrante', () => {
    const inicio = '2026-11-17';
    const fin = '2026-11-19';
    const result = evaluatePermisoRange({
      inicio,
      fin,
      trabajaFestivos: false,
      days: fill(inicio, fin, (date) => ({
        cuadrante: date === '2026-11-18' ? 'off' : 'work',
        horario: 'work',
      })),
    });
    expect(result.workingDays).toBe(2);
    expect(result.offDates).toEqual(['2026-11-18']);
  });

  it('5. cuadrante completo, incluido el sábado', () => {
    const inicio = '2026-11-20';
    const fin = '2026-11-21';
    const result = evaluatePermisoRange({
      inicio,
      fin,
      trabajaFestivos: false,
      days: fill(inicio, fin, () => ({ cuadrante: 'work' })),
    });
    expect(result.workingDays).toBe(2);
    expect(result.days.every((day) => day.source === 'cuadrante')).toBe(true);
  });

  it('6. horario multicentro cuando el cuadrante no existe', () => {
    const result = evaluatePermisoRange({
      inicio: '2026-11-21',
      fin: '2026-11-21',
      trabajaFestivos: false,
      days: fill('2026-11-21', '2026-11-21', () => ({
        cuadrante: 'missing',
        multicentro: 'work',
      })),
    });
    expect(result.workingDays).toBe(1);
    expect(result.days[0].source).toBe('multicentro');
  });

  it('7. solo la plantilla del centro', () => {
    const result = evaluatePermisoRange({
      inicio: '2026-11-17',
      fin: '2026-11-17',
      trabajaFestivos: false,
      days: fill('2026-11-17', '2026-11-17', () => ({ horario: 'work' })),
    });
    expect(result.workingDays).toBe(1);
    expect(result.days[0].source).toBe('horarios');
  });

  it('8. sin ningún programa no inventa lunes a viernes', () => {
    const inicio = '2026-11-17';
    const fin = '2026-11-23';
    const result = evaluatePermisoRange({
      inicio,
      fin,
      trabajaFestivos: false,
      days: fill(inicio, fin, () => ({})),
    });
    expect(result.status).toBe('needs_verification');
    expect(result.workingDays).toBeNull();
    expect(result.headline).toBe('Duración pendiente de verificar');
    expect(result.unknownDates).toHaveLength(7);
  });

  it('9. celda vacía usa la fuente inferior; celda ilegible pide verificación', () => {
    const empty = evaluatePermisoRange({
      inicio: '2026-11-17',
      fin: '2026-11-17',
      trabajaFestivos: false,
      days: fill('2026-11-17', '2026-11-17', () => ({
        cuadrante: 'empty',
        horario: 'work',
      })),
    });
    expect(empty.workingDays).toBe(1);
    expect(empty.days[0].source).toBe('horarios');

    const unreadable = evaluatePermisoRange({
      inicio: '2026-11-17',
      fin: '2026-11-18',
      trabajaFestivos: false,
      days: fill('2026-11-17', '2026-11-18', (date) => ({
        cuadrante: date === '2026-11-17' ? 'unknown' : 'work',
      })),
    });
    expect(unreadable.status).toBe('needs_verification');
    expect(unreadable.knownWorkingDays).toBe(1);
    expect(unreadable.unknownDates).toEqual(['2026-11-17']);
    expect(unreadable.workingDays).toBeNull();
  });

  it('10. un libre explícito no se sustituye por la plantilla', () => {
    const result = evaluatePermisoRange({
      inicio: '2026-11-17',
      fin: '2026-11-17',
      trabajaFestivos: false,
      days: fill('2026-11-17', '2026-11-17', () => ({
        cuadrante: 'off',
        horario: 'work',
      })),
    });
    expect(result.workingDays).toBe(0);
    expect(result.days[0].source).toBe('cuadrante');
  });

  it('11. festivo nacional y autonómico sin trabajo en festivo', () => {
    const result = evaluatePermisoRange({
      inicio: '2026-11-17',
      fin: '2026-11-18',
      trabajaFestivos: false,
      days: fill('2026-11-17', '2026-11-18', (date) => ({
        horario: 'work',
        holiday: date === '2026-11-17' ? 'applies' : 'applies',
      })),
    });
    expect(result.workingDays).toBe(0);
    expect(result.days.every((day) => day.source === 'festivo')).toBe(true);
  });

  it('12. quien trabaja festivos y está programado cuenta el festivo', () => {
    const result = evaluatePermisoRange({
      inicio: '2026-11-17',
      fin: '2026-11-17',
      trabajaFestivos: true,
      days: fill('2026-11-17', '2026-11-17', () => ({
        cuadrante: 'work',
        holiday: 'applies',
      })),
    });
    expect(result.workingDays).toBe(1);
    expect(result.days[0].source).toBe('cuadrante');
  });

  it('13. dos plantillas del mismo centro cuentan un solo día', () => {
    expect(collapseTemplates(['work', 'work'])).toBe('work');
    expect(collapseTemplates(['off', 'work'])).toBe('work');
    expect(collapseTemplates(['off', 'off'])).toBe('off');
    const result = evaluatePermisoRange({
      inicio: '2026-11-21',
      fin: '2026-11-21',
      trabajaFestivos: false,
      days: fill('2026-11-21', '2026-11-21', () => ({
        horario: collapseTemplates(['work', 'work']),
      })),
    });
    expect(result.workingDays).toBe(1);
  });

  it('14 y 15. aprobar o crear ya aprobada guarda los días de programa', () => {
    const preview = evaluatePermisoRange({
      inicio: '2026-11-17',
      fin: '2026-11-23',
      trabajaFestivos: false,
      days: fill('2026-11-17', '2026-11-23', (date) => ({
        horario: weekdayWork(date),
      })),
    });
    expect(decidePermisoSave({ tipo: 'Permiso Retribuido', preview })).toEqual({
      applies: true,
      action: 'save',
      dias: 5,
      unidad: 'dias',
    });
  });

  it('16. recalcular con programa incompleto no guarda cero ni el calendario', () => {
    const preview = evaluatePermisoRange({
      inicio: '2026-11-17',
      fin: '2026-11-18',
      trabajaFestivos: false,
      days: fill('2026-11-17', '2026-11-18', (date) => ({
        horario: date === '2026-11-17' ? 'work' : 'missing',
      })),
    });
    const decision = decidePermisoSave({
      tipo: 'Permiso Retribuido',
      preview,
    });
    expect(decision.applies).toBe(true);
    if (decision.applies && decision.action === 'reject') {
      expect(decision.message).toContain('pendiente de verificar');
      expect(decision.message).not.toContain('7');
    } else {
      throw new Error('debía pedir confirmación');
    }
  });

  it('17. una duración confirmada no se sustituye sin acción explícita', () => {
    const preview = evaluatePermisoRange({
      inicio: '2026-11-17',
      fin: '2026-11-23',
      trabajaFestivos: false,
      days: fill('2026-11-17', '2026-11-23', (date) => ({
        horario: weekdayWork(date),
      })),
    });
    const kept = decidePermisoSave({
      tipo: 'Permiso Retribuido',
      preview,
      existingUnidad: 'dias_manual',
      existingDias: 4,
    });
    expect(kept).toMatchObject({
      action: 'keep',
      dias: 4,
      unidad: 'dias_manual',
    });

    const forced = decidePermisoSave({
      tipo: 'Permiso Retribuido',
      preview,
      existingUnidad: 'dias_manual',
      existingDias: 4,
      forzar: true,
    });
    expect(forced).toMatchObject({ action: 'save', dias: 5, unidad: 'dias' });

    const confirmed = decidePermisoSave({
      tipo: 'Permiso Retribuido',
      preview,
      duracionConfirmada: 4,
    });
    expect(confirmed).toEqual({
      applies: true,
      action: 'save',
      dias: 4,
      unidad: 'dias_manual',
    });
  });

  it('18. formulario, tarjeta y exportación usan el mismo texto', () => {
    const preview = evaluatePermisoRange({
      inicio: '2026-11-17',
      fin: '2026-11-23',
      trabajaFestivos: false,
      days: fill('2026-11-17', '2026-11-23', (date) => ({
        horario: weekdayWork(date),
      })),
    });
    const again = presentPermisoDuration(preview.days);
    expect(again.text).toBe(preview.text);
    expect(again.text).toContain('5 días laborables');
    expect(again.text).toContain('7 días naturales');
    expect(again.text).not.toBe('7 días');
  });

  it('19. Vacaciones y Asuntos Propios no entran en esta decisión', () => {
    const preview = presentPermisoDuration([]);
    expect(decidePermisoSave({ tipo: 'Vacaciones', preview }).applies).toBe(
      false,
    );
    expect(decidePermisoSave({ tipo: 'Asunto Propio', preview }).applies).toBe(
      false,
    );
    expect(
      decidePermisoSave({ tipo: 'Asuntos Propios', preview }).applies,
    ).toBe(false);
  });

  it('20. solo el personal que aprueba puede confirmar la duración', () => {
    expect(
      canConfirmPermisoDuracion({
        userId: '1',
        email: 'a@b.c',
        grupo: 'Limpiador',
        role: 'USER',
      }),
    ).toBe(false);
    expect(
      canConfirmPermisoDuracion({
        userId: '1',
        email: 'a@b.c',
        grupo: 'Supervisor',
        role: 'USER',
      }),
    ).toBe(false);
    expect(
      canConfirmPermisoDuracion({
        userId: '1',
        email: 'a@b.c',
        grupo: 'Supervisor',
        role: 'USER',
        solicitudesAdmin: true,
      }),
    ).toBe(true);
    expect(
      canConfirmPermisoDuracion({
        userId: '1',
        email: 'a@b.c',
        grupo: 'Admin',
        role: 'USER',
      }),
    ).toBe(true);
  });

  it('reconoce los formatos reales de mes y de celda', () => {
    expect(lunaMatches('2026-11', 2026, 11)).toBe(true);
    expect(lunaMatches('11/2026', 2026, 11)).toBe(true);
    expect(lunaMatches('2026/11', 2026, 11)).toBe(true);
    expect(lunaMatches('202611', 2026, 11)).toBe(true);
    expect(lunaMatches('noviembre 2026', 2026, 11)).toBe(true);
    expect(lunaMatches('11', 2026, 11)).toBe(false);
    expect(lunaMatches(11, 2026, 11)).toBe(false);
    expect(lunaMatches('11/26', 2026, 11)).toBe(false);
    const november2026 = Math.round(Date.UTC(2026, 10, 1) / 86400000 + 25569);
    const november2025 = Math.round(Date.UTC(2025, 10, 1) / 86400000 + 25569);
    expect(lunaMatches(november2026, 2026, 11)).toBe(true);
    expect(lunaMatches(november2026, 2025, 11)).toBe(false);
    expect(lunaMatches(november2025, 2026, 11)).toBe(false);
    expect(resolveLuna('11').kind).toBe('ambiguous');
    expect(lunaMatches('2026-12', 2026, 11)).toBe(false);
    expect(classifySlot('08:00-15:00')).toBe('work');
    expect(classifySlot('T1 09:00-17:00')).toBe('work');
    expect(classifySlot('8h')).toBe('work');
    expect(classifySlot('24h (3×8h)')).toBe('work');
    expect(classifySlot('12')).toBe('work');
    expect(classifySlot('7,5')).toBe('work');
    expect(classifySlot('LIBRE')).toBe('off');
    expect(classifySlot('')).toBe('empty');
    expect(classifySlot(null)).toBe('empty');
    expect(classifySlot('TURNO X')).toBe('unknown');
    expect(madridIsoDate(new Date('2026-11-16T23:00:00.000Z'))).toBe(
      '2026-11-17',
    );
  });

  it('una luna sin año no se aplica y no pisa el cuadrante del año correcto', () => {
    expect(
      slotFromMonthRows(
        [{ luna: '11', cells: { '17': '08:00-15:00' } }],
        2026,
        11,
        17,
        'one',
      ),
    ).toBe('unknown');
    expect(
      slotFromMonthRows(
        [{ luna: 11, cells: { '17': '08:00-15:00' } }],
        2025,
        11,
        17,
        'one',
      ),
    ).toBe('unknown');
    expect(
      slotFromMonthRows(
        [
          { luna: '2026-11', cells: { '17': '08:00-15:00' } },
          { luna: '11', cells: { '17': 'LIBRE' } },
        ],
        2026,
        11,
        17,
        'one',
      ),
    ).toBe('work');
  });

  it('la duración guardada no se muestra como un cálculo nuevo', () => {
    const preview = evaluatePermisoRange({
      inicio: '2026-11-17',
      fin: '2026-11-23',
      trabajaFestivos: false,
      days: fill('2026-11-17', '2026-11-23', (date) => ({
        horario: weekdayWork(date),
      })),
    });
    const registered = presentRegisteredDuration(preview, {
      unidad: 'dias',
      dias: 7,
    });
    expect(registered.workingDays).toBe(7);
    expect(registered.registered).toBe(true);
    expect(registered.headline).toBe('Duración registrada: 7 días');
    expect(registered.headline).not.toContain('5 días laborables');
    expect(
      presentRegisteredDuration(preview, { unidad: 'dias', dias: 5 }).headline,
    ).toBe('5 días laborables');
    expect(presentRegisteredDuration(preview, null).headline).toBe(
      '5 días laborables',
    );
  });

  it('aprobar otra vez no sustituye la duración histórica; editar las fechas sí', () => {
    const preview = evaluatePermisoRange({
      inicio: '2026-11-17',
      fin: '2026-11-23',
      trabajaFestivos: false,
      days: fill('2026-11-17', '2026-11-23', (date) => ({
        horario: weekdayWork(date),
      })),
    });
    expect(
      decidePermisoSave({
        tipo: 'Permiso Retribuido',
        preview,
        existingUnidad: 'dias',
        existingDias: 7,
      }),
    ).toMatchObject({
      action: 'keep',
      dias: 7,
      unidad: 'dias',
      requiresForce: true,
    });
    expect(
      decidePermisoSave({
        tipo: 'Permiso Retribuido',
        preview,
        existingUnidad: 'dias',
        existingDias: 7,
        replaceStored: true,
      }),
    ).toEqual({ applies: true, action: 'save', dias: 5, unidad: 'dias' });
  });

  it('la celda vacía no tapa la plantilla y dos cuadrantes distintos no se suman', () => {
    expect(
      slotFromMonthRows(
        [{ luna: '11/2026', cells: { '17': '' } }],
        2026,
        11,
        17,
        'one',
      ),
    ).toBe('empty');
    expect(
      slotFromMonthRows(
        [
          { luna: '2026-11', cells: { '21': '08:00-15:00' } },
          { luna: '11/2026', cells: { '21': 'LIBRE' } },
        ],
        2026,
        11,
        21,
        'one',
      ),
    ).toBe('unknown');
    expect(
      slotFromMonthRows(
        [
          { luna: '2026-11', cells: { '21': 'LIB' } },
          { luna: '2026-11', cells: { '21': '09:00-13:00' } },
        ],
        2026,
        11,
        21,
        'many',
      ),
    ).toBe('work');
  });

  it('un festivo que no se puede atribuir no se trata como día normal', () => {
    const result = evaluatePermisoRange({
      inicio: '2026-11-17',
      fin: '2026-11-17',
      trabajaFestivos: false,
      days: fill('2026-11-17', '2026-11-17', () => ({
        horario: 'work',
        holiday: 'unresolved',
      })),
    });
    expect(result.status).toBe('needs_verification');
    expect(result.workingDays).toBeNull();
  });
});
