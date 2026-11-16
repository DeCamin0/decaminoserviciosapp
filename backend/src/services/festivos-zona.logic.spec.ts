import {
  canManageFestivoZonas,
  decideZona,
  fiestaAppliesOn,
  fiestaAppliesToZona,
  isManualCalendarShadow,
  isOfficialNonLocalRow,
  localFestivoName,
  type FiestaRow,
  type Zona,
} from './festivos-zona.logic';

const madrid: Zona = { ine: '28079', nombre: 'Madrid', ccaaCode: 'ES-MD' };
const alcala: Zona = {
  ine: '28005',
  nombre: 'Alcalá de Henares',
  ccaaCode: 'ES-MD',
};
const barcelona: Zona = {
  ine: '08019',
  nombre: 'Barcelona',
  ccaaCode: 'ES-CT',
};

function row(
  partial: Partial<FiestaRow> & Pick<FiestaRow, 'date' | 'scope'>,
): FiestaRow {
  return {
    observedDate: partial.date,
    name: partial.name || 'Festivo',
    ccaaCode: partial.ccaaCode ?? null,
    municipioIne: partial.municipioIne ?? '',
    active: partial.active ?? true,
    ...partial,
  };
}

describe('festivos zona', () => {
  it('9 noiembrie e liber doar în Madrid', () => {
    const almudena = row({
      date: '2026-11-09',
      scope: 'Local',
      ccaaCode: 'ES-MD',
      municipioIne: '28079',
      name: 'Festivo local de Madrid',
    });
    expect(fiestaAppliesToZona(almudena, madrid, '2026-11-09')).toBe(true);
    expect(fiestaAppliesToZona(almudena, alcala, '2026-11-09')).toBe(false);
    expect(fiestaAppliesToZona(almudena, null, '2026-11-09')).toBe(false);
  });

  it('sărbătoarea de comunitate rămâne pentru cine nu a ales zona', () => {
    const dosDeMayo = row({
      date: '2026-05-02',
      scope: 'Autonómico',
      ccaaCode: 'ES-MD',
      name: 'Fiesta de la Comunidad de Madrid',
    });
    expect(fiestaAppliesToZona(dosDeMayo, null, '2026-05-02')).toBe(true);
    expect(fiestaAppliesToZona(dosDeMayo, alcala, '2026-05-02')).toBe(true);
    expect(fiestaAppliesToZona(dosDeMayo, barcelona, '2026-05-02')).toBe(false);
  });

  it('o dată observată la luni distanță nu mută sărbătoarea', () => {
    const bad = row({
      date: '2026-11-09',
      observedDate: '2026-08-17',
      scope: 'Nacional',
      name: 'Rupt',
    });
    expect(fiestaAppliesOn(bad, '2026-08-17')).toBe(false);
    expect(fiestaAppliesOn(bad, '2026-11-09')).toBe(true);
  });

  it('puente-ul de o zi se ține', () => {
    const puente = row({
      date: '2026-12-06',
      observedDate: '2026-12-07',
      scope: 'Nacional',
      name: 'Constitución',
    });
    expect(fiestaAppliesOn(puente, '2026-12-07')).toBe(true);
  });

  it('centrul își ia orașul, chiar dacă scrierea diferă', () => {
    const decision = decideZona({
      hasCenter: true,
      poblacion: 'Alcala de henares',
      zonas: [madrid, alcala],
      chosenIne: null,
    });
    expect(decision.source).toBe('centro');
    expect(decision.zona?.ine).toBe('28005');
    expect(decision.needsChoice).toBe(false);
  });

  it('fără centru și cu mai multe zone se cere alegerea de azi', () => {
    const pending = decideZona({
      hasCenter: false,
      poblacion: null,
      zonas: [madrid, alcala],
      chosenIne: null,
    });
    expect(pending.needsChoice).toBe(true);
    expect(pending.zona).toBeNull();

    const chosen = decideZona({
      hasCenter: false,
      poblacion: null,
      zonas: [madrid, alcala],
      chosenIne: '28079',
    });
    expect(chosen.source).toBe('elegida');
    expect(chosen.zona?.ine).toBe('28079');
  });

  it('o singură zonă ține pentru toată firma, și pentru un centru din alt oraș', () => {
    const faraCentru = decideZona({
      hasCenter: false,
      poblacion: null,
      zonas: [madrid],
      chosenIne: null,
    });
    expect(faraCentru.source).toBe('unica');
    expect(faraCentru.zona?.ine).toBe('28079');

    const sanse = decideZona({
      hasCenter: true,
      poblacion: 'San Sebastian de los Reyes',
      zonas: [madrid],
      chosenIne: null,
    });
    expect(sanse.source).toBe('unica');
    expect(sanse.needsChoice).toBe(false);
    expect(sanse.zona?.ine).toBe('28079');
    expect(
      fiestaAppliesToZona(
        row({
          date: '2026-11-09',
          scope: 'Local',
          ccaaCode: 'ES-MD',
          municipioIne: '28079',
          name: 'La Almudena',
        }),
        sanse.zona,
        '2026-11-09',
      ),
    ).toBe(true);
  });

  it('numele gol din API primește orașul', () => {
    expect(localFestivoName('Fiesta local', 'Madrid')).toBe(
      'Festivo local de Madrid',
    );
    expect(localFestivoName('San Isidro', 'Madrid')).toBe('San Isidro');
  });

  it('un San Isidro marcat național de mână nu e rând oficial', () => {
    expect(
      isOfficialNonLocalRow({ scope: 'Nacional', notes: 'SAN ISIDRO' }),
    ).toBe(false);
    expect(
      isOfficialNonLocalRow({
        scope: 'Nacional',
        notes: 'calendariosnacionales | synced:2026-11-09',
      }),
    ).toBe(true);
  });

  it('Dia CCMM pus de mână e umbră, rândul oficial de comunitate nu', () => {
    expect(
      isManualCalendarShadow({ scope: 'Nacional', notes: 'DIA CCMM' }),
    ).toBe(true);
    expect(
      isManualCalendarShadow({
        scope: 'Autonómico',
        notes: 'calendariosnacionales | verified:madrid-od',
      }),
    ).toBe(false);
    expect(
      isManualCalendarShadow({
        scope: 'Local',
        notes: 'calendariosnacionales | local | 28079',
        municipioIne: '28079',
      }),
    ).toBe(false);
  });

  it('cine are cuadrantes poate schimba zonele', () => {
    expect(
      canManageFestivoZonas({
        grupo: 'Administrativ',
        cuadrantesPermitted: true,
      }),
    ).toBe(true);
    expect(
      canManageFestivoZonas({
        grupo: 'Limpiador',
        cuadrantesPermitted: false,
      }),
    ).toBe(false);
    expect(canManageFestivoZonas({ grupo: 'Supervisor' })).toBe(true);
    expect(canManageFestivoZonas({ role: 'DEVELOPER' })).toBe(true);
  });
});
