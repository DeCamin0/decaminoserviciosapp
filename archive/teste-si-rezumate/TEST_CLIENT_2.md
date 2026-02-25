# Test: Verificare pentru Client 2

## 🎯 Scop
Verificăm că aplicația funcționează cu un URL diferit (simulând Client 2).

## 🧪 Metode de testare

### Metoda 1: Test cu .env.local (Recomandat)

1. **Creează `frontend/.env.local`:**
   ```bash
   # Simulează Client 2
   VITE_API_URL=https://api.client2-test.com
   ```

2. **Pornește frontend-ul:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Verifică în console (F12):**
   - Ar trebui să vezi:
     ```
     🔧 VITE_API_URL: https://api.client2-test.com
     🔧 BACKEND_PROD_URL: https://api.client2-test.com
     ```

4. **Build pentru production:**
   ```bash
   npm run build
   ```

5. **Verifică build-ul:**
   - În `frontend/dist/` caută în fișierele JS compilate
   - Ar trebui să vezi `https://api.client2-test.com` hardcodat în bundle

### Metoda 2: Test cu build production

1. **Creează `frontend/.env.production`:**
   ```bash
   VITE_API_URL=https://api.client2-test.com
   ```

2. **Build pentru production:**
   ```bash
   npm run build
   ```

3. **Preview build-ul:**
   ```bash
   npm run preview
   ```

4. **Verifică în browser:**
   - Deschide `http://localhost:4173/`
   - Console (F12) → ar trebui să vezi URL-ul clientului 2
   - Network tab → request-urile merg la `https://api.client2-test.com`

### Metoda 3: Verificare în cod compilat

1. **Build:**
   ```bash
   npm run build
   ```

2. **Caută în bundle:**
   ```bash
   # Windows PowerShell
   Select-String -Path "frontend/dist/assets/*.js" -Pattern "api.client2-test.com"
   ```

3. **Verifică că URL-ul e corect:**
   - Dacă vezi `api.client2-test.com` în bundle → ✅ Funcționează!
   - Dacă vezi `api.decaminoservicios.com` → ❌ Nu folosește env var

### Metoda 4: Test cu script automat

```bash
# Creează .env.local temporar
echo "VITE_API_URL=https://api.test-client.com" > frontend/.env.local

# Build
cd frontend
npm run build

# Verifică în bundle
grep -r "api.test-client.com" dist/ || echo "❌ URL-ul nu e în bundle"

# Șterge .env.local
rm .env.local
```

## ✅ Checklist pentru Client 2

- [ ] `.env.production` conține `VITE_API_URL=https://api.client2.com`
- [ ] Build-ul funcționează fără erori
- [ ] Bundle-ul conține URL-ul clientului 2 (nu pe cel vechi)
- [ ] Request-urile API merg la URL-ul corect
- [ ] Nu există hardcodate-uri rămase de `decaminoservicios.com`

## 🔍 Verificare automată

Poți crea un script care verifică automat că nu mai sunt hardcodate-uri:

```bash
# Verifică că nu mai sunt hardcodate-uri în routes.js
grep -n "api.decaminoservicios.com" frontend/src/utils/routes.js | grep -v "default" | grep -v "fallback"
# Ar trebui să returneze doar linia cu default-ul (linia 4)
```
