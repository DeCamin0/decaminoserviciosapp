# Pornire ambii clienți pe local

Da, **poți rula în paralel** DeCamino (client 1) și HERA (client 2) pe mașina ta.

## Înainte de pași: `.env` pentru DeCamino (obligatoriu)

**DeCamino (port 3000)** citește din `backend/.env`. Dacă fișierul e gol sau incomplet, procesul **iese cu eroare** și rămâne doar HERA pe 3002 (de aceea `check:ports` arată 3000: NU).

1. Copiază exemplul:
   ```bash
   cd backend
   copy .env.example .env
   ```
2. Deschide `backend/.env` și completează **cel puțin**:
   - **DB_HOST**, **DB_NAME**, **DB_USERNAME**, **DB_PASSWORD** (baza MySQL pentru DeCamino)
   - **JWT_SECRET**, **JWT_EXPIRES_IN**, **JWT_REFRESH_EXPIRES_IN**
   - (opțional dar recomandat: COMPANY_*, CORS_ORIGINS, API_URL)
3. Salvează și pornește din nou `npm run dev:both`.

## Ce pornești

| Ce | DeCamino (client 1) | HERA (client 2) |
|----|---------------------|-----------------|
| **Backend** | port **3000**, baza DeCamino | port **3002**, baza `hera_facility_db` |
| **Frontend** | port **5173** | port **5174** |

---

## Pași

### 1. Backend – ambii în același terminal

În folderul **backend**:

```bash
cd backend
npm run dev:both
```

- Pornește **DeCamino** pe 3000.
- După ~12 secunde pornește și **HERA** pe 3002.
- Lasă acest terminal deschis.

### 2. Frontend DeCamino

Într-un **alt terminal**, în folderul **frontend**:

```bash
cd frontend
npm run dev
```

- Deschide în browser: **http://localhost:5173**
- Login → API merge la **http://localhost:3000** (backend DeCamino).

### 3. Frontend HERA

Într-un **al treilea terminal**, tot în **frontend**:

```bash
cd frontend
npm run dev:client2
```

- Deschide în browser: **http://localhost:5174**
- Login → API merge la **http://localhost:3002** (backend HERA, baza HERA).

---

## Rezumat

| Terminal | Comandă | Ce rulează |
|---------|---------|------------|
| 1 (backend) | `npm run dev:both` | Backend DeCamino (3000) + HERA (3002) |
| 2 (frontend) | `npm run dev` | DeCamino UI → http://localhost:5173 |
| 3 (frontend) | `npm run dev:client2` | HERA UI → http://localhost:5174 |

**Da, e posibil** – două backend-uri (3000 și 3002) și două frontend-uri (5173 și 5174) în paralel.
