# Test Faza 1: Frontend API URLs Externalizate

## ✅ Ce trebuie să verificăm:

1. **Backward Compatibility**: Frontend-ul funcționează fără `VITE_API_URL` setat (folosește default-ul)
2. **Env Var Funcționează**: Dacă setăm `VITE_API_URL`, se folosește valoarea setată
3. **Console Logs**: Verificăm că valorile sunt corecte în console

## 🧪 Pași de testare:

### Test 1: Backward Compatibility (fără VITE_API_URL)

1. **Verifică că nu există `VITE_API_URL` în `.env`:**
   ```bash
   cd frontend
   grep VITE_API_URL .env 2>/dev/null || echo "VITE_API_URL nu e setat (OK pentru test)"
   ```

2. **Pornește frontend-ul:**
   ```bash
   npm run dev
   ```

3. **Verifică console-ul browser (F12):**
   - Caută log-urile care încep cu `🔧`
   - Ar trebui să vezi:
     ```
     🔧 BASE_URL value: http://localhost:3000 (în dev) sau https://api.decaminoservicios.com (în prod)
     🔧 VITE_API_URL: (not set - using default)
     🔧 BACKEND_PROD_URL: https://api.decaminoservicios.com
     ```

4. **Testează un request API:**
   - Încearcă să te loghezi sau să accesezi orice pagină care face request-uri API
   - Verifică în Network tab (F12) că request-urile merg la URL-ul corect:
     - Dev: `http://localhost:3000/api/...`
     - Prod: `https://api.decaminoservicios.com/api/...`

### Test 2: Cu VITE_API_URL setat

1. **Creează/editează `frontend/.env.local`:**
   ```bash
   echo "VITE_API_URL=https://api.test-client.com" > frontend/.env.local
   ```

2. **Repornește frontend-ul:**
   ```bash
   npm run dev
   ```

3. **Verifică console-ul:**
   - Ar trebui să vezi:
     ```
     🔧 VITE_API_URL: https://api.test-client.com
     🔧 BACKEND_PROD_URL: https://api.test-client.com
     ```

4. **Testează request-urile:**
   - În Network tab, verifică că request-urile merg la `https://api.test-client.com/api/...`

### Test 3: Verificare sintaxă

1. **Verifică că nu sunt erori de linting:**
   ```bash
   cd frontend
   npm run lint  # dacă există script
   ```

2. **Verifică că build-ul funcționează:**
   ```bash
   npm run build
   ```

## ✅ Rezultate așteptate:

- ✅ Frontend pornește fără erori
- ✅ Console logs arată valorile corecte
- ✅ Request-urile API merg la URL-ul corect
- ✅ Backward compatible: funcționează fără `VITE_API_URL`
- ✅ Env var funcționează: dacă setăm `VITE_API_URL`, se folosește

## 🐛 Dacă ceva nu funcționează:

1. **Verifică console-ul pentru erori**
2. **Verifică Network tab pentru request-uri eșuate**
3. **Verifică că `routes.js` nu are erori de sintaxă**
4. **Verifică că toate template string-urile sunt corecte (backtick, nu apostrof)**
