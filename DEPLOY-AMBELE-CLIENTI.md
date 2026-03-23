# Deploy ambele clienți (Decamino + HERA) – ce faci tu pas cu pas

Pe **același VPS** rulează:
- **2 backend-uri** (același cod, 2 procese: Decamino pe 3000, HERA pe 3002)
- **2 frontend-uri** (2 build-uri: unul Decamino, unul HERA, servite pe domenii diferite)

---

## 0. PRIMA DATĂ PE VPS – când proiectul încă nu e pe server

Dacă pe VPS **nu ai deja** proiectul (nici Decamino, nici HERA), faci următorii pași **o singură dată**.

### 0.1. Pui proiectul pe VPS

**Variantă A – git clone (recomandat dacă ai repo pe Git):**

```bash
sudo mkdir -p /opt/decaminoserviciosapp
sudo chown "$USER:$USER" /opt/decaminoserviciosapp
cd /opt/decaminoserviciosapp
git clone <URL-ul-repo-ului-tău> .
# Exemplu: git clone https://github.com/.../decaminoserviciosapp.git .
```

**Variantă B – copiezi proiectul de pe PC (rsync / scp):**

Pe mașina ta (PowerShell sau CMD), din directorul unde ai proiectul:

```bash
scp -r backend frontend package.json decaminoserviciosapp/
# sau: rsync -avz --exclude node_modules --exclude .git ./ user@vps-ip:/opt/decaminoserviciosapp/
```

Pe VPS creezi directorul și pui ce ai copiat:

```bash
sudo mkdir -p /opt/decaminoserviciosapp
sudo chown "$USER:$USER" /opt/decaminoserviciosapp
# apoi urci fișierele (scp/rsync/FTP) în /opt/decaminoserviciosapp/
```

Rezultat: pe VPS ai `/opt/decaminoserviciosapp/backend/` (cu `package.json`, `src/`, `prisma/`, `scripts/`, etc.).

### 0.2. Configurezi .env pentru Decamino

```bash
cd /opt/decaminoserviciosapp/backend
cp .env.example .env
nano .env   # sau vim
```

Completezi: `PORT=3000`, `DB_NAME=decamino_db`, `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `CORS_ORIGINS`, `API_URL` (ex. https://api.decaminoservicios.com), toate `COMPANY_*` pentru Decamino, SMTP, etc. (vezi `backend/.env.example`).

### 0.3. Configurezi .env.client2 pentru HERA

```bash
cp .env.client2.example .env.client2
nano .env.client2
```

Completezi: `PORT=3002`, `DB_NAME=hera_facility_db`, user/parolă DB pentru HERA, **alt JWT_SECRET** (nu același ca Decamino), `CORS_ORIGINS` (ex. https://app.herafs.com), `API_URL` (ex. https://api.herafs.com), toate `COMPANY_*` HERA. Vezi `backend/.env.client2.example`.

### 0.3b. OpenAI (asistent) — ambele `.env`

Pune **`OPENAI_API_KEY=`** o singură dată în **`backend/.env.production`** pe VPS (sau exportă înainte de deploy).

La rularea **`backend/deploy-backend.sh`**, scriptul copiază automat cheia la **sfârșitul** lui **`.env`** (Decamino) și **`.env.client2`** (HERA): șterge orice linie veche `OPENAI_API_KEY=...` și adaugă una nouă. Astfel ambele servicii systemd primesc aceeași cheie fără să o pui manual de două ori.

Alternativ, fără a o stoca în `.env.production`:

```bash
export OPENAI_API_KEY="sk-..."
cd /opt/decaminoserviciosapp/backend && ./deploy-backend.sh
```

### 0.4. Servicii systemd (ambele backend-uri)

**Decamino (port 3000):**

```bash
sudo nano /etc/systemd/system/decamino-backend.service
```

Conținut (ajustezi `User` dacă e nevoie):

```ini
[Unit]
Description=Backend Decamino (api.decaminoservicios.com) - Client 1
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/decaminoserviciosapp/backend
ExecStart=/usr/bin/node dist/src/main.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**HERA (port 3002):**

```bash
sudo nano /etc/systemd/system/hera-backend.service
```

```ini
[Unit]
Description=Backend HERA (api.herafs.com) - Client 2
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/decaminoserviciosapp/backend
Environment=ENV_FILE=.env.client2
Environment=PORT=3002
ExecStart=/usr/bin/node dist/src/main.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Apoi:

```bash
sudo systemctl daemon-reload
sudo systemctl enable decamino-backend
sudo systemctl enable hera-backend
```

### 0.5. Prima build și pornire

Înainte să poți porni serviciile, trebuie să ai **build-ul** (dist/) și migrările aplicate:

```bash
cd /opt/decaminoserviciosapp/backend
npm install
npx prisma generate
# Migrări Decamino (folosește .env):
export $(grep -v '^#' .env | xargs)  # încarcă .env
npx prisma migrate deploy
# Migrări HERA (pe baza HERA):
ENV_FILE=.env.client2 node scripts/prisma-migrate-deploy.js
npm run build
```

Apoi pornești ambele:

```bash
sudo systemctl start decamino-backend
sudo systemctl start hera-backend
sudo systemctl status decamino-backend
sudo systemctl status hera-backend
```

Verificare: `curl -s http://127.0.0.1:3000/health` și `curl -s http://127.0.0.1:3002/health` trebuie să răspundă.

