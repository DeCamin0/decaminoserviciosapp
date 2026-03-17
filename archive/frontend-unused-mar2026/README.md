# Archive: fișiere frontend nefolosite (martie 2026)

Fișiere mutate din `frontend/` care **nu sunt referite** în cod, build sau config.

## Conținut

- **Diseño-sin-título.svg** – copie din rădăcina frontend (asset nefolosit).
- **public/Diseño-sin-título.svg** – copie din `frontend/public/` (nefolosită în index sau componente).

Ambele au fost verificate cu grep: niciun import sau referință în proiect.

## Ce nu s-a mutat (e folosit)

- `frontend/scripts/` – folosit de package.json (postinstall, versioning, lint, preflight, etc.).
- `frontend/docs/` – folosit (ex: `MANUAL_EMPLEADOS.md` de backend pentru PDF manual).
- `proxy-server.js`, `package-proxy.json`, `applied-config.json` – folosite de npm scripts / eslint / tsconfig.
