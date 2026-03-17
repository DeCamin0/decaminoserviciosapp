import { z } from 'zod';

/**
 * Schema Zod pentru variabilele de mediu obligatorii la startup.
 * Aruncă cu mesaj clar (inclusiv path-ul fiecărei erori) dacă lipsește sau e invalid ceva.
 */
const envSchema = z.object({
  DB_HOST: z.string().min(1, 'DB_HOST este obligatoriu (backend/.env sau .env.decamino.local / .env.hera.local)'),
  DB_NAME: z.string().min(1, 'DB_NAME este obligatoriu'),
  DB_USERNAME: z.string().min(1, 'DB_USERNAME este obligatoriu'),
  COMPANY_LEGAL_NAME: z.string().min(1, 'COMPANY_LEGAL_NAME este obligatoriu'),
  COMPANY_LEGAL_NAME_SHORT: z.string().min(1, 'COMPANY_LEGAL_NAME_SHORT este obligatoriu'),
  COMPANY_ADDRESS_LINE1: z.string().min(1, 'COMPANY_ADDRESS_LINE1 este obligatoriu'),
  COMPANY_CIF: z.string().min(1, 'COMPANY_CIF este obligatoriu'),
  COMPANY_EMAIL: z.string().min(1, 'COMPANY_EMAIL este obligatoriu'),
  FRONTEND_APP_URL: z.string().min(1, 'FRONTEND_APP_URL este obligatoriu'),
});

export function validateEnv(): void {
  const raw = {
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    DB_USERNAME: process.env.DB_USERNAME,
    COMPANY_LEGAL_NAME: process.env.COMPANY_LEGAL_NAME,
    COMPANY_LEGAL_NAME_SHORT: process.env.COMPANY_LEGAL_NAME_SHORT,
    COMPANY_ADDRESS_LINE1: process.env.COMPANY_ADDRESS_LINE1,
    COMPANY_CIF: process.env.COMPANY_CIF,
    COMPANY_EMAIL: process.env.COMPANY_EMAIL,
    FRONTEND_APP_URL: process.env.FRONTEND_APP_URL,
  };

  const result = envSchema.safeParse(raw);

  if (result.success) return;

  const err = result.error;
  const lines: string[] = [
    '[env.validation] Lipsesc sau sunt invalide variabile de mediu obligatorii:',
    '',
    ...err.errors.map(
      (e) => `  - ${e.path.join('.')}: ${e.message}`,
    ),
    '',
    'Completează backend/.env sau .env.decamino.local / .env.hera.local (vezi .env.example).',
  ];
  const msg = lines.join('\n');
  console.error(msg);
  throw new Error(msg);
}
