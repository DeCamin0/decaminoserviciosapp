# 🧪 Ghid de Testare - Sistem Fichaje Regularizacion

## 📋 Pași de Testare

### 1. Rulare Migrație SQL

**Opțiunea 1: Manual (recomandat pentru testare)**
```bash
# Conectează-te la baza de date
mysql -h 217.154.102.115 -u facturacion_user -p decamino_db

# Rulează migrația
source backend/prisma/migrations/20250115000000_add_fichaje_regularizacion/migration.sql
```

**Opțiunea 2: Din fișier SQL direct**
```bash
mysql -h 217.154.102.115 -u facturacion_user -p decamino_db < backend/prisma/migrations/20250115000000_add_fichaje_regularizacion/migration.sql
```

### 2. Regenerare Prisma Client

```bash
cd backend
npx prisma generate
```

### 3. Restart Backend

```bash
# Dacă rulează cu npm start:dev, se restartează automat
# Altfel, restart manual:
npm run start:dev
```

### 4. Testare în Frontend

#### Test 1: Salida cu diferență pozitivă (mai mult decât programat)

1. **Pregătire:**
   - Asigură-te că ai un cuadrante/horario pentru ziua de azi (ex: 8h)
   - Fă Entrada la ora normală (ex: 08:00)

2. **Test:**
   - Fă Salida cu 1-2 ore mai târziu decât programat (ex: 18:00 în loc de 17:00)
   - **Rezultat așteptat:** Modal-ul "Confirmar Jornada" ar trebui să apară automat

3. **Verificare modal:**
   - Modal-ul ar trebui să afișeze:
     - Has fichado: X horas
     - Horario previsto: Y horas
     - Diferencia: +Z horas
   - Butoane: "No he trabajado más" / "He trabajado más"

#### Test 2: "No he trabajado más"

1. **Acțiune:**
   - Click pe "No he trabajado más"
   
2. **Rezultat așteptat:**
   - Modal-ul se închide
   - Se creează `FichajeRegularizacion` cu:
     - `regularization_type` = `NO_EXTRA`
     - `status` = `CONFIRMED`
     - `effective_minutes` = scheduled_minutes

#### Test 3: "He trabajado más"

1. **Acțiune:**
   - Click pe "He trabajado más"
   
2. **Rezultat așteptat:**
   - Modal-ul se închide
   - Se creează `FichajeRegularizacion` cu:
     - `regularization_type` = `DECLARES_EXTRA`
     - `status` = `NEEDS_REVIEW`
     - `effective_minutes` = punched_minutes (temporar)

#### Test 4: Verificare în DB

```sql
-- Verifică regularizările create
SELECT * FROM FichajeRegularizacion 
ORDER BY created_at DESC 
LIMIT 10;

-- Verifică pentru un angajat specific
SELECT * FROM FichajeRegularizacion 
WHERE employee_codigo = '10000001'  -- înlocuiește cu CODIGO-ul tău
ORDER BY workday_date DESC;
```

#### Test 5: Admin - Regularizări Pending

1. **Endpoint:**
   ```
   GET http://localhost:3000/api/registros/regularizaciones/pendientes
   ```

2. **Rezultat așteptat:**
   - Listă cu regularizări cu `status = NEEDS_REVIEW`
   - Include: employee_codigo, workday_date, punched_minutes, scheduled_minutes

#### Test 6: Admin - Aprobare/Respingere

1. **Aprobare:**
   ```
   POST http://localhost:3000/api/registros/regularizaciones/{id}/aprobar
   ```

2. **Respingere:**
   ```
   POST http://localhost:3000/api/registros/regularizaciones/{id}/rechazar
   Body: { "notes": "Motivo rechazo" }
   ```

### 5. Testare Edge Cases

#### Test 7: Salida fără diferență (< 15 minute)

1. **Pregătire:**
   - Fă Entrada și Salida conform programului
   - Diferența < 15 minute

2. **Rezultat așteptat:**
   - Modal-ul **NU** ar trebui să apară
   - Fichaje se salvează normal

#### Test 8: Ture de noapte (22:00-06:00)

1. **Pregătire:**
   - Fă Entrada la 22:00 (azi)
   - Fă Salida la 06:00 (mâine)

2. **Rezultat așteptat:**
   - `workday_date` = data de la 22:00 (nu mâine!)
   - `window_start` = 2026-01-04 22:00:00
   - `window_end` = 2026-01-05 06:00:00

#### Test 9: Split shifts (partido)

1. **Pregătire:**
   - Fă Entrada 08:00, Salida 13:00
   - Fă Entrada 15:00, Salida 20:00 (același workday)

2. **Rezultat așteptat:**
   - Un singur `FichajeRegularizacion` pentru ambele ture
   - `punched_minutes` = suma ambelor ture (10h)

#### Test 10: Gap > 6h (workday nou)

1. **Pregătire:**
   - Fă Salida la 13:00
   - Fă Entrada la 20:00 (gap > 6h)

2. **Rezultat așteptat:**
   - Două `FichajeRegularizacion` separate
   - Prima: workday_date = data primei Entrada
   - A doua: workday_date = data celei de-a doua Entrada

---

## 🔍 Verificări în Console

### Backend Logs

Urmărește în console backend:
```
✅ Fichaje added: ID=..., CODIGO=..., TIPO=Salida
✅ Regularizacion created: ID=..., employee=..., decision=...
```

### Frontend Logs

Urmărește în browser console:
```
📝 Confirm jornada request - employee: ..., fecha: ..., decision: ...
```

---

## ❌ Probleme Posibile

### 1. Modal-ul nu apare

**Cauze:**
- Diferența < 15 minute (normal, nu apare)
- Backend nu returnează `needs_confirmation: true`
- Eroare în `checkNeedsConfirmation()`

**Debug:**
```javascript
// În Fichaje.jsx, după Salida, verifică:
console.log('Result after Salida:', result);
console.log('needs_confirmation:', result.data?.needs_confirmation);
console.log('confirmation_data:', result.data?.confirmation_data);
```

### 2. Eroare "Regularizacion not found"

**Cauză:** Workday-ul nu a fost detectat corect

**Debug:**
- Verifică dacă există Entrada pentru ziua respectivă
- Verifică log-urile backend pentru `detectWorkday()`

### 3. Eroare SQL la migrație

**Cauză:** Tabelul există deja sau sintaxă greșită

**Soluție:**
```sql
-- Verifică dacă tabelul există
SHOW TABLES LIKE 'FichajeRegularizacion';

-- Dacă există, șterge-l și rulează din nou
DROP TABLE IF EXISTS FichajeRegularizacion;
```

---

## ✅ Checklist Final

- [ ] Migrația SQL rulată cu succes
- [ ] Prisma Client regenerat
- [ ] Backend restartat
- [ ] Modal apare după Salida cu diferență > 15 min
- [ ] "No he trabajado más" creează regularizare CONFIRMED
- [ ] "He trabajado más" creează regularizare NEEDS_REVIEW
- [ ] Admin poate vedea regularizări pending
- [ ] Admin poate aproba/respinge
- [ ] Ture de noapte funcționează corect
- [ ] Split shifts funcționează corect

---

## 📝 Note

- Threshold pentru confirmare: **15 minute** (configurabil în `FichajeRegularizacionService.CONFIRMATION_THRESHOLD_MINUTES`)
- Gap maxim pentru workday: **6 ore** (configurabil în `MAX_GAP_HOURS`)
- Safety cap workday: **16 ore** (configurabil în `MAX_WORKDAY_HOURS`)

