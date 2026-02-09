# Plan Minimal: Pregătire pentru Client 2

## 1. HARDCODED RISK LIST

### 🔴 CRITICE (Data Leak / Break)

**API URLs (Frontend)**
- `frontend/src/utils/routes.js`: `https://api.decaminoservicios.com` hardcodat în toate endpoint-urile
- **Risc:** Frontend client 2 va trimite request-uri către backend client 1

**CORS Origins (Backend)**
- `backend/src/main.ts`: `https://app.decaminoservicios.com`, `https://decaminoservicios.com` hardcodate
- **Risc:** Frontend client 2 va fi blocat de CORS

**Company Info în Export-uri (Frontend)**
- `frontend/src/utils/exportExcel.ts`: COMPANY_INFO (nume, CIF, adresă, telefon, email) hardcodat
- `frontend/src/pages/SolicitudesPage.jsx`: Date companie hardcodate în PDF-uri
- **Risc:** Export-urile client 2 vor afișa datele client 1

**Email BCC (Backend)**
- `backend/src/controllers/sent-emails.controller.ts`: `app@decaminoservicios.com`, `decamino.rrhh@gmail.com` hardcodate
- `backend/src/controllers/monitoring.controller.ts`: `app@decaminoservicios.com` hardcodat
- `backend/src/services/hall-of-fame.service.ts`: probabil BCC hardcodat
- **Risc:** Email-urile client 2 vor merge la adrese client 1

**SMTP From (Backend)**
- `backend/src/services/email.service.ts`: `'DE CAMINO Servicios Auxiliares SL <info@decaminoservicios.com>'` hardcodat ca fallback
- **Risc:** Email-urile client 2 vor apărea ca trimise de client 1

### 🟡 MEDIUM (Cosmetic, dar vizibil)

**Logo/UI Branding**
- `frontend/src/components/MainLayout.jsx`: Logo path hardcodat
- **Risc:** Client 2 va vedea logo-ul client 1 (cosmetic, nu data leak)

---

## 2. MINIMAL ENV VARIABLES

### Backend (.env)

```env
# API Domain (pentru CORS și public URL)
API_DOMAIN=api.decaminoservicios.com
CORS_ORIGINS=https://app.decaminoservicios.com,https://decaminoservicios.com

# Company Info (pentru email-uri)
COMPANY_NAME=De Camino Servicios Auxiliares SL
COMPANY_EMAIL=info@decaminoservicios.com
SMTP_FROM=De Camino Servicios Auxiliares SL <info@decaminoservicios.com>

# Email BCC (pentru copii email-uri)
EMAIL_BCC=decamino.rrhh@gmail.com,app@decaminoservicios.com
```

**Unde se folosesc:**
- `API_DOMAIN`: `backend/src/main.ts` (public URL)
- `CORS_ORIGINS`: `backend/src/main.ts` (CORS config)
- `COMPANY_NAME`, `COMPANY_EMAIL`: `backend/src/services/email.service.ts` (SMTP_FROM fallback)
- `SMTP_FROM`: `backend/src/services/email.service.ts` (from email)
- `EMAIL_BCC`: `backend/src/controllers/sent-emails.controller.ts`, `monitoring.controller.ts`, `hall-of-fame.service.ts`

### Frontend (.env.production)

```env
# API URL
VITE_API_URL=https://api.decaminoservicios.com

# Company Info (pentru export-uri Excel/PDF)
VITE_COMPANY_NAME=DE CAMINO SERVICIOS AUXILIARES SL
VITE_COMPANY_CIF=B85524536
VITE_COMPANY_ADDRESS=Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España
VITE_COMPANY_PHONE=910 440 275
VITE_COMPANY_EMAIL=info@decaminoservicios.com
```

**Unde se folosesc:**
- `VITE_API_URL`: `frontend/src/utils/routes.js` (toate endpoint-urile)
- `VITE_COMPANY_*`: `frontend/src/utils/exportExcel.ts`, `SolicitudesPage.jsx` (export-uri)

---

## 3. FILE-LEVEL CHANGE LIST

### Frontend

