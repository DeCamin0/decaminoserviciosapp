# Plan de Acțiune: Externalizare Hardcodate-uri

**Data:** $(date)  
**Status:** 🟡 În Așteptare  
**Timp estimat total:** ~4-6 ore

---

## ✅ CE E DEJA ÎN ENV VARS (Nu Trebuie Modificat)

### Backend - Deja Configurat ✅

**Telegram:**
- ✅ `TELEGRAM_BOT_TOKEN` - folosit în `TelegramService`
- ✅ `TELEGRAM_CHAT_ID` - folosit în `TelegramService` (are default hardcodat `-4990173907`, dar e OK - doar default)
- ✅ `TELEGRAM_BOT_TOKEN_GENERAL` - folosit în `TelegramService`
- ✅ `TELEGRAM_CHAT_ID_GENERAL` - folosit în `TelegramService`

**SMTP:**
- ✅ `SMTP_HOST` - folosit în `EmailService`
- ✅ `SMTP_PORT` - folosit în `EmailService`
- ✅ `SMTP_USER` - folosit în `EmailService`
- ✅ `SMTP_PASSWORD` - folosit în `EmailService`
- ✅ `SMTP_SECURE` - folosit în `EmailService`
- ✅ `SMTP_FROM` - folosit în `EmailService` (are fallback hardcodat, dar e OK - doar fallback)

**N8N:**
- ✅ `N8N_BASE_URL` - folosit în `n8n.config.ts` (are fallback hardcodat, dar e OK - doar fallback)

**Database:**
- ✅ `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` - folosite în `PrismaService`

**JWT:**
- ✅ `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` - folosite în `jwt.config.ts`

**Concluzie:** Telegram, SMTP, N8N, Database, JWT sunt deja configurate corect! Nu trebuie să le modifici.

---

## 📊 INVENTAR COMPLET - Hardcodate-uri Găsite (Ce Trebuie Modificat)

### 🔴 CRITICE (Data Leak / Break Production)

#### 1. URL-uri API (Frontend)
- **Fișier:** `frontend/src/utils/routes.js`
- **Problema:** Peste 100 de linii cu `https://api.decaminoservicios.com` hardcodat
- **Risc:** Client 2 va trimite request-uri către backend Client 1
- **Impact:** CRITIC - aplicația nu va funcționa pentru Client 2

#### 2. CORS Origins (Backend)
- **Fișier:** `backend/src/main.ts` (liniile 29-30, 129-130, 137-138)
- **Problema:** `app.decaminoservicios.com`, `decaminoservicios.com` hardcodate
- **Risc:** Frontend Client 2 va fi blocat de CORS
- **Impact:** CRITIC - aplicația nu va funcționa pentru Client 2

#### 3. Date Companie în Export-uri (Frontend)
- **Fișiere:**
  - `frontend/src/utils/exportExcel.ts` - COMPANY_INFO hardcodat
  - `frontend/src/pages/SolicitudesPage.jsx` - PDF (liniile ~5599-5603)
  - `frontend/src/pages/Fichaje.jsx` - PDF (liniile ~5723-5727)
  - `frontend/src/pages/EmpleadosPage.jsx` - PDF (liniile ~2831-2835) + email (linia 2364, 2501)
  - `frontend/src/pages/DocumentosEmpleadosPage.jsx` - PDF (liniile ~3942-3957)
  - `frontend/src/pages/DatosPage.jsx` - form default (linia 1879)
  - `frontend/src/components/HorasTrabajadasPDF.tsx` - PDF (linia 526)
  - `frontend/src/utils/inspectionExporter.js` - PDF (linia 131)
- **Risc:** Export-urile Client 2 vor afișa datele Client 1
- **Impact:** CRITIC - data leak, branding greșit

