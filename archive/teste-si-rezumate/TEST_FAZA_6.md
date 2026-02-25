# 🧪 TEST FAZA 6: Frontend - Culori Branding

## Test automat (rapid - 30 secunde)

```bash
cd frontend
node test-faza-6.js
```

**Rezultat așteptat:**
```
🧪 Test Faza 6: Frontend - Culori Branding

Test 1: Fără VITE_PRIMARY_COLOR (backward compatible)
  ✅ PASS

Test 2: Cu VITE_PRIMARY_COLOR setat
  ✅ PASS

✅ Toate testele finalizate!
```

---

## Test manual în aplicație (10-15 minute)

### Test 1: Backward Compatibility (Client 1)

**Scenariu:** Verifică că aplicația funcționează exact ca înainte (fără `VITE_PRIMARY_COLOR` setat).

1. **Verifică `frontend/.env`:**
   - Nu ar trebui să existe `VITE_PRIMARY_COLOR` (sau să fie comentat)

2. **Pornește frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Testează Export Excel:**
   - Mergi în aplicație → Empleados (sau altă pagină cu export Excel)
   - Click pe "Export Excel" sau butonul de export
   - Descarcă fișierul
   - Deschide Excel-ul și verifică:
     - ✅ Header-ul ar trebui să fie **roșu** (#CC0000)
     - ✅ Nu sunt erori

4. **Testează Export PDF - Solicitudes:**
   - Mergi în aplicație → Solicitudes
   - Click pe "Export PDF" sau butonul de export
   - Descarcă fișierul
   - Deschide PDF-ul și verifică:
     - ✅ Header-ul ar trebui să fie **roșu** (#CC0000)
     - ✅ Nu sunt erori

5. **Testează Export PDF - Fichaje:**
   - Mergi în aplicație → Fichaje
   - Click pe "Export PDF" sau butonul de export
   - Descarcă fișierul
   - Deschide PDF-ul și verifică:
     - ✅ Header-ul ar trebui să fie **roșu** (#CC0000)
     - ✅ Nu sunt erori

6. **Testează Export PDF - Empleados:**
   - Mergi în aplicație → Empleados
   - Selectează un empleado
   - Click pe "Export PDF" sau butonul de export
   - Descarcă fișierul
   - Deschide PDF-ul și verifică:
     - ✅ Header-ul ar trebui să fie **roșu** (#CC0000)
     - ✅ Nu sunt erori

7. **Testează Export PDF - DocumentosEmpleados:**
   - Mergi în aplicație → DocumentosEmpleados
   - Click pe "Export PDF" sau butonul de export
   - Descarcă fișierul
   - Deschide PDF-ul și verifică:
     - ✅ Header-ul ar trebui să fie **roșu** (#CC0000)
     - ✅ Nu sunt erori

8. **Testează UI - ChatBot:**
   - Deschide ChatBot (butonul din colțul dreapta jos)
   - Verifică că:
     - ✅ Butonul de toggle are culoarea **roșie** (#E53935)
     - ✅ Nu sunt erori în console

---

### Test 2: Client 2 (cu VITE_PRIMARY_COLOR setat)

**Scenariu:** Verifică că aplicația folosește `VITE_PRIMARY_COLOR` când e setat.

1. **Adaugă în `frontend/.env`:**
   ```env
   VITE_PRIMARY_COLOR=#0066CC
   ```

2. **Restart frontend:**
   - Oprește frontend (Ctrl+C)
   - Pornește din nou: `npm run dev`

3. **Testează Export Excel:**
   - Mergi în aplicație → Empleados
   - Click pe "Export Excel"
   - Descarcă fișierul
   - Deschide Excel-ul și verifică:
     - ✅ Header-ul ar trebui să fie **albastru** (#0066CC) (NU roșu)
     - ✅ Nu sunt erori

4. **Testează Export PDF - Solicitudes:**
   - Mergi în aplicație → Solicitudes
   - Click pe "Export PDF"
   - Descarcă fișierul
   - Deschide PDF-ul și verifică:
     - ✅ Header-ul ar trebui să fie **albastru** (#0066CC) (NU roșu)
     - ✅ Nu sunt erori

5. **Testează UI - ChatBot:**
   - Deschide ChatBot
   - Verifică că:
     - ✅ Butonul de toggle are culoarea **albastră** (#0066CC) (NU roșu)
     - ✅ Nu sunt erori în console

---

## ✅ Checklist final

- [ ] Test automat: toate testele trec
- [ ] Test 1 (backward compatibility): 
  - [ ] Export Excel: culori roșii (#CC0000)
  - [ ] Export PDF Solicitudes: culori roșii (#CC0000)
  - [ ] Export PDF Fichaje: culori roșii (#CC0000)
  - [ ] Export PDF Empleados: culori roșii (#CC0000)
  - [ ] Export PDF DocumentosEmpleados: culori roșii (#CC0000)
  - [ ] ChatBot UI: culori roșii (#E53935)
- [ ] Test 2 (Client 2): 
  - [ ] Export Excel: culori albastre (#0066CC)
  - [ ] Export PDF: culori albastre (#0066CC)
  - [ ] ChatBot UI: culori albastre (#0066CC)
- [ ] Nu sunt erori în console
- [ ] Nu sunt erori în logs

---

## 🐛 Dacă ceva nu funcționează

### Problema: Culorile sunt tot roșii chiar dacă am setat `VITE_PRIMARY_COLOR`

**Soluție:**
1. Verifică că ai restart-at frontend-ul după modificarea `.env`
2. Verifică că `.env` e în `frontend/` (nu în root)
3. Verifică că nu ai spații în jurul `VITE_PRIMARY_COLOR=...`
4. Verifică că ai format corect: `VITE_PRIMARY_COLOR=#0066CC` (cu #)
5. Șterge cache-ul browser-ului (Ctrl+Shift+Delete) și reîncarcă pagina

### Problema: Eroare "PRIMARY_COLOR is not defined"

**Soluție:**
1. Verifică că ai salvat toate fișierele modificate
2. Verifică că frontend-ul s-a recompilat (vezi logs la pornire)
3. Verifică că nu sunt erori de compilare în console

---

## 📝 Rezumat

**Dacă toate testele trec:**
- ✅ Faza 6 funcționează corect
- ✅ Backward compatible (Client 1 funcționează)
- ✅ Gata pentru Client 2 (setează `VITE_PRIMARY_COLOR` în `.env`)

**Următorul pas:** Faza 7 (Logo Path)
