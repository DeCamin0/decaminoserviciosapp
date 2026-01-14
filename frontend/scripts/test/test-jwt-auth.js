#!/usr/bin/env node

// Script de test pentru middleware-ul de autentificare JWT
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'decamino-secret-key-2024';

// Generează un token de test
const testUser = {
  CODIGO: 'TEST001',
  email: 'test@decamino.com',
  GRUPO: 'Developer',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 ore
};

const validToken = jwt.sign(testUser, JWT_SECRET);
const invalidToken = 'invalid.token.here';

console.log('🔑 JWT Token de test generat:');
console.log('=====================================');
console.log('Token valid:', validToken);
console.log('');
console.log('Token invalid:', invalidToken);
console.log('');
console.log('📋 Instrucțiuni de testare:');
console.log('=====================================');
console.log('');
console.log('1. Pornește proxy server-ul:');
console.log('   npm run proxy');
console.log('');
console.log('2. Testează fără token (ar trebui să returneze 401):');
console.log('   curl -X GET http://localhost:3001/webhook/health');
console.log('');
console.log('3. Testează cu token invalid (ar trebui să returneze 401):');
console.log(`   curl -X GET http://localhost:3001/webhook/health -H "Authorization: Bearer ${invalidToken}"`);
console.log('');
console.log('4. Testează cu token valid (ar trebui să treacă prin proxy):');
console.log(`   curl -X GET http://localhost:3001/webhook/health -H "Authorization: Bearer ${validToken}"`);
console.log('');
console.log('5. Testează health check endpoint (nu necesită autentificare):');
console.log('   curl -X GET http://localhost:3001/health');
console.log('');
console.log('🎯 Rezultate așteptate:');
console.log('=====================================');
console.log('• Fără token: 401 Unauthorized');
console.log('• Token invalid: 401 Unauthorized');
console.log('• Token valid: 200 OK sau răspuns de la n8n');
console.log('• Health check: 200 OK');
