# Get Permissions Workflow

## Descriere
Workflow pentru extragerea permisiunilor utilizatorilor din Google Sheets și returnarea lor în format JSON.

## Endpoint
`GET https://n8n.decaminoservicios.com/webhook/get-permissions`

## Structura Workflow

### 1. Webhook Node
- **Nume**: "Get Permissions Webhook"
- **HTTP Method**: GET
- **Path**: `/get-permissions`

### 2. Google Sheets Node
- **Nume**: "Read Permissions from Sheet"
- **Operation**: Read
- **Sheet**: `Admin_Permissions`
- **Range**: `A:Z` (toate coloanele)

### 3. Code Node
- **Nume**: "Format Permissions Response"
- **Funcție**: Procesează datele din Google Sheets și le formatează în structura JSON dorită

### 4. Respond to Webhook Node
- **Nume**: "Return Permissions"
- **Response Code**: 200
- **Response Body**: Datele formatate din Code Node

## JSON Workflow Complet

```json
{
  "name": "get-permissions",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "GET",
        "path": "get-permissions",
        "responseMode": "responseNode",
        "options": {}
      },
      "id": "webhook-get-permissions",
      "name": "Get Permissions Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [240, 300],
      "webhookId": "get-permissions-webhook"
    },
    {
      "parameters": {
        "operation": "read",
        "sheetName": "Admin_Permissions",
        "range": "A:Z",
        "options": {}
      },
      "id": "google-sheets-read-permissions",
      "name": "Read Permissions from Sheet",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4,
      "position": [460, 300],
      "credentials": {
        "googleSheetsOAuth2Api": {
          "id": "google-sheets-credentials",
          "name": "Google Sheets OAuth2"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "// Procesează datele din Google Sheets cu structura: grupo, module, permitted, last_updated, updated_by\nconst rows = $input.all();\nconst permissions = {};\n\nconsole.log('Total rows received:', rows.length);\n\n// Verifică dacă avem date\nif (rows.length === 0) {\n  console.log('No data received from Google Sheets');\n  return [{\n    json: {\n      success: true,\n      permissions: {},\n      message: 'No permissions data found in Google Sheets',\n      timestamp: new Date().toISOString()\n    }\n  }];\n}\n\n// Prima linie conține header-ele\nconst headers = rows[0].json;\nconsole.log('Headers:', headers);\n\n// Verifică dacă avem mai mult de o linie (header + date)\nif (rows.length <= 1) {\n  console.log('Only headers found, no data rows');\n  return [{\n    json: {\n      success: true,\n      permissions: {},\n      message: 'Only headers found in Google Sheets',\n      timestamp: new Date().toISOString()\n    }\n  }];\n}\n\n// Procesează fiecare linie de date (începând cu a doua)\nfor (let i = 1; i < rows.length; i++) {\n  const row = rows[i].json;\n  console.log(`Processing row ${i}:`, row);\n  \n  const grupo = row[0]; // Prima coloană = grupo\n  const module = row[1]; // A doua coloană = module\n  const permitted = row[2]; // A treia coloană = permitted\n  const lastUpdated = row[3]; // A patra coloană = last_updated\n  const updatedBy = row[4]; // A cincea coloană = updated_by\n  \n  if (grupo && grupo.trim() !== '' && module && module.trim() !== '') {\n    // Inițializează grupul dacă nu există\n    if (!permissions[grupo]) {\n      permissions[grupo] = {};\n    }\n    \n    // Setează permisiunea pentru modul\n    const isPermitted = permitted === 'true' || permitted === true || permitted === '1' || permitted === 1;\n    permissions[grupo][module] = isPermitted;\n    \n    console.log(`Set ${grupo}.${module} = ${isPermitted}`);\n  }\n}\n\nconsole.log('Final permissions object:', permissions);\n\n// Returnează răspunsul formatat\nreturn [{\n  json: {\n    success: true,\n    permissions: permissions,\n    message: 'Permissions retrieved successfully',\n    timestamp: new Date().toISOString()\n  }\n}];"
      },
      "id": "code-format-permissions",
      "name": "Format Permissions Response",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [680, 300]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json }}",
        "options": {}
      },
      "id": "respond-permissions",
      "name": "Return Permissions",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [900, 300]
    }
  ],
  "connections": {
    "Get Permissions Webhook": {
      "main": [
        [
          {
            "node": "Read Permissions from Sheet",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read Permissions from Sheet": {
      "main": [
        [
          {
            "node": "Format Permissions Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Format Permissions Response": {
      "main": [
        [
          {
            "node": "Return Permissions",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {},
  "settings": {
    "executionOrder": "v1"
  },
  "staticData": null,
  "tags": [],
  "triggerCount": 1,
  "updatedAt": "2025-01-28T13:00:00.000Z",
  "versionId": "1"
}
```

## Structura Google Sheets

### Tabela: Admin_Permissions

| Rol | dashboard | empleados | fichar | cuadrantes | cuadrantes-empleado | estadisticas | clientes | documentos | solicitudes | aprobaciones | admin |
|-----|-----------|-----------|--------|------------|-------------------|--------------|----------|------------|-------------|--------------|-------|
| Admin | true | true | true | true | true | true | true | true | true | true | true |
| Supervisor | true | true | true | true | true | true | true | true | true | true | false |
| Manager | true | true | true | true | true | true | true | true | true | false | false |
| Operario | true | false | true | false | true | false | false | true | true | false | false |
| Auxiliar | true | false | true | false | true | false | false | true | true | false | false |

## Răspuns Așteptat

```json
{
  "success": true,
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
    },
    "Manager": {
      "dashboard": true,
      "empleados": true,
      "fichar": true,
      "cuadrantes": true,
      "cuadrantes-empleado": true,
      "estadisticas": true,
      "clientes": true,
      "documentos": true,
      "solicitudes": true,
      "aprobaciones": false,
      "admin": false
    },
    "Operario": {
      "dashboard": true,
      "empleados": false,
      "fichar": true,
      "cuadrantes": false,
      "cuadrantes-empleado": true,
      "estadisticas": false,
      "clientes": false,
      "documentos": true,
      "solicitudes": true,
      "aprobaciones": false,
      "admin": false
    },
    "Auxiliar": {
      "dashboard": true,
      "empleados": false,
      "fichar": true,
      "cuadrantes": false,
      "cuadrantes-empleado": true,
      "estadisticas": false,
      "clientes": false,
      "documentos": true,
      "solicitudes": true,
      "aprobaciones": false,
      "admin": false
    }
  },
  "message": "Permissions retrieved successfully",
  "timestamp": "2025-01-28T13:00:00.000Z"
}
```

## Instrucțiuni de Implementare

1. **Creează workflow-ul** în n8n folosind JSON-ul de mai sus
2. **Configurează Google Sheets credentials** pentru accesul la sheet-ul Admin_Permissions
3. **Creează tabela Admin_Permissions** în Google Sheets cu structura specificată
4. **Activează workflow-ul** pentru a fi disponibil la endpoint-ul GET
5. **Testează endpoint-ul** cu un request GET la `https://n8n.decaminoservicios.com/webhook/get-permissions`

## Utilizare în Frontend

```javascript
// În useAdminApi.js
const getPermissions = async () => {
  try {
    const response = await fetch(routes.getPermissions, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error('Error fetching permissions');
    }
    
    const data = await response.json();
    return data.permissions; // Returnează doar obiectul permissions
  } catch (error) {
    console.error('Error fetching permissions:', error);
    // Returnează permisiuni implicite în caz de eroare
    return defaultPermissions;
  }
};
``` 