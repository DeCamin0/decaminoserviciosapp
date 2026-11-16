import { decideRefreshSession, refreshTtlMs } from './refresh-session';

describe('refresh session', () => {
  const now = new Date('2026-11-10T10:00:00.000Z');
  const row = {
    userCodigo: 'E1',
    revokedAt: null,
    expiresAt: new Date('2026-11-17T10:00:00.000Z'),
  };

  it('citește 7d, 2h și 30m', () => {
    expect(refreshTtlMs('7d', 1)).toBe(7 * 24 * 60 * 60 * 1000);
    expect(refreshTtlMs('2h', 1)).toBe(2 * 60 * 60 * 1000);
    expect(refreshTtlMs('30m', 1)).toBe(30 * 60 * 1000);
    expect(refreshTtlMs('nope', 5)).toBe(5);
  });

  it('sesiunea activă a aceluiași angajat trece', () => {
    expect(
      decideRefreshSession({ sid: 'sid-1', userId: 'E1', session: row, now }),
    ).toEqual({ ok: true });
  });

  it('fără sid, revocată, expirată sau a altui angajat nu trece', () => {
    expect(
      decideRefreshSession({ sid: '', userId: 'E1', session: row, now }).ok,
    ).toBe(false);
    expect(
      decideRefreshSession({
        sid: 'sid-1',
        userId: 'E1',
        session: { ...row, revokedAt: now },
        now,
      }).ok,
    ).toBe(false);
    expect(
      decideRefreshSession({
        sid: 'sid-1',
        userId: 'E1',
        session: { ...row, expiresAt: now },
        now,
      }).ok,
    ).toBe(false);
    expect(
      decideRefreshSession({
        sid: 'sid-1',
        userId: 'E2',
        session: row,
        now,
      }).ok,
    ).toBe(false);
    expect(
      decideRefreshSession({
        sid: 'sid-1',
        userId: 'E1',
        session: null,
        now,
      }).ok,
    ).toBe(false);
  });
});
