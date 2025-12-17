import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust proxy pentru a extrage corect IP-ul din headers
  // NestJS folosește Express sub hood, deci putem accesa instanța Express
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  // Handler explicit pentru OPTIONS requests (preflight) - TREBUIE să fie PRIMUL
  // Asigură că OPTIONS requests sunt procesate corect înainte de orice alt middleware
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      console.log(`[Main] OPTIONS preflight request from origin: ${req.headers.origin}`);
      const origin = req.headers.origin;
      // Verifică dacă origin-ul este permis (folosim aceeași logică ca în CORS config)
      const defaultOrigins = [
        'http://localhost:5173',
        'https://app.decaminoservicios.com',
        'https://decaminoservicios.com',
      ];
      const corsOrigins = process.env.CORS_ORIGIN
        ? [
            ...process.env.CORS_ORIGIN.split(',').map((o) => o.trim()),
            'https://app.decaminoservicios.com',
            'https://decaminoservicios.com',
          ]
        : defaultOrigins;
      const uniqueCorsOrigins = [...new Set(corsOrigins)];

      if (!origin || uniqueCorsOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        res.header('Access-Control-Allow-Origin', origin || '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-App-Source, X-App-Version, X-Client-Type');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Max-Age', '3600');
        console.log(`[Main] OPTIONS preflight allowed for origin: ${origin}`);
        return res.status(204).send();
      } else {
        console.log(`[Main] OPTIONS preflight blocked for origin: ${origin}`);
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
      console.log(`[Main] Skipping body parsing for FormData request (Content-Type: ${contentType.substring(0, 50)}, Content-Length: ${contentLength || 'unknown'})`);
      return next();
    }
    // For other content types, use normal body parsing
    next();
  });

  // Error handler pentru multer errors (file size exceeded, etc.)
  app.use((error: any, req: any, res: any, next: any) => {
    if (error && error.code === 'LIMIT_FILE_SIZE') {
      console.error(`[Main] Multer error - File size exceeded: ${error.message}`);
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

  // Increase body size limit for file uploads
  app.use(json({ limit: '50mb' }));
  // Parse URL-encoded bodies
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Enable CORS for frontend communication
  // Suport pentru multiple origins (development și producție)
  const defaultOrigins = [
    'http://localhost:5173',
    'https://app.decaminoservicios.com',
    'https://decaminoservicios.com',
  ];
  
  const corsOrigins = process.env.CORS_ORIGIN
    ? [
        ...process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
        // Adaugă întotdeauna origins-urile default pentru siguranță
        'https://app.decaminoservicios.com',
        'https://decaminoservicios.com',
      ]
    : defaultOrigins;
  
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
    // Setează header-urile CORS pentru toate request-urile (nu doar OPTIONS)
    if (origin) {
      // Verifică dacă origin-ul este permis
      if (uniqueCorsOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
      } else if (process.env.NODE_ENV !== 'production') {
        // În development, permite orice origin
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
      }
      // Setează întotdeauna metodele și header-urile permise
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-App-Source, X-App-Version, X-Client-Type');
    } else {
      // Pentru requests fără origin (mobile apps, etc.)
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-App-Source, X-App-Version, X-Client-Type');
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

  // URL-ul public pentru mesaje de log
  // În producție, folosește subdomeniul real (api.decaminoservicios.com)
  // În development, folosește localhost
  const publicUrl =
    process.env.API_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://api.decaminoservicios.com'
      : `http://${host}:${port}`);

  console.log(`🚀 NestJS Backend is running on: ${publicUrl}`);
  console.log(`📡 n8n Proxy available at: ${publicUrl}/api/n8n/*`);
  if (host === '0.0.0.0') {
    console.log(`   (Listening on ${host}:${port} - accessible via Traefik)`);
  }
}
bootstrap();
