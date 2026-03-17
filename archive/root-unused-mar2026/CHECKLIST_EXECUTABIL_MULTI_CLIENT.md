# Checklist executabil – Multi-client (ordine commits + teste + rollback)

**Reguli:** Max 1–3 fișiere per commit. După fiecare commit: Test checklist (scurt sau complet). Comportamentul DeCamino nu se schimbă până la Faza 3.

**Legendă:**  
- **CP** = Critical path (necesar ca clientul 2 să poată rula în DEV cu propriul .env)  
- **Risc:** L = low, M = medium

---

## Test checklist standard (folosit după commit-uri)

După fiecare commit, bifă pe măsură ce verifici. Pentru commit-uri low-risk din Faza 1 poți folosi varianta **Scurtă**; pentru Faza 2 (backend/frontend care citesc config) și orice M folosești **Completă**.

### Scurtă (Faza 1, docs, scripturi)
- [ ] Backend: `npm run build` + start fără erori
- [ ] Frontend: `npm run build` fără erori
- [ ] Login + un request API (ex: GET /api/me)

### Completă (Faza 2, orice risc M)
- [ ] **Login + API de bază:** login, GET /api/me, token refresh
- [ ] **Pagini critice:** Empleados (listă), Fichaje, Solicitudes, Dashboard (date vizibile)
- [ ] **PDF:** generare 1 presupuesto + 1 informe; compară cu un PDF anterior (text legal, CIF, telefon, email, culori)
- [ ] **Email:** trimite un email de test (ex. invitație empleado sau notificare); verifică From, BCC, link-uri din corp către app
- [ ] **Signing:** deschide firmar.html și firmar-informe.html; verifică că se încarcă și că URL-urile către API/app sunt corecte
- [ ] **PWA / SW:** reîncarcă app; verifică cache/update (Application → Service Workers); instalare PWA dacă e cazul
- [ ] **n8n proxy:** dacă folosești workflow-uri din app, execută unul și verifică răspuns

---

## FAZA 1 – Config + fallback + securitate scripturi

*Comportament identic; zero impact runtime. Scripturile nu rulează în producție la request.*

---

### Commit 1.1 — Backend: add company config (fallback DeCamino)
**Nume commit:** `feat(config): add company.config.ts with DeCamino fallbacks`  
**CP:** Da  

| Fișier | Modificare |
|--------|------------|
| `backend/src/config/company.config.ts` | **Adăugare fișier.** registerAs('company', ...) cu COMPANY_LEGAL_NAME, COMPANY_ADDRESS, COMPANY_CIF, COMPANY_PHONE, COMPANY_EMAIL, COMPANY_EMAIL_BCC, COMPANY_EMAIL_FROM_NAME, COMPANY_WEBSITE, COMPANY_BRAND_RED, FRONTEND_APP_URL; toate cu fallback la valorile DeCamino. |

**Test checklist:** Scurtă (build backend + start).

**Risc:** L

---

### Commit 1.2 — Backend: register company config in ConfigModule
**Nume commit:** `feat(config): register company config in ConfigModule`  
**CP:** Da  

| Fișier | Modificare |
|--------|------------|
| `backend/src/config/config.module.ts` | **Refactor.** În `load: [...]` adaugi companyConfig; nu schimbi niciun serviciu. |

**Test checklist:** Scurtă.

**Risc:** L

---

### Commit 1.3 — Frontend: extend env.js with all VITE_ vars and fallbacks
**Nume commit:** `feat(frontend): extend env.js with all VITE_ vars and DeCamino fallbacks`  
**CP:** Da  

| Fișier | Modificare |
|--------|------------|
| `frontend/src/config/env.js` | **Adăugare variabile.** Exportă toate VITE_* (API_URL, API_BASE_URL, BASE_PATH, COMPANY_NAME, COMPANY_EMAIL, COMPANY_PHONE, COMPANY_CIF, COMPANY_ADDRESS, PRIMARY_COLOR, LOGO_PATH, APP_NAME, N8N_BASE_URL, EXTERNAL_SITE_URL etc.) cu fallback la valorile DeCamino. Restul codului neschimbat. |

