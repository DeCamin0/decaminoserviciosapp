# Archive: fișiere backend nefolosite (martie 2026)

Fișiere mutate din `backend/` care **nu sunt referite** în package.json, docs sau cod.

## Conținut

- **run-telefon-entrega-migration.js** – era în rădăcina `backend/`. Migrarea oficială pentru telefon/horario entrega este în `scripts/run-horario-telefono-entrega-migration.js` (folosită în docs și .cursor rules). Acest fișier din root adăuga doar coloana TELEFON ENTREGA la tabela Clientes și nu e apelat nicăieri.

- **backend-frontend/** – copie a unei foldere `backend/frontend/` care conținea doar un `package.json` cu dependențe quill/react-quill. Nu e folosită de NestJS sau de aplicația principală (frontend-ul real e în repo la `frontend/`). Mutată ca `backend-frontend` ca să nu se confunde cu frontend-ul principal.

## Ce nu s-a mutat (e folosit)

- `backend/scripts/*` – multe sunt apelate din package.json (run-decamino-dev, launch-nest-client2, migrations, check-ports, pdf:manual-empleados, etc.) sau din documentație.
- `backend/docs/` – documentație deploy/env, poate fi referită.
- `backend/archive/` – deja arhivă existentă.
- Scripturile de deploy (deploy-backend.sh, deploy.sh, setup-env.sh) – referite în MASTER_LEAD și docs.
