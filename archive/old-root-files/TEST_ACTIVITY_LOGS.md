# 🧪 TEST ACTIVITY LOGS ENDPOINT

## 📋 Checklist Test

### 1. Pornește backend-ul
```bash
cd backend
npm run start:dev
```

### 2. Test POST /api/activity-logs (creare log)

#### Test 1: Log simplu (acțiune de bază)
```bash
curl -X POST http://localhost:3000/api/activity-logs \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test_action",
    "details": {
      "user": "Test User",
      "email": "test@example.com",
      "grupo": "Developer"
    },
    "url": "http://localhost:5173/test",
    "sessionId": "test_session_123"
  }'
```

**Rezultat așteptat:**
```json
{
  "success": true,
  "message": "Activity log created",
  "log": {
    "id": 1
  }
}
```

#### Test 2: Log cu timestamp explicit
```bash
curl -X POST http://localhost:3000/api/activity-logs \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2025-01-15T10:30:00.000Z",
    "action": "login",
    "details": {
      "user": "John Doe",
      "email": "john@example.com",
      "grupo": "Manager"
    },
    "url": "http://localhost:5173/login",
    "sessionId": "session_abc123"
  }'
```

#### Test 3: Log fără details (minimal)
```bash
curl -X POST http://localhost:3000/api/activity-logs \
  -H "Content-Type: application/json" \
  -d '{
    "action": "page_access"
  }'
```

#### Test 4: Test cu userAgent și IP din headers
```bash
curl -X POST http://localhost:3000/api/activity-logs \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Test/1.0" \
  -H "X-Forwarded-For: 192.168.1.100" \
  -d '{
    "action": "test_with_headers",
    "details": {
      "user": "Test User",
      "email": "test@example.com"
    }
  }'
```

**Verificare:** IP-ul și userAgent-ul trebuie să fie extrase automat din headers.

### 3. Test GET /api/activity-logs (citire log-uri)

**⚠️ Necesită autentificare JWT!**

#### Obține token JWT (login):
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

**Salvează token-ul din răspuns!**

#### Test 1: Lista toate log-urile (ultimele 100)
```bash
curl -X GET "http://localhost:3000/api/activity-logs" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Test 2: Filtrare după acțiune
```bash
curl -X GET "http://localhost:3000/api/activity-logs?action=login" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Test 3: Filtrare după email
```bash
curl -X GET "http://localhost:3000/api/activity-logs?email=test@example.com" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Test 4: Filtrare după grup
```bash
curl -X GET "http://localhost:3000/api/activity-logs?grupo=Manager" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Test 5: Limit custom
```bash
curl -X GET "http://localhost:3000/api/activity-logs?limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Test 6: Filtrare după dată
```bash
curl -X GET "http://localhost:3000/api/activity-logs?dateFrom=2025-01-01&dateTo=2025-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Test integrare frontend

#### Test în browser console:
```javascript
// Test direct din frontend
const testLog = {
  timestamp: new Date().toISOString(),
  action: 'test_from_frontend',
  details: {
    user: 'Test User',
    email: 'test@example.com',
    grupo: 'Developer'
  },
  url: window.location.href,
  sessionId: 'test_session_frontend'
};

fetch('http://localhost:3000/api/activity-logs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
  },
  body: JSON.stringify(testLog)
})
  .then(res => res.json())
  .then(data => console.log('✅ Log creat:', data))
  .catch(err => console.error('❌ Eroare:', err));
```

### 5. Verificare în baza de date

```sql
-- Verifică ultimele 10 log-uri
SELECT * FROM Logs ORDER BY id DESC LIMIT 10;

-- Verifică log-urile cu acțiune specifică
SELECT * FROM Logs WHERE action = 'test_action';

-- Verifică IP-urile și userAgent-urile
SELECT id, action, user, ip, userAgent, timestamp 
FROM Logs 
ORDER BY id DESC 
LIMIT 10;
```

## ✅ Verificări

- [ ] Backend pornește fără erori
- [ ] POST /api/activity-logs răspunde cu success
- [ ] Datele se salvează corect în baza de date
- [ ] IP-ul este extras automat din headers
- [ ] userAgent este extras automat din headers
- [ ] updateby este mapat corect din details.user sau details.email
- [ ] GET /api/activity-logs funcționează cu JWT
- [ ] Filtrarea funcționează corect (action, email, grupo, date)
- [ ] Frontend poate trimite log-uri prin activityLogger.js

## 🔧 Probleme posibile

### Eroare: "Cannot find module '@prisma/client'"
**Soluție:** Rulează `npx prisma generate` în folderul `backend`

### Eroare: "Table 'Logs' doesn't exist"
**Soluție:** Verifică dacă tabelul există în baza de date. Dacă nu, creează-l manual sau folosește Prisma migrations.

### Eroare: "PrismaClientKnownRequestError: Column 'xxx' cannot be null"
**Soluție:** Verifică schema Prisma și asigură-te că toate câmpurile opționale sunt marcate cu `?`

### IP-ul nu este extras corect
**Soluție:** Verifică dacă aplicația rulează în spatele unui proxy. Poate trebuie configurat NestJS pentru trust proxy.

## 📊 Rezultate așteptate

După testare, ar trebui să vezi:
- ✅ Log-uri create în tabelul `Logs`
- ✅ IP-urile populate corect
- ✅ userAgent-urile populate corect
- ✅ updateby mapat corect
- ✅ Filtrarea funcționează pentru toate câmpurile
- ✅ Frontend poate trimite log-uri fără erori