**Test checklist:** Scurtă (build frontend + login + un API call).

**Risc:** L

---

### Commit 1.4 — Add .env.example backend and frontend
**Nume commit:** `docs: add .env.example for backend and frontend`  
**CP:** Da  

| Fișier | Modificare |
|--------|------------|
| `backend/.env.example` | **Documentație.** Toate variabilele din ENV_EXAMPLE.md + COMPANY_*, FRONTEND_APP_URL; placeholders fără valori reale. |
| `frontend/.env.example` | **Documentație.** Toate VITE_* necesare; placeholders. |

**Test checklist:** Scurtă (doar că fișierele există; producția folosește .env real).

**Risc:** L

---

### Commit 1.5 — Backend: main.ts comments only (CORS/API_URL from env)
**Nume commit:** `docs(backend): add comments for CORS/API_URL from env in main.ts`  
**CP:** Nu  

| Fișier | Modificare |
|--------|------------|
| `backend/src/main.ts` | **Documentație.** Comentarii că CORS_ORIGINS și API_URL vin din env; default-urile rămân identice (fără schimbare de logică). |

**Test checklist:** Scurtă.

**Risc:** L

---

### Commit 1.6 — Backend: n8n and database config comments
**Nume commit:** `docs(config): add multi-client comments to n8n and database config`  
**CP:** Nu  

| Fișier | Modificare |
|--------|------------|
| `backend/src/config/n8n.config.ts` | **Documentație.** Comentariu: multi-client să seteză N8N_BASE_URL în .env; default rămâne. |
| `backend/src/config/database.config.ts` | **Documentație.** Comentariu: multi-client să seteză DB_NAME în .env; default rămâne. |

**Test checklist:** Scurtă.

**Risc:** L

---

### FAZA 1 – Securitate scripturi (fără impact runtime)

*Eliminare IP/user/parolă/DB hardcodate din scripturi; citire doar din process.env; eșec clar dacă lipsește. Producția web nu rulează aceste scripturi la request.*

---

### Commit 1.7a — Scripts: remove hardcoded DB (run-ausencia, create-convenios)
**Nume commit:** `fix(scripts): remove hardcoded DB in run-ausencia and create-convenios`  
**CP:** Nu  

| Fișier | Modificare |
|--------|------------|
| `backend/scripts/run-ausencia-asociada-migration.js` | **Înlocuire.** DB_HOST, DB_USERNAME, DB_NAME doar din process.env; fără fallback 217.154.102.115, facturacion_user, decamino_db; dacă lipsesc → throw cu mesaj clar. |
| `backend/scripts/create-convenios-system.js` | **Înlocuire.** La fel. |

**Test checklist:** Rulezi un script (pe copie DB cu .env setat) și verifici că merge; fără .env sau fără DB_* → eroare clară. Nu e necesar test aplicație web.

**Risc:** L

---

### Commit 1.7b — Scripts: remove hardcoded DB (cleanup-duplicate-bajas, create-grupos)
**Nume commit:** `fix(scripts): remove hardcoded DB in cleanup-duplicate-bajas and create-grupos`  
**CP:** Nu  

| Fișier | Modificare |
|--------|------------|
| `backend/scripts/cleanup-duplicate-bajas.js` | **Înlocuire.** Conexiune doar din env; fără fallback la IP/user/DB. |
| `backend/scripts/create-grupos-referencia-table.js` | **Înlocuire.** La fel. |

**Test checklist:** Ca la 1.7a (script cu .env setat vs lipsă).

**Risc:** L

---

### Commit 1.7c — Scripts: remove hardcoded DB (push, notifications)
**Nume commit:** `fix(scripts): remove hardcoded DB in push and notifications scripts`  
**CP:** Nu  

| Fișier | Modificare |
|--------|------------|
| `backend/scripts/create-push-subscriptions-table.js` | **Înlocuire.** Doar env; fără fallback. |
| `backend/scripts/check-notifications-data.js` | **Înlocuire.** Fără fallback la IP/user/parolă. |
| `backend/scripts/create-notifications-table.js` | **Înlocuire.** La fel. |