#### 4. Email BCC (Backend)
- **Fișiere:**
  - `backend/src/controllers/sent-emails.controller.ts` - BCC (linia 325-326)
  - `backend/src/controllers/monitoring.controller.ts` - BCC (linia 208)
  - `backend/src/services/hall-of-fame.service.ts` - BCC (linia 5855)
  - `backend/src/controllers/empleados.controller.ts` - MULTIPLE BCC (liniile 436, 453, 499, 511, 696, 711, 964, 1427, 1440, 1628, 1789, 1944, 2070, 2293, 2602)
  - `backend/src/services/solicitudes.service.ts` - BCC (liniile 418, 1581, 2329, 2338)
  - `backend/src/services/ausencias.service.ts` - BCC (liniile 338, 599, 2680)
  - `backend/src/services/nominas.service.ts` - BCC (linia 760)
  - `backend/src/services/pedidos.service.ts` - BCC (linia 1747)
  - `backend/src/email-ingestion/services/document-distribution.service.ts` - BCC (linia 127)
  - `backend/src/services/scheduled-messages-cron.service.ts` - BCC (linia 192)
- **Risc:** Email-urile Client 2 vor merge la adrese Client 1
- **Impact:** CRITIC - data leak, confidențialitate

#### 5. SMTP From Fallback (Backend)
- **Fișier:** `backend/src/services/email.service.ts` (liniile 86, 145, 204)
- **Problema:** `'DE CAMINO Servicios Auxiliares SL <info@decaminoservicios.com>'` hardcodat ca fallback
- **Status:** `SMTP_FROM` e DEJA în env vars, dar fallback-ul e hardcodat
- **Risc:** Dacă `SMTP_FROM` lipsește, email-urile Client 2 vor apărea ca trimise de Client 1
- **Impact:** MEDIUM - doar dacă env var lipsește (dar e recomandat să fie setat)

### 🟡 MEDIUM (Cosmetic, dar Important pentru Branding)

#### 6. Culori Branding (Frontend)
- **Fișiere:**
  - `frontend/src/utils/exportExcel.ts` - `#CC0000`, `#0066CC` (liniile 16, 25, 39)
  - `frontend/src/pages/DocumentosEmpleadosPage.jsx` - `#CC0000`, `#0066CC` (liniile 3995, 4009)
  - `frontend/src/pages/SolicitudesPage.jsx` - `#CC0000`, `#0066CC` (liniile 5629, 5645)
  - `frontend/src/pages/Fichaje.jsx` - `#CC0000`, `#0066CC` (liniile 5760, 5763, 5777, 5790)
  - `frontend/src/pages/EmpleadosPage.jsx` - `#CC0000`, `#0066CC` (liniile 2862, 2878)
  - `frontend/src/components/admin/ActivityLog.jsx` - `#CC0000`, `#0066CC` (liniile 369, 383, 391)
  - `frontend/src/components/ChatBot.jsx` - `#E53935` (liniile 596, 600, 693)
  - `frontend/src/components/ChatBot.css` - `#E53935` (liniile 27, 97, 246, 252, 276, 346)
  - `frontend/src/utils/inspectionExporter.js` - `#E53935` (liniile 379, 384, 390, 406, 415, 432)
  - `frontend/src/theme.js` - `#E53935` (linia 3)
- **Risc:** Client 2 va avea culorile Client 1 în Excel-uri și UI
- **Impact:** MEDIUM - branding greșit, dar nu afectează funcționalitatea

#### 7. Logo Path (Frontend)
- **Fișiere:**
  - `frontend/src/components/MainLayout.jsx` - `logo.svg` (linia 18)
  - `frontend/src/layouts/DesktopLayout.jsx` - `logo.svg` (linia 19)
  - `frontend/src/layouts/MobileLayout.jsx` - `logo.svg` (linia 17)
  - `frontend/src/utils/pushNotifications.js` - `logo.svg` (liniile 56-57)
  - `frontend/src/sw.js` - `logo.svg` (liniile 101-102, 115-116)
  - `frontend/src/components/ChatBot.jsx` - `logo.svg` (linia 752)
  - `frontend/src/pages/LoginPage.jsx` - `logo.svg` (linia 250)
  - `frontend/src/utils/inspectionExporter.js` - `logo.svg` (linia 72)
- **Risc:** Client 2 va vedea logo-ul Client 1
- **Impact:** MEDIUM - branding greșit, dar nu afectează funcționalitatea

