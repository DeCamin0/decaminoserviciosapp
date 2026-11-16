import { publicDbHealthBody, publicHealthBody } from './public-health-body';

describe('public health body', () => {
  it('nu publică adresa n8n', () => {
    const body = publicHealthBody(new Date('2026-11-09T12:00:00.000Z'));
    expect(body).toEqual({
      status: 'ok',
      timestamp: '2026-11-09T12:00:00.000Z',
    });
    expect(body).not.toHaveProperty('n8nBaseUrl');
  });

  it('nu publică hostul, numele bazei sau mesajul de eroare SQL', () => {
    expect(publicDbHealthBody({ ok: true, latencyMs: 12 })).toEqual({
      ok: true,
      latencyMs: 12,
    });
    expect(publicDbHealthBody({ ok: false, latencyMs: 4 })).toEqual({
      ok: false,
    });
  });
});
