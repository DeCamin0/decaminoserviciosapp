# n8n Workflow: get-admin-stats

## 📋 Descriere
Workflow pentru calcularea și returnarea statisticilor administrative din logurile de activitate pentru Admin Panel.

## 🔗 Endpoint
```
https://n8n.decaminoservicios.com/webhook/get-admin-stats
```

## 📊 Structura Workflow

### 1. Webhook Node
**Nume:** `Webhook`
**Metodă:** POST
**Path:** `/get-admin-stats`

**Configurare:**
- Method: POST
- Path: get-admin-stats
- Response Mode: Respond to Webhook
- Authentication: None (public endpoint)

### 2. Set Node (Parse Parameters)
**Nume:** `Parse Parameters`

**JavaScript Code:**
```javascript
const body = $input.first().json;

// Parametri cu valori implicite
const params = {
  period: body.period || 'week', // week, month, year
  include_trends: body.include_trends !== false, // default true
  include_modules: body.include_modules !== false, // default true
  include_users: body.include_users !== false // default true
};

return [{ json: { params, originalRequest: body } }];
```

### 3. Google Sheets Node (Read All Logs)
**Nume:** `Read All Activity Logs`

**Configurare:**
- Operation: Read
- Document: [Google Sheets Document - DeCamino Admin]
- Sheet: Admin_ActivityLog
- Range: A:I (toate coloanele)
- Options: Skip empty rows

### 4. Set Node (Calculate Statistics)
**Nume:** `Calculate Statistics`

**JavaScript Code:**
```javascript
const params = $input.first().json.params;
const rows = $input.first().json.values || [];

// Skip header row
const dataRows = rows.slice(1);

// Parse datele
const logs = dataRows
  .map(row => {
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
        timestamp: new Date(timestamp),
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
      return null;
    }
  })
  .filter(log => log !== null);

// Calculează perioada
const now = new Date();
let periodStart;
switch (params.period) {
  case 'week':
    periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    break;
  case 'month':
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    break;
  case 'year':
    periodStart = new Date(now.getFullYear(), 0, 1);
    break;
  default:
    periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}

// Filtrează log-urile din perioada specificată
const periodLogs = logs.filter(log => log.timestamp >= periodStart);

// Statistici generale
const stats = {
  totalLogs: logs.length,
  periodLogs: periodLogs.length,
  uniqueUsers: new Set(periodLogs.map(log => log.user_email)).size,
  activeUsersToday: 0,
  uniqueUsersWeek: 0,
  uniqueUsersMonth: 0
};

// Calculează utilizatori activi astăzi
const today = new Date();
today.setHours(0, 0, 0, 0);
const todayLogs = periodLogs.filter(log => log.timestamp >= today);
stats.activeUsersToday = new Set(todayLogs.map(log => log.user_email)).size;

// Calculează utilizatori unici pe săptămână și lună
const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

const weekLogs = logs.filter(log => log.timestamp >= weekAgo);
const monthLogs = logs.filter(log => log.timestamp >= monthAgo);

stats.uniqueUsersWeek = new Set(weekLogs.map(log => log.user_email)).size;
stats.uniqueUsersMonth = new Set(monthLogs.map(log => log.user_email)).size;

// Module accesate (din URL-uri)
const moduleStats = {};
periodLogs.forEach(log => {
  if (log.url) {
    const url = new URL(log.url);
    const path = url.pathname.split('/')[1] || 'dashboard';
    moduleStats[path] = (moduleStats[path] || 0) + 1;
  }
});

// Sortează modulele după numărul de accesări
const mostAccessedModules = Object.entries(moduleStats)
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 10);

// Trend login pe zile (ultimele 7 zile)
const loginTrend = [];
for (let i = 6; i >= 0; i--) {
  const date = new Date(now);
  date.setDate(date.getDate() - i);
  date.setHours(0, 0, 0, 0);
  
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);
  
  const dayLogs = periodLogs.filter(log => 
    log.timestamp >= date && log.timestamp < nextDate
  );
  
  const loginLogs = dayLogs.filter(log => log.action === 'login');
  
  loginTrend.push({
    date: date.toISOString().split('T')[0],
    logins: loginLogs.length,
    uniqueUsers: new Set(loginLogs.map(log => log.user_email)).size,
    totalActions: dayLogs.length
  });
}

// Top utilizatori activi
const userStats = {};
periodLogs.forEach(log => {
  userStats[log.user_email] = (userStats[log.user_email] || 0) + 1;
});

const topUsers = Object.entries(userStats)
  .map(([email, count]) => ({ email, count }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 10);

// Top acțiuni
const actionStats = {};
periodLogs.forEach(log => {
  actionStats[log.action] = (actionStats[log.action] || 0) + 1;
});

const topActions = Object.entries(actionStats)
  .map(([action, count]) => ({ action, count }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 10);

// Statistici pe grupuri
const grupoStats = {};
periodLogs.forEach(log => {
  if (log.user_grupo) {
    grupoStats[log.user_grupo] = (grupoStats[log.user_grupo] || 0) + 1;
  }
});

const topGrupos = Object.entries(grupoStats)
  .map(([grupo, count]) => ({ grupo, count }))
  .sort((a, b) => b.count - a.count);

return [{
  json: {
    stats,
    mostAccessedModules,
    loginTrend,
    topUsers,
    topActions,
    topGrupos,
    period: params.period,
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
curl -X POST https://n8n.decaminoservicios.com/webhook/get-admin-stats \
  -H "Content-Type: application/json" \
  -d '{
    "period": "week",
    "include_trends": true,
    "include_modules": true,
    "include_users": true
  }'
```

