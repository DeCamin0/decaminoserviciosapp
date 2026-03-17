# Raport: Environment variables – DECAMINO & HERA

## Fișiere create/modificate

### Backend
- **backend/.env.example** – rescris: structură cu secțiuni (# === COMMON ===, # === TELEGRAM ===, etc.), doar chei fără valori reale.
- **backend/src/env.validation.ts** – nou: validare la startup cu **Zod** pentru variabile obligatorii (DB_HOST, DB_NAME, DB_USERNAME, COMPANY_*, FRONTEND_APP_URL); aruncă eroare clară cu path per câmp dacă lipsește sau e invalid ceva.
- **backend/src/main.ts** – modificat: suport pentru .env.decamino.local / .env.hera.local (cu fallback la .env și .env.client2.local); apel validateEnv() după încărcarea dotenv.
- **backend/scripts/launch-nest-client2.js** – modificat: preferă .env.hera.local, fallback la .env.client2.local; setare ENV_FILE corespunzătoare.
- **backend/package.json** – adăugat: `dev:backend:decamino`, `dev:backend:hera`.
- **backend/.gitignore** – adăugat: .env*.local, .env.decamino.local, .env.hera.local, .env.client2.local.

### Frontend
- **frontend/.env.example** – rescris: structură cu # === COMMON ===, # === Company ===, etc., doar chei.
- **frontend/vite.config.js** – modificat: mode `hera` tratat ca HERA (buildOutDir dist-client2, VITE_PRIMARY_COLOR).
- **frontend/src/config/env.js** – modificat: MODE === 'hera' considerat HERA (isHera), același comportament ca client2.
- **frontend/package.json** – adăugat: `dev:frontend:decamino`, `dev:frontend:hera`, `build:frontend:decamino`, `build:frontend:hera`.

### Root
- **.gitignore** – adăugat: .env*.local.

---

## Structură env per client

| Locație   | DECAMINO              | HERA                   |
|----------|------------------------|-------------------------|
| Backend  | .env.decamino.local*   | .env.hera.local*        |
| Frontend | .env.decamino.local*   | .env.hera.local*        |

\* Sau fallback: backend .env / .env.client2.local; frontend folosește --mode decamino / hera care încarcă .env.[mode].local.

---

## Variabile BACKEND (process.env)

### Obligatorii (validare la startup)
- DB_HOST, DB_NAME, DB_USERNAME
- COMPANY_LEGAL_NAME, COMPANY_LEGAL_NAME_SHORT, COMPANY_ADDRESS_LINE1, COMPANY_CIF, COMPANY_EMAIL
- FRONTEND_APP_URL

### Folosite în cod (opționale sau cu fallback)
- **Server:** PORT, NODE_ENV, HOST, ENV_FILE
- **CORS/API:** CORS_ORIGINS, CORS_ORIGIN, API_URL
- **DB:** DB_TYPE, DB_PORT, DB_PASSWORD, DB_SYNC, DB_LOGGING, DATABASE_URL
- **JWT:** JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN
- **Company:** COMPANY_ADDRESS, COMPANY_CP_POBLACION, COMPANY_PHONE, COMPANY_EMAIL_BCC, COMPANY_SOLICITUDES_EMAIL, COMPANY_EMAIL_FROM_NAME, COMPANY_WEBSITE, COMPANY_BRAND_RED, COMPANY_LOGO_PATH, COMPANY_PORTADA_BG, COMPANY_PORTADA_TEXT_COLOR, COMPANY_LEGAL_REGISTRY_TEXT, COMPANY_EMPRESA_BLOCK, COMPANY_OFFICINA_LABEL
- **n8n:** N8N_BASE_URL, N8N_TIMEOUT, N8N_RATE_LIMIT_*, N8N_BACKOFF_*
- **SMTP:** SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_PEDIDOS_*
- **Telegram:** TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_BOT_TOKEN_GENERAL, TELEGRAM_CHAT_ID_GENERAL, TELEGRAM_CLIENT_LABEL
- **VAPID:** VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
- **Altele:** FRONTEND_URL, FIRMAR_BASE_URL, LOG_LEVEL, MONITORING_ENABLED, IMAP_*, OPENAI_API_KEY, USE_PRISMA_AUTH

---

## Variabile FRONTEND (import.meta.env)

### VITE_* folosite în cod
- **API:** VITE_API_BASE, VITE_API_URL, VITE_API_BASE_URL, VITE_BACKEND_URL
- **App:** VITE_APP_NAME, VITE_APP_VERSION, VITE_BASE_PATH, VITE_LOGO_PATH
- **Company:** VITE_COMPANY_NAME, VITE_COMPANY_NAME_LEGAL, VITE_COMPANY_EMAIL, VITE_COMPANY_PHONE, VITE_COMPANY_CIF, VITE_COMPANY_ADDRESS, VITE_COMPANY_CP_POBLACION, VITE_WHATSAPP_PHONE
- **Theme:** VITE_PRIMARY_COLOR, VITE_SECONDARY_COLOR
- **Feature flags:** VITE_SIGNING_MOCK, VITE_ENABLE_EINVOICE_XML, VITE_UPLOAD_BAJAS_MEDICAS, VITE_DEBUG_MODE, VITE_MAX_FILE_SIZE, VITE_USE_NEW_PERMISSIONS, VITE_USE_NEW_PROTECTION, VITE_LOG_PERMISSION_DISCREPANCIES, VITE_DEMO, VITE_PDF_QUALITY
- **Idle:** VITE_IDLE_ENABLED, VITE_IDLE_TIMEOUT_MIN, VITE_IDLE_WARNING_SEC
- **Extern:** VITE_N8N_BASE_URL, VITE_EXTERNAL_SITE_URL, VITE_GOOGLE_MAPS_API_KEY

### Built-in Vite
- import.meta.env.MODE (decamino | hera | client2 | development | production)
- import.meta.env.DEV, import.meta.env.PROD

---

## Scripturi package.json

### Backend
- `npm run dev:backend:decamino` – pornește backend cu .env.decamino.local (sau .env)
- `npm run dev:backend:hera` – pornește backend cu .env.hera.local (sau .env.client2.local)

### Frontend
- `npm run dev:frontend:decamino` – vite --mode decamino (încarcă .env.decamino.local)
- `npm run dev:frontend:hera` – vite --mode hera --port 5174 (încarcă .env.hera.local)
- `npm run build:frontend:decamino` – build pentru DECAMINO → dist/
- `npm run build:frontend:hera` – build pentru HERA → dist-client2/

---

## Pași pentru developer

1. **Backend DECAMINO:** copiază `backend/.env.example` → `backend/.env.decamino.local` (sau păstrează `.env`) și completează valorile.
2. **Backend HERA:** copiază `backend/.env.example` → `backend/.env.hera.local` (sau `.env.client2.local`) și completează valorile HERA.
3. **Frontend DECAMINO:** copiază `frontend/.env.example` → `frontend/.env.decamino.local` și completează.
4. **Frontend HERA:** copiază `frontend/.env.example` → `frontend/.env.hera.local` și completează.
5. Nu comite niciodată fișiere `.env*.local` – sunt în .gitignore.