#### 8. Logo Import Static (Frontend)
- **Fișiere:**
  - `frontend/src/components/inspections/InspectionForm.jsx` - `import logoImg from '@/assets/logo.svg'`
  - `frontend/src/components/employees/EmployeePDF.jsx` - `import logoImg from '@/assets/logo.svg'`
  - `frontend/src/components/HorasTrabajadasPDF.tsx` - `import logoImg from '@/assets/logo.svg'`
- **Risc:** Logo-ul Client 1 va fi bundle-uit în build
- **Impact:** MEDIUM - necesită rebuild pentru fiecare client (mai complex)

---

## 🎯 PLAN DE ACȚIUNE - Ordine de Implementare

### Faza 1: Frontend - URL-uri API (CRITIC) ⏱️ ~30 min

**Prioritate:** 🔴 CRITIC  
**Fișier:** `frontend/src/utils/routes.js`

**Modificări:**
1. Creează constantă `BACKEND_PROD_URL` din env var
2. Înlocuiește toate hardcodate-urile `'https://api.decaminoservicios.com'` cu `BACKEND_PROD_URL`
3. Păstrează backward compatibility cu default

**Test:**
- [ ] Login funcționează (default-ul funcționează)
- [ ] Request-urile merg la `api.decaminoservicios.com` (fără env var)
- [ ] Request-urile merg la `api.client2.com` (cu env var setat)

---

### Faza 2: Backend - CORS Origins (CRITIC) ⏱️ ~15 min

**Prioritate:** 🔴 CRITIC  
**Fișier:** `backend/src/main.ts`

**Modificări:**
1. Externalizează CORS origins în `CORS_ORIGINS` env var
2. Păstrează backward compatibility cu default-uri

**Test:**
- [ ] Backend pornește (default-urile funcționează)
- [ ] CORS funcționează pentru `app.decaminoservicios.com` (default)
- [ ] CORS funcționează pentru `app.client2.com` (cu env var setat)

---

### Faza 3: Frontend - Date Companie în Export-uri (CRITIC) ⏱️ ~1-2 ore

**Prioritate:** 🔴 CRITIC  
**Fișiere multiple:**

#### 3.1. `frontend/src/utils/exportExcel.ts` (~20 min)
- Externalizează `COMPANY_INFO` în env vars
- Externalizează culori (`PRIMARY_COLOR`, `SECONDARY_COLOR`)

#### 3.2. `frontend/src/pages/SolicitudesPage.jsx` (~15 min)
- Înlocuiește date companie hardcodate cu env vars

#### 3.3. `frontend/src/pages/Fichaje.jsx` (~15 min)
- Înlocuiește date companie hardcodate cu env vars

#### 3.4. `frontend/src/pages/EmpleadosPage.jsx` (~20 min)
- Înlocuiește date companie hardcodate cu env vars (PDF + email)

#### 3.5. `frontend/src/pages/DocumentosEmpleadosPage.jsx` (~15 min)
- Înlocuiește date companie hardcodate cu env vars

#### 3.6. `frontend/src/pages/DatosPage.jsx` (~5 min)
- Înlocuiește default form value cu env var

#### 3.7. `frontend/src/components/HorasTrabajadasPDF.tsx` (~5 min)
- Înlocuiește nume companie hardcodat cu env var

#### 3.8. `frontend/src/utils/inspectionExporter.js` (~5 min)
- Înlocuiește nume companie hardcodat cu env var

**Test:**
- [ ] Export Excel → verifică header (apare "DE CAMINO..." cu default-uri)
- [ ] Export PDF → verifică header (apare "DE CAMINO..." cu default-uri)
- [ ] Export cu env vars Client 2 → verifică că apare "CLIENT 2..." (NU "DE CAMINO...")

---

### Faza 4: Backend - Email BCC (CRITIC) ⏱️ ~1-2 ore

**Prioritate:** 🔴 CRITIC  
**Fișiere multiple:**

#### 4.1. `backend/src/controllers/sent-emails.controller.ts` (~10 min)
- Externalizează BCC în `EMAIL_BCC` env var

