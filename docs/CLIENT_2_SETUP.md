# Setup Client 2 (același cod, config separat)

Același cod pentru DeCamino (Client 1) și HERA FACILITY SERVICES SL (Client 2). Diferența: câte un set de `.env` + logo per client.

**Client 2 exemplu:** HERA FACILITY SERVICES SL — CIF B85974558, Calle Gran Capitan 5 - Piso 3 D, 28802 Alcalá de Henares, Madrid.

---

## Ce ai nevoie pentru Client 2

1. **Date firma Client 2** – nume, CIF, adresă, email, telefon, domeniu (în .env.client2.example sunt deja datele HERA).
2. **Logo Client 2** – imagine (PNG/SVG) în `backend/assets/logo-hera.png` și `frontend/public/logo-hera.svg`.
3. **Domenii** – ex: `app.herafs.com`, `api.herafs.com` (domeniul real HERA: https://herafs.com; ajustezi în .env).
4. **Bază de date** – fie DB separată pentru Client 2, fie același DB (multi-tenant).

---

## Pași

### 1. Backend (server / container pentru Client 2)

- Copiază șablonul:  
  `cp backend/.env.client2.example backend/.env`
- Deschide `backend/.env` și înlocuiește toate valorile cu **datele reale Client 2**:
  - `COMPANY_*`, `FRONTEND_APP_URL`, `CORS_ORIGINS`, `API_URL`
  - `DB_*` dacă Client 2 are DB separată
  - `JWT_SECRET` **diferit** de Client 1
  - SMTP, VAPID etc. dacă le folosești
- Pune logo-ul Client 2 în `backend/assets/` (ex: `logo-hera.png`) și păstrează în `.env`:  
  `COMPANY_LOGO_PATH=logo-hera.png`
- Pornește backend-ul ca de obicei (npm run start etc.) – citește din `.env`.

### 2. Frontend (build pentru Client 2)

- Copiază șablonul:  
  `cp frontend/.env.client2.example frontend/.env.production`  
  (sau `frontend/.env` dacă build-ul citește doar `.env`).
- Completează în acel fișier toate valorile cu **datele reale Client 2** (VITE_COMPANY_*, VITE_APP_NAME, VITE_API_URL, VITE_LOGO_PATH etc.).
- Pune logo-ul în `frontend/public/` (ex: `logo-hera.svg`) și păstrează în env:  
  `VITE_LOGO_PATH=logo-hera.svg`
- Build:  
  `cd frontend && npm run build`
- Deploy: conținutul din `frontend/dist/` pe domeniul Client 2 (ex. `app.client2.com`).

### 3. Verificare

- Login pe `app.client2.com` – nume firmă, logo, culoare = Client 2.
- PDF-uri (presupuesto/informe) – logo și date firma = Client 2.
- Footer „diseñada y desarrollada por DeCamino” rămâne la fel (branding DeCamino).

---

## Rezumat fișiere

| Ce | Client 1 | Client 2 |
|----|----------|----------|
| Backend env | `backend/.env` (DeCamino) | `backend/.env` pe serverul Client 2 (din `.env.client2.example` – HERA) |
| Frontend env la build | `frontend/.env` (DeCamino) | `frontend/.env.production` din `.env.client2.example` (HERA) |
| Logo backend | `backend/assets/logo.png` | `backend/assets/logo-hera.png` |
| Logo frontend | `frontend/public/logo.svg` | `frontend/public/logo-hera.svg` |

Același cod: doar două seturi de `.env` + două logo-uri.

---

## Pornire Client 2 în local

Poți rula HERA (Client 2) pe mașina ta, cu backend pe `localhost:3000` și frontend pe `localhost:5173`.

### 1. Salvează env-urile Client 1 (ca să poți reveni)

```bash
# Opțional: backup .env curente
cp backend/.env backend/.env.client1.backup
cp frontend/.env frontend/.env.client1.backup
```

### 2. Activează config Client 2 pentru local

```bash
# Backend – folosește .env.client2.local (localhost, CORS 5173)
cp backend/.env.client2.local backend/.env

# Frontend – folosește .env.client2.local (API către localhost:3000)
cp frontend/.env.client2.local frontend/.env
```

### 3. Pornește backend și frontend

**Terminal 1 – Backend:**
```bash
cd backend
npm run start
# sau npm run start:dev
```

**Terminal 2 – Frontend:**
```bash
cd frontend
npm run dev
```

Deschizi în browser **http://localhost:5173** – vezi HERA FACILITY SERVICES SL (logo, nume, date firma). Login-ul folosește aceeași bază de date ca și Client 1 (utilizatori din DB); doar branding-ul e HERA.

### 4. Înapoi la Client 1 (DeCamino)

```bash
cp backend/.env.client1.backup backend/.env
cp frontend/.env.client1.backup frontend/.env
# Repornește backend și frontend
```

Sau păstrezi două backup-uri: `.env.client1.backup` (DeCamino) și folosești `cp .env.client2.local .env` când vrei HERA.

---

## Pornire ambii clienți odată (local)

Poți rula în paralel **DeCamino (Client 1)** și **HERA (Client 2)** pe mașina ta: 4 terminale.

| Client   | Backend port | Frontend port | URL                    |
|----------|--------------|---------------|------------------------|
| DeCamino | 3000         | 5173          | http://localhost:5173  |
| HERA     | 3001         | 5174          | http://localhost:5174  |

### 1. Backend Client 1 (DeCamino)

În `backend/` ai deja `.env` pentru DeCamino. Pornește:

```bash
cd backend
npm run start
# sau npm run start:dev
```

→ Backend pe **http://localhost:3000**

### 2. Backend Client 2 (HERA)

**Alt terminal**, tot din `backend/`:

```bash
cd backend
npm run start:client2
# sau npm run start:dev:client2
```

→ Backend pe **http://localhost:3001** (citește din `.env.client2.local`).

### 3. Frontend Client 1 (DeCamino)

**Alt terminal**, din `frontend/`:

```bash
cd frontend
npm run dev
```

→ **http://localhost:5173** (folosește `.env` → API localhost:3000).

### 4. Frontend Client 2 (HERA)

**Alt terminal**, din `frontend/`:

```bash
cd frontend
npm run dev:client2
```

→ **http://localhost:5174** (mode `client2` → încarcă `.env.client2.local`, API localhost:3001).

### Rezultat

- **http://localhost:5173** = DeCamino (logo, nume, API 3000)  
- **http://localhost:5174** = HERA (logo HERA, nume, API 3001)  

Ambele folosesc aceeași bază de date (utilizatori comuni); doar branding-ul și API-ul sunt separate.
