import {
  FIRMA_LINK_TTL_MS,
  buildPresupuestoFirmarUrl,
  createFirmaToken,
  readPresupuestoFirmaConfig,
  resolveFirmaAccess,
  verifyFirmaToken,
} from './presupuesto-firma-access';

const DAY = 24 * 60 * 60 * 1000;

const decamino = readPresupuestoFirmaConfig({
  PRESUPUESTO_FIRMA_SECRET: 'decamino-secret-valoare-lunga-32b-aaaa',
  PRESUPUESTO_FIRMA_INSTANCE: 'decamino',
  PRESUPUESTO_FIRMA_ACTIVATED_AT: '2026-01-01T00:00:00.000Z',
});

const heraSameSecret = readPresupuestoFirmaConfig({
  PRESUPUESTO_FIRMA_SECRET: 'decamino-secret-valoare-lunga-32b-aaaa',
  PRESUPUESTO_FIRMA_INSTANCE: 'hera',
  PRESUPUESTO_FIRMA_ACTIVATED_AT: '2026-01-01T00:00:00.000Z',
});

const heraOtherSecret = readPresupuestoFirmaConfig({
  PRESUPUESTO_FIRMA_SECRET: 'hera-secret-complet-diferit-32-bytes-bb',
  PRESUPUESTO_FIRMA_INSTANCE: 'hera',
  PRESUPUESTO_FIRMA_ACTIVATED_AT: '2026-01-01T00:00:00.000Z',
});

const activatedAt = new Date('2026-01-01T00:00:00.000Z');
const oldRow = new Date('2025-06-01T00:00:00.000Z');
const newRow = new Date('2026-02-01T00:00:00.000Z');

describe('presupuesto firma access', () => {
  it('tokenul valid deschide bugetul timp de 90 de zile și nu pune id-ul în URL', () => {
    const issued = new Date('2026-03-01T00:00:00.000Z');
    const url = buildPresupuestoFirmarUrl(
      'https://app.example.com/',
      42,
      decamino,
      issued,
    );
    const token = new URL(url).searchParams.get('t') || '';
    expect(new URL(url).searchParams.get('id')).toBeNull();
    expect(url).not.toContain('id=42');
    const verified = verifyFirmaToken(
      token,
      decamino,
      new Date(issued.getTime() + 89 * DAY),
    );
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.id).toBe(42);
  });

  it('tokenul expirat este respins și nu cade pe linkul vechi', () => {
    const issued = new Date('2026-03-01T00:00:00.000Z');
    const token = createFirmaToken(decamino, 42, issued);
    const decision = resolveFirmaAccess({
      token,
      requestedId: 42,
      createdAt: oldRow,
      config: decamino,
      now: new Date(issued.getTime() + FIRMA_LINK_TTL_MS),
    });
    expect(decision).toEqual({ ok: false, reason: 'token-expired' });
  });

  it('tokenul invalid sau modificat este respins chiar dacă bugetul este vechi', () => {
    const token = createFirmaToken(decamino, 42, activatedAt);
    const tampered = `${token.slice(0, -2)}aa`;
    const decision = resolveFirmaAccess({
      token: tampered,
      requestedId: 42,
      createdAt: oldRow,
      config: decamino,
      now: new Date('2026-03-01T00:00:00.000Z'),
    });
    expect(decision).toMatchObject({ ok: false, reason: 'token-invalid' });

    const empty = resolveFirmaAccess({
      token: '',
      requestedId: 42,
      createdAt: oldRow,
      config: decamino,
      now: new Date('2026-03-01T00:00:00.000Z'),
    });
    expect(empty).toEqual({ ok: false, reason: 'token-invalid' });
  });

  it('un token emis pentru DeCamino nu este acceptat de Hera, nici cu același secret', () => {
    const token = createFirmaToken(
      decamino,
      42,
      new Date('2026-03-01T00:00:00.000Z'),
    );
    const sameSecret = verifyFirmaToken(
      token,
      heraSameSecret,
      new Date('2026-03-02T00:00:00.000Z'),
    );
    const otherSecret = verifyFirmaToken(
      token,
      heraOtherSecret,
      new Date('2026-03-02T00:00:00.000Z'),
    );
    expect(sameSecret).toEqual({ ok: false, reason: 'token-invalid' });
    expect(otherSecret).toEqual({ ok: false, reason: 'token-invalid' });
  });

  it('tokenul unui buget nu deschide alt id trimis lângă el', () => {
    const token = createFirmaToken(
      decamino,
      42,
      new Date('2026-03-01T00:00:00.000Z'),
    );
    const decision = resolveFirmaAccess({
      token,
      requestedId: 7,
      createdAt: oldRow,
      config: decamino,
      now: new Date('2026-03-02T00:00:00.000Z'),
    });
    expect(decision).toEqual({ ok: false, reason: 'token-mismatch' });
  });

  it('linkul vechi rămâne valabil pentru un buget creat înainte de activare, în cele 90 de zile', () => {
    const decision = resolveFirmaAccess({
      token: null,
      requestedId: 42,
      createdAt: oldRow,
      config: decamino,
      now: new Date(activatedAt.getTime() + 90 * DAY - 1),
    });
    expect(decision).toEqual({ ok: true, id: 42, mode: 'legacy' });
  });

  it('linkul vechi se închide la 90 de zile de la activarea de pe server', () => {
    const decision = resolveFirmaAccess({
      token: null,
      requestedId: 42,
      createdAt: oldRow,
      config: decamino,
      now: new Date(activatedAt.getTime() + FIRMA_LINK_TTL_MS),
    });
    expect(decision).toEqual({ ok: false, reason: 'legacy-expired' });
  });

  it('un buget creat după activare nu poate fi deschis doar cu id-ul', () => {
    const decision = resolveFirmaAccess({
      token: null,
      requestedId: 99,
      createdAt: newRow,
      config: decamino,
      now: new Date('2026-02-02T00:00:00.000Z'),
    });
    expect(decision).toEqual({
      ok: false,
      reason: 'legacy-requires-token',
    });
  });

  it('înainte de data de activare, linkul cu id rămâne cel de acum', () => {
    const inactive = readPresupuestoFirmaConfig({});
    const url = buildPresupuestoFirmarUrl(
      'https://app.example.com',
      42,
      inactive,
      new Date('2026-11-09T00:00:00.000Z'),
    );
    expect(url).toBe('https://app.example.com/firmar.html?id=42');
    const decision = resolveFirmaAccess({
      token: null,
      requestedId: 42,
      createdAt: new Date('2026-11-09T00:00:00.000Z'),
      config: inactive,
      now: new Date('2026-11-09T00:00:00.000Z'),
    });
    expect(decision).toEqual({ ok: true, id: 42, mode: 'legacy' });
  });

  it('nu există secret implicit, iar un secret scurt nu emite tokenuri', () => {
    const config = readPresupuestoFirmaConfig({
      PRESUPUESTO_FIRMA_ACTIVATED_AT: '2026-01-01T00:00:00.000Z',
      PRESUPUESTO_FIRMA_SECRET: 'scurt',
      PRESUPUESTO_FIRMA_INSTANCE: 'decamino',
    });
    expect(config.secret).toBeNull();
    expect(config.mintError).toBeTruthy();
    expect(() =>
      buildPresupuestoFirmarUrl(
        'https://app.example.com',
        42,
        config,
        activatedAt,
      ),
    ).toThrow(/PRESUPUESTO_FIRMA_SECRET/);
  });
});
