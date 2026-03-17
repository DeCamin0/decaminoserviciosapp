# Plan implementare: Single codebase, multi-client (fără oprire producție)

**Obiectiv:** DeCamino rămâne funcțional; devine "clientul 1" configurat prin .env; ulterior se adaugă clientul 2.

**Convenții:** Fiecare pas are: fișiere exacte, tip modificare, risc (low/medium/high), verificare producție.

---

## FAZA 1 – Introducere config + fallback (comportament identic)

*Toate pașii păstrează valorile actuale ca fallback; producția nu se schimbă dacă .env nu e modificat.*

---

### Pas 1.1 – Backend: fișier config company (nou)

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/src/config/company.config.ts` (nou) |
| **Modificare** | Adăugare fișier nou care exportă un obiect `company` citit din `process.env`: `COMPANY_LEGAL_NAME`, `COMPANY_ADDRESS`, `COMPANY_CIF`, `COMPANY_PHONE`, `COMPANY_EMAIL`, `COMPANY_EMAIL_BCC`, `COMPANY_EMAIL_FROM_NAME`, `COMPANY_WEBSITE`, `COMPANY_BRAND_RED`, `FRONTEND_APP_URL` (pentru link-uri tip app.decaminoservicios.com). Toate cu fallback la valorile actuale DeCamino. |
| **Risc** | Low |
| **Verificare** | Build backend OK; aplicația pornește; nu injectezi încă acest config în servicii. |

---

### Pas 1.2 – Backend: înregistrare company config în ConfigModule

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/src/config/config.module.ts` |
| **Modificare** | Adăugare: în `load: [...]` incluzi `companyConfig` (company.config.ts). Nu schimbi niciun serviciu încă. |
| **Risc** | Low |
| **Verificare** | `npm run build` în backend; start backend; log-uri fără erori. |

---

### Pas 1.3 – Frontend: centralizare env într-un singur modul

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `frontend/src/config/env.js` (există deja) |
| **Modificare** | Extindere: exportă toate variabilele VITE_ folosite în app (API_URL, API_BASE_URL, BASE_PATH, COMPANY_NAME, COMPANY_EMAIL, COMPANY_PHONE, COMPANY_CIF, COMPANY_ADDRESS, PRIMARY_COLOR, LOGO_PATH, APP_NAME, N8N_BASE_URL, EXTERNAL_SITE_URL etc.) cu fallback la valorile actuale DeCamino. Restul codului nu se schimbă încă. |
| **Risc** | Low |
| **Verificare** | Build frontend; app rulează local; nu înlocui încă referințele directe la `import.meta.env` în alte fișiere. |

---

### Pas 1.4 – Fișiere .env.example (fără a modifica .env reale)

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/.env.example` (nou, din ENV_EXAMPLE.md), `frontend/.env.example` (nou) |
| **Modificare** | Backend: creezi `.env.example` cu toate variabilele din `backend/docs/ENV_EXAMPLE.md` plus noile variabile company (COMPANY_*, FRONTEND_APP_URL), fără valori reale (placeholders: `your-company-name`, `https://your-api.example.com`). Frontend: creezi `frontend/.env.example` cu toate VITE_* necesare, cu valori placeholder. |
| **Risc** | Low |
| **Verificare** | Fișierele sunt doar documentație; producția folosește .env existent, neschimbat. |

---

### Pas 1.5 – Backend main.ts: CORS și API_URL din env cu fallback

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/src/main.ts` |
| **Modificare** | Logica rămâne: dacă `CORS_ORIGINS` / `CORS_ORIGIN` lipsesc, folosești același array default (app.decaminoservicios.com, decaminoservicios.com). La fel pentru `API_URL`: dacă lipsește în producție, rămâne default `https://api.decaminoservicios.com`. Adaugi doar comentarii că valorile vin din env. (Faptul că deja citești CORS_ORIGINS/API_URL e OK; asigură-te că default-urile rămân identice.) |
| **Risc** | Low |
| **Verificare** | Deploy pe staging/prod; login, CORS, API calls funcționează fără schimbare. |

---

