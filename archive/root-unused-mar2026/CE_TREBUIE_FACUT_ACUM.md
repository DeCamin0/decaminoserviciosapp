# Ce Trebuie Făcut ACUM (în Proiectul Actual)

## 🎯 Obiectiv

Externalizează hardcodate-urile critice în env vars, astfel încât:
- ✅ Producția actuală (Client 1) continuă să funcționează (backward compatible)
- ✅ Mai târziu, pentru Client 2, doar schimbi env vars (fără modificări de cod)

---

## 📋 LISTA DE LUCRU (11 Fișiere)

### Frontend (6 fișiere)

#### 1. `frontend/src/utils/routes.js`
**Ce face:** Toate endpoint-urile folosesc `https://api.decaminoservicios.com` hardcodat

**Modificare:**
- Înlocuiește `'https://api.decaminoservicios.com'` cu `import.meta.env.VITE_API_URL || 'https://api.decaminoservicios.com'`
- Aplică la toate endpoint-urile (baseUrl, login, refresh, me, etc.)

**Test:** După modificare, producția continuă să funcționează (default-ul e păstrat)

---

#### 2. `frontend/src/utils/exportExcel.ts`
**Ce face:** COMPANY_INFO hardcodat (nume, CIF, adresă, telefon, email) + culori hardcodate (`#CC0000`, `#0066CC`)

**Modificare:**
```typescript
// Company info din env vars
const COMPANY_INFO = {
  name: import.meta.env.VITE_COMPANY_NAME || 'DE CAMINO SERVICIOS AUXILIARES SL',
  cif: import.meta.env.VITE_COMPANY_CIF || 'B85524536',
  address: import.meta.env.VITE_COMPANY_ADDRESS || 'Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España',
  phone: import.meta.env.VITE_COMPANY_PHONE || '910 440 275',
  email: import.meta.env.VITE_COMPANY_EMAIL || 'info@decaminoservicios.com'
};

// Culori din env vars (fără # pentru Excel ARGB)
const PRIMARY_COLOR = (import.meta.env.VITE_PRIMARY_COLOR || '#CC0000').replace('#', '');
const SECONDARY_COLOR = (import.meta.env.VITE_SECONDARY_COLOR || '#0066CC').replace('#', '');

// Înlocuiește în STYLES:
const STYLES = {
  companyName: {
    fill: { fgColor: { argb: PRIMARY_COLOR } }  // ← Din env!
  },
  reportTitle: {
    fill: { fgColor: { argb: SECONDARY_COLOR } }  // ← Din env!
  },
  totalsRow: {
    fill: { fgColor: { argb: PRIMARY_COLOR } }   // ← Din env!
  }
};
```

**Test:** Export Excel → verifică că apare "DE CAMINO..." și culorile roșu/albastru (default-urile funcționează)

---

#### 3. `frontend/src/pages/SolicitudesPage.jsx`
**Ce face:** Date companie hardcodate în PDF-uri (liniile ~5327-5331)

**Modificare:**
- Înlocuiește hardcodate-urile cu env vars (similar cu exportExcel.ts)
- Folosește: `VITE_COMPANY_NAME`, `VITE_COMPANY_CIF`, `VITE_COMPANY_ADDRESS`, `VITE_COMPANY_PHONE`, `VITE_COMPANY_EMAIL`

**Test:** Export PDF din SolicitudesPage → verifică că datele companiei apar corect

---

#### 4. `frontend/src/components/MainLayout.jsx`
**Ce face:** Logo path hardcodat (`logo.svg`)

**Modificare:**
```javascript
const getLogoUrl = () => {
  if (window.location.hostname.includes('ngrok')) {
    return 'data:image/svg+xml;base64,...'; // Keep ngrok fallback
  }
  const logoPath = import.meta.env.VITE_LOGO_PATH || 'logo.svg';
  const basePath = import.meta.env.VITE_BASE_PATH || '/';
  return `${basePath}${logoPath}`.replace(/\/+/g, '/');
};
```

**Test:** Verifică că logo-ul apare corect (default-ul `logo.svg` funcționează)

---

#### 5. `frontend/src/layouts/DesktopLayout.jsx`
**Ce face:** Logo path hardcodat (`logo.svg`)

