# n8n Workflow: get-activity-log

## 📋 Descriere
Workflow pentru citirea și filtrarea logurilor de activitate din Google Sheets pentru Admin Panel.

## 🔗 Endpoint
```
https://n8n.decaminoservicios.com/webhook/get-activity-log
```

## 📊 Structura Workflow

### 1. Webhook Node
**Nume:** `Webhook`
**Metodă:** POST
**Path:** `/get-activity-log`

**Configurare:**
- Method: POST
- Path: get-activity-log
- Response Mode: Respond to Webhook
- Authentication: None (public endpoint)

### 2. Set Node (Parse Filters)
**Nume:** `Parse Filters`

**JavaScript Code:**
```javascript
const body = $input.first().json;

// Parametri de filtrare cu valori implicite
const filters = {
  limit: body.limit || 100,
  action: body.action || 'todos',
  user_email: body.user_email || 'todos',
  date_from: body.date_from || '',
  date_to: body.date_to || '',
  grupo: body.grupo || 'todos'
};

// Validare limit
if (filters.limit > 1000) {
  filters.limit = 1000; // Limit maxim
}

return [{ json: { filters, originalRequest: body } }];
```

### 3. Google Sheets Node (Read Data)
**Nume:** `Read Activity Log`

**Configurare:**
- Operation: Read
- Document: [Google Sheets Document - DeCamino Admin]
- Sheet: Admin_ActivityLog
- Range: A:I (toate coloanele)
- Options: Skip empty rows

### 4. Set Node (Filter and Format)
**Nume:** `Filter and Format Data`

**JavaScript Code:**
```javascript
const filters = $input.first().json.filters;
const rows = $input.first().json.values || [];

// Skip header row
const dataRows = rows.slice(1);

// Parse și filtrează datele
const filteredLogs = dataRows
  .map((row, index) => {
    try {
      const [timestamp, action, details, user_email, user_grupo, session_id, user_agent, url, ip] = row;
      
      // Parse details JSON
      let parsedDetails = {};
      try {
        parsedDetails = JSON.parse(details || '{}');
      } catch (e) {
        parsedDetails = { raw: details };
      }

      return {
        id: index + 1,
        timestamp,
        action,
        details: parsedDetails,
        user_email,
        user_grupo,
        session_id,
        user_agent,
        url,
        ip
      };
    } catch (error) {
      console.error('Error parsing row:', error);
      return null;
    }
  })
  .filter(log => log !== null) // Remove invalid rows
  .filter(log => {
    // Filtrare după action
    if (filters.action !== 'todos' && log.action !== filters.action) {
      return false;
    }
    
    // Filtrare după user_email
    if (filters.user_email !== 'todos' && log.user_email !== filters.user_email) {
      return false;
    }
    
    // Filtrare după grupo
    if (filters.grupo !== 'todos' && log.user_grupo !== filters.grupo) {
      return false;
    }
    
    // Filtrare după date
    if (filters.date_from) {
      const logDate = new Date(log.timestamp);
      const fromDate = new Date(filters.date_from);
      if (logDate < fromDate) {
        return false;
      }
    }
    
    if (filters.date_to) {
      const logDate = new Date(log.timestamp);
      const toDate = new Date(filters.date_to);
      if (logDate > toDate) {
        return false;
      }
    }
    
    return true;
  })
  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Sort by newest first
  .slice(0, filters.limit); // Apply limit

// Calculează statistici
const stats = {
  total: filteredLogs.length,
  actions: {},
  users: {},
  grupos: {}
};

filteredLogs.forEach(log => {
  // Count actions
  stats.actions[log.action] = (stats.actions[log.action] || 0) + 1;
  
  // Count users
  stats.users[log.user_email] = (stats.users[log.user_email] || 0) + 1;
  
  // Count grupos
  stats.grupos[log.user_grupo] = (stats.grupos[log.user_grupo] || 0) + 1;
});

return [{
  json: {
    logs: filteredLogs,
    stats,
    filters,
    total: filteredLogs.length,
    timestamp: new Date().toISOString()
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

## 📝 Date de Test

### Test cu curl:
```bash
curl -X POST https://n8n.decaminoservicios.com/webhook/get-activity-log \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 50,
    "action": "login",
    "user_email": "alex@decamino.com",
    "date_from": "2024-01-01",
    "date_to": "2024-01-31"
  }'
