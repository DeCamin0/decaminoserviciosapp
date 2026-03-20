import { looksLikeDetailOrReformulationFollowUp } from './follow-up-detail.util';

describe('looksLikeDetailOrReformulationFollowUp', () => {
  it('detectează cereri listă / RO polite', () => {
    expect(
      looksLikeDetailOrReformulationFollowUp('da nu mi poti da tu o lista ?'),
    ).toBe(true);
    expect(looksLikeDetailOrReformulationFollowUp('imi poti da o lista')).toBe(
      true,
    );
    expect(
      looksLikeDetailOrReformulationFollowUp(
        'da poti sami arati toate nominele aici',
      ),
    ).toBe(true);
  });

  it('detectează ES detalles / darme', () => {
    expect(
      looksLikeDetailOrReformulationFollowUp('me puedes dar más detalles'),
    ).toBe(true);
    expect(
      looksLikeDetailOrReformulationFollowUp('puedes darme la lista'),
    ).toBe(true);
  });

  it('exclude lista de empleados (subiect explicit angajați)', () => {
    expect(looksLikeDetailOrReformulationFollowUp('lista de empleados')).toBe(
      false,
    );
    expect(looksLikeDetailOrReformulationFollowUp('mis empleados')).toBe(false);
  });

  it('mesaje foarte lung → false', () => {
    const long = `${'x'.repeat(200)} lista`;
    expect(looksLikeDetailOrReformulationFollowUp(long)).toBe(false);
  });
});
