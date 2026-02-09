# Ce Trebuie Făcut ACUM (în Proiectul Actual)

## 🎯 Obiectiv

Externalizează hardcodate-urile critice în env vars, astfel încât:
- ✅ Producția actuală (Client 1) continuă să funcționează (backward compatible)
- ✅ Mai târziu, pentru Client 2, doar schimbi env vars (fără modificări de cod)

---

## 📋 LISTA DE LUCRU (8 Fișiere)

### Frontend (3 fișiere)

#### 1. `frontend/src/utils/routes.js`
**Ce face:** Toate endpoint-urile folosesc `https://api.decaminoservicios.com` hardcodat

**Modificare:**
- Înlocuiește `'https://api.decaminoservicios.com'` cu `import.meta.env.VITE_API_URL || 'https://api.decaminoservicios.com'`
- Aplică la toate endpoint-urile (baseUrl, login, refresh, me, etc.)

**Test:** După modificare, producția continuă să funcționează (default-ul e păstrat)

---

#### 2. `frontend/src/utils/exportExcel.ts`
**Ce face:** COMPANY_INFO hardcodat (nume, CIF, adresă, telefon, email)

**Modificare:**
```typescript
const COMPANY_INFO = {
  name: import.meta.env.VITE_COMPANY_NAME || 'DE CAMINO SERVICIOS AUXILIARES SL',
  cif: import.meta.env.VITE_COMPANY_CIF || 'B85524536',
  address: import.meta.env.VITE_COMPANY_ADDRESS || 'Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España',
  phone: import.meta.env.VITE_COMPANY_PHONE || '910 440 275',
  email: import.meta.env.VITE_COMPANY_EMAIL || 'info@decaminoservicios.com'
};
```

**Test:** Export Excel → verifică că apare "DE CAMINO..." (default-ul funcționează)

---

#### 3. `frontend/src/pages/SolicitudesPage.jsx`
**Ce face:** Date companie hardcodate în PDF-uri (liniile ~5327-5331)

**Modificare:**
- Înlocuiește hardcodate-urile cu env vars (similar cu exportExcel.ts)
- Folosește: `VITE_COMPANY_NAME`, `VITE_COMPANY_CIF`, `VITE_COMPANY_ADDRESS`, `VITE_COMPANY_PHONE`, `VITE_COMPANY_EMAIL`

**Test:** Export PDF din SolicitudesPage → verifică că datele companiei apar corect

---

### Backend (5 fișiere)

#### 4. `backend/src/main.ts`
**Ce face:** CORS origins hardcodate (`https://app.decaminoservicios.com`, `https://decaminoservicios.com`)

**Modificare:**
```typescript
const defaultOrigins = ['http://localhost:5173'];
const corsOrigins = process.env.CORS_ORIGINS
  ? [...process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()), ...defaultOrigins]
  : ['http://localhost:5173', 'https://app.decaminoservicios.com', 'https://decaminoservicios.com']; // backward compatible
```

**Test:** Backend pornește, CORS funcționează (default-urile sunt păstrate)

---

#### 5. `backend/src/services/email.service.ts`
**Ce face:** SMTP_FROM fallback hardcodat (linia ~204)

**Modificare:**
```typescript
const fromEmail = options?.from || 
  this.configService.get<string>('SMTP_FROM') || 
  process.env.SMTP_FROM ||
  'DE CAMINO Servicios Auxiliares SL <info@decaminoservicios.com>'; // backward compatible
```

**Test:** Trimite email de test → verifică că "From" e corect (default-ul funcționează)

---

#### 6. `backend/src/controllers/sent-emails.controller.ts`
**Ce face:** BCC emails hardcodate (liniile ~325-326), inclusiv hardcodare mascată pentru 'gestoria'

**Modificare:**
```typescript
const bccList = process.env.EMAIL_BCC?.split(',').map(e => e.trim()) || ['decamino.rrhh@gmail.com'];
```

**Șterge:** Logica cu `recipientType === 'gestoria'` (hardcodare mascată)

**Test:** Trimite email → verifică că BCC e corect (default-ul funcționează)

---

#### 7. `backend/src/controllers/monitoring.controller.ts`
**Ce face:** BCC email hardcodat (linia ~208)

**Modificare:**
```typescript
const bccList = process.env.EMAIL_BCC?.split(',').map(e => e.trim()) || ['app@decaminoservicios.com'];
```

**Test:** Trimite email de monitoring → verifică că BCC e corect

---

#### 8. `backend/src/services/hall-of-fame.service.ts`
**Ce face:** BCC email hardcodat (verifică în cod exact unde)

**Modificare:**
- Similar cu sent-emails.controller.ts
- Folosește `process.env.EMAIL_BCC` cu fallback

**Test:** Hall of Fame email → verifică că BCC e corect

---

## 🔧 ENV VARS DE ADĂUGAT (Opțional pentru Client 1)

**Nu e obligatoriu să le adaugi ACUM** (codul are default-uri), dar poți:

### Backend `.env` (opțional)
```env
# Dacă vrei să le setezi explicit (opțional, default-urile funcționează)
API_DOMAIN=api.decaminoservicios.com
CORS_ORIGINS=https://app.decaminoservicios.com,https://decaminoservicios.com
COMPANY_NAME=De Camino Servicios Auxiliares SL
COMPANY_EMAIL=info@decaminoservicios.com
SMTP_FROM=De Camino Servicios Auxiliares SL <info@decaminoservicios.com>
EMAIL_BCC=decamino.rrhh@gmail.com,app@decaminoservicios.com
```

### Frontend `.env.production` (opțional)
```env
# Dacă vrei să le setezi explicit (opțional, default-urile funcționează)
VITE_API_URL=https://api.decaminoservicios.com
VITE_COMPANY_NAME=DE CAMINO SERVICIOS AUXILIARES SL
VITE_COMPANY_CIF=B85524536
VITE_COMPANY_ADDRESS=Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España
VITE_COMPANY_PHONE=910 440 275
VITE_COMPANY_EMAIL=info@decaminoservicios.com
```

---

## ✅ CHECKLIST FINAL

După ce faci toate modificările:

- [ ] Toate cele 8 fișiere modificate
- [ ] Testează producția actuală:
  - [ ] Login funcționează
  - [ ] Export Excel → verifică header (apare "DE CAMINO...")
  - [ ] Export PDF → verifică header
  - [ ] Trimite email → verifică "From" și "BCC"
  - [ ] CORS funcționează (frontend → backend)
- [ ] Commit modificările
- [ ] Deploy pe producție
- [ ] Verifică din nou pe producție că totul funcționează

---

## 🎯 REZULTAT

**După ce faci asta:**
- ✅ Producția actuală (Client 1) funcționează normal (backward compatible)
- ✅ Pentru Client 2: doar clonezi proiectul, schimbi env vars, gata!

**NU mai trebuie să modifici codul pentru Client 2!**

---

## ⏱️ TIMP ESTIMAT

- **Modificări cod:** ~1-2 ore (8 fișiere, ~50-100 linii)
- **Testare:** ~1 oră
- **Deploy:** ~30 min

**Total:** ~3-4 ore pentru a pregăti proiectul pentru clonare