**1. `frontend/src/utils/routes.js`**
- **Hardcodat:** `'https://api.decaminoservicios.com'` (linia 24, 29, 32, etc.)
- **Schimbare:** `import.meta.env.VITE_API_URL || 'https://api.decaminoservicios.com'`
- **Backward compatible:** Da (default păstrat)

**2. `frontend/src/utils/exportExcel.ts`**
- **Hardcodat:** `COMPANY_INFO` object (liniile 4-10)
- **Schimbare:** 
```typescript
const COMPANY_INFO = {
  name: import.meta.env.VITE_COMPANY_NAME || 'DE CAMINO SERVICIOS AUXILIARES SL',
  cif: import.meta.env.VITE_COMPANY_CIF || 'B85524536',
  address: import.meta.env.VITE_COMPANY_ADDRESS || 'Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España',
  phone: import.meta.env.VITE_COMPANY_PHONE || '910 440 275',
  email: import.meta.env.VITE_COMPANY_EMAIL || 'info@decaminoservicios.com'
};
```
- **Backward compatible:** Da

**3. `frontend/src/pages/SolicitudesPage.jsx`**
- **Hardcodat:** Date companie în PDF (liniile 5327-5331)
- **Schimbare:** Înlocuiește cu env vars (similar cu exportExcel.ts)
- **Backward compatible:** Da

### Backend

**4. `backend/src/main.ts`**
- **Hardcodat:** CORS origins (liniile 129-130, 137-138)
- **Schimbare:**
```typescript
const defaultOrigins = ['http://localhost:5173'];
const corsOrigins = process.env.CORS_ORIGINS
  ? [...process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()), ...defaultOrigins]
  : ['http://localhost:5173', 'https://app.decaminoservicios.com', 'https://decaminoservicios.com']; // backward compatible
```
- **Backward compatible:** Da

**5. `backend/src/services/email.service.ts`**
- **Hardcodat:** SMTP_FROM fallback (linia 204)
- **Schimbare:**
```typescript
const fromEmail = options?.from || 
  this.configService.get<string>('SMTP_FROM') || 
  process.env.SMTP_FROM ||
  'DE CAMINO Servicios Auxiliares SL <info@decaminoservicios.com>'; // backward compatible
```
- **Backward compatible:** Da

**6. `backend/src/controllers/sent-emails.controller.ts`**
- **Hardcodat:** BCC emails (liniile 325-326), inclusiv hardcodare mascată pentru 'gestoria'
- **Schimbare (simplificat - fără hardcodări mascate):**
```typescript
const bccList = process.env.EMAIL_BCC?.split(',').map(e => e.trim()) || ['decamino.rrhh@gmail.com'];
```
- **Backward compatible:** Da (default păstrat)
- **Notă:** Dacă ai nevoie de BCC diferit pentru 'gestoria', configurează `EMAIL_BCC` în `.env` cu toate adresele necesare

**7. `backend/src/controllers/monitoring.controller.ts`**
- **Hardcodat:** BCC email (linia 208)
- **Schimbare:**
```typescript
const bccList = process.env.EMAIL_BCC?.split(',').map(e => e.trim()) || ['app@decaminoservicios.com'];
```
- **Backward compatible:** Da

**8. `backend/src/services/hall-of-fame.service.ts`**
- **Hardcodat:** BCC email (verifică în cod)
- **Schimbare:** Similar cu sent-emails.controller.ts
- **Backward compatible:** Da

---

## 4. DATABASE WORKFLOW (CRITIC!)

### ⚠️ REGULI IMPORTANTE

**1. Database Creation (MANDATORY - Manual)**
- Database-ul trebuie creat MANUAL înainte de a rula Prisma
- Database-ul trebuie să fie GOL (empty) când îl creezi
- Prisma NU creează database-ul, doar se conectează la unul existent

**2. Prisma Usage Rules**
- **Database gol (empty):** Folosește `prisma db push` pentru a crea schema
- **Dacă există migrări:** Preferă `prisma migrate deploy` (production-safe)
- **NU rula `prisma db push` pe un database cu date existente!**
- Prisma creează doar tabele/schema, NU database-ul în sine

**3. Ordinea Corectă (OBLIGATORIE)**
```
a) Creează database + user manual (MySQL)
b) Configurează backend .env (cu DB_NAME, DB_USERNAME, DB_PASSWORD)
c) Rulează Prisma (push sau migrate)
d) Start backend
```