După acești pași, proiectul e pe VPS și ambele backend-uri rulează. La **următoarele** actualizări folosești doar **`./deploy-backend.sh`** (secțiunea C mai jos).

---

## A. BUILD FRONTEND (îl faci tu pe mașina ta sau pe VPS)

Din directorul **frontend/**:

```bash
cd frontend
```

### 1. Build Decamino (client 1)
```bash
npm run build:frontend:decamino
```
- **Rezultat:** directorul `frontend/dist/`
- Conține: logo/nume/culori Decamino, API către api.decaminoservicios.com (sau ce ai în `.env` / `.env.decamino` / `.env.production` la build)

### 2. Build HERA (client 2)
```bash
npm run build:frontend:hera
```
- **Rezultat:** directorul `frontend/dist-client2/`
- Conține: logo/nume/culori HERA, API către api.herafs.com (sau ce ai în `.env.hera` / `.env.client2` la build)

**Important:** Pentru ca HERA să aibă API-ul și culorile corecte, înainte de build HERA trebuie să existe un fișier de env pentru mode `hera`, de ex.:
- `frontend/.env.hera` sau `frontend/.env.hera.local`  
- sau `frontend/.env.client2` (Vite pentru `--mode hera` încarcă și `.env.client2`).  
Copiază din `frontend/.env.client2.example` și completează (în special `VITE_API_URL` / `VITE_API_BASE_URL` pentru api.herafs.com).

---

## B. UNDE SE SERVESC CELE 2 FRONTEND-URI PE VPS

- **Decamino:** conținutul din `frontend/dist/` → servit pe domeniul app Decamino (ex. **app.decaminoservicios.com**), de ex. cu nginx sau un container care servește acest director.
- **HERA:** conținutul din `frontend/dist-client2/` → servit pe domeniul app HERA (ex. **app.herafs.com**).

Fiecare domeniu pointează la directorul corespunzător pe server (sau la un reverse proxy care servește acel director).

---

## C. DEPLOY BACKEND PE VPS (ambele clienți pe același VPS)

Te conectezi la VPS și mergi în directorul backend:

```bash
ssh user@vps
cd /opt/decaminoserviciosapp/backend
```

### Ce trebuie să existe o singură dată pe VPS

1. **Fișiere .env în `backend/`:**
   - **`.env`** – pentru Decamino: `PORT=3000`, `DB_NAME=decamino_db`, COMPANY_* Decamino, JWT, CORS, API_URL (api.decaminoservicios.com), etc.
   - **`.env.client2`** – pentru HERA: `PORT=3002`, `DB_NAME=hera_facility_db`, COMPANY_* HERA, **alt JWT_SECRET**, CORS/API pentru api.herafs.com. Poți copia din `backend/.env.client2.example` și completezi.

2. **Serviciu systemd pentru HERA** (doar dacă nu l-ai creat deja):
   - Serviciul **decamino-backend** (Decamino pe 3000) există deja și folosește `.env`.
   - Trebuie creat **hera-backend.service** care pornește al doilea proces cu `ENV_FILE=.env.client2` și `PORT=3002`. Exemplu în secțiunea 4 din `COMO_DESCHID_CLIENTII.txt` sau în `docs/VPS-HERA-CHECKLIST-SIGUR.md`.

### Verificare înainte de deploy (VPS pregătit pentru HERA?)

Pe VPS, înainte de `./deploy-backend.sh`, poți rula:

```bash
cd /opt/decaminoserviciosapp/backend
bash scripts/check-vps-ready-for-both-clients.sh
```

Scriptul verifică: existența `.env` și `.env.client2`, serviciile systemd `decamino-backend` și `hera-backend`, porturile 3000/3002, și răspunsul la `/health` pentru ambele. Dacă ceva lipsește (în special `.env.client2` sau `hera-backend.service`), îți spune ce să repari.

### La fiecare deploy (cod nou)

Rulezi **o singură comandă**:

```bash
./deploy-backend.sh
```

Scriptul:
1. Oprește **decamino-backend**
2. Face `git pull`, `npm install`, `npx prisma generate`, `prisma migrate deploy` (pe baza din `.env` – Decamino)
3. Face `npm run build`
4. Pornește **decamino-backend** (port 3000)
5. Dacă există serviciul **hera-backend**, îl **repornește** și pe el (port 3002)

Deci: **un singur deploy** actualizează codul și repornește **ambele** backend-uri.

---

## Rezumat rapid

| Ce vrei | Unde | Comandă / acțiune |
|--------|------|-------------------|
| Build frontend Decamino | Pe mașina ta, în `frontend/` | `npm run build:frontend:decamino` → rezultat în `dist/` |
| Build frontend HERA     | Pe mașina ta, în `frontend/` | `npm run build:frontend:hera`     → rezultat în `dist-client2/` |
| Upload frontend Decamino | Pe VPS | Urcă/conectează `dist/` la domeniul app Decamino |
| Upload frontend HERA     | Pe VPS | Urcă/conectează `dist-client2/` la domeniul app HERA |
| Deploy backend (ambele)  | Pe VPS, în `backend/` | `./deploy-backend.sh` (repornește Decamino + HERA dacă hera-backend există) |

**O dată pe VPS:** ai `.env` (Decamino) și `.env.client2` (HERA) în `backend/`, și serviciul `hera-backend.service` creat și activ.

Dacă vrei, putem adăuga și pașii exacti pentru „unde urc dist/ și dist-client2/” pe VPS (nginx paths, sau comenzi rsync/scp).