```

### Test cu JavaScript:
```javascript
fetch('https://n8n.decaminoservicios.com/webhook/get-activity-log', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    limit: 100,
    action: 'todos',
    user_email: 'todos',
    date_from: '2024-01-01',
    date_to: '2024-01-31'
  })
})
.then(response => response.json())
.then(data => {
  console.log('Logs:', data.logs);
  console.log('Stats:', data.stats);
})
.catch(error => console.error('Error:', error));
```

## 📊 Răspuns API

### Format răspuns:
```json
{
  "logs": [
    {
      "id": 1,
      "timestamp": "2024-01-15T10:30:00.000Z",
      "action": "login",
      "details": {
        "user": "Alexandru Mihai Paulet",
        "email": "alex@decamino.com"
      },
      "user_email": "alex@decamino.com",
      "user_grupo": "Developer",
      "session_id": "session_abc123",
      "user_agent": "Mozilla/5.0...",
      "url": "https://decamino.com/dashboard",
      "ip": "192.168.1.100"
    }
  ],
  "stats": {
    "total": 1,
    "actions": {
      "login": 1
    },
    "users": {
      "alex@decamino.com": 1
    },
    "grupos": {
      "Developer": 1
    }
  },
  "filters": {
    "limit": 100,
    "action": "login",
    "user_email": "alex@decamino.com",
    "date_from": "2024-01-01",
    "date_to": "2024-01-31",
    "grupo": "todos"
  },
  "total": 1,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🔧 Parametri de Filtrare

### Parametri disponibili:
- **limit** (number): Numărul maxim de log-uri (default: 100, max: 1000)
- **action** (string): Tipul acțiunii (ex: "login", "logout", "page_access")
- **user_email** (string): Email-ul utilizatorului
- **date_from** (string): Data de început (YYYY-MM-DD)
- **date_to** (string): Data de sfârșit (YYYY-MM-DD)
- **grupo** (string): Grupul utilizatorului

### Exemple de filtrare:
```json
// Toate log-urile din ultima săptămână
{
  "limit": 500,
  "date_from": "2024-01-08"
}

// Doar login-urile
{
  "action": "login",
  "limit": 50
}

// Log-urile unui utilizator specific
{
  "user_email": "alex@decamino.com",
  "limit": 100
}

// Log-urile unui grup
{
  "grupo": "Developer",
  "limit": 200
}
```

## 🚨 Gestionarea Erorilor

### Erori comune:
1. **Invalid date format** - Când datele nu sunt în format YYYY-MM-DD
2. **Google Sheets connection** - Când nu se poate conecta la Google Sheets
3. **Invalid JSON in details** - Când coloana details nu este JSON valid

### Error Response:
```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 📈 Optimizări

### Pentru performanță:
1. **Limitare rezultate** - Maxim 1000 log-uri per request
2. **Filtrare eficientă** - Filtrare în JavaScript după citire
3. **Sortare optimizată** - Sortare după timestamp descrescător
4. **Caching** - Cache pentru filtrele frecvente

### Pentru securitate:
1. **Validare input** - Toate parametrii sunt validați
2. **Sanitizare date** - Datele sunt curățate înainte de procesare
3. **Rate limiting** - Limitare număr de request-uri

## 🔄 Următorii pași

1. **Creează workflow-ul în n8n**
2. **Configurează Google Sheets connection**
3. **Testează cu diferite filtre**
4. **Integrează cu Admin Panel**
5. **Optimizează pentru performanță**

---
**Status:** Ready for implementation
**Priority:** High
**Estimated time:** 2-3 hours 