### ⚠️ WARNING BOX

```
╔══════════════════════════════════════════════════════════════╗
║  ⚠️  ATENȚIE - REGULI CRITICE DATABASE                       ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ❌ NU porni backend-ul înainte ca database-ul să existe!  ║
║  ❌ NU reutiliza database-ul de producție al Client 1!     ║
║  ❌ NU lăsa Prisma să creeze database-ul automat!          ║
║                                                              ║
║  ✅ Creează database-ul MANUAL înainte de Prisma           ║
║  ✅ Database-ul trebuie să fie GOL când îl creezi           ║
║  ✅ Prisma doar creează tabele, NU database-ul              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 5. SAFE CLONING STEPS (CLIENT 2)

### Pas 1: Clonează Proiectul
```bash
cd /opt
git clone <repo-url> client2-app
cd client2-app
```

### Pas 2: Creează Database Nou (MANDATORY - ÎNAINTE DE PRISMA!)

**⚠️ IMPORTANT: Acest pas trebuie făcut MANUAL, înainte de a configura backend-ul!**

```bash
# Conectează-te la MySQL
mysql -u root -p

# Creează database GOL și user
CREATE DATABASE client2_db;
CREATE USER 'client2_user'@'%' IDENTIFIED BY 'strong-password-here';
GRANT ALL PRIVILEGES ON client2_db.* TO 'client2_user'@'%';
FLUSH PRIVILEGES;

# Verifică că database-ul e gol (nu ar trebui să existe tabele)
SHOW TABLES FROM client2_db;
# Ar trebui să returneze: Empty set (0.00 sec)

EXIT;
```

**✅ Verificare:** Database-ul `client2_db` există și este GOL (fără tabele)

### Pas 3: Configurează Backend .env

**⚠️ IMPORTANT: Configurează .env ÎNAINTE de a rula Prisma!**

```bash
cd backend
cp .env.example .env
# Editează .env cu valorile client 2:
# - DB_NAME=client2_db          ← Database-ul creat la Pas 2
# - DB_USERNAME=client2_user     ← User-ul creat la Pas 2
# - DB_PASSWORD=strong-password-here
# - DB_HOST=your-db-host-ip
# - API_DOMAIN=api.client2.com
# - CORS_ORIGINS=https://app.client2.com
# - COMPANY_NAME=Client 2 Name SL
# - COMPANY_EMAIL=info@client2.com
# - SMTP_FROM=Client 2 Name SL <info@client2.com>
# - EMAIL_BCC=client2.rrhh@gmail.com
```

**✅ Verificare:** `.env` conține `DB_NAME=client2_db` (database-ul creat manual)

### Pas 4: Setup Database Schema cu Prisma

**⚠️ IMPORTANT: Prisma se conectează la database-ul EXISTENT, nu îl creează!**

**⚠️ CRITIC: Dacă database-ul NU este goală, OPREȘTE și NU rula Prisma!**

```bash
# Verifică că database-ul e gol (înainte de Prisma)
mysql -u root -p -e "SHOW TABLES FROM client2_db;"
# Ar trebui să returneze: Empty set (0.00 sec)
# Dacă vezi tabele, OPREȘTE și verifică!

cd backend
npm install
npx prisma generate

# Opțiunea 1: Database gol (recomandat pentru primul setup)
npx prisma db push

