import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
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
  await app.listen(port);
  console.log(`🚀 NestJS Backend is running on: http://localhost:${port}`);
  console.log(`📡 n8n Proxy available at: http://localhost:${port}/api/n8n/*`);
}
bootstrap();
