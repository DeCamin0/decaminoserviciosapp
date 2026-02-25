# Lista completă: Ce trebuie pregătit pentru Client 2

**Scop:** Tot ce trebuie să creezi / să ceri înainte și în timpul migrării la al 2-lea client.

---

## 1. BAZA DE DATE (obligatoriu – înainte de orice)

Trebuie **creată manual** o bază de date nouă (goală). Nu o creează Prisma.

### Ce ai nevoie de la server / hosting

| Ce | Exemplu | Unde se folosește |
|----|---------|--------------------|
| **Acces MySQL** (host, port) | `217.154.102.115`, `3306` | Backend `.env` |
| **Nume bază de date** | `client2_db` | Backend `.env` → `DB_NAME` |
| **User MySQL** | `client2_user` | Backend `.env` → `DB_USERNAME` |
| **Parolă MySQL** | (parolă puternică) | Backend `.env` → `DB_PASSWORD`, `DATABASE_URL` |

### Comenzi SQL (le rulezi tu sau le dă cineva cu acces root)

```sql
CREATE DATABASE client2_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'client2_user'@'%' IDENTIFIED BY 'PAROLA_TA_PUTERNICA';
GRANT ALL PRIVILEGES ON client2_db.* TO 'client2_user'@'%';
FLUSH PRIVILEGES;
```

După asta rulezi Prisma (`npx prisma db push` sau `npx prisma migrate deploy`) ca să creeze tabelele.

---

## 2. VARIABILE BACKEND (`.env` în `backend/`)

Toate acestea le pregătești tu sau le ceri de la client / IT.

### Server (obligatorii)

| Variabilă | Ce să pregătești / să ceri | Exemplu Client 2 |
|-----------|-----------------------------|-------------------|
| `PORT` | Un port **diferit** de Client 1 (ex. 3001 → 3002) | `3002` |
| `HOST` | De obicei `0.0.0.0` | `0.0.0.0` |
| `NODE_ENV` | `production` | `production` |
| `API_URL` | URL-ul public al API-ului Client 2 | `https://api.client2.com` |

### CORS (obligatorii)

| Variabilă | Ce să pregătești / să ceri | Exemplu |
|-----------|-----------------------------|---------|
| `CORS_ORIGINS` | Domeniile de unde se încarcă frontend-ul (virgulă) | `https://app.client2.com,https://client2.com` |

### Baza de date (obligatorii)

| Variabilă | Ce să pregătești / să ceri | Exemplu |
|-----------|-----------------------------|---------|
| `DB_TYPE` | Tip DB (de obicei `mysql`) | `mysql` |
| `DB_HOST` | Host MySQL | `217.154.102.115` |
| `DB_PORT` | Port MySQL | `3306` |
| `DB_USERNAME` | User creat la pasul 1 | `client2_user` |
| `DB_PASSWORD` | Parola user | `ParolaClient2Secure123!` |
| `DB_NAME` | Numele bazei create | `client2_db` |
| `DATABASE_URL` | URL complet (parola URL-encoded dacă are caractere speciale) | `mysql://client2_user:Parola...@217.154.102.115:3306/client2_db?charset=utf8mb4` |
| `DB_SYNC` | În producție mereu `false` | `false` |
| `DB_LOGGING` | `true` dev, `false` prod | `false` |

### JWT (obligatorii)

| Variabilă | Ce să pregătești / să ceri | Exemplu |
|-----------|-----------------------------|---------|
| `JWT_SECRET` | Secret unic pentru Client 2 (min. 32 caractere) | `client2-super-secret-key-change-in-production` |
| `JWT_EXPIRES_IN` | Valabilitate token | `7d` |

### SMTP – email principal (obligatorii dacă trimiți emailuri)

| Variabilă | Ce să ceri de la client | Exemplu |
|-----------|--------------------------|---------|
| `SMTP_HOST` | Server SMTP (ex. serviciodecorreo, Gmail, etc.) | `smtp.serviciodecorreo.es` |
| `SMTP_PORT` | Port (465 / 587) | `465` |
| `SMTP_SECURE` | `true` pentru 465 | `true` |
| `SMTP_USER` | Email / user SMTP | `info@client2.com` |
| `SMTP_PASSWORD` | Parolă SMTP | (parola contului) |
| `SMTP_FROM` | Afișat ca „De la” | `CLIENT 2 SERVICIOS SL <info@client2.com>` |