#### 4.2. `backend/src/controllers/monitoring.controller.ts` (~10 min)
- Externalizează BCC în `EMAIL_BCC` env var

#### 4.3. `backend/src/services/hall-of-fame.service.ts` (~10 min)
- Externalizează BCC în `EMAIL_BCC` env var

#### 4.4. `backend/src/controllers/empleados.controller.ts` (~30 min)
- Externalizează toate BCC-urile în `EMAIL_BCC` env var
- **ATENȚIE:** Multe locații (15+), verifică fiecare

#### 4.5. `backend/src/services/solicitudes.service.ts` (~15 min)
- Externalizează BCC în `EMAIL_BCC` env var

#### 4.6. `backend/src/services/ausencias.service.ts` (~15 min)
- Externalizează BCC în `EMAIL_BCC` env var

#### 4.7. `backend/src/services/nominas.service.ts` (~5 min)
- Externalizează BCC în `EMAIL_BCC` env var

#### 4.8. `backend/src/services/pedidos.service.ts` (~5 min)
- Externalizează BCC în `EMAIL_BCC` env var

#### 4.9. `backend/src/email-ingestion/services/document-distribution.service.ts` (~5 min)
- Externalizează BCC în `EMAIL_BCC` env var

#### 4.10. `backend/src/services/scheduled-messages-cron.service.ts` (~5 min)
- Externalizează BCC în `EMAIL_BCC` env var

**Test:**
- [ ] Trimite email de test → verifică că BCC e corect (default-ul funcționează)
- [ ] Trimite email cu env var Client 2 → verifică că BCC e adrese Client 2 (NU Client 1)

---

### Faza 5: Backend - SMTP From Fallback (MEDIUM) ⏱️ ~10 min

**Prioritate:** 🟡 MEDIUM (SMTP_FROM e deja în env vars, doar fallback-ul e hardcodat)  
**Fișier:** `backend/src/services/email.service.ts`

**Status Actual:**
- ✅ `SMTP_FROM` e DEJA folosit din env vars (linia 85, 145, 203)
- ⚠️ Fallback-ul e hardcodat: `'DE CAMINO Servicios Auxiliares SL <info@decaminoservicios.com>'` (linia 86, 146, 204)

**Modificări:**
1. Externalizează fallback-ul în `COMPANY_NAME` și `COMPANY_EMAIL` env vars
2. Construiește fallback din env vars: `${COMPANY_NAME} <${COMPANY_EMAIL}>`
3. Păstrează backward compatibility cu default-ul vechi dacă env vars lipsesc

**Test:**
- [ ] Trimite email cu `SMTP_FROM` setat → verifică că "From" e corect
- [ ] Trimite email fără `SMTP_FROM` (folosește fallback) → verifică că "From" e construit din `COMPANY_NAME` și `COMPANY_EMAIL`

---

### Faza 5.1: Backend - Telegram Chat ID Default (MEDIUM - Opțional) ⏱️ ~5 min

**Prioritate:** 🟡 MEDIUM (Opțional - doar dacă vrei să externalizezi default-ul)  
**Fișier:** `backend/src/services/telegram.service.ts`

**Status Actual:**
- ✅ `TELEGRAM_BOT_TOKEN` e DEJA în env vars
- ✅ `TELEGRAM_CHAT_ID` e DEJA în env vars
- ⚠️ Default-ul pentru `TELEGRAM_CHAT_ID` e hardcodat: `'-4990173907'` (linia 25)

**Modificări (Opțional):**
1. Externalizează default-ul în `TELEGRAM_CHAT_ID_DEFAULT` env var
2. Sau păstrează hardcodat (e doar default, nu afectează Client 2 dacă setezi `TELEGRAM_CHAT_ID`)

**Recomandare:** Păstrează hardcodat - e doar default, Client 2 va seta `TELEGRAM_CHAT_ID` în env.

---

### Faza 5.2: Backend - N8N Base URL Fallback (MEDIUM - Opțional) ⏱️ ~5 min

