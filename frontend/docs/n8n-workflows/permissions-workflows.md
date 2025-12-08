# n8n Workflows: Permissions Management

## 📋 Descriere
Workflow-uri pentru gestionarea permisiunilor utilizatorilor în aplicația DeCamino.

## 🔗 Endpoint-uri
```
https://n8n.decaminoservicios.com/webhook/get-permissions
https://n8n.decaminoservicios.com/webhook/save-permissions
```

---

## 📊 Workflow 1: get-permissions

### Structura Workflow

#### 1. Webhook Node
**Nume:** `Webhook`
**Metodă:** POST
**Path:** `/get-permissions`

**Configurare:**
- Method: POST
- Path: get-permissions
- Response Mode: Respond to Webhook
- Authentication: None (public endpoint)

#### 2. Google Sheets Node (Read Permissions)
**Nume:** `Read Permissions`

**Configurare:**
- Operation: Read
- Document: [Google Sheets Document - DeCamino Admin]
- Sheet: Admin_Permissions
- Range: A:C (toate coloanele)
- Options: Skip empty rows

#### 3. Set Node (Format Permissions)
**Nume:** `Format Permissions`

**JavaScript Code:**
```javascript
const rows = $input.first().json.values || [];

// Skip header row
const dataRows = rows.slice(1);

// Parse permisiunile
const permissions = {};

dataRows.forEach(row => {
  try {
    const [grupo, module, enabled] = row;
    
    if (!permissions[grupo]) {
      permissions[grupo] = {};
    }
    
    // Convert string to boolean
    const isEnabled = enabled === 'true' || enabled === '1' || enabled === true;
    permissions[grupo][module] = isEnabled;
  } catch (error) {
    console.error('Error parsing permission row:', error);
  }
});

// Adaugă permisiuni implicite pentru grupuri care nu există
const defaultPermissions = {
  Admin: {
    dashboard: true,
    empleados: true,
    fichar: true,
    cuadrantes: true,
    'cuadrantes-empleado': true,
    estadisticas: true,
    clientes: true,
    documentos: true,
    solicitudes: true,
    aprobaciones: true,
    admin: true
  },
  Supervisor: {
    dashboard: true,
    empleados: true,
    fichar: true,
    cuadrantes: true,
    'cuadrantes-empleado': true,
    estadisticas: true,
    clientes: true,
    documentos: true,
    solicitudes: true,
    aprobaciones: true,
    admin: false
  },
  Manager: {
    dashboard: true,
    empleados: true,
    fichar: true,
    cuadrantes: true,
    'cuadrantes-empleado': true,
    estadisticas: true,
    clientes: true,
    documentos: true,
    solicitudes: true,
    aprobaciones: false,
    admin: false
  },
  Operario: {
    dashboard: true,
    empleados: false,
    fichar: true,
    cuadrantes: false,
    'cuadrantes-empleado': true,
    estadisticas: false,
    clientes: false,
    documentos: true,
    solicitudes: true,
    aprobaciones: false,
    admin: false
  },
  Auxiliar: {
    dashboard: true,
    empleados: false,
    fichar: true,
    cuadrantes: false,
    'cuadrantes-empleado': true,
    estadisticas: false,
    clientes: false,
    documentos: true,
    solicitudes: true,
    aprobaciones: false,
    admin: false
  }
};

// Merge cu permisiunile din Google Sheets
Object.keys(defaultPermissions).forEach(grupo => {
  if (!permissions[grupo]) {
    permissions[grupo] = defaultPermissions[grupo];
  } else {
    // Merge cu permisiunile implicite
    Object.keys(defaultPermissions[grupo]).forEach(module => {
      if (permissions[grupo][module] === undefined) {
        permissions[grupo][module] = defaultPermissions[grupo][module];
      }
    });
  }
});

return [{
  json: {
    permissions,
    timestamp: new Date().toISOString()
  }
}];
```

