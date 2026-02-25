# 🧪 TEST FAZA 4: Backend - Email BCC

## Test automat (rapid - 30 secunde)

```bash
cd backend
node test-bcc.js
```

**Rezultat așteptat:**
```
🧪 Test Faza 4: Backend - Email BCC

Test 1: Fără EMAIL_BCC (backward compatible)
  ✅ PASS

Test 2: Cu EMAIL_BCC (o singură adresă)
  ✅ PASS

Test 3: Cu EMAIL_BCC (multiple adrese)
  ✅ PASS

Test 4: Cu EMAIL_BCC (cu spații)
  ✅ PASS

Test 5: Cu EMAIL_BCC (string gol)
  ✅ PASS

✅ Toate testele finalizate!
```

---

## Test manual în aplicație (5-10 minute)

### Test 1: Backward Compatibility (Client 1)

**Scenariu:** Verifică că aplicația funcționează exact ca înainte (fără `EMAIL_BCC` setat).

1. **Verifică `.env` backend:**
   - Nu ar trebui să existe `EMAIL_BCC` (sau să fie comentat)

2. **Pornește backend:**
   ```bash
   cd backend
   npm run start:dev
   ```

3. **Trimite un email** (alege unul):
   - **Creare empleado:**
     - Mergi în aplicație → Empleados → Adaugă empleado nou
     - Completează formularul
     - Bifează "Enviar a gestoria"
     - Submit
   - **Creare solicitud:**
     - Mergi în aplicație → Solicitudes → Creează solicitud nouă
     - Submit
   - **Trimite nómina:**
     - Mergi în aplicație → Nominas → Selectează o nómina → "Enviar por email"

4. **Verifică logs backend:**
   ```
   ✅ Email sent successfully:
      TO: ...
      BCC: decamino.rrhh@gmail.com
   ```
   - ✅ **PASS** dacă vezi `BCC: decamino.rrhh@gmail.com`
   - ❌ **FAIL** dacă vezi altceva sau eroare

5. **Verifică că email-ul a fost trimis:**
   - Verifică inbox-ul pentru `decamino.rrhh@gmail.com`
   - Ar trebui să vezi email-ul cu BCC corect

---

### Test 2: Client 2 (cu EMAIL_BCC setat)

**Scenariu:** Verifică că aplicația folosește `EMAIL_BCC` când e setat.

1. **Adaugă în `.env` backend:**
   ```env
   EMAIL_BCC=test-client2@example.com
   ```

2. **Restart backend:**
   - Oprește backend (Ctrl+C)
   - Pornește din nou: `npm run start:dev`

3. **Trimite un email** (același ca în Test 1)

4. **Verifică logs backend:**
   ```
   ✅ Email sent successfully:
      TO: ...
      BCC: test-client2@example.com
   ```
   - ✅ **PASS** dacă vezi `BCC: test-client2@example.com` (NU `decamino.rrhh@gmail.com`)
   - ❌ **FAIL** dacă vezi `decamino.rrhh@gmail.com` sau eroare

5. **Verifică că email-ul a fost trimis:**
   - Verifică inbox-ul pentru `test-client2@example.com`
   - Ar trebui să vezi email-ul cu BCC corect

---

### Test 3: Multiple adrese BCC

**Scenariu:** Verifică că funcționează cu multiple adrese.

1. **Modifică `.env` backend:**
   ```env
   EMAIL_BCC=test-client2@example.com, test-admin@example.com
   ```

2. **Restart backend**

3. **Trimite un email**

4. **Verifică logs backend:**
   ```
   ✅ Email sent successfully:
      TO: ...
      BCC: test-client2@example.com, test-admin@example.com
   ```
   - ✅ **PASS** dacă vezi ambele adrese
   - ❌ **FAIL** dacă vezi doar una sau eroare

---

## ✅ Checklist final

- [ ] Test automat: toate testele trec
- [ ] Test 1 (backward compatibility): BCC e `decamino.rrhh@gmail.com`
- [ ] Test 2 (Client 2): BCC e `test-client2@example.com`
- [ ] Test 3 (multiple adrese): BCC conține ambele adrese
- [ ] Nu sunt erori în logs
- [ ] Email-urile sunt trimise corect

---

## 🐛 Dacă ceva nu funcționează

### Problema: BCC e tot `decamino.rrhh@gmail.com` chiar dacă am setat `EMAIL_BCC`

**Soluție:**
1. Verifică că ai restart-at backend-ul după modificarea `.env`
2. Verifică că `.env` e în `backend/` (nu în root)
3. Verifică că nu ai spații în jurul `EMAIL_BCC=...`
4. Verifică logs la pornire - ar trebui să vezi că env vars sunt încărcate

### Problema: Eroare "getDefaultBcc is not a function"

**Soluție:**
1. Verifică că ai salvat `email.service.ts`
2. Verifică că backend-ul s-a recompilat (vezi logs la pornire)
3. Verifică că nu sunt erori de compilare TypeScript

---

## 📝 Rezumat

**Dacă toate testele trec:**
- ✅ Faza 4 funcționează corect
- ✅ Backward compatible (Client 1 funcționează)
- ✅ Gata pentru Client 2 (setează `EMAIL_BCC` în `.env`)

**Următorul pas:** Faza 5 (SMTP From Fallback)
