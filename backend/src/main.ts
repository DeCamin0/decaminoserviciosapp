import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Încarcă .env înainte de orice. HERA doar dacă ENV_FILE=.env.client2.local sau există sentinel (nu după PORT, ca să nu pornească ambele pe 3002).
const cwd = process.cwd();
const client2Sentinel = resolve(
  cwd,
  'node_modules',
  '.decamino-client2-active',
);
const sentinelExists = existsSync(client2Sentinel);
const wantClient2 =
  sentinelExists ||
  process.env.ENV_FILE === '.env.client2.local' ||
  process.env.ENV_FILE === '.env.hera.local';
const envFilePreferred = wantClient2
  ? (process.env.ENV_FILE || '.env.hera.local')
  : process.env.ENV_FILE || '.env.decamino.local';
const envFileFallback = wantClient2 ? '.env.client2.local' : '.env';
const envPathPreferred = resolve(cwd, envFilePreferred);
const envPathFallback = resolve(cwd, envFileFallback);
const envPathResolved = existsSync(envPathPreferred)
  ? envPathPreferred
  : envPathFallback;
const envFileResolved = existsSync(envPathPreferred)
  ? envFilePreferred
  : envFileFallback;
if (wantClient2 && !existsSync(envPathResolved)) {
  console.error(
    '[Main] HERA (client2) requested but missing file:',
    envPathPreferred,
    'or',
    envPathFallback,
  );
  process.exit(1);
}
// Obligatoriu: setăm ENV_FILE ca ConfigModule să încarce ACELAȘI fișier
if (wantClient2) {
  process.env.ENV_FILE = envFileResolved;
  process.env.PORT = '3002';
} else {
  process.env.PORT = process.env.PORT || '3000';
}
process.env.ENV_FILE = envFileResolved;
loadEnv({ path: envPathResolved });
import { validateEnv } from './env.validation';
validateEnv();
const dbName = process.env.DB_NAME || '(not set)';
const clientLabel = wantClient2
  ? 'HERA (client 2)'
  : 'DeCamino (client 1 – principal)';
