# Test Faza 3: Frontend - Date Companie în Export-uri

## 🎯 Ce trebuie să verificăm:

1. **Backward Compatibility**: Export-urile funcționează fără env vars (folosesc default-urile)
2. **Date Companie Corecte**: Export-urile arată "DE CAMINO SERVICIOS AUXILIARES SL" (default)
3. **Culori Corecte**: Export-urile folosesc culorile default (#CC0000, #0066CC)

## 🧪 Pași de testare:

### Test 1: Export Excel (Backward Compatibility)

1. **Pornește frontend-ul:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Generează un export Excel:**
   - Mergi la orice pagină care are export Excel (ex: Empleados, Estadisticas, etc.)
   - Click pe "Export Excel" sau similar
   - Descarcă fișierul

3. **Verifică Excel-ul:**
   - Deschide fișierul Excel
   - Verifică header-ul (prima linie):
     - ✅ Ar trebui să vezi: "DE CAMINO SERVICIOS AUXILIARES SL"
     - ✅ Ar trebui să vezi: "NIF: B85524536"
     - ✅ Ar trebui să vezi: "Teléfono: 910 440 275"
     - ✅ Ar trebui să vezi: "Email: info@decaminoservicios.com"
   - Verifică culorile:
     - ✅ Header-ul ar trebui să fie roșu (#CC0000)
     - ✅ Titlurile ar trebui să fie albastre (#0066CC)

### Test 2: Export PDF (Backward Compatibility)

1. **Generează un export PDF:**
   - Mergi la orice pagină care are export PDF (ex: Solicitudes, Fichaje, Empleados, etc.)
   - Click pe "Export PDF" sau similar
   - Descarcă fișierul

2. **Verifică PDF-ul:**
   - Deschide fișierul PDF
   - Verifică header-ul (prima pagină):
     - ✅ Ar trebui să vezi: "DE CAMINO SERVICIOS AUXILIARES SL"
     - ✅ Ar trebui să vezi: "NIF: B85524536"
     - ✅ Ar trebui să vezi: "Teléfono: 910 440 275"
     - ✅ Ar trebui să vezi: "Email: info@decaminoservicios.com"

### Test 3: UI - Nume Companie

1. **Verifică în aplicație:**
   - Login page: ar trebui să vezi "DE CAMINO SERVICIOS AUXILIARES" în header
   - Dashboard: ar trebui să vezi "DE CAMINO SERVICIOS AUXILIARES" în text
   - Layout-uri: ar trebui să vezi numele companiei în header

### Test 4: Cu Env Vars Setate (Opțional - pentru Client 2)

1. **Creează `frontend/.env.local`:**
   ```bash
   VITE_COMPANY_NAME=CLIENT 2 SERVICIOS SL
   VITE_COMPANY_CIF=B12345678
   VITE_COMPANY_ADDRESS=Dirección Client 2, Madrid
   VITE_COMPANY_PHONE=912 345 678
   VITE_COMPANY_EMAIL=info@client2.com
   VITE_PRIMARY_COLOR=#FF0000
   VITE_SECONDARY_COLOR=#0000FF
   ```

2. **Repornește frontend-ul:**
   ```bash
   npm run dev
   ```

3. **Generează export Excel/PDF:**
   - Ar trebui să vezi "CLIENT 2 SERVICIOS SL" în loc de "DE CAMINO..."
   - Ar trebui să vezi culorile Client 2 (#FF0000, #0000FF)

## ✅ Checklist:

- [ ] Export Excel funcționează
- [ ] Export Excel arată "DE CAMINO SERVICIOS AUXILIARES SL" (default)
- [ ] Export PDF funcționează
- [ ] Export PDF arată "DE CAMINO SERVICIOS AUXILIARES SL" (default)
- [ ] Culorile în export-uri sunt corecte (roșu #CC0000, albastru #0066CC)
- [ ] UI arată numele companiei corect
- [ ] Nu sunt erori în console

## 🐛 Dacă ceva nu funcționează:

1. **Export-urile nu se generează:**
   - Verifică console-ul pentru erori
   - Verifică că toate dependențele sunt instalate

2. **Datele companiei nu apar:**
   - Verifică că env vars sunt setate corect (sau lipsesc pentru default)
   - Verifică console-ul pentru erori

3. **Culorile nu sunt corecte:**
   - Verifică că env vars pentru culori sunt setate corect (sau lipsesc pentru default)
