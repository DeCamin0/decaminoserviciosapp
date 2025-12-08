import { registerAs } from '@nestjs/config';

export default registerAs('n8n', () => ({
  baseUrl: process.env.N8N_BASE_URL || 'https://n8n.decaminoservicios.com',
  timeout: parseInt(process.env.N8N_TIMEOUT || '30000', 10),
}));