const port = process.env.PORT || '3000';
console.log(
  '[Main]',
  clientLabel,
  '| Env:',
  envPathResolved,
  '| DB_NAME:',
  dbName,
  '| Port:',
  port,
);
if (wantClient2 && dbName !== 'hera_facility_db') {
  console.error(
    '[Main] EROARE: HERA trebuie să folosească hera_facility_db, nu',
    dbName,
  );
  process.exit(1);
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { TelegramService } from './services/telegram.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global exception filter pentru alerting Telegram
  // Obținem instanța TelegramService din context
  const telegramService = app.get(TelegramService);
  app.useGlobalFilters(new GlobalExceptionFilter(telegramService));

  // Trust proxy pentru a extrage corect IP-ul din headers
  // NestJS folosește Express sub hood, deci putem accesa instanța Express
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  // Handler explicit pentru OPTIONS requests (preflight) - TREBUIE să fie PRIMUL
  // Asigură că OPTIONS requests sunt procesate corect înainte de orice alt middleware
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin;
      console.log(`[Main] OPTIONS preflight request from origin: ${origin}`);

      // Multi-client: doar din env. În producție CORS_ORIGINS obligatoriu.
      const corsOriginsEnv =
        process.env.CORS_ORIGINS || process.env.CORS_ORIGIN;
      const corsOrigins = corsOriginsEnv?.trim()
        ? corsOriginsEnv
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : process.env.NODE_ENV === 'production'
          ? []
          : ['http://localhost:5173'];

      const uniqueCorsOrigins = [...new Set(corsOrigins)];
      const isAllowed =
        !origin ||
        uniqueCorsOrigins.includes(origin) ||
        process.env.NODE_ENV !== 'production';

      console.log(
        `[Main] OPTIONS check - origin: ${origin}, allowed origins: ${uniqueCorsOrigins.join(', ')}, isAllowed: ${isAllowed}`,
      );

      if (isAllowed) {
        res.header('Access-Control-Allow-Origin', origin || '*');
        res.header(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        );
        res.header(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, X-App-Source, X-App-Version, X-Client-Type',
        );
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Max-Age', '3600');
        console.log(
          `[Main] ✅ OPTIONS preflight allowed for origin: ${origin}`,
        );
        return res.status(204).send();
      } else {
        console.log(
          `[Main] ❌ OPTIONS preflight blocked for origin: ${origin} (not in: ${uniqueCorsOrigins.join(', ')})`,
        );
        return res.status(403).send('CORS not allowed');
      }
    }
    next();
  });

  // IMPORTANT: Skip body parsing for multipart/form-data
  // Express body parsers consume the stream, making it unavailable for multer
  // Trebuie să fie ÎNAINTE de json() și urlencoded() middleware-uri
  app.use((req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    const contentLength = req.headers['content-length'];
    // Verifică dacă este multipart/form-data (poate include boundary)
    if (contentType.toLowerCase().includes('multipart/form-data')) {
      // Skip body parsing - multer will handle it in controller
      console.log(
        `[Main] Skipping body parsing for FormData request (Content-Type: ${contentType.substring(0, 50)}, Content-Length: ${contentLength || 'unknown'})`,
      );
      return next();
    }
    // For other content types, use normal body parsing
    next();
  });

  // Error handler pentru multer errors (file size exceeded, etc.)
  app.use((error: any, req: any, res: any, next: any) => {
    if (error && error.code === 'LIMIT_FILE_SIZE') {
      console.error(
        `[Main] Multer error - File size exceeded: ${error.message}`,
      );
      return res.status(413).json({
        success: false,
        message: 'El archivo es demasiado grande. Tamaño máximo: 50MB',
        error: 'FILE_TOO_LARGE',
      });
    }
    if (error && error.message && error.message.includes('File too large')) {
      console.error(`[Main] File too large error: ${error.message}`);
      return res.status(413).json({
        success: false,
        message: 'El archivo es demasiado grande. Tamaño máximo: 50MB',
        error: 'FILE_TOO_LARGE',
      });
    }
    next(error);
  });

  // Increase body size limit for file uploads and folder ingestion (base64 content can be large)
  // Base64 encoding increases size by ~33%, so for multiple large files we need a high limit
  // For folder ingestion with many files, we may need up to 500MB
  app.use(json({ limit: '500mb' }));
  // Parse URL-encoded bodies
  app.use(urlencoded({ extended: true, limit: '500mb' }));

  // Enable CORS – multi-client: doar din env. În producție setați CORS_ORIGINS.
  const corsOriginsEnv = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN;
  const corsOrigins = corsOriginsEnv?.trim()
    ? corsOriginsEnv
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:5173'];

  // Elimină duplicate-urile
  const uniqueCorsOrigins = [...new Set(corsOrigins)];

  app.enableCors({
    origin: (origin, callback) => {
      // Permite requests fără origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      // Verifică dacă origin-ul este în lista de origins permise
      if (uniqueCorsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // În development, permite orice origin pentru debugging
        if (process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-App-Source',
      'X-App-Version',
      'X-Client-Type',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Middleware pentru a adăuga header-urile CORS la toate răspunsurile
  // (asigură că header-urile sunt setate chiar dacă enableCors nu funcționează corect)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isAllowedOrigin = origin && uniqueCorsOrigins.includes(origin);
    const isDevelopment = process.env.NODE_ENV !== 'production';

    // Log pentru debugging CORS (doar pentru POST/PUT pentru a nu încărca log-urile)
    if (
      (req.method === 'POST' || req.method === 'PUT') &&
      req.path.includes('/comunicados')
    ) {
      console.log(
        `[Main] CORS middleware - Method: ${req.method}, Path: ${req.path}, Origin: ${origin || 'none'}, Allowed: ${isAllowedOrigin || isDevelopment}`,
      );
    }

    // Setează header-urile CORS pentru toate request-urile (nu doar OPTIONS)
    if (origin) {
      // Verifică dacă origin-ul este permis SAU suntem în development
      if (isAllowedOrigin || isDevelopment) {
        // Setează ÎNTOTDEAUNA header-urile CORS pentru origin-urile permise
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        if (
          (req.method === 'POST' || req.method === 'PUT') &&
          req.path.includes('/comunicados')
        ) {
          console.log(`[Main] ✅ CORS header set for origin: ${origin}`);
        }
      } else {
        if (
          (req.method === 'POST' || req.method === 'PUT') &&
          req.path.includes('/comunicados')
        ) {
          console.log(
            `[Main] ❌ CORS blocked for origin: ${origin} (not in: ${uniqueCorsOrigins.join(', ')})`,
          );
        }
      }
      // Setează ÎNTOTDEAUNA metodele și header-urile permise (chiar dacă origin-ul nu este permis)
      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      );
      res.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-App-Source, X-App-Version, X-Client-Type',
      );
      res.header('Access-Control-Expose-Headers', 'Content-Disposition');
    } else {
      // Pentru requests fără origin (mobile apps, etc.)
      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      );
      res.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-App-Source, X-App-Version, X-Client-Type',
      );
      res.header('Access-Control-Expose-Headers', 'Content-Disposition');
    }
    next();
  });

  const port = process.env.PORT || 3000;
  // În producție, ascultă pe 0.0.0.0 pentru a fi accesibil prin Traefik/reverse proxy
  // În development, poate rămâne pe localhost
  const host =
    process.env.HOST ||
    (process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost');
  await app.listen(port, host);

  // URL public pentru log – multi-client: doar din env. În producție setați API_URL.
  const publicUrl =
    (process.env.API_URL || '').trim() ||
    (process.env.NODE_ENV === 'production' ? '' : `http://${host}:${port}`);

  console.log(`🚀 NestJS Backend is running on: ${publicUrl}`);
  console.log(`📡 n8n Proxy available at: ${publicUrl}/api/n8n/*`);
  if (host === '0.0.0.0') {
    console.log(`   (Listening on ${host}:${port} - accessible via Traefik)`);
  }
}
bootstrap();