### Pas 1.6 – Backend: n8n și database config – default-uri doar în comentarii

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/src/config/n8n.config.ts`, `backend/src/config/database.config.ts` |
| **Modificare** | n8n: păstrezi `process.env.N8N_BASE_URL || 'https://n8n.decaminoservicios.com'` (comportament identic). database: păstrezi `process.env.DB_NAME || 'decaminoservicios'`. Adaugi în comentarii: "Pentru multi-client, setați aceste variabile în .env; nu folosiți default în producție pentru client nou." |
| **Risc** | Low |
| **Verificare** | Backend pornește; n8n proxy și DB merg ca înainte. |

---

## FAZA 2 – DeCamino citește din .env (valorile DeCamino puse în .env producție)

*Adaugi variabilele în .env-ul de producție DeCamino cu valorile actuale; apoi faci codul să citească din env (sau din config care citește env), păstrând fallback-urile DeCamino ca siguranță.*

---

### Pas 2.1 – Backend: servicii PDF (presupuesto, informe) să folosească company config

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/src/services/presupuesto-documento.service.ts`, `backend/src/services/informe-pdf.service.ts` |
| **Modificare** | Înlocuire valori hardcodate (BRAND_RED, text legal, adresă, CIF, telefon, email, website, link app, regex-uri "Officina - DE CAMINO...") cu citiri din ConfigService (company config). Fallback la valorile actuale DeCamino dacă variabila lipsește. |
| **Risc** | Medium (PDF-uri critice) |
| **Verificare** | Generare presupuesto + generare informe PDF în staging; compară cu PDF-uri generate înainte; verifică că textul legal, CIF, telefon, email, culori sunt identice. Apoi deploy producție; regenerare 1–2 documente și verificare. |

---

### Pas 2.2 – Backend: controllers (presupuestos-guardados, informes-factura-config) – footer email/telefon

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/src/controllers/presupuestos-guardados.controller.ts`, `backend/src/controllers/informes-factura-config.controller.ts` |
| **Modificare** | Înlocuire string-uri "info@decaminoservicios.com · Tfno. 645 111 999" cu valori din ConfigService (company). Fallback la valorile actuale. |
| **Risc** | Low |
| **Verificare** | Trimite email de test din aceste flow-uri; verifică footer în email. |

---

### Pas 2.3 – Backend: email.service – From, BCC, adrese implicite

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/src/services/email.service.ts` |
| **Modificare** | From name și adresă default din ConfigService (company). BCC default (decamino.rrhh@gmail.com) din COMPANY_EMAIL_BCC. Fallback la valorile actuale. |
| **Risc** | Medium |
| **Verificare** | Trimitere email de test (login, notificare); verifică From și BCC. |

---

### Pas 2.4 – Backend: empleados.controller – link app, adrese email

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/src/controllers/empleados.controller.ts` |
| **Modificare** | Înlocuire "info@decaminoservicios.com", "https://app.decaminoservicios.com" cu valori din ConfigService (FRONTEND_APP_URL, COMPANY_EMAIL). Păstrare fallback. |
| **Risc** | Medium |
| **Verificare** | Flow-uri care trimit email către empleados (invitație, reset parolă etc.); verifică link-uri și destinatari. |

---

### Pas 2.5 – Backend: pedidos.service, solicitudes.service, ausencias.service, push.service, permissions.controller

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/src/services/pedidos.service.ts`, `backend/src/services/solicitudes.service.ts`, `backend/src/services/ausencias.service.ts`, `backend/src/services/push.service.ts`, `backend/src/controllers/permissions.controller.ts`, `backend/src/controllers/monitoring.controller.ts` |
| **Modificare** | Înlocuire adrese email hardcodate (info@decaminoservicios.com, solicitudes@..., app@..., admin@decamino.com, admin@decaminoservicios.com) și orice link app cu ConfigService (company). Fallback la valorile actuale. |
| **Risc** | Low–Medium |
| **Verificare** | Testează: trimitere pedido, solicitud, ausencia; push subscription; permisiuni; monitoring email. |

---

