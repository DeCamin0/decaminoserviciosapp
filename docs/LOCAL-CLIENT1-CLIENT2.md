# Local: Client 1 vs Client 2

Poți rula **un singur backend** (3000) sau **ambele backend-uri** în paralel: Decamino pe **3000**, HERA pe **3002**.

---

## Ambele (Decamino + HERA) – un singur comand

Dacă vrei **amândouă** să ruleze în același timp:

```bash
cd backend
npm run dev:both
```

- Pornește **Decamino** pe port **3000** imediat.
- După ~12 s pornește **HERA** pe port **3002** (scriptul eliberează automat 3002 dacă e ocupat).
- În alt(e) terminal(e): frontend Decamino `npm run dev` (5173), frontend HERA `npm run dev:client2` (5174).

---

## Variantă 1: Un singur backend (3000)

- Backend-ul pe 3000 poate fi fie Decamino (`.env`), fie HERA (`.env.client2.local`).
- Ambele frontend-uri pot apela localhost:3000, dar **nu** în același timp: rulezi un singur backend.

## Variantă 2: Ambele backend-uri în paralel (recomandat pentru dev)

1. **Pornești ambele backend-uri** (Decamino 3000 + HERA 3002):
   ```bash
   cd backend
   npm run dev:both
   ```
   (folosește `concurrently`: Decamino pe 3000, HERA pe 3002)

2. **Frontend Decamino** (apelează 3000):
   ```bash
   cd frontend
   npm run dev
   ```
   → http://localhost:5173

3. **Frontend HERA** (apelează 3002):
   ```bash
   cd frontend
   npm run dev:client2
   ```
   → http://localhost:5174

Astfel poți avea ambele clienți deschise în browser și fiecare își folosește propriul backend.

## Cum folosești doar Client 2 (HERA) local

1. **Backend** (baza HERA, port 3002):
   ```bash
   cd backend
   npm run client2
   ```
   (pornește backend cu `.env.client2.local` → `hera_facility_db`, PORT=3002)

2. **Frontend** (interfața HERA):
   ```bash
   cd frontend
   npm run dev:client2
   ```
   → http://localhost:5174 (apelează http://localhost:3002)

## Cum folosești doar Client 1 (Decamino) local

1. **Backend** (baza Decamino, port 3000):
   ```bash
   cd backend
   npm run start:dev
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

## Rezumat

| Ce vrei să testezi       | Backend (în `backend/`)   | Frontend (în `frontend/`) | URL API      |
|--------------------------|---------------------------|---------------------------|--------------|
| **Client 1**             | `npm run start:dev`       | `npm run dev`             | localhost:3000 |
| **Client 2 (HERA)**      | `npm run client2`         | `npm run dev:client2`     | localhost:3002 |
| **Ambele în paralel**     | `npm run dev:both`        | `npm run dev` + `npm run dev:client2` (în 2 terminale) | 3000 + 3002 |

Porturi: Decamino = 3000, HERA = 3002 (setat în `backend/.env.client2.local`).
