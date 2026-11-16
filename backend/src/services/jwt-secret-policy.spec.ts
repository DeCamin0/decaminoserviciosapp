import {
  INSECURE_JWT_SECRET,
  assertEmployeeJwtSecret,
  assertPortalJwtSecret,
} from './jwt-secret-policy';

describe('jwt secret policy', () => {
  it('respinge secretul lipsă și valoarea publică din cod', () => {
    expect(() => assertEmployeeJwtSecret(undefined)).toThrow(/JWT_SECRET/);
    expect(() => assertEmployeeJwtSecret('   ')).toThrow(/JWT_SECRET/);
    expect(() => assertEmployeeJwtSecret(INSECURE_JWT_SECRET)).toThrow(
      /JWT_SECRET/,
    );
  });

  it('păstrează un secret propriu, chiar dacă este mai scurt de 32 de caractere', () => {
    expect(assertEmployeeJwtSecret('secret-propriu-instanta')).toBe(
      'secret-propriu-instanta',
    );
  });

  it('secretul portalului este obligatoriu, lung și diferit de cel al angajaților', () => {
    const employee = 'secret-angajati-instanta-cu-peste-treizeci-caractere';
    expect(() => assertPortalJwtSecret(undefined, employee)).toThrow(
      /JWT_PORTAL_SECRET/,
    );
    expect(() => assertPortalJwtSecret('scurt', employee)).toThrow(/32/);
    expect(() => assertPortalJwtSecret(employee, employee)).toThrow(/diferit/);
    expect(() =>
      assertPortalJwtSecret(`${employee}::portal_client`, employee),
    ).toThrow(/diferit/);
    const portal = 'portal-secret-separat-cu-peste-treizeci-de-caractere';
    expect(assertPortalJwtSecret(portal, employee)).toBe(portal);
  });
});
