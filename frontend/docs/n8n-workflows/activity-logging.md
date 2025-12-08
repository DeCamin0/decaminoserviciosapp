# Workflow-uri n8n pentru Logging și Admin Panel

## 📝 **1. Workflow: log-activity**

### **Endpoint:** `https://n8n.decaminoservicios.com/webhook/log-activity`

### **Funcționalitate:**
- Primește log-uri de activitate de la frontend
- Salvează în Google Sheets `Admin_ActivityLog`
- Include timestamp, user, action, details

### **Structura date:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "action": "login",
  "details": {
    "user": "Alexandru Mihai Paulet",
    "email": "alex@decamino.com",
    "grupo": "Developer"
  },
  "userAgent": "Mozilla/5.0...",
  "url": "https://decamino.com/dashboard",
  "sessionId": "session_abc123"
}
```

### **Coloane Google Sheets `Admin_ActivityLog`:**
- `timestamp` - data și ora
- `action` - tipul acțiunii (login, logout, page_access, etc.)
- `user` - numele utilizatorului
- `email` - email-ul utilizatorului
- `grupo` - grupul utilizatorului
- `details` - detalii suplimentare (JSON)
- `userAgent` - browser și sistem
- `url` - pagina accesată
- `sessionId` - ID-ul sesiunii
- `ip` - adresa IP (opțional)

---

## 📊 **2. Workflow: get-activity-log**

### **Endpoint:** `https://n8n.decaminoservicios.com/webhook/get-activity-log`

### **Funcționalitate:**
- Citește log-urile din Google Sheets
- Filtrează după parametri (user, action, date)
- Returnează log-urile sortate

### **Parametri de intrare:**
```json
{
  "user": "todos", // sau numele specific
  "action": "todos", // sau tipul de acțiune
  "date": "2024-01-15", // data specifică
  "limit": 100 // numărul de log-uri
}
```

### **Răspuns:**
```json
[
  {
    "id": 1,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "action": "login",
    "user": "Alexandru Mihai Paulet",
    "email": "alex@decamino.com",
    "grupo": "Developer",
    "details": {...},
    "userAgent": "Mozilla/5.0...",
    "url": "https://decamino.com/dashboard",
    "sessionId": "session_abc123"
  }
]
```

---

## 📈 **3. Workflow: get-admin-stats**

### **Endpoint:** `https://n8n.decaminoservicios.com/webhook/get-admin-stats`

### **Funcționalitate:**
- Calculează statistici din datele existente
- Citește din `Angajati` și `Fichajes`
- Returnează statistici agregate

### **Statistici calculate:**
- **Utilizatori activi azi** - din fichajes de azi
- **Utilizatori unici (7 zile)** - din log-uri
- **Total utilizatori** - din tabela Angajati
- **Modulele cele mai accesate** - din log-uri
- **Evoluția login-urilor** - ultimele 7 zile

### **Răspuns:**
```json
{
  "activeUsersToday": 24,
  "uniqueUsersWeek": 156,
  "totalUsers": 342,
  "mostAccessedModules": [
    {
      "name": "Dashboard",
      "count": 89,
      "percentage": 45
    }
  ],
  "loginTrend": [
    {
      "date": "2024-01-15",
      "logins": 45,
      "uniqueUsers": 23
    }
  ]
}
```

---

## 🔐 **4. Workflow: get-permissions**

### **Endpoint:** `https://n8n.decaminoservicios.com/webhook/get-permissions`

### **Funcționalitate:**
- Citește matricea de permisiuni din Google Sheets
- Returnează permisiunile pentru toate grupurile

### **Coloane Google Sheets `Admin_Permissions`:**
- `grupo` - grupul de utilizatori
- `module` - numele modulului
- `permitted` - true/false
- `last_updated` - data ultimei modificări
- `updated_by` - cine a modificat

### **Răspuns:**
```json
{
  "Admin": {
    "dashboard": true,
    "empleados": true,
    "fichar": true,
    "cuadrantes": true,
    "estadisticas": true,
    "clientes": true,
    "admin": true
  },
  "Supervisor": {
    "dashboard": true,
    "empleados": true,
    "fichar": true,
    "cuadrantes": true,
    "estadisticas": true,
    "clientes": true,
    "admin": false
  }
}
```

---

## 💾 **5. Workflow: save-permissions**

### **Endpoint:** `https://n8n.decaminoservicios.com/webhook/save-permissions`

### **Funcționalitate:**
- Primește matricea de permisiuni
- Salvează în Google Sheets `Admin_Permissions`
- Loghează modificarea

### **Parametri de intrare:**
```json
{
  "permissions": {
    "Admin": {
      "dashboard": true,
      "empleados": true,
      "fichar": true
    }
  },
  "updated_by": "Alexandru Mihai Paulet"
}
```

---

## 🛠️ **Implementare în n8n:**

### **1. Creează tabelele Google Sheets:**
- `Admin_ActivityLog` - pentru log-uri
- `Admin_Permissions` - pentru permisiuni

### **2. Creează workflow-urile:**
- Fiecare workflow cu webhook trigger
- Google Sheets nodes pentru citire/scriere
- HTTP Response nodes pentru răspunsuri

### **3. Configurează autentificarea:**
- Google Sheets credentials
- Webhook URLs

### **4. Testează endpoint-urile:**
- Cu Postman sau curl
- Verifică răspunsurile

---

## 🚀 **Următorii pași:**

1. **Creează tabelele Google Sheets**
2. **Implementează workflow-urile în n8n**
3. **Testează endpoint-urile**
4. **Integrează cu frontend-ul**

Vrei să încep cu implementarea workflow-urilor în n8n? 🤔 