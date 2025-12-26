# n8n Workflow: log-activity

## 📋 Descriere
Workflow pentru primirea și salvarea logurilor de activitate din aplicația DeCamino în Google Sheets.

## 🔗 Endpoint
```
https://n8n.decaminoservicios.com/webhook/log-activity
```

## 📊 Structura Workflow

### 1. Webhook Node
**Nume:** `Webhook`
**Metodă:** POST
**Path:** `/log-activity`

**Configurare:**
- Method: POST
- Path: log-activity
- Response Mode: Respond to Webhook
- Authentication: None (public endpoint)

### 2. Set Node (Validare și Formatare)
**Nume:** `Validate and Format`

**JavaScript Code:**
```javascript
// Validare input
const body = $input.first().json;

// Verifică câmpurile obligatorii
if (!body.timestamp || !body.action) {
  throw new Error('Missing required fields: timestamp, action');
}

// Extrage datele utilizatorului
const user = body.user || {};
const details = body.details || {};

// Formatare pentru Google Sheets
const row = [
  body.timestamp,                    // A: timestamp
  body.action,                       // B: action
  JSON.stringify(details),           // C: details (JSON)
  user.email || '',                  // D: user_email
  user.GRUPO || user.grupo || '',   // E: user_grupo
  body.sessionId || '',              // F: session_id
  body.userAgent || '',              // G: user_agent
  body.url || ''                     // H: url
];

// Adaugă IP-ul dacă este disponibil
const ip = $input.first().headers['x-forwarded-for'] || 
           $input.first().headers['x-real-ip'] || 
           'unknown';

row.push(ip); // I: ip

return [{ json: { row, originalData: body, ip } }];
```

### 3. Google Sheets Node
**Nume:** `Insert Log Row`

**Configurare:**
- Operation: Append
- Document: [Google Sheets Document - DeCamino Admin]
- Sheet: Admin_ActivityLog
- Range: A:I (toate coloanele)

**Data:**
```javascript
// Din nodul anterior
return [{ json: { values: [row] } }];
```

### 4. Set Node (Success Response)
**Nume:** `Success Response`

**JavaScript Code:**
```javascript
const originalData = $input.first().json.originalData;

return [{
  json: {
    success: true,
    message: "Log saved successfully",
    timestamp: new Date().toISOString(),
    action: originalData.action,
    sessionId: originalData.sessionId
  }
}];
```

### 5. Respond to Webhook Node
**Nume:** `Success Response`

**Configurare:**
- Response Code: 200
- Response Body: JSON
- Response Headers: 
  - Content-Type: application/json

### 6. Error Handling Node
**Nume:** `Error Response`

**JavaScript Code:**
```javascript
const error = $input.first().json;

return [{
  json: {
    success: false,
    error: error.message || "Unknown error",
    timestamp: new Date().toISOString()
  }
}];
```

## 📝 Date de Test

### Test cu curl:
```bash
curl -X POST https://n8n.decaminoservicios.com/webhook/log-activity \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2024-01-15T10:30:00.000Z",
    "action": "login",
    "details": {
      "user": "Alexandru Mihai Paulet",
      "email": "alex@decamino.com",
      "grupo": "Developer"
    },
    "user": {
      "email": "alex@decamino.com",
      "GRUPO": "Developer"
    },
    "sessionId": "session_abc123",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "url": "https://decamino.com/dashboard"
  }'
```

### Test cu JavaScript:
```javascript
fetch('https://n8n.decaminoservicios.com/webhook/log-activity', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    timestamp: new Date().toISOString(),
    action: 'test_action',
    details: { test: 'data' },
    user: { email: 'test@test.com', GRUPO: 'Admin' },
    sessionId: 'test123',
    userAgent: navigator.userAgent,
    url: window.location.href
  })
})
.then(response => response.json())
.then(data => console.log('Log saved:', data))
.catch(error => console.error('Error:', error));
```

## 📊 Structura Google Sheets

### Tabela: Admin_ActivityLog

**Coloane:**
- **A: timestamp** - Data și ora (ISO format)
- **B: action** - Tipul acțiunii (login, logout, page_access, etc.)
- **C: details** - Detalii suplimentare (JSON)
- **D: user_email** - Email-ul utilizatorului
- **E: user_grupo** - Grupul utilizatorului
- **F: session_id** - ID-ul sesiunii
- **G: user_agent** - Browser și sistem
- **H: url** - Pagina accesată
- **I: ip** - Adresa IP

**Exemplu de date:**
```
2024-01-15T10:30:00.000Z | login | {"user":"Alex","email":"alex@decamino.com"} | alex@decamino.com | Developer | session_abc123 | Mozilla/5.0... | https://decamino.com/dashboard | 192.168.1.100
```

## 🔧 Configurare n8n

### 1. Creează workflow-ul
1. Deschide n8n
2. Creează un nou workflow
3. Nume: "log-activity"

### 2. Configurează nodurile
1. **Webhook Node:**
   - Method: POST
   - Path: log-activity
   - Response Mode: Respond to Webhook

2. **Google Sheets Node:**
   - Operation: Append
   - Document: [Selectează documentul Google Sheets]
   - Sheet: Admin_ActivityLog
   - Range: A:I

### 3. Activează workflow-ul
1. Salvează workflow-ul
2. Activează-l
3. Copiază URL-ul webhook-ului

### 4. Testează
1. Folosește curl sau Postman
2. Verifică că datele ajung în Google Sheets
3. Verifică răspunsul API-ului

## 🚨 Gestionarea Erorilor

### Erori comune:
1. **Missing required fields** - Când timestamp sau action lipsesc
2. **Google Sheets connection** - Când nu se poate conecta la Google Sheets
3. **Invalid JSON** - Când datele nu sunt în format JSON valid

### Logging de erori:
- Toate erorile sunt logate în consola n8n
- Răspunsurile de eroare includ mesajul specific
- Log-urile rămân salvate local în aplicație ca backup

## 📈 Monitorizare

### Metrici de urmărit:
- Numărul de log-uri pe zi
- Tipurile de acțiuni cele mai frecvente
- Utilizatorii cei mai activi
- Erorile de logging

### Alerte:
- Când workflow-ul nu răspunde
- Când Google Sheets nu este disponibil
- Când sunt prea multe erori

## 🔄 Următorii pași

1. **Creează workflow-ul în n8n**
2. **Configurează Google Sheets**
3. **Testează cu aplicația**
4. **Monitorizează performanța**
5. **Creează workflow-urile pentru citire**

---
**Status:** Ready for implementation
**Priority:** High
**Estimated time:** 2-3 hours 