#### 4. Respond to Webhook Node
**Nume:** `Success Response`

**Configurare:**
- Response Code: 200
- Response Body: JSON
- Response Headers: 
  - Content-Type: application/json

---

## 📊 Workflow 2: save-permissions

### Structura Workflow

#### 1. Webhook Node
**Nume:** `Webhook`
**Metodă:** POST
**Path:** `/save-permissions`

**Configurare:**
- Method: POST
- Path: save-permissions
- Response Mode: Respond to Webhook
- Authentication: None (public endpoint)

#### 2. Set Node (Validate and Format)
**Nume:** `Validate and Format`

**JavaScript Code:**
```javascript
const body = $input.first().json;

// Validare input
if (!body.permissions || typeof body.permissions !== 'object') {
  throw new Error('Missing or invalid permissions data');
}

// Convert permissions object to rows for Google Sheets
const rows = [];
const permissions = body.permissions;

Object.keys(permissions).forEach(grupo => {
  Object.keys(permissions[grupo]).forEach(module => {
    const enabled = permissions[grupo][module];
    rows.push([grupo, module, enabled ? 'true' : 'false']);
  });
});

return [{ json: { rows, originalData: body } }];
```

#### 3. Google Sheets Node (Clear and Insert)
**Nume:** `Clear and Insert Permissions`

**Configurare:**
- Operation: Clear
- Document: [Google Sheets Document - DeCamino Admin]
- Sheet: Admin_Permissions
- Range: A:C

#### 4. Google Sheets Node (Insert Headers)
**Nume:** `Insert Headers`

**Configurare:**
- Operation: Append
- Document: [Google Sheets Document - DeCamino Admin]
- Sheet: Admin_Permissions
- Range: A:C

**Data:**
```javascript
return [{ json: { values: [['grupo', 'module', 'enabled']] } }];
```

#### 5. Google Sheets Node (Insert Permissions)
**Nume:** `Insert Permissions`

**Configurare:**
- Operation: Append
- Document: [Google Sheets Document - DeCamino Admin]
- Sheet: Admin_Permissions
- Range: A:C

**Data:**
```javascript
const rows = $input.first().json.rows;
return [{ json: { values: rows } }];
```

#### 6. Respond to Webhook Node
**Nume:** `Success Response`

**Configurare:**
- Response Code: 200
- Response Body: JSON
- Response Headers: 
  - Content-Type: application/json

**JavaScript Code:**
```javascript
const originalData = $input.first().json.originalData;

return [{
  json: {
    success: true,
    message: "Permissions saved successfully",
    timestamp: new Date().toISOString(),
    permissions: originalData.permissions
  }
}];
```

---

## 📝 Date de Test

### Test get-permissions cu curl:
```bash
curl -X POST https://n8n.decaminoservicios.com/webhook/get-permissions \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Test save-permissions cu curl:
```bash
curl -X POST https://n8n.decaminoservicios.com/webhook/save-permissions \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": {
      "Admin": {
        "dashboard": true,
        "empleados": true,
        "fichar": true,
        "cuadrantes": true,
        "cuadrantes-empleado": true,
        "estadisticas": true,
        "clientes": true,
        "documentos": true,
        "solicitudes": true,
        "aprobaciones": true,
        "admin": true
      },
      "Supervisor": {
        "dashboard": true,
        "empleados": true,
        "fichar": true,
        "cuadrantes": true,
        "cuadrantes-empleado": true,
        "estadisticas": true,
        "clientes": true,
        "documentos": true,
        "solicitudes": true,
        "aprobaciones": true,
        "admin": false
      }
    }
  }'
```

### Test cu JavaScript:
```javascript
// Get permissions
fetch('https://n8n.decaminoservicios.com/webhook/get-permissions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
})
.then(response => response.json())
.then(data => {
  console.log('Permissions:', data.permissions);
})
.catch(error => console.error('Error:', error));