**Test checklist:** Ca la 1.7a.

**Risc:** L

---

### Commit 1.7d — Scripts: remove hardcoded DB (pull-all-tables, list-all-tables)
**Nume commit:** `fix(scripts): remove hardcoded DB in pull-all-tables and list-all-tables`  
**CP:** Nu  

| Fișier | Modificare |
|--------|------------|
| `backend/scripts/pull-all-tables.js` | **Înlocuire.** DB_* doar din env; default doar 'localhost'/'root' pentru dev opțional, sau fără default în prod. |
| `backend/scripts/list-all-tables.js` | **Înlocuire.** La fel. |

**Test checklist:** Ca la 1.7a.

**Risc:** L

---

### Commit 1.7e — Scripts: PowerShell and SQL comment (no hardcoded credentials)
**Nume commit:** `fix(scripts): remove hardcoded credentials from PS1 and SQL comment`  
**CP:** Nu  

| Fișier | Modificare |
|--------|------------|
| `backend/scripts/run-add-estado-to-pedidos-migration.ps1` | **Înlocuire.** Host/user/database din env sau parametri; fără 217.154.102.115, facturacion_user, decamino_db. |
| `backend/scripts/run-add-codigo-supervisor-migration.ps1` | **Înlocuire.** La fel. |
| `backend/scripts/add-no-punch-enum.sql` | **Documentație.** Comentariu de rulare fără IP/user real (ex: "Run: mysql -h $DB_HOST -u $DB_USERNAME -p $DB_NAME < ..."). |

**Test checklist:** .ps1 rulează cu env setat; fără env → mesaj clar. SQL doar comentariu.

**Risc:** L

---

## FAZA 2 – DeCamino citește din .env (fallback păstrat)

*După Faza 2, completezi .env producție DeCamino cu noile variabile (valorile actuale). Comportament identic dacă .env e complet.*

---

### Commit 2.1 — Backend: PDF services use company config
**Nume commit:** `feat(backend): PDF services use company config with fallback`  
**CP:** Da  
**Risc:** M  

| Fișier | Modificare |
|--------|------------|
| `backend/src/services/presupuesto-documento.service.ts` | **Refactor.** BRAND_RED, text legal, adresă, CIF, telefon, email, website, link app, regex-uri Officina → ConfigService.get('company'); fallback la valorile DeCamino. |
| `backend/src/services/informe-pdf.service.ts` | **Refactor.** La fel. |

**Test checklist:** Completă (în special PDF: presupuesto + informe, comparație cu PDF anterior).

**Rollback (risc M):** `git revert <commit>`; redeploy backend. Verifică: generare presupuesto + informe; text legal, CIF, telefon, email, culori identice cu înainte.

---

### Commit 2.2 — Backend: controllers footer (presupuestos-guardados, informes-factura-config)
**Nume commit:** `feat(backend): presupuestos/informes controllers use company config for footer`  
**CP:** Da  
**Risc:** L  

| Fișier | Modificare |
|--------|------------|
| `backend/src/controllers/presupuestos-guardados.controller.ts` | **Înlocuire string.** "info@... · Tfno. 645 111 999" → ConfigService (company); fallback. |
| `backend/src/controllers/informes-factura-config.controller.ts` | **Înlocuire string.** La fel. |

**Test checklist:** Completă (email din aceste flow-uri; footer în email).

**Risc:** L

---

### Commit 2.3 — Backend: email.service From, BCC, defaults
**Nume commit:** `feat(backend): email.service use company config for From and BCC`  
**CP:** Da  
**Risc:** M  

| Fișier | Modificare |
|--------|------------|
| `backend/src/services/email.service.ts` | **Refactor.** From name/address și BCC default din ConfigService (company); fallback la valorile actuale. |

**Test checklist:** Completă (trimitere email; From + BCC corecte).

**Rollback (risc M):** `git revert <commit>`; redeploy backend. Verifică: trimitere email (login/notificare); From și BCC ca înainte.

---

