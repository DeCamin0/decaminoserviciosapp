# Migrare Login Endpoint

## Analiză Endpoint Actual

### Frontend Request
- **Method**: POST
- **URL**: `/webhook/login-yyBov0qVQZEhX2TL`
- **Body**: `{ email: string, password: string }`
- **Headers**: 
  - `Content-Type: application/json`
  - `X-App-Source: DeCamino-Web-App`
  - `X-App-Version: 1.0.0`
  - `X-Client-Type: web-browser`

### n8n Response (actual)
Mai multe formate posibile:
1. **Nou format**: `[{ status: 200, body: { success: true, user: {...} } }]`
2. **Format simplu**: `{ success: true, user: {...} }`
3. **Format vechi (compatibilitate)**: `[{ user1 }, { user2 }, ...]` - array de utilizatori

### Frontend Processing
- Caută user-ul în răspuns (multiple formate)
- Verifică `ESTADO === 'ACTIVO'`
- Detectează rolul din `GRUPO` (Manager, Supervisor, Developer, Admin)
- Creează user object cu toate datele
- Salvează în localStorage

## Plan de Migrare

### Faza 1: Înțelegere Date Utilizatori
- [ ] De unde vin datele utilizatorilor? (DB, n8n, alt serviciu?)
- [ ] Cum se verifică email/password?
- [ ] Ce structură are user object-ul?

### Faza 2: Implementare Backend
- [ ] Creez `AuthController` cu endpoint `/api/auth/login`
- [ ] Implementez logica de autentificare
- [ ] Returnez format compatibil cu frontend
- [ ] Adaug validare și error handling

### Faza 3: Comutare Frontend
- [ ] Modific `routes.js` să folosească `/api/auth/login` în development
- [ ] Testez login-ul
- [ ] Verific compatibilitate cu restul aplicației

### Faza 4: Testare
- [ ] Test login cu credențiale valide
- [ ] Test login cu credențiale invalide
- [ ] Test cu utilizatori inactivi
- [ ] Test cu diferite roluri (Manager, Admin, etc.)

## Întrebări de Răspuns

1. **De unde vin datele utilizatorilor?**
   - Baza de date proprie?
   - n8n query la baza de date?
   - Alt serviciu?

2. **Cum se verifică password-ul?**
   - Hash-uit în DB?
   - Plain text (nu recomandat)?
   - Comparare directă?

3. **Ce câmpuri are user object-ul?**
   - `CORREO ELECTRONICO`
   - `D.N.I. / NIE` (folosit ca password?)
   - `ESTADO`
   - `GRUPO`
   - `CENTRO TRABAJO`
   - Alte câmpuri importante?

## Next Steps

1. Verifică workflow-ul n8n pentru login pentru a înțelege logica
2. Identifică sursa datelor (DB, API, etc.)
3. Implementează logica în backend
4. Testează și comută frontend-ul
