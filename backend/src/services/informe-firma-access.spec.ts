import {
  FIRMA_LINK_TTL_MS,
  FIRMA_PURPOSE_INFORME,
  FIRMA_PURPOSE_PRESUPUESTO,
  buildInformeFirmarUrl,
  createFirmaToken,
  readInformeFirmaConfig,
  resolveFirmaAccess,
} from './presupuesto-firma-access';

const activated = '2026-01-01T00:00:00.000Z';
const config = readInformeFirmaConfig({
  INFORME_FIRMA_SECRET: 'informe-secret-diferit-de-buget-32ch',
  INFORME_FIRMA_INSTANCE: 'decamino',
  INFORME_FIRMA_ACTIVATED_AT: activated,
});
const presupuestoConfig = {
  ...config,
  secret: 'presupuesto-secret-altul-32-caractere',
  instanceId: 'decamino',
};

describe('informe firma access', () => {
  const now = new Date('2026-03-01T00:00:00.000Z');
  const createdBefore = new Date('2025-06-01T00:00:00.000Z');

  it('linkul nou nu conține id-ul și tokenul valid deschide raportul', () => {
    const url = buildInformeFirmarUrl(
      'https://app.example.com',
      7,
      config,
      now,
    );
    expect(url).toContain('/firmar-informe.html?t=');
    expect(url).not.toContain('id=');
    const token = new URL(url).searchParams.get('t') || '';
    const decision = resolveFirmaAccess({
      token,
      requestedId: null,
      createdAt: null,
      config,
      now,
      purpose: FIRMA_PURPOSE_INFORME,
    });
    expect(decision).toEqual({ ok: true, id: 7, mode: 'token' });
  });

  it('tokenul de buget nu deschide un raport', () => {
    const token = createFirmaToken(
      presupuestoConfig,
      7,
      now,
      FIRMA_PURPOSE_PRESUPUESTO,
    );
    const decision = resolveFirmaAccess({
      token,
      requestedId: null,
      createdAt: null,
      config,
      now,
      purpose: FIRMA_PURPOSE_INFORME,
    });
    expect(decision.ok).toBe(false);
  });

  it('tokenul expirat și cel invalid sunt respinse', () => {
    const token = createFirmaToken(config, 7, now, FIRMA_PURPOSE_INFORME);
    const expired = resolveFirmaAccess({
      token,
      requestedId: 7,
      createdAt: null,
      config,
      now: new Date(now.getTime() + FIRMA_LINK_TTL_MS + 1000),
      purpose: FIRMA_PURPOSE_INFORME,
    });
    expect(expired).toEqual({ ok: false, reason: 'token-expired' });
    const invalid = resolveFirmaAccess({
      token: 'nu-este-token',
      requestedId: 7,
      createdAt: null,
      config,
      now,
      purpose: FIRMA_PURPOSE_INFORME,
    });
    expect(invalid).toEqual({ ok: false, reason: 'token-invalid' });
  });

  it('înainte de activare linkul vechi rămâne, iar după activare doar rapoartele create înainte', () => {
    const inactive = readInformeFirmaConfig({});
    expect(
      buildInformeFirmarUrl('https://app.example.com', 7, inactive, now),
    ).toBe('https://app.example.com/firmar-informe.html?id=7');
    expect(
      resolveFirmaAccess({
        token: null,
        requestedId: 7,
        createdAt: createdBefore,
        config,
        now,
        purpose: FIRMA_PURPOSE_INFORME,
      }).ok,
    ).toBe(true);
    const createdAfter = new Date('2026-02-01T00:00:00.000Z');
    expect(
      resolveFirmaAccess({
        token: null,
        requestedId: 7,
        createdAt: createdAfter,
        config,
        now,
        purpose: FIRMA_PURPOSE_INFORME,
      }),
    ).toEqual({ ok: false, reason: 'legacy-requires-token' });
  });
});