### Commit 2.4 — Backend: empleados.controller links and email
**Nume commit:** `feat(backend): empleados.controller use company config for links and email`  
**CP:** Da  
**Risc:** M  

| Fișier | Modificare |
|--------|------------|
| `backend/src/controllers/empleados.controller.ts` | **Înlocuire string.** info@..., https://app.decaminoservicios.com → ConfigService (FRONTEND_APP_URL, COMPANY_EMAIL); fallback. |

**Test checklist:** Completă (invitație empleado, reset parolă; link-uri și destinatari).

**Rollback (risc M):** `git revert <commit>`; redeploy backend. Verifică: email către empleados cu link corect către app.

---

### Commit 2.5a — Backend: pedidos, solicitudes, ausencias use company config
**Nume commit:** `feat(backend): pedidos, solicitudes, ausencias use company config`  
**CP:** Da  
**Risc:** L  

| Fișier | Modificare |
|--------|------------|
| `backend/src/services/pedidos.service.ts` | **Înlocuire string.** Adrese email / link app → ConfigService; fallback. |
| `backend/src/services/solicitudes.service.ts` | **Înlocuire string.** EMAIL_RECIPIENT etc. din config; fallback. |
| `backend/src/services/ausencias.service.ts` | **Înlocuire string.** La fel. |

**Test checklist:** Completă (un pedido, o solicitud, o ausencia; emailuri corecte).

**Risc:** L

---

### Commit 2.5b — Backend: push, permissions, monitoring use company config
**Nume commit:** `feat(backend): push, permissions, monitoring use company config`  
**CP:** Da  
**Risc:** L  

| Fișier | Modificare |
|--------|------------|
| `backend/src/services/push.service.ts` | **Înlocuire string.** mailto: admin@... → config; fallback. |
| `backend/src/controllers/permissions.controller.ts` | **Înlocuire string.** updated_by default / admin@decamino → config; fallback. |
| `backend/src/controllers/monitoring.controller.ts` | **Înlocuire string.** BCC / app@... → config; fallback. |

**Test checklist:** Completă (push subscription; permisiuni; un flow de monitoring dacă e activ).

**Risc:** L

---

### Commit 2.6 — Backend: prl-documents CIF from config
**Nume commit:** `feat(backend): prl-documents.service CIF from company config`  
**CP:** Da  
**Risc:** L  

| Fișier | Modificare |
|--------|------------|
| `backend/src/services/prl-documents.service.ts` | **Înlocuire string.** cifDefault → ConfigService (company) sau env; fallback B85524536. |

**Test checklist:** Completă (generare/descărcare document PRL unde se folosește CIF).

**Risc:** L

---

### Commit 2.7 — Backend: n8n-proxy use n8n config only
**Nume commit:** `feat(backend): n8n-proxy use n8n config only, no hardcoded URL`  
**CP:** Da  
**Risc:** L  

| Fișier | Modificare |
|--------|------------|
| `backend/src/services/n8n-proxy.service.ts` | **Refactor.** Orice fallback hardcodat la n8n URL → doar config n8n (injectat); fără string decaminoservicios. |

**Test checklist:** Completă (n8n proxy: un request către workflow).

**Risc:** L

---

### Commit 2.8a — Frontend: routes.js use central config
**Nume commit:** `feat(frontend): routes.js use central env config`  
**CP:** Da  
**Risc:** L  

| Fișier | Modificare |
|--------|------------|
| `frontend/src/utils/routes.js` | **Refactor.** BASE_URL / BACKEND_PROD_URL din env.js (sau direct import.meta.env cu același fallback); păstrezi comportamentul. |

**Test checklist:** Completă (login, pagini critice, toate request-urile către API).

**Risc:** L

---

### Commit 2.8b — Frontend: layouts use central config (company name, logo, base path)
**Nume commit:** `feat(frontend): MainLayout and Desktop/Mobile layouts use env config`  
**CP:** Da  
**Risc:** L  

| Fișier | Modificare |
|--------|------------|
| `frontend/src/components/MainLayout.jsx` | **Refactor.** VITE_COMPANY_NAME, VITE_LOGO_PATH, VITE_BASE_PATH din env.js; fallback. |
| `frontend/src/layouts/DesktopLayout.jsx` | **Refactor.** La fel. |
| `frontend/src/layouts/MobileLayout.jsx` | **Refactor.** La fel. |

