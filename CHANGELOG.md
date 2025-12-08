# Changelog

## [Unreleased]

### Added
- **Backend Infrastructure**
  - NestJS backend initialized in `/backend`
  - n8n Proxy Service for incremental migration
  - Environment configuration module
  - Health check endpoint (`/health`)
  - CORS configuration for frontend communication
  
- **Frontend Integration**
  - Frontend configured to use backend proxy in development
  - All API requests route through `http://localhost:3000/api/n8n/*` in dev
  - Production still uses n8n directly (no breaking changes)

- **Proxy Features**
  - Query parameters forwarding
  - Request/response logging
  - Error handling for n8n responses
  - Header forwarding (excluding host, connection, etc.)

- **Real-time Notifications System (WebSocket + Push Notifications)**
  - **Backend:**
    - WebSocket Gateway (`NotificationsGateway`) pentru comunicare real-time cu Socket.io
    - Notifications Service cu funcții pentru trimitere notificări către utilizatori, grupuri și centre
    - Notifications Controller cu endpoint-uri REST API:
      - `GET /api/notifications` - Obține notificările utilizatorului
      - `GET /api/notifications/unread-count` - Număr notificări necitite
      - `PUT /api/notifications/:id/read` - Marchează notificare ca citită
      - `PUT /api/notifications/read-all` - Marchează toate ca citite
      - `DELETE /api/notifications/:id` - Șterge notificare
      - `POST /api/notifications/send` - Trimite notificare către utilizator (doar Developer/Supervisor/Manager)
      - `POST /api/notifications/test` - Endpoint de test pentru notificări
    - Notifications Entity cu coloane: `id`, `sender_id`, `user_id`, `type`, `title`, `message`, `read`, `data` (TEXT), `grupo`, `centro`, `created_at`, `read_at`
    - Migrații SQL pentru crearea tabelului `notifications`
    - Script Node.js pentru crearea automată a tabelului (`npm run db:create-notifications`)
    - Autentificare JWT pentru WebSocket connections
    - Autorizare: doar Developer, Supervisor, Manager și Admin pot trimite notificări
  
  - **Frontend:**
    - NotificationsContext pentru gestionarea stării notificărilor și conexiune WebSocket
    - NotificationsBell component pentru afișarea notificărilor și număr necitite
    - SendNotificationModal component pentru trimiterea notificărilor către angajați:
      - Selecție multiplă de angajați
      - Căutare angajați
      - Lista se închide automat după selecție
      - Chips pentru angajații selectați cu opțiune de ștergere
    - Push Notifications support:
      - `pushNotifications.js` utility pentru notificări native browser
      - Service Worker (`sw.js`) actualizat pentru push notifications
      - Request permission automat la login
      - Buton explicit pentru activarea notificărilor push
    - Sincronizare cu backend pentru mark as read, mark all as read, delete
    - Încărcare notificări la login din API
  
  - **Database:**
    - Tabel `notifications` cu coloana `data` de tip TEXT pentru JSON
    - Indexuri pe `user_id`, `sender_id`, `read`, `created_at`
    - Coloana `data` salvează JSON string cu metadate (senderId, recipientId, timestamp, source, etc.)
    - Coloana `data` poate fi NULL dacă nu există date suplimentare

### Changed
- `frontend/src/utils/routes.js` - Updated to use backend proxy in development
- All endpoints now use `getN8nUrl()` helper function
- `frontend/src/contexts/NotificationsContext.jsx` - Adăugat logica pentru push notifications și sincronizare cu backend
- `frontend/src/components/NotificationsBell.jsx` - Adăugat buton pentru activarea notificărilor push
- `frontend/src/pages/DashboardPage.jsx` - Adăugat buton "Enviar Notificación" pentru Developer/Manager
- `frontend/public/sw.js` - Adăugat event listeners pentru push notifications
- `backend/src/services/notifications.service.ts` - Logică pentru salvare `data` ca JSON string în coloană TEXT
- `backend/src/controllers/notifications.controller.ts` - Endpoint-uri pentru gestionarea notificărilor

### Technical Details
- Backend runs on `http://localhost:3000`
- Proxy endpoint: `http://localhost:3000/api/n8n/*`
- Development: Frontend → Backend Proxy → n8n
- Production: Frontend → n8n (direct)
- WebSocket server: `ws://localhost:3000` (same port as HTTP)
- Notifications table: `notifications` în baza de date MySQL/MariaDB
- Coloana `data` este de tip TEXT și salvează JSON string (poate fi NULL)
- Notificările se trimit simultan prin WebSocket (real-time) și se salvează în baza de date (persistență)

### Migration Strategy
- **Phase 1 (Current)**: Backend acts as proxy to n8n
- **Phase 2 (Next)**: Migrate endpoints one-by-one with real logic
- **Phase 3 (Future)**: Complete migration, n8n becomes optional

### Notes
- Sistemul de notificări este complet funcțional cu WebSocket real-time și push notifications native
- Notificările sunt persistate în baza de date pentru istoric
- Doar rolurile Developer, Supervisor, Manager și Admin pot trimite notificări
- Coloana `data` conține metadate JSON (senderId, recipientId, timestamp, source, etc.)
- Frontend-ul permite selecție multiplă de angajați pentru trimitere notificări