**Prioritate:** 🟡 MEDIUM (Opțional - doar dacă vrei să externalizezi fallback-ul)  
**Fișier:** `backend/src/config/n8n.config.ts`

**Status Actual:**
- ✅ `N8N_BASE_URL` e DEJA în env vars
- ⚠️ Fallback-ul e hardcodat: `'https://n8n.decaminoservicios.com'` (linia 4)

**Modificări (Opțional):**
1. Externalizează fallback-ul în `N8N_DOMAIN` env var
2. Construiește fallback: `https://${N8N_DOMAIN}` sau `https://n8n.${API_DOMAIN}`

**Recomandare:** Păstrează hardcodat - e doar fallback, Client 2 va seta `N8N_BASE_URL` în env.

---

### Faza 6: Frontend - Culori Branding (MEDIUM) ⏱️ ~1-2 ore

**Prioritate:** 🟡 MEDIUM  
**Fișiere multiple:**

#### 6.1. `frontend/src/utils/exportExcel.ts` (~10 min)
- ✅ Deja făcut în Faza 3.1 (culori)

#### 6.2. `frontend/src/pages/DocumentosEmpleadosPage.jsx` (~10 min)
- Externalizează culori PDF în env vars

#### 6.3. `frontend/src/pages/SolicitudesPage.jsx` (~10 min)
- Externalizează culori PDF în env vars

#### 6.4. `frontend/src/pages/Fichaje.jsx` (~10 min)
- Externalizează culori PDF în env vars

#### 6.5. `frontend/src/pages/EmpleadosPage.jsx` (~10 min)
- Externalizează culori PDF în env vars

#### 6.6. `frontend/src/components/admin/ActivityLog.jsx` (~10 min)
- Externalizează culori Excel în env vars

#### 6.7. `frontend/src/components/ChatBot.jsx` + `ChatBot.css` (~20 min)
- Externalizează culori UI în env vars sau CSS variables
- **Notă:** CSS variables ar fi mai elegant

#### 6.8. `frontend/src/utils/inspectionExporter.js` (~15 min)
- Externalizează culori PDF în env vars

#### 6.9. `frontend/src/theme.js` (~5 min)
- Externalizează primary color în env var

**Test:**
- [ ] Export Excel → verifică culori (roșu/albastru cu default-uri)
- [ ] Export PDF → verifică culori (roșu/albastru cu default-uri)
- [ ] UI → verifică culori (roșu cu default-uri)
- [ ] Export cu env vars Client 2 → verifică că culorile sunt Client 2 (NU roșu/albastru)

---

### Faza 7: Frontend - Logo Path (MEDIUM) ⏱️ ~30 min

**Prioritate:** 🟡 MEDIUM  
**Fișiere multiple:**

#### 7.1. `frontend/src/components/MainLayout.jsx` (~5 min)
- Externalizează logo path în `VITE_LOGO_PATH` env var

#### 7.2. `frontend/src/layouts/DesktopLayout.jsx` (~5 min)
- Externalizează logo path în `VITE_LOGO_PATH` env var

#### 7.3. `frontend/src/layouts/MobileLayout.jsx` (~5 min)
- Externalizează logo path în `VITE_LOGO_PATH` env var

#### 7.4. `frontend/src/utils/pushNotifications.js` (~5 min)
- Externalizează logo path în `VITE_LOGO_PATH` env var

#### 7.5. `frontend/src/sw.js` (~5 min)
- Externalizează logo path în `VITE_LOGO_PATH` env var

#### 7.6. `frontend/src/components/ChatBot.jsx` (~5 min)
- Externalizează logo path în `VITE_LOGO_PATH` env var

#### 7.7. `frontend/src/pages/LoginPage.jsx` (~5 min)
- Externalizează logo path în `VITE_LOGO_PATH` env var

#### 7.8. `frontend/src/utils/inspectionExporter.js` (~5 min)
- Externalizează logo path în `VITE_LOGO_PATH` env var

**Test:**
- [ ] Logo apare corect (default-ul `logo.svg` funcționează)
- [ ] Logo apare corect cu env var Client 2 (`logo-client2.svg`)

