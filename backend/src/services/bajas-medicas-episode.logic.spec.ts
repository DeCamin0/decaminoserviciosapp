import {
  decideEmployeeAnnounce,
  decideMutuaAbsorption,
  effectiveReturnDate,
  type BajaEpisode,
} from './bajas-medicas-episode.logic';

const empleado = (patch: Partial<BajaEpisode> = {}): BajaEpisode => ({
  idCaso: '1',
  idPosicion: '1',
  codigo: '10000072',
  fuente: 'EMPLEADO',
  fechaBaja: '2026-11-01',
  fechaAlta: null,
  altaAnunciada: null,
  ...patch,
});

describe('baja médica episode', () => {
  it('nu lasă a doua baja cât timp una e deschisă', () => {
    const decision = decideEmployeeAnnounce([empleado()], {
      codigo: '10000072',
      fechaBaja: '2026-11-20',
    });
    expect(decision.ok).toBe(false);
  });

  it('după alta poate anunța alt episod, dar nu aceeași zi de început', () => {
    const closed = empleado({ fechaAlta: '2026-11-10' });
    expect(
      decideEmployeeAnnounce([closed], {
        codigo: '10000072',
        fechaBaja: '2026-12-01',
      }).ok,
    ).toBe(true);
    expect(
      decideEmployeeAnnounce([closed], {
        codigo: '10000072',
        fechaBaja: '2026-11-01',
      }).ok,
    ).toBe(false);
  });

  it('un singur anunț care se suprapune cu mutua se înlocuiește', () => {
    const decision = decideMutuaAbsorption([empleado()], {
      codigo: '10000072',
      fechaBaja: '2026-11-03',
      fechaAlta: null,
    });
    expect(decision.action).toBe('replace');
  });

  it('o baja veche închisă nu se amestecă cu una nouă de la mutua', () => {
    const decision = decideMutuaAbsorption(
      [empleado({ fechaBaja: '2026-06-01', fechaAlta: '2026-06-20' })],
      { codigo: '10000072', fechaBaja: '2026-11-01', fechaAlta: null },
    );
    expect(decision.action).toBe('none');
  });

  it('două anunțuri suprapuse rămân conflict', () => {
    const decision = decideMutuaAbsorption(
      [
        empleado({ idCaso: '1' }),
        empleado({ idCaso: '2', fechaBaja: '2026-11-02' }),
      ],
      { codigo: '10000072', fechaBaja: '2026-11-03', fechaAlta: null },
    );
    expect(decision.action).toBe('conflict');
  });

  it('alta anunțată ține revenirea până vine cea oficială', () => {
    expect(
      effectiveReturnDate({ fechaAlta: null, altaAnunciada: '2026-11-18' }),
    ).toBe('2026-11-18');
    expect(
      effectiveReturnDate({
        fechaAlta: '2026-11-20',
        altaAnunciada: '2026-11-18',
      }),
    ).toBe('2026-11-20');
  });
});
