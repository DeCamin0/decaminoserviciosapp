import { decideJwtAccess } from './jwt-access-policy';

describe('jwt access policy', () => {
  const base = {
    lookupFailed: false,
    userFound: true,
    tokenAuthVersion: 2,
    storedAuthVersion: 2,
    estado: 'ACTIVO',
    impersonation: false,
  };

  it('acceptă tokenul când utilizatorul există și versiunea coincide', () => {
    expect(decideJwtAccess(base)).toEqual({ ok: true });
  });

  it('respinge utilizatorul șters', () => {
    expect(decideJwtAccess({ ...base, userFound: false }).ok).toBe(false);
    expect(decideJwtAccess({ ...base, userFound: false })).toMatchObject({
      reason: 'missing-user',
    });
  });

  it('respinge tokenul invalidat de schimbarea parolei', () => {
    expect(decideJwtAccess({ ...base, storedAuthVersion: 3 })).toMatchObject({
      reason: 'version-mismatch',
    });
  });

  it('respinge contul inactiv, dar păstrează impersonarea de suport', () => {
    expect(decideJwtAccess({ ...base, estado: 'INACTIVO' })).toMatchObject({
      reason: 'inactive',
    });
    expect(
      decideJwtAccess({ ...base, estado: 'INACTIVO', impersonation: true }),
    ).toEqual({ ok: true });
    expect(decideJwtAccess({ ...base, estado: '' })).toEqual({ ok: true });
  });

  it('o eroare la verificare nu lasă tokenul să treacă', () => {
    expect(decideJwtAccess({ ...base, lookupFailed: true })).toMatchObject({
      reason: 'lookup-failed',
    });
  });
});