**Modificare:**
- Similar cu MainLayout.jsx
- Folosește `VITE_LOGO_PATH` cu fallback la `logo.svg`

**Test:** Verifică că logo-ul apare corect pe desktop

---

#### 6. `frontend/src/layouts/MobileLayout.jsx` (dacă există)
**Ce face:** Logo path hardcodat (`logo.svg`)

**Modificare:**
- Similar cu MainLayout.jsx
- Folosește `VITE_LOGO_PATH` cu fallback la `logo.svg`

**Test:** Verifică că logo-ul apare corect pe mobile

---

### Backend (5 fișiere)

#### 7. `backend/src/main.ts`
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

#### 8. `backend/src/services/email.service.ts`
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

#### 9. `backend/src/controllers/sent-emails.controller.ts`
**Ce face:** BCC emails hardcodate (liniile ~325-326), inclusiv hardcodare mascată pentru 'gestoria'

**Modificare:**
```typescript
const bccList = process.env.EMAIL_BCC?.split(',').map(e => e.trim()) || ['decamino.rrhh@gmail.com'];
```

**Șterge:** Logica cu `recipientType === 'gestoria'` (hardcodare mascată)

**Test:** Trimite email → verifică că BCC e corect (default-ul funcționează)

---

#### 10. `backend/src/controllers/monitoring.controller.ts`
**Ce face:** BCC email hardcodat (linia ~208)

**Modificare:**
```typescript
const bccList = process.env.EMAIL_BCC?.split(',').map(e => e.trim()) || ['app@decaminoservicios.com'];
```

**Test:** Trimite email de monitoring → verifică că BCC e corect

---

#### 11. `backend/src/services/hall-of-fame.service.ts`
**Ce face:** BCC email hardcodat (verifică în cod exact unde)

**Modificare:**
- Similar cu sent-emails.controller.ts
- Folosește `process.env.EMAIL_BCC` cu fallback

**Test:** Hall of Fame email → verifică că BCC e corect

---

## 🎨 LOGO-URI ȘI CULORI (Manual pentru fiecare client)

### Logo-uri Fizice

**Pentru fiecare client nou:**
1. Copiezi logo-ul clientului în `frontend/public/logo-{client-slug}.svg`
2. Setezi `VITE_LOGO_PATH=logo-{client-slug}.svg` în `.env.production`

**Exemplu pentru Client 2:**
```bash
# 1. Copiezi logo-ul
cp client2-logo.svg frontend/public/logo-client2.svg

# 2. Setezi în .env.production
echo "VITE_LOGO_PATH=logo-client2.svg" >> frontend/.env.production
```

**Notă:** Logo-urile fizice NU se externalizează automat - trebuie copiate manual pentru fiecare client.

### Culori

Culorile se externalizează automat prin env vars (`VITE_PRIMARY_COLOR`, `VITE_SECONDARY_COLOR`). Pentru fiecare client, setezi culorile în `.env.production`.

**Exemplu pentru Client 2 (verde în loc de roșu):**
```env
VITE_PRIMARY_COLOR=#00AA00      # Verde
VITE_SECONDARY_COLOR=#0066FF    # Albastru
VITE_ACCENT_COLOR=#00CC00       # Verde accent
```

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

# Branding - Logo
VITE_LOGO_PATH=logo.svg

# Branding - Culori
VITE_PRIMARY_COLOR=#CC0000        # Roșu DeCamino
VITE_SECONDARY_COLOR=#0066CC      # Albastru DeCamino
VITE_ACCENT_COLOR=#E53935         # Roșu accent
```

---

## ✅ CHECKLIST FINAL

După ce faci toate modificările:

- [ ] Toate cele 11 fișiere modificate
- [ ] Testează producția actuală:
  - [ ] Login funcționează
  - [ ] Export Excel → verifică header (apare "DE CAMINO...") și culori (roșu/albastru)
  - [ ] Export PDF → verifică header
  - [ ] Logo apare corect în header (logo.svg)
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

- **Modificări cod:** ~2-3 ore (11 fișiere, ~80-120 linii)
- **Testare:** ~1 oră
- **Deploy:** ~30 min

**Total:** ~3-4 ore pentru a pregăti proiectul pentru clonare