### Pas 2.6 – Backend: prl-documents.service – CIF default

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/src/services/prl-documents.service.ts` |
| **Modificare** | Înlocuire `cifDefault = 'B85524536'` cu ConfigService (company) sau env. Fallback la B85524536. |
| **Risc** | Low |
| **Verificare** | Generare/descărcare document PRL unde se folosește CIF. |

---

### Pas 2.7 – Backend: n8n-proxy fallback URL

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/src/services/n8n-proxy.service.ts` |
| **Modificare** | Orice fallback hardcodat la `https://n8n.decaminoservicios.com` înlocuit cu config n8n (deja în n8n.config.ts); asigură-te că n8n-proxy folosește doar config-ul, fără string hardcodat. |
| **Risc** | Low |
| **Verificare** | Apeluri către n8n prin backend (workflow-uri); verifică că merg. |

---

### Pas 2.8 – Frontend: înlocuire referințe directe import.meta.env cu config centralizat (opțional dar recomandat)

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `frontend/src/utils/routes.js`, `frontend/src/components/Footer.jsx`, `frontend/src/components/MainLayout.jsx`, `frontend/src/layouts/DesktopLayout.jsx`, `frontend/src/layouts/MobileLayout.jsx`, `frontend/index.html` (dacă se poate injecta titlul din env la build), `frontend/vite.config.js` (PWA name din env) |
| **Modificare** | Înlocuire `import.meta.env.VITE_*` cu import din `frontend/src/config/env.js` (sau cum ai denumit modulul), păstrând același comportament. În index.html titlul/meta poate rămâne din index.html cu placeholder; Vite poate înlocui la build doar dacă expui variabile în HTML. Alternativ: la fel, citire din env cu fallback. PWA name în vite.config: `process.env.VITE_APP_NAME || 'DE CAMINO SERVICIOS AUXILIARES'`. |
| **Risc** | Low (dacă fallback-urile rămân) |
| **Verificare** | Build production; verifică base URL, logo, company name în header/footer; PWA name; login și toate paginile care folosesc BASE_URL. |

---

### Pas 2.9 – Frontend: pagini cu API URL / company / culori – trecere la config

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `frontend/src/pages/EmpleadosPage.jsx`, `frontend/src/pages/DashboardPage.jsx`, `frontend/src/pages/DocumentosEmpleadosPage.jsx`, `frontend/src/pages/SolicitudesPage.jsx`, `frontend/src/pages/Fichaje.jsx`, `frontend/src/pages/LoginPage.jsx`, `frontend/src/pages/PresupuestosInformesPage.jsx`, `frontend/src/pages/EstadisticasPage.jsx`, `frontend/src/utils/pushNotifications.js`, `frontend/src/utils/inspectionExporter.js`, `frontend/src/components/ChatBot.jsx`, `frontend/src/components/admin/ActivityLog.jsx`, `frontend/src/components/HorasTrabajadas.tsx`, `frontend/src/components/HorasTrabajadasPDF.tsx`, `frontend/src/components/HorasPermitidas.tsx`, `frontend/src/utils/exportExcel.ts`, `frontend/src/utils/monthlyAlerts.js`, `frontend/src/contexts/ThemeContext.jsx`, plus orice alt fișier care folosește VITE_API_URL / VITE_API_BASE_URL / VITE_COMPANY_* / VITE_PRIMARY_COLOR cu fallback Decamino |
| **Modificare** | Înlocuire referințe directe la `import.meta.env.VITE_*` cu import din modulul central de config (env.js), păstrând fallback. |
| **Risc** | Low |
| **Verificare** | Build; test pe toate paginile enumerate: listă empleados, dashboard, documente, solicitudes, fichaje, login, presupuestos/informes, estadísticas, push, inspecții, chatbot, activity log, horas trabajadas, export Excel, monthly alerts, theme. |

---

