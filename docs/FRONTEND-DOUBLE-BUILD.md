# Frontend: 2 build-uri (Decamino + HERA)

Un singur cod, două build-uri pentru deploy separat.

## Comenzi

| Client   | Comandă              | Output      |
|----------|----------------------|-------------|
| Decamino | `npm run build`      | `frontend/dist/` |
| HERA     | `npm run build:client2` | `frontend/dist-client2/` |

## Ce folosește fiecare build

- **Build Decamino** (`npm run build`): mode implicit `production`. Încarcă `.env`, `.env.production`. API = `VITE_API_URL` din `.env.production` (ex. `https://api.decaminoservicios.com`). Output: **dist/**.
- **Build HERA** (`npm run build:client2`): mode `client2`. Încarcă `.env`, **`.env.client2`**, `.env.client2.local` (dacă există). API = `VITE_API_URL` din `.env.client2`. Output: **dist-client2/**.

## Setup pentru build HERA (producție)

1. În `frontend/` copiază exemplul: `cp .env.client2.example .env.client2`
2. Verifică în `.env.client2` URL-urile de producție:
   - `VITE_API_URL=https://api.herafs.com`
   - `VITE_API_BASE_URL=https://api.herafs.com`
3. Rulează: `npm run build:client2`
4. Conținutul pentru deploy HERA este în **dist-client2/** (nu suprascrie `dist/`).

## Deploy pe server

- **Decamino:** uploadezi conținutul din `frontend/dist/` pe domeniul app Decamino (ex. `app.decaminoservicios.com`).
- **HERA:** uploadezi conținutul din `frontend/dist-client2/` pe domeniul app HERA (ex. `app.herafs.com`).

Poți rula ambele build-uri în același repo: `npm run build` apoi `npm run build:client2`; rezultatul stă în `dist/` și `dist-client2/`.
