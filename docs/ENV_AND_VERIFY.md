# Env și verificare (local + producție)

Un singur codebase, două seturi de .env (ex: `.env` = client 1, `.env.client2` = client 2). Verificarea se poate face **local** sau în producție.

---

## 2.11 – Setare .env (client 1 – DeCamino)

### Backend (fără fallback-uri)

- Copiază `backend/.env.example` → `backend/.env`.
- **Obligatoriu** (altfel backend nu pornește, eroare clară):
  - `DB_HOST`, `DB_NAME`, `DB_USERNAME`
  - `COMPANY_LEGAL_NAME`, `COMPANY_LEGAL_NAME_SHORT`, `COMPANY_ADDRESS_LINE1`, `COMPANY_CIF`, `COMPANY_EMAIL`, `FRONTEND_APP_URL`
- **Local:** ex. `DB_HOST=localhost`, `FRONTEND_APP_URL=http://localhost:5173`.  
- **Producție:** valorile de producție. Dacă lipsește ceva, la pornire vei vedea: `Missing required env: NUME_VAR`.

### Frontend

- Folosește `frontend/.env.example` ca referință; creează `frontend/.env` (dev) și/sau `frontend/.env.production` (build prod).
- **Local:** ex. `VITE_API_URL=http://localhost:3000`, `VITE_EXTERNAL_SITE_URL=https://decaminoservicios.com`.  
- **Producție:** `VITE_API_URL=https://api.decaminoservicios.com`, etc.

Variabilele folosite sunt cele din `frontend/.env.example` și din `frontend/src/config/env.js`.

---

## Verificare **locală** (fără producție)

1. **Backend:** `cd backend && npm run start:dev` (cu `backend/.env` complet).
2. **Frontend:** `cd frontend && npm run dev` (cu `frontend/.env` care are cel puțin `VITE_API_URL=http://localhost:3000`).
3. Rulează **checklist scurt**:
   - [ ] Login + GET /api/me
   - [ ] O pagină critică (Empleados, Dashboard, Solicitudes)
   - [ ] Un PDF (presupuesto sau informe) – verifică CIF, nume firmă
   - [ ] Un email de test (invitație empleado sau notificare) – From, link app
   - [ ] Link T&C pe login → domeniul corect
   - [ ] (Opțional) firmar.html cu `?id=...` – semnare merge

Dacă toate trec, configurația .env pentru client 1 e validă **local**. Același set de variabile (cu URL-uri de producție) se folosește și în producție.

---

## Verificare în **producție**

După deploy, rulezi același tip de checklist pe domeniul live (login, pagini, PDF, email, linkuri). Nu e nevoie de alt flow; doar că backend și frontend citesc .env de pe server / din build.

---

## Al doilea client **local** (același folder)

- **Backend:** creezi `backend/.env.client2` (port alt, ex. `PORT=3001`, DB client 2, COMPANY_* client 2, `FRONTEND_APP_URL=http://localhost:5174`).
- **Frontend:** creezi `frontend/.env.client2` (`VITE_API_URL=http://localhost:3001`, `VITE_COMPANY_NAME=...`, etc.).
- Pornire cu env client 2 (ex. cu `dotenv-cli`):
  - Backend: `npx dotenv -e .env.client2 -- npm run start:dev` (și setezi `PORT=3001` în `.env.client2`).
  - Frontend: `npx dotenv -e .env.client2 -- npm run dev` (Vite ia alt port dacă 5173 e ocupat).

Verificarea pentru client 2 e aceeași checklist locală, dar pe porturile și datele client 2.

---

## Rezumat

| Unde        | Ce folosești        | Verificare                          |
|------------|---------------------|-------------------------------------|
| Local C1   | `backend/.env` + `frontend/.env` | Checklist scurt (login, PDF, email, linkuri) |
| Local C2   | `.env.client2` (backend + frontend) | La fel, pe porturile C2              |
| Producție  | .env pe server / build | Aceeași checklist pe domeniul live   |

Verificarea merge **local** și în **producție**; nu e obligatoriu să fie doar în producție.
