import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  console.log('[database.config] Reading env vars:');
  console.log('  DB_HOST:', process.env.DB_HOST);
  console.log('  DB_NAME:', process.env.DB_NAME);
  console.log('  DB_USERNAME:', process.env.DB_USERNAME);

  return {
    type: process.env.DB_TYPE || 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'decaminoservicios',
    synchronize: process.env.DB_SYNC === 'true', // NEVER true in production!
    logging: process.env.DB_LOGGING === 'true',
  };
});
