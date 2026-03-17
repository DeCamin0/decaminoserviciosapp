# Notă sesiune 27 feb 2026 – Client 2 (HERA) culoare teal

**Scop:** La Client 2 (HERA, `localhost:5174`) pagina de login apărea **tot roșu** în loc de **teal** (#3B8D99).

---

## Ce s-a făcut azi

### 1. Culoare forțată în Vite când rulezi Client 2
- **Fișier:** `frontend/vite.config.js`
- După `loadEnv(mode, ...)` s-a adăugat: dacă `mode === 'client2'` → `env.VITE_PRIMARY_COLOR = '#3B8D99'`.
- Astfel, la `npm run dev:client2` env-ul folosit de Vite are deja culoarea HERA.

### 2. Injectare culori în HTML (ca să nu depindă de cache/ordine .env)
- **Fișier:** `frontend/vite.config.js` (plugin `inject-html-version`)
- Se injectează:
  - un **`<style id="vite-primary-vars">`** cu `:root { --primary-color, --primary-color-darker, --primary-color-darkest, --primary-color-rgba-* }`;
  - un **`<script id="vite-primary-set">`** la începutul `<head>` care setează aceste variabile pe `document.documentElement` imediat la parsare;
  - atribut **`data-primary-color="..."`** pe `<html>`.
- Placeholder în `frontend/index.html`: comentariul `<!-- VITE_PRIMARY_CSS_VARS ... -->` e înlocuit cu `<style>`.

### 3. Bundle client (JS) – forțat teal
- **Fișier:** `frontend/vite.config.js` → `define`
- S-a adăugat:  
  `'import.meta.env.VITE_PRIMARY_COLOR': JSON.stringify(env.VITE_PRIMARY_COLOR || '#CC0000')`  
  ca în bundle-ul client să intre mereu valoarea din `env` (deci #3B8D99 la `--mode client2`).
- Fără asta, consola arăta `VITE_PRIMARY_COLOR: #CC0000` și login-ul rămânea roșu.

### 4. LoginPage – fără roșu hardcodat
- **Fișier:** `frontend/src/pages/LoginPage.jsx`
- Fundal și toate accentele folosesc `var(--primary-color)` / `var(--primary-color-darker)` etc., nu hex-uri roșii fixe.
- Fundal: `style={{ backgroundColor: 'var(--primary-color, ' + primaryFallback + ')' }}` cu fallback `#3B8D99` când config nu are culoare.

### 5. App.jsx
- **Fișier:** `frontend/src/App.jsx`
- Variabilele CSS `--primary-color` (și derivate) se setează din `config.PRIMARY_COLOR` (cu fallback la `COLORS.PRIMARY`).

### 6. Fișier .env pentru Client 2 (comis)
- **Fișier:** `frontend/.env.client2` (nou)
- Conține doar `VITE_PRIMARY_COLOR=#3B8D99` ca să fie clar ce culoare folosește Client 2.

---

## Service Worker (PWA) – de reținut

- Dacă tot vezi **roșu** la `localhost:5174`, cel mai probabil **Service Worker-ul** servește o versiune veche din cache.
- **Soluție:** F12 → Application → Service Workers → **Unregister** pentru `localhost:5174`, apoi **Ctrl+Shift+R** (sau folosește fereastră Incognito pentru dev Client 2).

---

## De unde continuăm mâine

1. **Verificare rapidă Client 2:**
   - `cd frontend` → `npm run dev:client2`
   - Deschide `http://localhost:5174/login`
   - Dacă e roșu: Unregister Service Worker (Application → Service Workers), apoi hard refresh.
   - În consolă ar trebui: `VITE_PRIMARY_COLOR: #3B8D99` și pagina **teal**.

2. **Fișiere cheie dacă mai vrei să ajustezi culorile Client 2:**
   - `frontend/vite.config.js` – override `env.VITE_PRIMARY_COLOR` pentru `mode === 'client2'`, injectare HTML, `define` pentru client.
   - `frontend/src/pages/LoginPage.jsx` – toate culorile pe `var(--primary-color*)`.
   - `frontend/.env.client2` și `frontend/.env.client2.local` – `VITE_PRIMARY_COLOR=#3B8D99`.

3. **Doc setup complet Client 2:**  
   `docs/CLIENT_2_SETUP.md` – pași backend + frontend, rulare „ambii clienți odată”.

---

## Rezumat one-liner

**Client 2 teal:** în `vite.config.js` forțăm `#3B8D99` când `mode === 'client2'`, injectăm variabilele CSS în HTML + script la load, și punem `import.meta.env.VITE_PRIMARY_COLOR` în `define`; LoginPage folosește doar `var(--primary-color)`. Dacă tot e roșu → șterge Service Worker pentru localhost:5174 și reîncarcă.