### Pas 2.10 – Frontend: public (firmar, sw.js) și vite

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `frontend/public/firmar.html`, `frontend/public/firmar-informe.html`, `frontend/public/sw.js`, `frontend/vite.config.js` |
| **Modificare** | firmar*.html: URL-uri către API/app/decamino.es – dacă sunt statice, trebuie injectate la build (ex. prin plugin Vite care înlocuiește placeholders din process.env) sau servite din backend. Alternativ: păstrezi temporar URL-urile Decamino ca fallback și adaugi un comentariu "TODO: inject from env at build". sw.js: URL-uri API/n8n – la fel, injectate la build sau din config. vite.config: PWA name și orice define pentru VITE_* să folosească process.env cu fallback DeCamino. |
| **Risc** | Medium (SW și HTML statice afectează PWA și signing) |
| **Verificare** | Build prod; testare signing (firmar); verifică că SW nu rupe cache/API; PWA name corect. |

---

### Pas 2.11 – Setare .env producție DeCamino

| Element | Detaliu |
|--------|---------|
| **Fișiere** | Pe server (nu în repo): `backend/.env`, `frontend/.env.production` (sau ce folosești la build) |
| **Modificare** | Adaugi în .env-ul de producție toate variabilele noi (COMPANY_*, FRONTEND_APP_URL, etc.) cu valorile actuale DeCamino. La frontend la fel pentru build-ul de producție. Nu ștergi nimic existent. |
| **Risc** | Low |
| **Verificare** | După deploy: backend și frontend se comportă identic; PDF-uri, emailuri, link-uri corecte. |

---

## FAZA 3 – Curățare finală fallback-uri Decamino

*După ce producția DeCamino rulează stabil cu .env complet, elimini fallback-urile hardcodate Decamino din cod; dacă lipsește o variabilă, aplicația aruncă eroare clară sau warning la pornire.*

---

### Pas 3.1 – Backend: eliminare fallback-uri cu valori Decamino

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/src/config/company.config.ts`, `backend/src/config/n8n.config.ts`, `backend/src/config/database.config.ts`, toate serviciile și controllerele modificate la Faza 2 |
| **Modificare** | În company.config: fallback la string gol sau la throw/warning dacă NODE_ENV=production și lipsește o variabilă obligatorie. În n8n/database: elimini default-urile `decaminoservicios` / `n8n.decaminoservicios.com` pentru producție (sau lași doar pentru NODE_ENV=development). În servicii: elimini fallback-urile cu "info@decaminoservicios.com", "DE CAMINO...", etc.; folosești doar config. |
| **Risc** | Medium (dacă .env producție nu e complet, aplicația poate să nu pornească) |
| **Verificare** | Pe producție: .env complet; restart backend; toate flow-urile OK. Apoi ștergi un env key esențial din .env, restartezi – trebuie să vezi eroare clară, nu să folosească Decamino. |

---

### Pas 3.2 – Frontend: eliminare fallback-uri cu valori Decamino

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `frontend/src/config/env.js`, toate paginile/componentele din Pas 2.8–2.10 |
| **Modificare** | În env.js: fără fallback la "DE CAMINO...", "api.decaminoservicios.com", etc.; folosești doar import.meta.env.VITE_* sau arăți warning la build dacă lipsește. În restul fișierelor: fără stringuri Decamino; totul din config. |
| **Risc** | Medium |
| **Verificare** | Build producție cu .env.production complet = OK. Build fără una dintre variabile = build fail sau warning vizibil. |

---

### Pas 3.3 – Backend: main.ts – eliminare default CORS/API_URL Decamino

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/src/main.ts` |
| **Modificare** | În producție, dacă CORS_ORIGINS/CORS_ORIGIN sau API_URL lipsesc, nu mai pui default-uri cu decaminoservicios; folosești doar env (sau aplicația refuză să pornească cu mesaj clar). |
| **Risc** | Medium |
| **Verificare** | Producție cu CORS_ORIGINS și API_URL setate = OK. Fără ele în prod = eroare la pornire. |

---