**Test checklist:** Completă (header/footer: nume firmă, logo, rute).

**Risc:** L

---

### Commit 2.8c — Frontend: index.html and vite.config PWA / title
**Nume commit:** `feat(frontend): index.html and vite.config PWA name from env`  
**CP:** Da  
**Risc:** L  

| Fișier | Modificare |
|--------|------------|
| `frontend/index.html` | **Adăugare variabilă / refactor.** Titlu și meta og:title etc. din env la build (placeholder în HTML + Vite define sau plugin) sau păstrat cu fallback; același text ca acum. |
| `frontend/vite.config.js` | **Refactor.** PWA name din process.env.VITE_APP_NAME cu fallback 'DE CAMINO SERVICIOS AUXILIARES'; define-uri VITE_* păstrate. |

**Test checklist:** Completă (titlu pagină; PWA name; instalare PWA).

**Risc:** L

---

### Commit 2.9a — Frontend: EmpleadosPage, DashboardPage, DocumentosEmpleadosPage
**Nume commit:** `feat(frontend): Empleados, Dashboard, DocumentosEmpleados use env config`  
**CP:** Da  
**Risc:** L  

| Fișier | Modificare |
|--------|------------|
| `frontend/src/pages/EmpleadosPage.jsx` | **Refactor.** API URL, company name, CIF, address, phone, email, primary color din env.js; fallback. |
| `frontend/src/pages/DashboardPage.jsx` | **Refactor.** API URL, company name din env.js; fallback. |
| `frontend/src/pages/DocumentosEmpleadosPage.jsx` | **Refactor.** Company / API din env.js; fallback. |

**Test checklist:** Completă (listă empleados, dashboard, documente empleados).

**Risc:** L

---

### Commit 2.9b — Frontend: SolicitudesPage, Fichaje, LoginPage, PresupuestosInformesPage
**Nume commit:** `feat(frontend): Solicitudes, Fichaje, Login, PresupuestosInformes use env config`  
**CP:** Da  
**Risc:** L  

| Fișier | Modificare |
|--------|------------|
| `frontend/src/pages/SolicitudesPage.jsx` | **Refactor.** VITE_* din env.js; fallback. |
| `frontend/src/pages/Fichaje.jsx` | **Refactor.** La fel. |
| `frontend/src/pages/LoginPage.jsx` | **Refactor.** Company name, logo, base path, link extern (decamino.es) din env.js; fallback. |
| `frontend/src/pages/PresupuestosInformesPage.jsx` | **Refactor.** titulo_empresa / company din env.js; fallback. |

**Test checklist:** Completă (solicitudes, fichaje, login, presupuestos/informes).

**Risc:** L

---

### Commit 2.9c — Frontend: EstadisticasPage, pushNotifications, inspectionExporter, ChatBot, ActivityLog
**Nume commit:** `feat(frontend): Estadisticas, push, inspectionExporter, ChatBot, ActivityLog use env config`  
**CP:** Da  
**Risc:** L  

| Fișier | Modificare |
|--------|------------|
| `frontend/src/pages/EstadisticasPage.jsx` | **Refactor.** Logo, company name din env.js; fallback. |
| `frontend/src/utils/pushNotifications.js` | **Refactor.** API URL, logo, base path din env.js; fallback. |
| `frontend/src/utils/inspectionExporter.js` | **Refactor.** PRIMARY_COLOR, company name, logo din env.js; fallback. |
| `frontend/src/components/ChatBot.jsx` | **Refactor.** Primary color din env.js; fallback. |
| `frontend/src/components/admin/ActivityLog.jsx` | **Refactor.** Primary color din env.js; fallback. |

**Test checklist:** Completă (estadísticas PDF, push, inspecții export, chatbot, activity log).

**Risc:** L

---

