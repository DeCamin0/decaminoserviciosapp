import { buildUniqueCorsOrigins, isCorsOriginAllowed } from './cors-origins';

describe('cors origins', () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env = { ...previous };
  });

  it('includes the app origin next to the explicit list', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://app.decaminoservicios.com';
    process.env.FRONTEND_APP_URL = 'https://app.herafs.com/inicio';
    process.env.FRONTEND_URL = 'https://decaminoservicios.com';

    expect(buildUniqueCorsOrigins()).toEqual([
      'https://app.decaminoservicios.com',
      'https://app.herafs.com',
      'https://decaminoservicios.com',
    ]);
    expect(isCorsOriginAllowed('https://app.herafs.com')).toBe(true);
    expect(isCorsOriginAllowed('https://evil.example')).toBe(false);
  });
});
