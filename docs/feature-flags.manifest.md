# Feature flags manifest (v1 — documentare)

Scop: o singură listă de referință. **Nu există încă endpoint runtime**; comportamentul rămâne citirea directă din env ca astăzi.

## Convenții

- **Frontend:** `import.meta.env.VITE_*` (build-time).
- **Backend:** `process.env.*` la startup / la cerere, după cum e deja în cod.
- Orice flag nou: adaugă rând aici + locul exact din cod.

## Inventar (frontend)

| Flag (canonic) | Variabilă env | Fișier(e) / notă |
|----------------|---------------|------------------|
| Signing mock | `VITE_SIGNING_MOCK` | `config/env.js` |
| eInvoice XML | `VITE_ENABLE_EINVOICE_XML` | `config/env.js` (atenție: `|| true` astăzi) |
| Bajas médicas upload | `VITE_UPLOAD_BAJAS_MEDICAS` | `config/env.js` |
| Debug | `VITE_DEBUG_MODE` | `config/env.js` |
| PDF quality | `VITE_PDF_QUALITY` | `config/env.js` |
| Max file size | `VITE_MAX_FILE_SIZE` | `config/env.js` |
| Permisiuni noi | `VITE_USE_NEW_PERMISSIONS` | `hooks/usePermissions.ts` |
| Protecție nouă | `VITE_USE_NEW_PROTECTION` | (căutare în `src/`) |
| Log discrepanțe permisiuni | `VITE_LOG_PERMISSION_DISCREPANCIES` | `hooks/usePermissions.ts` |
| Demo | `VITE_DEMO` | (căutare în `src/`) |
| Asistent angajați | `VITE_ASSISTANT_FOR_EMPLOYEES` | `config/env.js` |
| Idle | `VITE_IDLE_*` | (căutare în `src/`) |

## Inventar (backend)

Documentat în `docs/ENV_VARIABLES_REPORT.md` (secțiuni SMTP, n8n, Telegram, VAPID, `USE_PRISMA_AUTH`, etc.).

## Super-admin health (control plane)

Probing-ul API pentru fiecare tenant folosește **`GET {api_public_url}/health`** (fără prefix `/api`). Răspuns așteptat: HTTP 2xx; opțional JSON cu `status: "ok"`.
