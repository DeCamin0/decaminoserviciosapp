import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust proxy pentru a extrage corect IP-ul din headers
  // NestJS folosește Express sub hood, deci putem accesa instanța Express
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  // IMPORTANT: Skip body parsing for multipart/form-data
  // Express body parsers consume the stream, making it unavailable for multer
  app.use((req, res, next) => {
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      // Skip body parsing - multer will handle it in controller
      console.log('[Main] Skipping body parsing for FormData request');
      return next();
    }
    // For other content types, use normal body parsing
    next();
  });

  // Increase body size limit for file uploads
  app.use(json({ limit: '50mb' }));
  // Parse URL-encoded bodies
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Enable CORS for frontend communication
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173', // Vite default port
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-App-Source',
      'X-App-Version',
      'X-Client-Type',
    ],
  });

  const port = process.env.PORT || 3000;
  // În producție, ascultă pe 0.0.0.0 pentru a fi accesibil prin Traefik/reverse proxy
  // În development, poate rămâne pe localhost
  const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost');
  await app.listen(port, host);
  
  // URL-ul public pentru mesaje de log
  // În producție, folosește subdomeniul real (api.decaminoservicios.com)
  // În development, folosește localhost
  const publicUrl = process.env.API_URL || 
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