---

### Faza 8: Frontend - Logo Import Static (MEDIUM - Opțional) ⏱️ ~30 min

**Prioritate:** 🟡 MEDIUM (Opțional - mai complex)  
**Fișiere:**
- `frontend/src/components/inspections/InspectionForm.jsx`
- `frontend/src/components/employees/EmployeePDF.jsx`
- `frontend/src/components/HorasTrabajadasPDF.tsx`

**Problema:** Import static `import logoImg from '@/assets/logo.svg'` bundle-uiește logo-ul în build.

**Opțiuni:**
1. **Opțiunea A (Recomandat):** Folosește path din env var (similar cu celelalte)
2. **Opțiunea B:** Păstrează import static, dar schimbi logo-ul manual pentru fiecare client

**Recomandare:** Opțiunea A - externalizează path-ul, folosește `import.meta.env.VITE_LOGO_PATH`

**Test:**
- [ ] Logo apare corect în PDF-uri (default-ul funcționează)
- [ ] Logo apare corect cu env var Client 2

---

## 📋 CHECKLIST FINAL

### După Faza 1-4 (CRITICE):
- [ ] Toate fișierele critice modificate
- [ ] Testează producția actuală (fără env vars):
  - [ ] Login funcționează
  - [ ] Export Excel → verifică header (apare "DE CAMINO...")
  - [ ] Export PDF → verifică header
  - [ ] Trimite email → verifică "From" și "BCC"
  - [ ] CORS funcționează
- [ ] Commit modificările
- [ ] Deploy pe producție
- [ ] Verifică din nou pe producție că totul funcționează

### După Faza 5-8 (MEDIUM):
- [ ] Toate fișierele de branding modificate
- [ ] Testează branding:
  - [ ] Logo apare corect
  - [ ] Culori în Excel-uri corecte
  - [ ] Culori în PDF-uri corecte
  - [ ] Culori în UI corecte
- [ ] Commit modificările
- [ ] Deploy pe producție

---

## 🎯 REZULTAT FINAL

**După ce faci toate fazele:**
- ✅ Producția actuală (Client 1) funcționează normal (backward compatible)
- ✅ Pentru Client 2: doar clonezi proiectul, schimbi env vars, copiezi logo, gata!
- ✅ NU mai trebuie să modifici codul pentru Client 2!

---

## ⏱️ TIMP ESTIMAT TOTAL

- **Faza 1:** ~30 min (Frontend API URLs) - 🔴 CRITIC
- **Faza 2:** ~15 min (Backend CORS) - 🔴 CRITIC
- **Faza 3:** ~1-2 ore (Frontend Date Companie) - 🔴 CRITIC
- **Faza 4:** ~1-2 ore (Backend Email BCC) - 🔴 CRITIC
- **Faza 5:** ~10 min (Backend SMTP From Fallback) - 🟡 MEDIUM
- **Faza 5.1:** ~5 min (Backend Telegram Default - Opțional) - 🟡 MEDIUM
- **Faza 5.2:** ~5 min (Backend N8N Fallback - Opțional) - 🟡 MEDIUM
- **Faza 6:** ~1-2 ore (Frontend Culori) - 🟡 MEDIUM
- **Faza 7:** ~30 min (Frontend Logo Path) - 🟡 MEDIUM
- **Faza 8:** ~30 min (Frontend Logo Import - Opțional) - 🟡 MEDIUM

**Total:** ~4-6 ore pentru toate fazele

**Recomandare:** 
- **Fazele 1-4 (CRITICE):** ~3-4 ore - fă-le întâi!
- **Faza 5 (SMTP Fallback):** ~10 min - fă-o după fazele critice
- **Fazele 5.1-5.2 (Opțional):** ~10 min - doar dacă vrei să externalizezi și fallback-urile
- **Fazele 6-8 (Branding):** ~2-3 ore - fă-le când ai timp

---

## 🚀 URMĂTORUL PAS

**Începe cu Faza 1:** `frontend/src/utils/routes.js` - Externalizare URL-uri API

**Spune "Aprobat" când ești gata să încep!**