// Save permissions
const permissions = {
  Admin: {
    dashboard: true,
    empleados: true,
    fichar: true,
    cuadrantes: true,
    'cuadrantes-empleado': true,
    estadisticas: true,
    clientes: true,
    documentos: true,
    solicitudes: true,
    aprobaciones: true,
    admin: true
  }
};

fetch('https://n8n.decaminoservicios.com/webhook/save-permissions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ permissions })
})
.then(response => response.json())
.then(data => {
  console.log('Save result:', data);
})
.catch(error => console.error('Error:', error));
```

---

## 📊 Răspunsuri API

### get-permissions Response:
```json
{
  "permissions": {
    "Admin": {
      "dashboard": true,
      "empleados": true,
      "fichar": true,
      "cuadrantes": true,
      "cuadrantes-empleado": true,
      "estadisticas": true,
      "clientes": true,
      "documentos": true,
      "solicitudes": true,
      "aprobaciones": true,
      "admin": true
    },
    "Supervisor": {
      "dashboard": true,
      "empleados": true,
      "fichar": true,
      "cuadrantes": true,
      "cuadrantes-empleado": true,
      "estadisticas": true,
      "clientes": true,
      "documentos": true,
      "solicitudes": true,
      "aprobaciones": true,
      "admin": false
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### save-permissions Response:
```json
{
  "success": true,
  "message": "Permissions saved successfully",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "permissions": {
    "Admin": {
      "dashboard": true,
      "empleados": true,
      "fichar": true,
      "cuadrantes": true,
      "cuadrantes-empleado": true,
      "estadisticas": true,
      "clientes": true,
      "documentos": true,
      "solicitudes": true,
      "aprobaciones": true,
      "admin": true
    }
  }
}
```

---

## 📊 Structura Google Sheets

### Tabela: Admin_Permissions

**Coloane:**
- **A: grupo** - Grupul utilizatorului (Admin, Supervisor, Manager, etc.)
- **B: module** - Modulul aplicației (dashboard, fichar, cuadrantes, etc.)
- **C: enabled** - Dacă modulul este activat (true/false)

**Exemplu de date:**
```
grupo | module | enabled
Admin | dashboard | true
Admin | empleados | true
Admin | fichar | true
Admin | cuadrantes | true
Admin | estadisticas | true
Admin | clientes | true
Admin | documentos | true
Admin | solicitudes | true
Admin | aprobaciones | true
Admin | admin | true
Supervisor | dashboard | true
Supervisor | empleados | true
Supervisor | fichar | true
Supervisor | cuadrantes | true
Supervisor | estadisticas | true
Supervisor | clientes | true
Supervisor | documentos | true
Supervisor | solicitudes | true
Supervisor | aprobaciones | true
Supervisor | admin | false
```

---

## 🔧 Module Disponibile

### Lista completă de module:
- **dashboard** - Pagina principală
- **empleados** - Gestionare angajați
- **fichar** - Sistem de pontaj
- **cuadrantes** - Gestionare programe
- **cuadrantes-empleado** - Programe per angajat
- **estadisticas** - Statistici și rapoarte
- **clientes** - Gestionare clienți
- **documentos** - Documente și fișiere
- **solicitudes** - Cereri și solicitări
- **aprobaciones** - Aprobări și autorizări
- **admin** - Panou de administrare

---

## 🚨 Gestionarea Erorilor

### Erori comune:
1. **Invalid permissions format** - Când datele nu sunt în format corect
2. **Google Sheets connection** - Când nu se poate conecta la Google Sheets
3. **Missing required fields** - Când lipsesc câmpurile obligatorii

### Error Response:
```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 🔄 Următorii pași

1. **Creează workflow-urile în n8n**
2. **Configurează Google Sheets connection**
3. **Testează cu diferite permisiuni**
4. **Integrează cu Admin Panel**
5. **Implementează verificarea permisiunilor în aplicație**

---
**Status:** Ready for implementation
**Priority:** Medium
**Estimated time:** 2-3 hours 