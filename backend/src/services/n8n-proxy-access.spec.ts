import { n8nForwardHeaders, n8nProxyRequiresSession } from './n8n-proxy-access';

describe('n8n proxy access', () => {
  it('cere sesiune pentru orice apel către proxy', () => {
    expect(n8nProxyRequiresSession()).toBe(true);
  });

  it('nu înaintează tokenul sau cookie-ul către n8n', () => {
    const forward = n8nForwardHeaders({
      Authorization: 'Bearer secret-token',
      cookie: 'session=1',
      host: 'api.local',
      'content-length': '10',
      'content-type': 'application/json',
      'x-app-source': 'DeCamino-Web-App',
    });
    expect(forward).toEqual({
      'content-type': 'application/json',
      'x-app-source': 'DeCamino-Web-App',
    });
  });

  it('un apel fără headere rămâne un corp gol de headere', () => {
    expect(n8nForwardHeaders(undefined)).toEqual({});
  });
});
