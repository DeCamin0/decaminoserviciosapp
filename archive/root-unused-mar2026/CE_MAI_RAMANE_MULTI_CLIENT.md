# Ce mai rămâne – implementare multi-client

Listă scurtă a pașilor rămași până la finalizare (conform `CHECKLIST_EXECUTABIL_MULTI_CLIENT.md`).

---

## ✅ Deja făcut

- **Faza 1:** company.config.ts, ConfigModule, frontend env.js, .env.example (backend + frontend), comentarii main.ts / n8n / database
- **Faza 2 backend 2.1–2.5b:** PDF (presupuesto, informe), controllers (footer), email.service, empleados.controller, pedidos/solicitudes/ausencias, push, permissions, monitoring

---

## 🔲 Rămas de făcut

### Backend (puțin)

| Pas | Ce | Fișiere | Dificultate |
|-----|-----|--------|-------------|
| **2.6** | CIF din config la documente PRL | `backend/src/services/prl-documents.service.ts` | L – inject ConfigService, `cifDefault` din `company.cif` |
| **2.7** | n8n-proxy fără URL hardcodat | `backend/src/services/n8n-proxy.service.ts` | L – scoate fallback-ul `'https://n8n.decaminoservicios.com'`, doar `configService.get('n8n.baseUrl')` |

### Frontend (mai mult)

| Pas | Ce | Fișiere | Dificultate |
|-----|-----|--------|-------------|
| **2.8a** | Routes din config central | `frontend/src/utils/routes.js` | L – folosește `config` din `env.js` în loc de duplicate `import.meta.env` + fallback |
| **2.8b** | Layouts din config | `MainLayout.jsx`, `DesktopLayout.jsx`, `MobileLayout.jsx` | L – asigură-te că toate folosesc env.js (VITE_COMPANY_NAME, LOGO_PATH, BASE_PATH) |
| **2.8c** | index.html + vite.config (titlu, PWA name) | `frontend/index.html`, `frontend/vite.config.js` | L – titlu / PWA name din env |
| **2.9a** | Pagini: Empleados, Dashboard, DocumentosEmpleados | 3 fișiere | L – API / company din env.js |
| **2.9b** | Pagini: Solicitudes, Fichaje, Login, PresupuestosInformes | 4 fișiere | L – idem |
| **2.9c** | Estadisticas, pushNotifications, inspectionExporter, ChatBot, ActivityLog | 5 fișiere | L – idem |
| **2.9d** | HorasTrabajadas, HorasTrabajadasPDF, HorasPermitidas | 3 fișiere | L – idem |
| **2.9e** | exportExcel, monthlyAlerts, ThemeContext | 3 fișiere | L – idem |
| **2.10a** | firmar.html, firmar-informe.html | URL-uri API/app din build sau fallback | M – injectare la build sau placeholder |
| **2.10b** | sw.js | URL-uri API/n8n din build sau fallback | M – idem |

### Ops (tu manual)

| Pas | Ce |
|-----|-----|
| **2.11** | Pe server: completezi `backend/.env` și `frontend/.env.production` (sau ce folosești) cu toate COMPANY_*, FRONTEND_APP_URL, VITE_* cu valorile DeCamino. |

### Opțional – Faza 3 (curățare)

După ce producția merge bine cu .env complet:

- **3.1** – Backend: scoate fallback-urile DeCamino din company.config, n8n.config, database.config (în prod obligatoriu env).
- **3.2** – Backend: scoate fallback-urile din toate serviciile/controllere (nu mai folosi "info@decaminoservicios.com" etc.).
- **3.3** – main.ts: CORS_ORIGINS și API_URL obligatorii în producție.
- **3.4** – Frontend: scoate fallback-urile DeCamino din env.js și din toate consumatorii.

### Opțional – Faza 4 (doc + polish)

- **4.1** – Doc `DEPLOY_MULTI_CLIENT.md`: cum se face deploy per client (.env, DB, domeniu).
- **4.2** – Actualizare .env.example + eventual validare env la pornire (backend).
- **4.3** – (Opțional) package.json: nume generice pentru frontend/backend.

---

## Ordine recomandată

1. **2.6** + **2.7** (backend) – rapid.
2. **2.8a → 2.8c** (routes, layouts, index/vite).
3. **2.9a → 2.9e** (toate paginile/componentele care folosesc API/company).
4. **2.10a** + **2.10b** (firmar + sw) – atenție la rollback dacă ceva nu merge.
5. **2.11** – setare .env producție DeCamino.
6. După stabilizare: Faza 3 (scoatere fallback-uri), apoi Faza 4 (doc + validare).

Dacă vrei doar „client 2 în DEV”, minimul este: 2.6, 2.7, 2.8a–2.8c, 2.9a–2.9e, 2.10a–2.10b, 2.11, 4.1, 4.2. Faza 3 poate fi făcută mai târziu.
