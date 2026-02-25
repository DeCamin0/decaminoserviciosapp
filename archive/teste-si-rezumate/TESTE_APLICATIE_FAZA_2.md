# Teste în Aplicație - Faza 2: CORS Origins

## 🎯 Ce trebuie să verifici:

### Test 1: Verificare că aplicația funcționează normal (Backward Compatibility)

**Scop:** Verificăm că producția actuală funcționează fără modificări.

#### Pași:

1. **Pornește backend-ul:**
   ```bash
   cd backend
   npm run start:dev
   ```

2. **Pornește frontend-ul:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Deschide aplicația în browser:**
   - Mergi la `http://localhost:5173/`

4. **Verifică că funcționează:**
   - ✅ **Login funcționează** - poți să te loghezi
   - ✅ **Paginile se încarcă** - poți naviga prin aplicație
   - ✅ **Request-urile API merg** - datele se încarcă corect

5. **Verifică în Network tab (F12):**
   - Deschide Developer Tools (F12)
   - Tab "Network"
   - Filtrează după "Fetch/XHR"
   - Fă o acțiune (ex: login, încărcare pagină)
   - Verifică că request-urile sunt **verzi** (200, 201, etc.)
   - **NU ar trebui** să vezi erori CORS (roșii cu "CORS policy")

#### Ce înseamnă dacă funcționează:
✅ **Backward compatibility OK** - aplicația funcționează exact ca înainte

---

### Test 2: Verificare CORS în Console (Backend)

**Scop:** Verificăm că backend-ul loghează origins-urile corecte.

#### Pași:

1. **Verifică console-ul backend:**
   - Când faci un request din frontend, ar trebui să vezi în console backend:
     ```
     [Main] OPTIONS preflight request from origin: http://localhost:5173
     [Main] OPTIONS check - origin: http://localhost:5173, allowed origins: http://localhost:5173, https://app.decaminoservicios.com, https://decaminoservicios.com, isAllowed: true
     [Main] ✅ OPTIONS preflight allowed for origin: http://localhost:5173
     ```

2. **Verifică că origins-urile sunt corecte:**
   - Ar trebui să vezi în log: `allowed origins: http://localhost:5173, https://app.decaminoservicios.com, https://decaminoservicios.com`
   - Acestea sunt default-urile (backward compatible)

#### Ce înseamnă dacă funcționează:
✅ **CORS funcționează cu default-urile** - backend permite origins-urile corecte

---

### Test 3: Verificare erori CORS (dacă apare)

**Scop:** Verificăm că nu apar erori CORS.

#### Ce să cauți:

1. **În Console (F12):**
   - **NU ar trebui** să vezi erori de genul:
     ```
     Access to fetch at 'http://localhost:3000/api/...' from origin 'http://localhost:5173' 
     has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
     ```

2. **În Network tab:**
   - **NU ar trebui** să vezi request-uri roșii cu status "CORS error" sau "Failed"

#### Ce înseamnă dacă NU apar erori:
✅ **CORS funcționează corect** - nu sunt blocări

---

### Test 4: Verificare funcționalități principale

**Scop:** Verificăm că toate funcționalitățile principale funcționează.

#### Ce să testezi:

1. **Login:**
   - ✅ Poți să te loghezi
   - ✅ Token-ul se salvează
   - ✅ Ești redirecționat corect

2. **Navigare:**
   - ✅ Poți naviga prin pagini
   - ✅ Datele se încarcă (empleados, cuadrantes, etc.)
   - ✅ Nu apar erori în console

3. **Request-uri API:**
   - ✅ GET requests funcționează (încărcare date)
   - ✅ POST requests funcționează (creare/update)
   - ✅ PUT/DELETE requests funcționează (dacă există)

#### Ce înseamnă dacă funcționează:
✅ **Aplicația funcționează complet** - toate funcționalitățile sunt OK

---

## ✅ Checklist final:

- [ ] Backend pornește fără erori
- [ ] Frontend pornește fără erori
- [ ] Login funcționează
- [ ] Paginile se încarcă
- [ ] Request-urile API merg (verzi în Network tab)
- [ ] NU apar erori CORS în console
- [ ] Backend loghează origins-urile corecte
- [ ] Toate funcționalitățile principale funcționează

## 🐛 Dacă ceva nu funcționează:

1. **Erori CORS în console:**
   - Verifică că backend-ul pornește corect
   - Verifică că `main.ts` nu are erori de sintaxă
   - Verifică console-ul backend pentru log-uri CORS

2. **Request-uri eșuate:**
   - Verifică Network tab pentru detalii
   - Verifică că backend-ul rulează pe portul corect (3000)
   - Verifică că frontend-ul rulează pe portul corect (5173)

3. **Backend nu pornește:**
   - Verifică erorile în console
   - Verifică că toate dependențele sunt instalate (`npm install`)