### Companie (pentru email-uri și fallback-uri)

| Variabilă | Ce să ceri de la client | Exemplu |
|-----------|--------------------------|---------|
| `COMPANY_NAME` | Denumire legală | `CLIENT 2 SERVICIOS SL` |
| `COMPANY_EMAIL` | Email principal companie | `info@client2.com` |

### Email – BCC (opțional dar recomandat)

| Variabilă | Ce să ceri | Exemplu |
|-----------|------------|---------|
| `EMAIL_BCC` | Adrese în copie (virgulă) | `rrhh@client2.com,admin@client2.com` |

### SMTP Pedidos (opțional – dacă folosești email separat pentru comenzi)

| Variabilă | Ce să ceri | Exemplu |
|-----------|------------|---------|
| `SMTP_PEDIDOS_USER` | User SMTP pedidos | `pedidos@client2.com` |
| `SMTP_PEDIDOS_PASSWORD` | Parolă | (parolă) |
| `SMTP_PEDIDOS_FROM` | De la | `CLIENT 2 <pedidos@client2.com>` |

### IMAP (opțional – doar dacă folosești ingestie email / documente)

| Variabilă | Ce să ceri | Exemplu |
|-----------|------------|---------|
| `IMAP_HOST` | Server IMAP | `imap.serviciodecorreo.es` |
| `IMAP_PORT` | Port | `993` |
| `IMAP_SECURE` | `true` | `true` |
| `IMAP_MAILBOX` | Inbox / folder | `INBOX` |
| `IMAP_PROCESSED_MAILBOX` | Folder pentru procesate | `Extrase` |

### Telegram (opțional)

| Variabilă | Ce să ceri / să creezi | Exemplu |
|-----------|-------------------------|---------|
| `TELEGRAM_BOT_TOKEN` | Token bot (BotFather) | `123:ABC...` |
| `TELEGRAM_CHAT_ID` | Chat ID unde se trimit notificări | `-4990173907` |
| `TELEGRAM_BOT_TOKEN_GENERAL` | (opțional) Al doilea bot | - |
| `TELEGRAM_CHAT_ID_GENERAL` | (opțional) Al doilea chat | - |

### n8n (opțional – dacă folosești workflow-uri)

| Variabilă | Ce să pregătești | Exemplu |
|-----------|-------------------|---------|
| `N8N_BASE_URL` | URL instanță n8n Client 2 | `https://n8n.client2.com` |
| `N8N_TIMEOUT` | Timeout ms | `30000` |

### Pagina de firmă (link din PDF-uri)

| Variabilă | Ce să pregătești | Exemplu |
|-----------|-------------------|---------|
| `FIRMAR_BASE_URL` | URL frontend (unde e `/firmar.html`) | `https://app.client2.com` |

### Monitoring (opțional)

| Variabilă | Ce să pregătești | Exemplu |
|-----------|-------------------|---------|
| `MONITORING_ENABLED` | `true` / `false` | `false` |

### Push notifications (opțional)

| Variabilă | Ce să creezi | Exemplu |
|-----------|--------------|---------|
| `VAPID_PUBLIC_KEY` | Cheie publică VAPID | (generată) |
| `VAPID_PRIVATE_KEY` | Cheie privată VAPID | (generată) |

### Altele (opțional)

| Variabilă | Notă |
|-----------|------|
| `FRONTEND_URL` | Pentru WebSocket; default localhost |
| `USE_PRISMA_AUTH` | `true` dacă folosești auth Prisma |
| `OPENAI_API_KEY` | Doar dacă folosești assistant AI |

---

## 3. VARIABILE FRONTEND (`.env` sau `.env.production` în `frontend/`)

Toate acestea se cer de la client sau se decid la deploy.

### API

| Variabilă | Ce să pregătești | Exemplu |
|-----------|-------------------|---------|
| `VITE_API_URL` | URL API Client 2 | `https://api.client2.com` |

Unele fișiere folosesc și `VITE_API_BASE_URL` / `VITE_BACKEND_URL` – dacă există, pune același URL ca `VITE_API_URL`.