### Pas 3.4 – Scripturi backend: eliminare IP/user/parolă/DB hardcodate

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/scripts/run-ausencia-asociada-migration.js`, `backend/scripts/create-convenios-system.js`, `backend/scripts/cleanup-duplicate-bajas.js`, `backend/scripts/create-grupos-referencia-table.js`, `backend/scripts/create-push-subscriptions-table.js`, `backend/scripts/check-notifications-data.js`, `backend/scripts/create-notifications-table.js`, `backend/scripts/run-add-estado-to-pedidos-migration.ps1`, `backend/scripts/run-add-codigo-supervisor-migration.ps1`, `backend/scripts/pull-all-tables.js`, `backend/scripts/list-all-tables.js`, `backend/scripts/add-no-punch-enum.sql` (comentariu) |
| **Modificare** | Toate scripturile să citească doar din process.env (DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME) fără fallback la 217.154.102.115, facturacion_user, decamino_db, ParolaTare123!. Scripturile să eșueze cu mesaj clar dacă .env nu e încărcat sau variabilele lipsesc. În .ps1: eliminare host/user/database hardcodate; citire din env sau parametri. În add-no-punch-enum.sql: comentariu actualizat fără IP/user real. |
| **Risc** | Low (scripturile se rulează manual; producția web nu depinde de ele la runtime) |
| **Verificare** | Rulezi un script de migrare pe o copie de DB cu .env setat corect; nu mai există referințe la 217.154.102.115/facturacion_user în cod. |

---

## FAZA 4 – Pregătire pentru clientul 2

*Fără a schimba din nou comportamentul pentru DeCamino; doar structură și documentație.*

---

### Pas 4.1 – Documentație deploy per client

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `docs/DEPLOY_MULTI_CLIENT.md` (nou) sau secțiune în README |
| **Modificare** | Documentezi: (1) un repo / un codebase; (2) fiecare client are: director sau branch/tag de deploy, .env propriu (backend + frontend), DB propriu, domeniu propriu; (3) checklist: PORT (dacă pe același server), DATABASE_URL/DB_*, CORS_ORIGINS, API_URL, FRONTEND_URL, FIRMAR_BASE_URL, N8N_BASE_URL, toate COMPANY_*, SMTP/Telegram/VAPID; (4) cum se face build frontend per client (env file per client); (5) exemplu .env.example pentru "client 2". |
| **Risc** | Low |
| **Verificare** | Cineva care nu a făcut refactorul poate urma doc-ul și pregăti un al doilea deploy. |

---

### Pas 4.2 – .env.example actualizate și optional validare la pornire

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `backend/.env.example`, `frontend/.env.example`, eventual `backend/src/main.ts` sau un script `backend/scripts/check-env.js` |
| **Modificare** | .env.example conțin toate variabilele necesare pentru un client nou, cu descrieri. Opțional: la pornirea backend-ului (doar în producție) verifici prezența variabilelor critice (DATABASE_URL sau DB_*, CORS_ORIGINS, API_URL, COMPANY_EMAIL, etc.) și loghezi un warning sau oprești pornirea dacă lipsesc. |
| **Risc** | Low |
| **Verificare** | Pornire backend cu .env incomplet (simulat) → warning sau eroare clară. |

---

### Pas 4.3 – Redenumire / neutralizare (opțional)

| Element | Detaliu |
|--------|---------|
| **Fișiere** | `frontend/package.json` (name), `backend/package.json` (name), orice referințe în README la "decamino" ca nume produs |
| **Modificare** | Opțional: package name generic (ex. "servicios-app-frontend" / "servicios-app-backend") ca să nu confunde la adăugarea clientului 2. Nu e obligatoriu pentru multi-client; e doar pentru claritate. |
| **Risc** | Low |
| **Verificare** | Build și deploy DeCamino în continuare OK. |

---

## Rezumat ordine și risc

| Fază | Pași | Risc maxim |
|------|------|------------|
| 1 | 1.1 – 1.6 | Low |
| 2 | 2.1 – 2.11 | Medium (PDF, email, CORS, PWA) |
| 3 | 3.1 – 3.4 | Medium (env obligatoriu) |
| 4 | 4.1 – 4.3 | Low |

**Regula de aur:** După fiecare pas (sau după fiecare 2–3 pași în Faza 2), deploy pe staging și test; apoi deploy producție și monitorizare scurtă. Nu treci la pasul următor dacă ceva s-a stricat.

**Rollback:** Fiecare pas trebuie să poată fi revertit prin git (commit-uri mici și clare); .env producție rămâne în afara repo-ului, deci nu se revine la valori vechi din cod, ci doar la codul anterior.
