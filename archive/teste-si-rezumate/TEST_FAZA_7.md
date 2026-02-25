# 🧪 TEST FAZA 7: Logo Path Externalizat

## 📋 Ce testăm

Verificăm că logo-urile din UI folosesc `VITE_LOGO_PATH` env var și că funcționează backward compatible.

---

## ✅ Test 1: Backward Compatibility (Fără env var)

### Pași:
1. **Asigură-te că `VITE_LOGO_PATH` NU este setat în `.env` sau `.env.local`**
2. **Restart frontend:**
   ```bash
   cd frontend
   npm run dev
   ```
3. **Verifică în browser:**
   - Logo-ul apare în header (MainLayout/DesktopLayout)
   - Logo-ul apare în footer
   - Logo-ul apare în pagina de login
   - Logo-ul apare în ChatBot (dacă este deschis)

### Rezultat așteptat:
- ✅ Logo-ul default (`logo.svg`) apare în toate locurile
- ✅ Nu există erori în console
- ✅ Aplicația funcționează normal

---

## ✅ Test 2: Cu VITE_LOGO_PATH setat (Client 2)

### Pași:
1. **Creează un logo de test:**
   - Copiază `frontend/public/logo.svg` în `frontend/public/logo-test.svg`
   - Sau creează un logo simplu pentru test

2. **Adaugă în `frontend/.env.local`:**
   ```env
   VITE_LOGO_PATH=logo-test.svg
   ```

3. **Restart frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

4. **Verifică în browser:**
   - Logo-ul NOU apare în header
   - Logo-ul NOU apare în footer
   - Logo-ul NOU apare în pagina de login
   - Logo-ul NOU apare în ChatBot

### Rezultat așteptat:
- ✅ Logo-ul NOU (`logo-test.svg`) apare în toate locurile
- ✅ Nu există erori în console
- ✅ Aplicația funcționează normal

---

## ✅ Test 3: Notificări Push

### Pași:
1. **Fără VITE_LOGO_PATH:**
   - Primește o notificare push
   - Verifică iconița notificării în browser/system tray

2. **Cu VITE_LOGO_PATH setat:**
   - Setează `VITE_LOGO_PATH=logo-test.svg` în `.env.local`
   - Restart frontend
   - Primește o notificare push
   - Verifică iconița notificării

### Rezultat așteptat:
- ✅ Iconița notificării folosește logo-ul corect (default sau custom)
- ✅ Nu există erori în console

---

## ✅ Test 4: InspectionExporter (PDF)

### Pași:
1. **Fără VITE_LOGO_PATH:**
   - Mergi la Inspecciones
   - Generează un PDF de inspecție
   - Verifică că logo-ul apare în PDF

2. **Cu VITE_LOGO_PATH setat:**
   - Setează `VITE_LOGO_PATH=logo-test.svg` în `.env.local`
   - Restart frontend
   - Generează un PDF de inspecție
   - Verifică că logo-ul NOU apare în PDF

### Rezultat așteptat:
- ✅ Logo-ul apare în PDF (default sau custom)
- ✅ Nu există erori în console

---

## ✅ Test 5: EstadisticasPage (logo.png)

### Pași:
1. **Fără VITE_LOGO_PATH:**
   - Mergi la Estadísticas
   - Generează un PDF
   - Verifică că logo-ul apare în PDF (ar trebui să folosească `logo.png`)

2. **Cu VITE_LOGO_PATH setat:**
   - Setează `VITE_LOGO_PATH=logo-test.svg` în `.env.local`
   - Creează `logo-test.png` în `frontend/public/`
   - Restart frontend
   - Generează un PDF
   - Verifică că logo-ul NOU apare în PDF (ar trebui să folosească `logo-test.png`)

### Rezultat așteptat:
- ✅ Logo-ul apare în PDF (default `logo.png` sau custom cu extensie `.png`)
- ✅ Nu există erori în console

---

## 🧪 Test Automat (Opțional)

Rulează scriptul de test:
```bash
cd frontend
node test-faza-7.js
```

---

## 📝 Checklist Final

- [ ] Logo-ul apare în header (MainLayout/DesktopLayout/MobileLayout)
- [ ] Logo-ul apare în footer
- [ ] Logo-ul apare în pagina de login
- [ ] Logo-ul apare în ChatBot
- [ ] Logo-ul apare în notificări push
- [ ] Logo-ul apare în InspectionExporter PDF
- [ ] Logo-ul apare în EstadisticasPage PDF (logo.png)
- [ ] Backward compatible: funcționează fără VITE_LOGO_PATH
- [ ] Configurable: funcționează cu VITE_LOGO_PATH setat
- [ ] Nu există erori în console

---

## 🎯 Pentru Client 2

1. **Adaugă în `frontend/.env`:**
   ```env
   VITE_LOGO_PATH=logo-client2.svg
   ```

2. **Înlocuiește logo-ul:**
   - Copiază logo-ul Client 2 în `frontend/public/logo-client2.svg`

3. **Restart frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

4. **Verifică:**
   - Logo-ul Client 2 apare în toate locurile
   - Nu există erori

---

## ✅ Status

- **Faza 7 COMPLETĂ** ✅
- **0 erori linter** ✅
- **Backward compatible** ✅
- **Gata pentru Client 2** ✅
