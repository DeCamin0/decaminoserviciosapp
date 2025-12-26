// Proxy server para resolver problemas de CORS en producción
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 3001;

// JWT Secret - în producție ar trebui să fie în variabile de mediu
const JWT_SECRET = process.env.JWT_SECRET || 'decamino-secret-key-2024';

// Middleware de autentificare
const authMiddleware = (req, res, next) => {
  try {
    // Extrage token-ul din header-ul Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log('❌ No authorization header provided');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authorization header is required'
      });
    }

    // Verifică dacă header-ul are formatul corect "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.log('❌ Invalid authorization header format');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authorization header must be in format "Bearer <token>"'
      });
    }

    const token = parts[1];

    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Token is required'
      });
    }

    // Verifică și decodifică token-ul JWT
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token valid for user:', decoded.email || decoded.CODIGO || 'unknown');
      
      // Adaugă informațiile utilizatorului în request pentru a fi disponibile în middleware-urile următoare
      req.user = decoded;
      next();
    } catch (jwtError) {
      console.log('❌ Invalid token:', jwtError.message);
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Authentication service error'
    });
  }
};

// Configurar CORS
app.use(cors({
  origin: ['https://decaminoservicios.com', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Middleware para manejar preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Proxy para webhooks de n8n cu middleware de autentificare
app.use('/webhook', authMiddleware, createProxyMiddleware({
  target: 'https://n8n.decaminoservicios.com',
  changeOrigin: true,
  secure: true,
  timeout: 30000,
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy error', details: err.message });
  },
  onProxyReq: (proxyReq, req) => {
    console.log('Proxying request:', req.method, req.url);
  },
  onProxyRes: (proxyRes, req) => {
    console.log('Proxy response:', proxyRes.statusCode, req.url);
    // Asegurar headers CORS
    proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Proxying requests to: https://n8n.decaminoservicios.com`);
});