### Commit 2.9d — Frontend: HorasTrabajadas, HorasTrabajadasPDF, HorasPermitidas
**Nume commit:** `feat(frontend): HorasTrabajadas, HorasTrabajadasPDF, HorasPermitidas use env config`  
**CP:** Da  
**Risc:** L  

| Fișier | Modificare |
|--------|------------|
| `frontend/src/components/HorasTrabajadas.tsx` | **Refactor.** API / company din env.js; fallback. |
| `frontend/src/components/HorasTrabajadasPDF.tsx` | **Refactor.** La fel. |
| `frontend/src/components/HorasPermitidas.tsx` | **Refactor.** La fel. |

**Test checklist:** Completă (horas trabajadas, PDF, horas permitidas).

**Risc:** L

---

### Commit 2.9e — Frontend: exportExcel, monthlyAlerts, ThemeContext
**Nume commit:** `feat(frontend): exportExcel, monthlyAlerts, ThemeContext use env config`  
**CP:** Da  
**Risc:** L  

| Fișier | Modificare |
|--------|------------|
| `frontend/src/utils/exportExcel.ts` | **Refactor.** Company / API din env.js; fallback. |
| `frontend/src/utils/monthlyAlerts.js` | **Refactor.** API URL din env.js; fallback. |
| `frontend/src/contexts/ThemeContext.jsx` | **Refactor.** Culori / theme din env.js; fallback. |

**Test checklist:** Completă (export Excel, monthly alerts, theme).

**Risc:** L

---

### Commit 2.10a — Frontend: firmar.html, firmar-informe.html (URLs from build or keep fallback)
**Nume commit:** `feat(frontend): firmar pages use env or fallback for URLs`  
**CP:** Da  
**Risc:** M  

| Fișier | Modificare |
|--------|------------|
| `frontend/public/firmar.html` | **Înlocuire string / build.** URL-uri API/app/decamino.es fie injectate la build (placeholder + env), fie păstrate ca fallback + comentariu TODO. |
| `frontend/public/firmar-informe.html` | **Înlocuire string / build.** La fel. |

**Test checklist:** Completă (signing: firmar + firmar-informe; URL-uri corecte).

**Rollback (risc M):** `git revert <commit>`; redeploy frontend. Verifică: deschidere firmar + firmar-informe; semnare funcțională.

**Risc:** M

---

### Commit 2.10b — Frontend: sw.js API/n8n URLs
**Nume commit:** `feat(frontend): sw.js use env or fallback for API/n8n URLs`  
**CP:** Da  
**Risc:** M  

| Fișier | Modificare |
|--------|------------|
| `frontend/public/sw.js` | **Refactor.** URL-uri API/n8n fie injectate la build, fie păstrate ca fallback + comentariu. |

**Test checklist:** Completă (PWA / SW: cache, update, request-uri către API).

**Rollback (risc M):** `git revert <commit>`; redeploy; șterge cache SW / reinstall PWA dacă e cazul.

**Risc:** M

---

### Pas 2.11 — Ops: set .env (DeCamino) – local sau producție
**CP:** Da  

| Locus | Modificare |
|-------|------------|
| `backend/.env` | Copie din `backend/.env.example`; completezi DB_*, JWT_*, COMPANY_*, FRONTEND_APP_URL. Local: FRONTEND_APP_URL=http://localhost:5173. |
| `frontend/.env` (dev) sau `frontend/.env.production` | Toate VITE_* necesare. Local: VITE_API_URL=http://localhost:3000. |

**Test checklist:** Completă **local** (backend + frontend pornite cu .env) sau după deploy: login, pagini critice, 1 PDF, 1 email, link T&C, (opțional) firmar.

**Verificare locală:** Vezi `docs/ENV_AND_VERIFY.md` – același checklist se poate rula și local, nu doar în producție.

**Risc:** L

---

## FAZA 3 – Curățare fallback-uri Decamino

*După ce producția rulează stabil cu .env complet. Eliminare fallback-uri cu valori Decamino; env obligatoriu în producție.*

---

### Commit 3.1 — Backend: remove Decamino fallbacks (company, n8n, database configs)
**Nume commit:** `refactor(config): remove Decamino fallbacks in company, n8n, database configs`  
**CP:** Nu  
**Risc:** M  