### Test cu JavaScript:
```javascript
fetch('https://n8n.decaminoservicios.com/webhook/get-admin-stats', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    period: 'month',
    include_trends: true,
    include_modules: true,
    include_users: true
  })
})
.then(response => response.json())
.then(data => {
  console.log('Stats:', data.stats);
  console.log('Modules:', data.mostAccessedModules);
  console.log('Trend:', data.loginTrend);
})
.catch(error => console.error('Error:', error));
```

## 📊 Răspuns API

### Format răspuns:
```json
{
  "stats": {
    "totalLogs": 15420,
    "periodLogs": 1234,
    "uniqueUsers": 45,
    "activeUsersToday": 12,
    "uniqueUsersWeek": 28,
    "uniqueUsersMonth": 45
  },
  "mostAccessedModules": [
    { "name": "dashboard", "count": 456 },
    { "name": "fichar", "count": 234 },
    { "name": "empleados", "count": 123 },
    { "name": "cuadrantes", "count": 89 },
    { "name": "estadisticas", "count": 67 }
  ],
  "loginTrend": [
    {
      "date": "2024-01-09",
      "logins": 15,
      "uniqueUsers": 12,
      "totalActions": 234
    },
    {
      "date": "2024-01-10",
      "logins": 18,
      "uniqueUsers": 14,
      "totalActions": 289
    }
  ],
  "topUsers": [
    { "email": "alex@decamino.com", "count": 156 },
    { "email": "maria@decamino.com", "count": 123 },
    { "email": "juan@decamino.com", "count": 98 }
  ],
  "topActions": [
    { "action": "page_access", "count": 1234 },
    { "action": "login", "count": 456 },
    { "action": "fichaje_created", "count": 234 },
    { "action": "logout", "count": 123 }
  ],
  "topGrupos": [
    { "grupo": "Developer", "count": 567 },
    { "grupo": "Manager", "count": 234 },
    { "grupo": "Supervisor", "count": 123 }
  ],
  "period": "week",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🔧 Parametri

### Parametri disponibili:
- **period** (string): Perioada pentru statistici (week, month, year)
- **include_trends** (boolean): Include trend-ul de login (default: true)
- **include_modules** (boolean): Include statisticile modulelor (default: true)
- **include_users** (boolean): Include top utilizatori (default: true)

### Exemple de parametri:
```json
// Statistici pentru ultima săptămână
{
  "period": "week"
}

// Statistici pentru ultima lună, fără trend
{
  "period": "month",
  "include_trends": false
}

// Statistici complete pentru an
{
  "period": "year",
  "include_trends": true,
  "include_modules": true,
  "include_users": true
}
```

## 📈 Metrici Calculate

### Statistici generale:
- **totalLogs**: Numărul total de log-uri
- **periodLogs**: Log-urile din perioada specificată
- **uniqueUsers**: Utilizatori unici în perioada specificată
- **activeUsersToday**: Utilizatori activi astăzi
- **uniqueUsersWeek**: Utilizatori unici în ultima săptămână
- **uniqueUsersMonth**: Utilizatori unici în ultima lună

### Module accesate:
- **mostAccessedModules**: Top 10 module accesate
- **count**: Numărul de accesări per modul

### Trend login:
- **loginTrend**: Trend-ul de login pe ultimele 7 zile
- **logins**: Numărul de login-uri pe zi
- **uniqueUsers**: Utilizatori unici pe zi
- **totalActions**: Total acțiuni pe zi

### Top utilizatori:
- **topUsers**: Top 10 utilizatori activi
- **count**: Numărul de acțiuni per utilizator

### Top acțiuni:
- **topActions**: Top 10 acțiuni frecvente
- **count**: Numărul de apariții per acțiune

### Statistici pe grupuri:
- **topGrupos**: Statistici pe grupuri de utilizatori
- **count**: Numărul de acțiuni per grup

## 🚨 Gestionarea Erorilor

### Erori comune:
1. **Invalid period** - Când perioada nu este validă
2. **Google Sheets connection** - Când nu se poate conecta la Google Sheets
3. **Invalid date format** - Când timestamp-urile nu sunt valide

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
1. **Filtrare eficientă** - Filtrare după dată înainte de procesare
2. **Calculare incrementală** - Cache pentru statistici frecvente
3. **Limitare rezultate** - Top 10 pentru liste mari
4. **Optimizare memorie** - Procesare în chunks pentru date mari

### Pentru securitate:
1. **Validare parametri** - Toate parametrii sunt validați
2. **Sanitizare date** - Datele sunt curățate înainte de procesare
3. **Rate limiting** - Limitare număr de request-uri

## 🔄 Următorii pași

1. **Creează workflow-ul în n8n**
2. **Configurează Google Sheets connection**
3. **Testează cu diferite perioade**
4. **Integrează cu Admin Panel**
5. **Optimizează pentru performanță**

---
**Status:** Ready for implementation
**Priority:** Medium
**Estimated time:** 2-3 hours 