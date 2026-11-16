import { extractJwtToken } from './jwt-query-token';

describe('jwt query token', () => {
  it('preferă Authorization și ignoră query-ul pe rutele obișnuite', () => {
    expect(
      extractJwtToken({
        authorizationHeader: 'Bearer header-token',
        queryToken: 'query-token',
        method: 'GET',
        path: '/api/empleados',
      }),
    ).toBe('header-token');
    expect(
      extractJwtToken({
        queryToken: 'query-token',
        method: 'GET',
        path: '/api/empleados',
      }),
    ).toBeNull();
    expect(
      extractJwtToken({
        queryToken: 'query-token',
        method: 'POST',
        path: '/api/pedidos-notas/imagenes/4/archivo',
      }),
    ).toBeNull();
  });

  it('acceptă tokenul din query doar la imaginea unei note de comandă', () => {
    expect(
      extractJwtToken({
        queryToken: 'img-token',
        method: 'GET',
        path: '/api/pedidos-notas/imagenes/12/archivo',
      }),
    ).toBe('img-token');
    expect(
      extractJwtToken({
        queryToken: 'img-token',
        method: 'get',
        path: '/api/pedidos-notas/imagenes/12/archivo?token=img-token',
      }),
    ).toBe('img-token');
  });
});
