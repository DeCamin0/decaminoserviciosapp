# Ce ai de făcut (tu)

Toate setările din cod și din fișierele `.example` sunt deja puse. Tu trebuie doar să **copiezi env-urile** și să **completezi parolele/secretele** unde e cazul.

---

## 1. Backend – Client 2 (HERA), local sau pe server

- **Copiază** fișierul de exemplu în fișierul real folosit la pornire:
  - **Local:** `backend/.env.client2.example` → `backend/.env.client2.local`
  - **Pe server HERA:** `backend/.env.client2.example` → `backend/.env` (sau cum pornești tu backend-ul)
- **Completează** (dacă nu sunt deja ok):
  - `DB_PASSWORD` – parola bazei HERA
  - `JWT_SECRET` – secret diferit de Decamino (la producție: lung, aleatoriu)
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_BOT_TOKEN_GENERAL`, `TELEGRAM_CHAT_ID_GENERAL` – dacă folosești Telegram
  - `SMTP_PASSWORD` – parola SMTP HERA (administracion@herafs.com)
  - `SMTP_PEDIDOS_PASSWORD` – parola pentru produccion@decaminoservicios.com (dacă folosești pedidos)
  - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` – dacă vrei push notifications
- **Asigură-te** că în `backend/assets/` ai fișierele:
  - `stampila_hera-removebg-preview.png` (sello HERA)
  - `LOGO_hera.png` (logo HERA), dacă e setat `COMPANY_LOGO_PATH=LOGO_hera.png`

Restul variabilelor din `.env.client2.example` (company, gestoria, port, CORS, etc.) sunt deja completate; le poți lăsa sau ajusta după nevoie.

---

## 2. Frontend – Client 2 (HERA), la build sau la dev

- **Pentru development** (`npm run dev:frontend:hera`):
  - Copiază `frontend/.env.client2.example` → `frontend/.env.hera.local`  
    (comanda folosește `--mode hera`, deci Vite încarcă `.env.hera` și `.env.hera.local`).
- **Pentru build de producție HERA** (`npm run build:client2` sau build cu mode client2):
  - Copiază `frontend/.env.client2.example` în fișierul folosit la build (ex. `.env.production` sau cum îl folosești în CI/CD), apoi rulează build-ul.

Nu e nevoie să completezi nimic în plus dacă valorile din `.env.client2.example` sunt corecte (URL API, company name, email gestoria, etc.).

---

## 3. (Opțional) După prima pornire HERA – informes ítems

Dacă la HERA în Informes dropdown-ul „Seleccionar item” e gol:

- Rulezi o dată:  
  `cd backend` apoi  
  `node scripts/import-informes-items-decamino-to-hera.js`  
- Cerințe: `.env` (Decamino) și `.env.client2.local` (HERA) cu `DB_*` corecte; la Decamino să existe deja ítems în `informes_items`.

---

Rezumat: **copiezi .env.client2.example → .env.client2.local (backend și frontend), completezi parolele/secretele, și pui asset-urile HERA în backend/assets. Restul e deja pregătit în cod.**
