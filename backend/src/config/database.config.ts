import { registerAs } from '@nestjs/config';

/** Fără fallback-uri: DB_* obligatorii în .env (local + producție). */
const req = (key: string): string => {
  const v = process.env[key];
  if (v === undefined || (key !== 'DB_PASSWORD' && String(v).trim() === '')) {
    throw new Error(
      `[database.config] Missing required env: ${key}. Add it in backend/.env (see .env.example).`,
    );
  }
  return v.trim();
};

export default registerAs('database', () => {
  const host = req('DB_HOST');
  const database = req('DB_NAME');
  const username = req('DB_USERNAME');
  const password = process.env.DB_PASSWORD ?? '';

  return {
    type: (process.env.DB_TYPE ?? 'mysql').trim(),
    host,
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    username,
    password,
    database,
    synchronize: process.env.DB_SYNC === 'true',
    logging: process.env.DB_LOGGING === 'true',
  };
});
