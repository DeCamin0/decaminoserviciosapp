import { z } from 'zod';

/**
 * Schema Zod pentru variabilele de mediu obligatorii la startup.
 * Aruncă cu mesaj clar dacă lipsește sau e invalid ceva.
 * Acceptă și nume vechi din .env (COMPANY_ADDRESS, COMPANY_LEGAL_NAME din COMPANY_NAME etc.).
 */
const envSchema = z.object({
  DB_HOST: z.string().min(1, 'DB_HOST este obligatoriu'),
  DB_NAME: z.string().min(1, 'DB_NAME este obligatoriu'),
  DB_USERNAME: z.string().min(1, 'DB_USERNAME este obligatoriu'),
  COMPANY_LEGAL_NAME: z
    .string()
    .min(1, 'COMPANY_LEGAL_NAME sau COMPANY_NAME este obligatoriu'),
  COMPANY_LEGAL_NAME_SHORT: z
    .string()
    .min(1, 'COMPANY_LEGAL_NAME_SHORT este obligatoriu'),
  COMPANY_ADDRESS_LINE1: z
    .string()
    .min(1, 'COMPANY_ADDRESS_LINE1 sau COMPANY_ADDRESS este obligatoriu'),
  COMPANY_CIF: z.string().min(1, 'COMPANY_CIF este obligatoriu'),
  COMPANY_EMAIL: z.string().min(1, 'COMPANY_EMAIL este obligatoriu'),
  FRONTEND_APP_URL: z.string().min(1, 'FRONTEND_APP_URL este obligatoriu'),
});

export function validateEnv(): void {
  // Fallback la nume vechi din .env (VPS poate avea COMPANY_ADDRESS, nu COMPANY_ADDRESS_LINE1; etc.)
  const raw = {
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    DB_USERNAME: process.env.DB_USERNAME,
    COMPANY_LEGAL_NAME:
      process.env.COMPANY_LEGAL_NAME || process.env.COMPANY_NAME,
    COMPANY_LEGAL_NAME_SHORT:
      process.env.COMPANY_LEGAL_NAME_SHORT ||
      process.env.COMPANY_LEGAL_NAME ||
      process.env.COMPANY_NAME,
    COMPANY_ADDRESS_LINE1:
      process.env.COMPANY_ADDRESS_LINE1 || process.env.COMPANY_ADDRESS || '',
    COMPANY_CIF: process.env.COMPANY_CIF,
    COMPANY_EMAIL: process.env.COMPANY_EMAIL,
    FRONTEND_APP_URL:
      process.env.FRONTEND_APP_URL ||
      process.env.APP_URL ||
      process.env.CORS_ORIGIN ||
      '',
  };

  const result = envSchema.safeParse(raw);

  if (result.success) {
    // Normalizează pentru restul app: pune COMPANY_ADDRESS_LINE1 dacă lipsea dar exista COMPANY_ADDRESS
    if (!process.env.COMPANY_ADDRESS_LINE1 && process.env.COMPANY_ADDRESS) {
      process.env.COMPANY_ADDRESS_LINE1 = process.env.COMPANY_ADDRESS;
    }
    if (!process.env.COMPANY_LEGAL_NAME && process.env.COMPANY_NAME) {
      process.env.COMPANY_LEGAL_NAME = process.env.COMPANY_NAME;
    }
    if (
      !process.env.COMPANY_LEGAL_NAME_SHORT &&
      (process.env.COMPANY_LEGAL_NAME || process.env.COMPANY_NAME)
    ) {
      process.env.COMPANY_LEGAL_NAME_SHORT =
        process.env.COMPANY_LEGAL_NAME || process.env.COMPANY_NAME || '';
    }
    if (
      !process.env.FRONTEND_APP_URL &&
      (process.env.APP_URL || process.env.CORS_ORIGIN)
    ) {
      process.env.FRONTEND_APP_URL =
        process.env.APP_URL || process.env.CORS_ORIGIN || '';
    }
    return;
  }

  const err = result.error;
  const lines: string[] = [
    '[env.validation] Lipsesc sau sunt invalide variabile de mediu obligatorii:',
    '',
    ...err.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`),
    '',
    'Completează backend/.env sau .env.decamino.local / .env.hera.local (vezi .env.example).',
  ];
  const msg = lines.join('\n');
  console.error(msg);
  throw new Error(msg);
}
