export const INSECURE_JWT_SECRET = 'your-secret-key-change-in-production';

/** Refuză secretul public din cod. Nu impune lungimea, ca să nu oprească instanțele deja configurate. */
export function assertEmployeeJwtSecret(secret: string | undefined): string {
  const value = String(secret || '').trim();
  if (!value || value === INSECURE_JWT_SECRET) {
    throw new Error(
      'JWT_SECRET lipsește sau este valoarea publică implicită. Setează un secret propriu pentru această instanță.',
    );
  }
  return value;
}

const MIN_PORTAL_SECRET = 32;

/**
 * Secretul portalului este obligatoriu, separat de secretul angajaților.
 * Nu se mai derivează din JWT_SECRET.
 */
export function assertPortalJwtSecret(
  secret: string | undefined,
  employeeSecret: string,
): string {
  const value = String(secret || '').trim();
  const employee = String(employeeSecret || '').trim();
  if (!value || value === INSECURE_JWT_SECRET) {
    throw new Error(
      'JWT_PORTAL_SECRET lipsește. Setează un secret propriu al portalului, diferit de JWT_SECRET.',
    );
  }
  if (value.length < MIN_PORTAL_SECRET) {
    throw new Error(
      'JWT_PORTAL_SECRET trebuie să aibă cel puțin 32 de caractere.',
    );
  }
  if (value === employee || value === `${employee}::portal_client`) {
    throw new Error(
      'JWT_PORTAL_SECRET trebuie să fie diferit de secretul angajaților.',
    );
  }
  return value;
}