### Date companie (export-uri, PDF-uri, footer)

| Variabilă | Ce să ceri de la client | Exemplu |
|-----------|--------------------------|---------|
| `VITE_COMPANY_NAME` | Denumire legală | `CLIENT 2 SERVICIOS SL` |
| `VITE_COMPANY_CIF` | CIF / NIF | `B12345678` |
| `VITE_COMPANY_ADDRESS` | Adresă completă | `Calle Ejemplo 123, 28001 Madrid` |
| `VITE_COMPANY_PHONE` | Telefon | `912 345 678` |
| `VITE_COMPANY_EMAIL` | Email | `info@client2.com` |

### Branding

| Variabilă | Ce să pregătești / să ceri | Exemplu |
|-----------|-----------------------------|---------|
| `VITE_PRIMARY_COLOR` | Culoare principală (hex) | `#0066CC` |
| `VITE_SECONDARY_COLOR` | Culoare secundară (hex) | `#004499` |
| `VITE_LOGO_PATH` | Nume fișier logo în `public/` | `logo-client2.svg` |

### Opțional

| Variabilă | Exemplu |
|-----------|---------|
| `VITE_BASE_PATH` | `/` (sau subpath dacă e cazul) |
| `VITE_APP_VERSION` | `1.0.0` |
| `VITE_USE_NEW_PERMISSIONS` | `true` / `false` |
| `VITE_ENABLE_EINVOICE_XML` | `true` / `false` |

---

## 4. CE MAI TREBUIE PREGĂTIT (non-env)

### De la client / pentru client

| Ce | Detalii |
|----|--------|
| **Logo** | Fișier logo (SVG sau PNG). Pentru UI: pui în `frontend/public/` (ex. `logo-client2.svg`) și setezi `VITE_LOGO_PATH`. Pentru PDF-uri: înlocuiești `frontend/src/assets/logo.svg` și faci rebuild. |
| **Domenii** | Decizia finală: `api.client2.com`, `app.client2.com` (sau ce domenii vrea clientul). |

### Infrastructură (tu / hosting)

| Ce | Detalii |
|----|--------|
| **DNS** | A / CNAME pentru `api.client2.com` (și opțional `app.client2.com`) către IP-ul serverului. |
| **Reverse proxy** | Nginx / Traefik: `api.client2.com` → `localhost:3002` (sau portul ales pentru Client 2). |
| **SSL** | Certificat pentru `api.client2.com` (ex. Let’s Encrypt). |
| **User admin inițial** | După primul deploy, inserezi în DB un user admin (cod, email, parolă hash) – conform ghidului din `GUID_SETUP_CLIENT_2.md`. |

---

## 5. ORDINEA RECOMANDATĂ

1. Creezi baza de date + user (pasul 1).
2. Pregătești toate valorile pentru **backend** `.env` (pasul 2) și le pui în fișier.
3. Rulezi Prisma pe baza nouă: `npx prisma db push` sau `npx prisma migrate deploy`.
4. Pregătești **frontend** `.env` (pasul 3), pui logo-ul în `public/` (și opțional în `assets/` pentru PDF).
5. Configurezi DNS, reverse proxy, SSL.
6. Pornești backend pe portul dedicat (ex. 3002), build frontend cu env Client 2, deploy.
7. Creezi user admin în baza de date și testezi login + email + export-uri.

---

## 6. REZUMAT – CE SĂ CERI EXPLICIT DE LA CLIENT

- **Date firmă:** denumire, CIF, adresă, telefon, email.
- **Domenii:** cum vor fi numite (api.ceva.com, app.ceva.com).
- **Email:** server SMTP (sau confirmarea că folosesc același tip ca tine), adresă „De la”, adrese BCC dacă vor copii.
- **Logo:** fișier logo (SVG preferat).
- **Culori (opțional):** culoare principală (și secundară) pentru aplicație.
- **Telegram (opțional):** dacă vor notificări, token + chat ID.

Restul (DB, JWT secret, port, N8N, monitoring, push) le configurezi tu pe server / cu IT-ul.

Dacă vrei, putem transforma acest document într-un checklist cu checkbox-uri (în markdown) ca să bifezi pe măsură ce pregătești fiecare punct.