# Opțiunea 2: Dacă există migrări (production-safe)
# npx prisma migrate deploy
```

**✅ Verificare:** 
- Database-ul `client2_db` era GOL înainte de Prisma
- Prisma s-a conectat la `client2_db` (nu a încercat să-l creeze)
- Tabelele au fost create în `client2_db`
- Nu există erori de conexiune

### Pas 5: Configurează Frontend
```bash
cd frontend
cp env.production.example .env.production
# Editează .env.production cu valorile client 2:
# - VITE_API_URL=https://api.client2.com
# - VITE_COMPANY_NAME=CLIENT 2 NAME SL
# - VITE_COMPANY_CIF=CLIENT2-CIF
# - VITE_COMPANY_ADDRESS=Client 2 Address
# - VITE_COMPANY_PHONE=Client 2 Phone
# - VITE_COMPANY_EMAIL=info@client2.com
```

### Pas 6: Deploy Backend

**⚠️ IMPORTANT: Backend-ul pornește DOAR după ce database-ul există și schema e creată!**
```bash
cd backend
# Actualizează deploy-backend.sh cu path-ul corect
./deploy-backend.sh
# SAU: manual start cu PM2/systemd
```

### Pas 7: Configurează DNS și Reverse Proxy
- DNS: `api.client2.com` → IP VPS
- Traefik/Nginx: Configurează routing pentru `api.client2.com` → backend port 3000

### Pas 8: Deploy Frontend pe Domain Client 2
```bash
cd frontend
npm install
npm run build
# Deploy dist/ pe domain-ul client 2 (app.client2.com)
# Poate fi: VPS separat, CDN, hosting static
```

### Pas 9: Verifică Configurarea
- Database `client2_db` există și conține tabele (verificat cu `SHOW TABLES FROM client2_db`)
- Backend rulează pe `api.client2.com` și se conectează la `client2_db`
- Frontend accesibil pe `app.client2.com`
- Env vars setate corect

---

## 6. VALIDATION CHECK

### ✅ Frontend → Backend Connection
- [ ] Deschide `app.client2.com` în browser
- [ ] Login funcționează
- [ ] Network tab: request-urile merg la `api.client2.com` (NU `api.decaminoservicios.com`)
- [ ] Nu există erori CORS în console

### ✅ Export-uri Excel/PDF
- [ ] Export Excel (orice pagină): verifică header-ul
  - [ ] Nume companie = "CLIENT 2 NAME SL" (NU "DE CAMINO...")
  - [ ] CIF = CIF client 2 (NU "B85524536")
  - [ ] Email = email client 2 (NU "info@decaminoservicios.com")
- [ ] Export PDF (SolicitudesPage): verifică header-ul
  - [ ] Date companie corecte

### ✅ Email-uri
- [ ] Trimite email de test (ex: din Sent Emails)
- [ ] Verifică "From": trebuie să fie email client 2
- [ ] Verifică "BCC": trebuie să fie adrese client 2 (NU "decamino.rrhh@gmail.com")
- [ ] Email-urile ajung la adresele corecte

### ✅ Data Isolation
- [ ] Login cu user client 2: vede doar datele client 2
- [ ] Database `client2_db` conține doar date client 2
- [ ] Database `decamino_db` (client 1) rămâne neschimbat
- [ ] Nu există acces cross-database
- [ ] Backend client 2 se conectează DOAR la `client2_db` (verifică în logs)

### ✅ CORS
- [ ] Request de la `app.client2.com` → `api.client2.com`: SUCCESS
- [ ] Request de la `app.decaminoservicios.com` → `api.client2.com`: BLOCKED (sau invers)
- [ ] CORS headers corecte în response

---

---

## SUMAR

### 8 Fișiere de Modificat

**Frontend (3):**
1. `frontend/src/utils/routes.js`
2. `frontend/src/utils/exportExcel.ts`
3. `frontend/src/pages/SolicitudesPage.jsx`

**Backend (5):**
4. `backend/src/main.ts`
5. `backend/src/services/email.service.ts`
6. `backend/src/controllers/sent-emails.controller.ts`
7. `backend/src/controllers/monitoring.controller.ts`
8. `backend/src/services/hall-of-fame.service.ts`

**Total:** ~50-100 linii de cod modificate, toate backward compatible.

### Ordinea Corectă de Clonare

1. ✅ Clonează proiectul
2. ✅ **Creează database MANUAL (MySQL)** ← CRITIC!
3. ✅ Configurează backend `.env` (cu DB_NAME, DB_USERNAME, DB_PASSWORD)
4. ✅ Rulează Prisma (`db push` sau `migrate deploy`)
5. ✅ Configurează frontend `.env.production`
6. ✅ Deploy backend
7. ✅ Configurează DNS/reverse proxy
8. ✅ Deploy frontend
9. ✅ Validare

**⚠️ NU schimba ordinea! Database-ul trebuie să existe înainte de Prisma!**
