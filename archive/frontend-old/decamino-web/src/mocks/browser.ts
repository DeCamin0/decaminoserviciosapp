/**
 * MSW Browser Setup
 * Mock Service Worker configuration for DEMO mode
 */

import { setupWorker } from 'msw/browser';

// Simple handlers for DEMO mode
const handlers = [
  // Basic login handler
  {
    url: 'https://n8n.decaminoservicios.com/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142',
    method: 'GET',
    response: () => {
      console.log('🎭 DEMO: Login request intercepted');
      
      // Return demo user
      return new Response(JSON.stringify([{
        "id": "demo_admin",
        "email": "admin@demo.com",
        "password": "123456",
        "NOMBRE / APELLIDOS": "Admin Demo",
        "CODIGO": "ADM001",
        "GRUPO": "Admin",
        "role": "ADMIN",
        "isManager": true,
        "centro": "Madrid",
        "telefono": "+34 600 000 001",
        "fechaAlta": "2024-01-01",
        "activo": true
      }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
];

// Setup MSW worker with simple handlers
export const worker = setupWorker(...handlers);
