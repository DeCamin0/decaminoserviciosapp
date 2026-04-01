# Super-admin: registry tenants + provisioning multi-DB

## Stack

- **Backend:** NestJS 11, MySQL (`mysql2`), Prisma schema aplicată cu **`prisma db push`** pe baza nouă (fără seed).
- **Frontend:** React (Vite), rută **`/superadmin/tenants`** (doar build **DeCamino**; nu există în build HERA). Acces UI: `isSuperAdminControlPlane` din `/api/me` (Developer sau email în `SUPER_ADMIN_EMAILS`). Redirect non-breaking: `/admin/tenants` → `/superadmin/tenants` (DeCamino).
- **Registry:** tabele `tenants` și `tenant_provision_logs` — fie într-o **bază dedicată** (`tenant_registry`), fie în **aceeași bază** ca aplicația (ex. `decamino_db`) dacă userul MySQL nu are `CREATE DATABASE`.

## Setup (o dată)

1. **Recomandat (local / VPS):** din folder `backend`:
   ```bash
   npm run db:setup-tenant-registry
   ```
   Scriptul folosește `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` din `.env.decamino.local` și creează tabelele (fără `CREATE DATABASE`).

   Opțional alt fișier env: `node scripts/setup-tenant-registry.js .env.hera.local`

   Opțional altă bază pe același server: setează `TENANT_REGISTRY_DB=nume_baza` (baza trebuie să existe deja).

2. **Manual:** importă `backend/migrations/tenant_registry_tables.sql` pe baza aleasă (ex. `decamino_db`).

3. **Migrare v1 (coloane opționale observabilitate):** pe aceeași bază unde e `tenants`, rulează o dată:
   ```bash
   mysql -h ... -u ... -p nombre_db < backend/migrations/tenant_registry_add_v1_columns.sql
   ```
   Adaugă `api_public_url` și `environment` (nullable). Fără acest pas, INSERT/SELECT pe tenants pot eșua după deploy de cod nou.

4. În `.env` (același fișier ca backend-ul care pornește API-ul):

   | Variabilă | Rol |
   |-----------|-----|
   | `TENANT_REGISTRY_DATABASE_URL` | `mysql://user:PASS_ENCODED@host:3306/nume_baza` — în URL, caractere speciale în parolă trebuie **encode** (ex. `!` → `%21`) |
   | `TENANT_DB_PASSWORD_ENCRYPTION_KEY` | 64 caractere hex (32 bytes) — cifrare parolă app DB stocată în registry |
   | `DB_PROVISION_HOST` | Host MySQL pentru admin provisioning |
   | `DB_PROVISION_PORT` | Opțional, default `3306` |
   | `DB_PROVISION_USER` | User cu `CREATE DATABASE`, `CREATE USER`, `GRANT` |
   | `DB_PROVISION_PASSWORD` | Parola acelui user |
   | `DB_PROVISION_APP_USER_HOST` | Opțional, default `%` (host pentru `app_<slug>@...`) |
   | `SUPER_ADMIN_EMAILS` | Opțional, liste email (virgulă) cu acces API dacă nu sunt Developer |

   Generează cheia de cifrare:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. **Nu** pune credențialele de admin MySQL în UI — doar în env pe server.

**HERA + Decamino:** poți folosi **aceeași** `TENANT_REGISTRY_DATABASE_URL` (ex. ambele pointează la `decamino_db`) ca să existe o singură listă de tenants.

### Instanțe deja existente (decamino_db / hera_facility_db)

Dacă vrei să apară în listă **fără** să recreezi bazele:

```bash
cd backend
npm run db:seed-existing-tenants
```

Inserează (sau actualizează) rânduri pentru `DB_NAME` din fiecare `.env` — slug `decamino` / `hera`, status `active`, parolă DB cifrată ca la tenants noi. Completează și **`api_public_url`** / **`environment`** (implicit `https://api.decaminoservicios.com` / `https://api.herafs.com` și `production`). Override: `TENANT_SEED_API_PUBLIC_URL`, `TENANT_SEED_ENVIRONMENT` în `.env`. Nu rulează `CREATE DATABASE`.

### Desactivar / activar (solo registro)

En `/superadmin/tenants`: **Desactivar** pone `status = inactive` (no borra datos). **Activar** solo desde `inactive`.  
Migración ENUM (una vez): `npm run db:tenant-registry-inactive`  
**Nota:** esto no corta solo el tráfico de la API por sí mismo; es marcar en el panel / tabla `tenants`.

## Comportament

- **POST** `/api/super-admin/tenants` creează rândul (`provisioning`), generează `tenant_<slug>`, `app_<slug>`, parolă aleatoare, o cifrează, pornește job **async** (same process, `setImmediate`). Body opțional: `api_public_url` (https…), `environment` (ex. `production`).
- Răspunsul include **`db_password_once`** o singură dată.
- Job-ul: `CREATE DATABASE` (dacă lipsește), `CREATE USER` / `ALTER USER`, `GRANT`, apoi `prisma db push --skip-generate` cu `DATABASE_URL` către noua bază (**fără seed**).
- **Retry:** `POST /api/super-admin/tenants/:id/retry` doar dacă `status === failed`.
- **GET** listă: fiecare tenant include **`api_health`**: `OK` | `DOWN` | `UNKNOWN`, calculat pe server cu **GET `{api_public_url}/health`** (timeout ~3.5s). Dacă lipsește `api_public_url`, `UNKNOWN`.
- **PATCH** `/api/super-admin/tenants/:id`: poți trimite `status` (active/inactive) ca înainte, și/sau `api_public_url` / `environment` (string gol = șterge valoarea în registry).

## Securitate

- Acces API: JWT + (`GRUPO === 'Developer'` sau email în `SUPER_ADMIN_EMAILS`).
- UI list/detail **nu** expun parola cifrării sau parola DB.
- Logurile nu ar trebui să conțină parole (mesaje din erori MySQL/Prisma — revizuiește în producție dacă e nevoie).

## Multi-client (Decamino / HERA)

- Fiecare instanță de backend care pornește cu alt `.env` poate avea **același** sau **alt** `TENANT_REGISTRY_DATABASE_URL`.
- Provisioning-ul folosește **întotdeauna** `DB_PROVISION_*` din env-ul procesului curent; aliniază-le cu serverul MySQL unde vrei bazele noi.

## Limitări (conștient)

- Cozi separate (Redis/Bull) nu sunt incluse — job-ul rulează în procesul Nest; la restart, un tenant în `provisioning` poate rămâne blocat până la **Retry** sau intervenție manuală.
- Schema tenant este ceea ce descrie `prisma/schema.prisma` la momentul `db push`; folderul `prisma/migrations/` din repo este în mare parte incremental și **nu** este rulat secvențial aici.
