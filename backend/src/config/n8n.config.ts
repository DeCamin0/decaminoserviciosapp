import { registerAs } from '@nestjs/config';

export default registerAs('n8n', () => ({
  baseUrl: process.env.N8N_BASE_URL || 'https://n8n.decaminoservicios.com',
  timeout: parseInt(process.env.N8N_TIMEOUT || '30000', 10),
  rateLimit: {
    maxBurst: parseInt(process.env.N8N_RATE_LIMIT_MAX_BURST || '10', 10),
    rps: parseInt(process.env.N8N_RATE_LIMIT_RPS || '5', 10),
    maxQueue: parseInt(process.env.N8N_RATE_LIMIT_MAX_QUEUE || '500', 10),
  },
  backoff: {
    baseMs: parseInt(process.env.N8N_BACKOFF_BASE_MS || '200', 10),
    maxRetries: parseInt(process.env.N8N_BACKOFF_MAX_RETRIES || '4', 10),
    jitterMs: parseInt(process.env.N8N_BACKOFF_JITTER_MS || '150', 10),
  },
}));