| Fișier | Modificare |
|--------|------------|
| `backend/src/config/company.config.ts` | **Refactor.** În producție: fără fallback la valori Decamino; warning sau throw dacă lipsește variabilă obligatorie. |
| `backend/src/config/n8n.config.ts` | **Refactor.** În producție fără default n8n.decaminoservicios.com (sau doar pentru NODE_ENV=development). |
| `backend/src/config/database.config.ts` | **Refactor.** În producție fără default decaminoservicios (sau doar dev). |

**Test checklist:** Producție cu .env complet → Completă. Apoi ștergi un env key esențial → backend nu pornește sau dă eroare clară.

**Rollback (risc M):** `git revert <commit>`; pune înapoi fallback-urile; redeploy. Verifică: pornire backend cu .env complet.

---

### Commit 3.2 — Backend: remove Decamino fallbacks from all services/controllers
**Nume commit:** `refactor(backend): remove Decamino fallbacks from services and controllers`  
**CP:** Nu  
**Risc:** M  

| Fișiere | Modificare |
|---------|------------|
| Toate serviciile și controllerele modificate în Faza 2 | **Refactor.** Elimini fallback-urile cu "info@decaminoservicios.com", "DE CAMINO...", etc.; folosești doar ConfigService (company). |

*Împarte în 2–3 commit-uri dacă vrei max 3 fișiere: 3.2a PDF + email + empleados; 3.2b restul serviciilor; 3.2c controllers.*

**Test checklist:** Completă cu .env producție complet.

**Rollback (risc M):** `git revert <commit(s)>`; redeploy. Verifică: PDF, email, link-uri.

---

### Commit 3.3 — Backend: main.ts no Decamino CORS/API_URL default in production
**Nume commit:** `refactor(backend): main.ts require CORS_ORIGINS and API_URL in production`  
**CP:** Nu  
**Risc:** M  

| Fișier | Modificare |
|--------|------------|
| `backend/src/main.ts` | **Refactor.** În producție, dacă CORS_ORIGINS sau API_URL lipsesc → nu mai pui default app.decaminoservicios / api.decaminoservicios; eroare la pornire sau warning clar. |

**Test checklist:** Producție cu CORS_ORIGINS + API_URL setate → Completă. Fără ele → eroare la start.

**Rollback (risc M):** `git revert <commit>`; redeploy. Verifică: CORS și API_URL din .env.

---

### Commit 3.4 — Frontend: remove Decamino fallbacks (env.js + all consumers)
**Nume commit:** `refactor(frontend): remove Decamino fallbacks from env and consumers`  
**CP:** Nu  
**Risc:** M  

| Fișiere | Modificare |
|---------|------------|
| `frontend/src/config/env.js` | **Refactor.** Fără fallback la "DE CAMINO...", "api.decaminoservicios.com"; doar import.meta.env.VITE_*; optional build warning dacă lipsește. |
| Toate fișierele care importă din env.js | **Refactor.** Fără stringuri Decamino; totul din config. |

*Împarte pe commit-uri mici (layouts, pagini, utils, public) dacă vrei.*

**Test checklist:** Build prod cu .env.production complet → Completă. Build fără o variabilă → warning sau fail.

**Rollback (risc M):** `git revert <commit(s)>`; redeploy frontend. Verifică: toate paginile și link-urile.

---

## FAZA 4 – Pregătire client 2 (doc + optional validare)

---

### Commit 4.1 — Docs: deploy multi-client
**Nume commit:** `docs: add DEPLOY_MULTI_CLIENT guide`  
**CP:** Da (pentru cine face deploy client 2)  

| Fișier | Modificare |
|--------|------------|
| `docs/DEPLOY_MULTI_CLIENT.md` (sau README) | **Documentație.** Un codebase; per client: .env backend + frontend, DB, domeniu; checklist variabile; build frontend per client; exemplu client 2. |

**Test checklist:** Scurtă (doc citibil; nu afectează runtime).

**Risc:** L

---

### Commit 4.2 — Backend: .env.example update + optional env validation at startup
**Nume commit:** `chore: update .env.example and optional startup env validation`  
**CP:** Da  

| Fișier | Modificare |
|--------|------------|
| `backend/.env.example` | **Documentație.** Toate variabilele cu descrieri. |
| `backend/src/main.ts` sau `backend/scripts/check-env.js` | **Adăugare (opțional).** La pornire (prod): verificare prezență variabile critice; warning sau exit dacă lipsesc. |

**Test checklist:** Scurtă; dacă ai validare: pornire fără env complet → warning/exit.

**Risc:** L

---

### Commit 4.3 — Optional: generic package names
**Nume commit:** `chore: use generic package names for multi-client`  
**CP:** Nu  

| Fișier | Modificare |
|--------|------------|
| `frontend/package.json`, `backend/package.json` | **Refactor.** name generic (ex. servicios-app-frontend / servicios-app-backend) dacă vrei. |

**Test checklist:** Scurtă (build + deploy DeCamino OK).

**Risc:** L

---

## Critical path (minim pentru client 2 în DEV)

Trebuie făcute **în ordine** ca să poți porni o a doua instanță în DEV cu propriul .env:

1. **Commit 1.1** – company config  
2. **Commit 1.2** – ConfigModule load company  
3. **Commit 1.3** – frontend env.js  
4. **Commit 1.4** – .env.example ambele  
5. **Commit 2.1** – PDF services citește config  
6. **Commit 2.2** – controllers footer  
7. **Commit 2.3** – email.service  
8. **Commit 2.4** – empleados.controller  
9. **Commit 2.5a, 2.5b** – pedidos, solicitudes, ausencias, push, permissions, monitoring  
10. **Commit 2.6** – prl-documents  
11. **Commit 2.7** – n8n-proxy  
12. **Commit 2.8a, 2.8b, 2.8c** – frontend routes, layouts, index/vite  
13. **Commit 2.9a–2.9e** – toate paginile/componentele care folosesc API/company  
14. **Commit 2.10a, 2.10b** – firmar, sw  
15. **Pas 2.11** – setare .env producție DeCamino (pentru prod); pentru client 2 în DEV: creezi .env backend + frontend pentru client 2  
16. **Commit 4.1** – doc deploy (recomandat)  
17. **Commit 4.2** – .env.example + validare (recomandat)

Faza 3 (curățare fallback) nu e obligatorie pentru a rula client 2 în DEV; e pentru curățenie și pentru a evita ca un client nou să „vedă” Decamino dacă uită o variabilă. Faza 1 scripturi (1.7a–1.7e) e securitate; nu blochează client 2.

---

## Rollback plan (pași cu risc medium)

| Commit | Acțiune rollback | Verificare după rollback |
|--------|-------------------|---------------------------|
| **2.1** (PDF services) | `git revert <hash>`; redeploy backend | Generare presupuesto + informe; compară cu PDF-uri anterioare (text, CIF, culori). |
| **2.3** (email.service) | `git revert <hash>`; redeploy backend | Trimitere email; From și BCC ca înainte. |
| **2.4** (empleados.controller) | `git revert <hash>`; redeploy backend | Email către empleados cu link app corect. |
| **2.10a** (firmar*.html) | `git revert <hash>`; redeploy frontend | Deschidere firmar + firmar-informe; semnare OK. |
| **2.10b** (sw.js) | `git revert <hash>`; redeploy; clear SW cache / reinstall PWA | Request-uri din app către API; PWA update. |
| **3.1** (config fallbacks) | `git revert <hash>`; redeploy backend | Backend pornește cu .env complet. |
| **3.2** (services fallbacks) | `git revert <hash>`; redeploy backend | PDF, email, link-uri ca înainte. |
| **3.3** (main.ts CORS/API) | `git revert <hash>`; redeploy backend | CORS și API_URL din .env; login + API. |
| **3.4** (frontend fallbacks) | `git revert <hash>`; redeploy frontend | Build cu .env; toate paginile și link-urile. |

După orice revert: rulează **Test checklist Completă** o dată pentru a confirma că producția DeCamino e stabilă.
