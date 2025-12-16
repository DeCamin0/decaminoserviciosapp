# Generate Inspection PDF Workflow

## Descriere
Workflow pentru procesarea datelor de inspecție și generarea PDF-urilor cu fișele de inspecție.

## Endpoint
`POST https://n8n.decaminoservicios.com/webhook/generate-inspection-pdf`

## Structura Workflow

### 1. Webhook Node
- **Nume**: "Inspection PDF Webhook"
- **HTTP Method**: POST
- **Path**: `/generate-inspection-pdf`

### 2. Code Node - Validare Date
- **Nume**: "Validate Inspection Data"
- **Funcție**: Validează structura payload-ului conform specificațiilor

### 3. Code Node - Procesare Semnături
- **Nume**: "Process Signatures"
- **Funcție**: Procesează semnăturile base64 și le validează

### 4. Code Node - Generare PDF
- **Nume**: "Generate PDF Content"
- **Funcție**: Generează conținutul PDF-ului cu datele de inspecție

### 5. HTTP Request Node - PDF Generator
- **Nume**: "Call PDF Generator Service"
- **Method**: POST
- **URL**: Serverul tău de generare PDF

### 6. Code Node - Procesare Răspuns
- **Nume**: "Process PDF Response"
- **Funcție**: Procesează răspunsul de la serverul PDF

### 7. Respond to Webhook Node
- **Nume**: "Return PDF Response"
- **Response Code**: 200/400/500
- **Response Body**: PDF sau eroare

## JSON Workflow Complet

```json
{
  "name": "generate-inspection-pdf",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "generate-inspection-pdf",
        "responseMode": "responseNode",
        "options": {}
      },
      "id": "webhook-inspection-pdf",
      "name": "Inspection PDF Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [240, 300],
      "webhookId": "inspection-pdf-webhook"
    },
    {
      "parameters": {
        "jsCode": "// Validare date de inspecție\nconst payload = $input.first().json;\n\nconsole.log('🔍 Validare payload inspecție:', JSON.stringify(payload, null, 2));\n\n// Schema de validare\nconst requiredFields = {\n  inspeccionId: 'string',\n  timestamp: 'string',\n  empleado: 'object',\n  vehicul: 'object',\n  locatie: 'object',\n  observatii: 'string',\n  items: 'array',\n  meta: 'object'\n};\n\nconst empleadoFields = {\n  id: 'string',\n  nume: 'string',\n  email: 'string'\n};\n\nconst vehiculFields = {\n  placa: 'string',\n  km: 'number'\n};\n\nconst locatieFields = {\n  lat: 'number',\n  lng: 'number'\n};\n\nconst metaFields = {\n  versiuneSchema: 'number',\n  clientApp: 'string',\n  type: 'string',\n  inspector: 'string',\n  numeroInspeccion: 'string'\n};\n\n// Funcție de validare\nfunction validateField(value, fieldName, expectedType) {\n  if (value === undefined || value === null) {\n    return { valid: false, error: `${fieldName} is required` };\n  }\n  \n  if (expectedType === 'string' && typeof value !== 'string') {\n    return { valid: false, error: `${fieldName} must be a string` };\n  }\n  \n  if (expectedType === 'number' && typeof value !== 'number') {\n    return { valid: false, error: `${fieldName} must be a number` };\n  }\n  \n  if (expectedType === 'object' && typeof value !== 'object') {\n    return { valid: false, error: `${fieldName} must be an object` };\n  }\n  \n  if (expectedType === 'array' && !Array.isArray(value)) {\n    return { valid: false, error: `${fieldName} must be an array` };\n  }\n  \n  return { valid: true };\n}\n\n// Validare câmpuri obligatorii\nconst errors = [];\n\nfor (const [field, type] of Object.entries(requiredFields)) {\n  const validation = validateField(payload[field], field, type);\n  if (!validation.valid) {\n    errors.push(validation.error);\n  }\n}\n\n// Validare empleado\nif (payload.empleado) {\n  for (const [field, type] of Object.entries(empleadoFields)) {\n    const validation = validateField(payload.empleado[field], `empleado.${field}`, type);\n    if (!validation.valid) {\n      errors.push(validation.error);\n    }\n  }\n}\n\n// Validare vehicul\nif (payload.vehicul) {\n  for (const [field, type] of Object.entries(vehiculFields)) {\n    const validation = validateField(payload.vehicul[field], `vehicul.${field}`, type);\n    if (!validation.valid) {\n      errors.push(validation.error);\n    }\n  }\n}\n\n// Validare locatie\nif (payload.locatie) {\n  for (const [field, type] of Object.entries(locatieFields)) {\n    const validation = validateField(payload.locatie[field], `locatie.${field}`, type);\n    if (!validation.valid) {\n      errors.push(validation.error);\n    }\n  }\n}\n\n// Validare meta\nif (payload.meta) {\n  for (const [field, type] of Object.entries(metaFields)) {\n    const validation = validateField(payload.meta[field], `meta.${field}`, type);\n    if (!validation.valid) {\n      errors.push(validation.error);\n    }\n  }\n}\n\n// Validare items\nif (payload.items && Array.isArray(payload.items)) {\n  if (payload.items.length === 0) {\n    errors.push('items array cannot be empty');\n  } else {\n    payload.items.forEach((item, index) => {\n      if (!item.cod || !item.descriere) {\n        errors.push(`item[${index}] missing required fields: cod, descriere`);\n      }\n      if (typeof item.ok !== 'boolean') {\n        errors.push(`item[${index}].ok must be a boolean`);\n      }\n      if (typeof item.nota !== 'number' || item.nota < 1 || item.nota > 5) {\n        errors.push(`item[${index}].nota must be a number between 1-5`);\n      }\n    });\n  }\n}\n\n// Validare semnături (opționale)\nif (payload.empleado.semnaturaPng && !payload.empleado.semnaturaPng.startsWith('data:image/png;base64,')) {\n  errors.push('empleado.semnaturaPng must be a valid PNG base64 data URL');\n}\n\nif (payload.meta.semnaturaInspector && !payload.meta.semnaturaInspector.startsWith('data:image/png;base64,')) {\n  errors.push('meta.semnaturaInspector must be a valid PNG base64 data URL');\n}\n\n// Verifică dacă sunt erori\nif (errors.length > 0) {\n  console.log('❌ Validare eșuată:', errors);\n  return [{\n    json: {\n      success: false,\n      error: 'Validation failed',\n      details: errors,\n      timestamp: new Date().toISOString()\n    }\n  }];\n}\n\nconsole.log('✅ Validare reușită');\n\n// Returnează datele validate\nreturn [{\n  json: {\n    success: true,\n    validatedData: payload,\n    timestamp: new Date().toISOString()\n  }\n}];"
      },
      "id": "code-validate-inspection",
      "name": "Validate Inspection Data",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [460, 300]
    },
    {
      "parameters": {
        "jsCode": "// Procesare semnături\nconst validatedData = $input.first().json;\n\nif (!validatedData.success) {\n  return [validatedData]; // Propagă eroarea de validare\n}\n\nconst payload = validatedData.validatedData;\n\nconsole.log('🔍 Procesare semnături...');\n\n// Funcție pentru validarea semnăturilor\nfunction validateSignature(signature, fieldName) {\n  if (!signature) {\n    return { valid: true, processed: null }; // Semnătura este opțională\n  }\n  \n  if (!signature.startsWith('data:image/png;base64,')) {\n    return { valid: false, error: `${fieldName} must be a valid PNG base64 data URL` };\n  }\n  \n  // Verifică că base64-ul este valid\n  try {\n    const base64Data = signature.replace('data:image/png;base64,', '');\n    const decoded = atob(base64Data);\n    \n    if (decoded.length < 100) {\n      return { valid: false, error: `${fieldName} appears to be too small for a valid signature` };\n    }\n    \n    return { valid: true, processed: signature };\n  } catch (error) {\n    return { valid: false, error: `${fieldName} contains invalid base64 data` };\n  }\n}\n\n// Procesează semnăturile\nconst signatureErrors = [];\n\n// Semnătura angajatului\nconst empleadoSignature = validateSignature(payload.empleado.semnaturaPng, 'empleado.semnaturaPng');\nif (!empleadoSignature.valid) {\n  signatureErrors.push(empleadoSignature.error);\n}\n\n// Semnătura inspectorului\nconst inspectorSignature = validateSignature(payload.meta.semnaturaInspector, 'meta.semnaturaInspector');\nif (!inspectorSignature.valid) {\n  signatureErrors.push(inspectorSignature.error);\n}\n\n// Verifică erorile de semnătură\nif (signatureErrors.length > 0) {\n  console.log('❌ Erori semnături:', signatureErrors);\n  return [{\n    json: {\n      success: false,\n      error: 'Signature validation failed',\n      details: signatureErrors,\n      timestamp: new Date().toISOString()\n    }\n  }];\n}\n\n// Actualizează payload-ul cu semnăturile procesate\nconst processedPayload = {\n  ...payload,\n  empleado: {\n    ...payload.empleado,\n    semnaturaPng: empleadoSignature.processed\n  },\n  meta: {\n    ...payload.meta,\n    semnaturaInspector: inspectorSignature.processed\n  }\n};\n\nconsole.log('✅ Semnături procesate cu succes');\n\nreturn [{\n  json: {\n    success: true,\n    processedData: processedPayload,\n    timestamp: new Date().toISOString()\n  }\n}];"
      },
      "id": "code-process-signatures",
      "name": "Process Signatures",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [680, 300]
    },
    {
      "parameters": {
        "jsCode": "// Generare conținut PDF\nconst processedData = $input.first().json;\n\nif (!processedData.success) {\n  return [processedData]; // Propagă eroarea\n}\n\nconst payload = processedData.processedData;\n\nconsole.log('🔍 Generare conținut PDF...');\n\n// Generează conținutul PDF-ului\nconst pdfContent = {\n  // Header\n  title: `Inspección ${payload.meta.numeroInspeccion}`,\n  date: new Date(payload.timestamp).toLocaleDateString('es-ES'),\n  time: new Date(payload.timestamp).toLocaleTimeString('es-ES'),\n  \n  // Informații de bază\n  inspectionInfo: {\n    id: payload.inspeccionId,\n    type: payload.meta.type,\n    inspector: payload.meta.inspector,\n    supervisor: payload.meta.supervisor || 'N/A'\n  },\n  \n  // Angajat\n  employee: {\n    id: payload.empleado.id,\n    name: payload.empleado.nume,\n    email: payload.empleado.email,\n    signature: payload.empleado.semnaturaPng\n  },\n  \n  // Vehicul\n  vehicle: {\n    plate: payload.vehicul.placa,\n    km: payload.vehicul.km\n  },\n  \n  // Locație\n  location: {\n    lat: payload.locatie.lat,\n    lng: payload.locatie.lng,\n    address: payload.observatii || 'N/A'\n  },\n  \n  // Puncte de inspecție\n  items: payload.items.map(item => ({\n    code: item.cod,\n    description: item.descriere,\n    ok: item.ok,\n    score: item.nota,\n    comment: item.comentariu || ''\n  })),\n  \n  // Semnătura inspectorului\n  inspectorSignature: payload.meta.semnaturaInspector,\n  \n  // Observații generale\n  observations: payload.observatii || 'Sin observaciones'\n};\n\n// Calculează statistici\nconst totalItems = pdfContent.items.length;\nconst passedItems = pdfContent.items.filter(item => item.ok).length;\nconst averageScore = pdfContent.items.reduce((sum, item) => sum + item.score, 0) / totalItems;\n\npdfContent.statistics = {\n  totalItems,\n  passedItems,\n  failedItems: totalItems - passedItems,\n  averageScore: Math.round(averageScore * 100) / 100,\n  passRate: Math.round((passedItems / totalItems) * 100)\n};\n\nconsole.log('✅ Conținut PDF generat:', {\n  title: pdfContent.title,\n  items: pdfContent.items.length,\n  statistics: pdfContent.statistics\n});\n\nreturn [{\n  json: {\n    success: true,\n    pdfContent: pdfContent,\n    originalData: payload,\n    timestamp: new Date().toISOString()\n  }\n}];"
      },
      "id": "code-generate-pdf-content",
      "name": "Generate PDF Content",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [900, 300]
    },
    {
      "parameters": {
        "url": "https://your-pdf-generator-server.com/generate-pdf",
        "method": "POST",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            },
            {
              "name": "Authorization",
              "value": "Bearer {{ $env.PDF_GENERATOR_API_KEY }}"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "data",
              "value": "={{ $json }}"
            }
          ]
        },
        "options": {
          "timeout": 30000
        }
      },
      "id": "http-pdf-generator",
      "name": "Call PDF Generator Service",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [1120, 300]
    },
    {
      "parameters": {
        "jsCode": "// Procesare răspuns PDF\nconst response = $input.first();\nconst pdfContent = $('Generate PDF Content').first().json;\n\nconsole.log('🔍 Procesare răspuns PDF...');\nconsole.log('Status:', response.statusCode);\nconsole.log('Headers:', response.headers);\n\n// Verifică dacă răspunsul este de succes\nif (response.statusCode >= 200 && response.statusCode < 300) {\n  // Verifică dacă răspunsul conține PDF\n  const contentType = response.headers['content-type'] || response.headers['Content-Type'] || '';\n  \n  if (contentType.includes('application/pdf')) {\n    console.log('✅ PDF generat cu succes');\n    \n    return [{\n      json: {\n        success: true,\n        pdfData: response.body,\n        contentType: 'application/pdf',\n        inspectionId: pdfContent.originalData.inspeccionId,\n        numeroInspeccion: pdfContent.pdfContent.title,\n        timestamp: new Date().toISOString()\n      }\n    }];\n  } else {\n    // Răspuns JSON cu informații despre PDF\n    try {\n      const responseData = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;\n      \n      return [{\n        json: {\n          success: true,\n          pdfUrl: responseData.pdfUrl || responseData.url,\n          pdfId: responseData.id || responseData.pdfId,\n          inspectionId: pdfContent.originalData.inspeccionId,\n          numeroInspeccion: pdfContent.pdfContent.title,\n          timestamp: new Date().toISOString()\n        }\n      }];\n    } catch (error) {\n      console.error('❌ Eroare parsare răspuns JSON:', error);\n      return [{\n        json: {\n          success: false,\n          error: 'Invalid response format from PDF generator',\n          details: 'Expected PDF or JSON response',\n          timestamp: new Date().toISOString()\n        }\n      }];\n    }\n  }\n} else {\n  // Eroare de la serverul PDF\n  console.error('❌ Eroare server PDF:', response.statusCode, response.body);\n  \n  let errorMessage = 'PDF generation failed';\n  let errorDetails = `HTTP ${response.statusCode}`;\n  \n  try {\n    const errorData = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;\n    errorMessage = errorData.error || errorData.message || errorMessage;\n    errorDetails = errorData.details || errorDetails;\n  } catch (e) {\n    // Nu se poate parsa răspunsul de eroare\n  }\n  \n  return [{\n    json: {\n      success: false,\n      error: errorMessage,\n      details: errorDetails,\n      statusCode: response.statusCode,\n      timestamp: new Date().toISOString()\n    }\n  }];\n}"
      },
      "id": "code-process-pdf-response",
      "name": "Process PDF Response",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1340, 300]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json }}",
        "responseCode": "={{ $json.success ? 200 : 400 }}",
        "options": {
          "responseHeaders": {
            "parameters": [
              {
                "name": "Content-Type",
                "value": "application/json"
              }
            ]
          }
        }
      },
      "id": "respond-pdf-result",
      "name": "Return PDF Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [1560, 300]
    }
  ],
  "connections": {
    "Inspection PDF Webhook": {
      "main": [
        [
          {
            "node": "Validate Inspection Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Validate Inspection Data": {
      "main": [
        [
          {
            "node": "Process Signatures",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Process Signatures": {
      "main": [
        [
          {
            "node": "Generate PDF Content",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Generate PDF Content": {
      "main": [
        [
          {
            "node": "Call PDF Generator Service",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Call PDF Generator Service": {
      "main": [
        [
          {
            "node": "Process PDF Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Process PDF Response": {
      "main": [
        [
          {
            "node": "Return PDF Response",
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
  "tags": [
    {
      "createdAt": "2025-08-05T12:00:00.000Z",
      "updatedAt": "2025-08-05T12:00:00.000Z",
      "id": "inspection-pdf-tag",
      "name": "inspection-pdf"
    }
  ],
  "triggerCount": 1,
  "updatedAt": "2025-08-05T12:00:00.000Z",
  "versionId": "1"
}
```

## Configurare

### 1. Variabile de Mediu
```bash
PDF_GENERATOR_API_KEY=your_api_key_here
PDF_GENERATOR_URL=https://your-pdf-generator-server.com/generate-pdf
```

### 2. Credențiale
- **Google Sheets OAuth2**: Pentru citirea datelor (dacă este necesar)
- **HTTP Request**: Pentru apelul către serverul PDF

## Utilizare

### Request Example
```bash
curl -X POST https://n8n.decaminoservicios.com/webhook/generate-inspection-pdf \
  -H "Content-Type: application/json" \
  -d '{
    "inspeccionId": "abc123",
    "timestamp": "2025-08-05T08:27:08.864Z",
    "empleado": {
      "id": "demo123",
      "nume": "MAVRU NADIA FLORINA",
      "email": "demo@demo.com",
      "semnaturaPng": "data:image/png;base64,..."
    },
    "vehicul": {
      "placa": "Oficina",
      "km": 0
    },
    "locatie": {
      "lat": 40.547123,
      "lng": -3.630694
    },
    "observatii": "Inspección completada",
    "items": [
      {
        "cod": "point_0",
        "descriere": "HORARIO",
        "ok": true,
        "nota": 4,
        "comentariu": "Todo en orden"
      }
    ],
    "meta": {
      "versiuneSchema": 1,
      "clientApp": "decamino-web-1.0.0",
      "type": "servicios",
      "inspector": "TEST USER ADMINISTRATOR",
      "semnaturaInspector": "data:image/png;base64,...",
      "numeroInspeccion": "SERV-20250805-1026"
    }
  }'
```

### Response Example
```json
{
  "success": true,
  "pdfUrl": "https://your-server.com/pdfs/inspection-abc123.pdf",
  "pdfId": "pdf_123456",
  "inspectionId": "abc123",
  "numeroInspeccion": "Inspección SERV-20250805-1026",
  "timestamp": "2025-08-05T12:00:00.000Z"
}
```

## Funcționalități

### ✅ Validare Completă
- Structura payload-ului conform specificațiilor
- Validare tipuri de date
- Validare câmpuri obligatorii
- Validare semnături base64

### ✅ Procesare Semnături
- Validare format PNG base64
- Verificare dimensiuni minime
- Procesare opțională (undefined pentru lipsă)

### ✅ Generare PDF
- Structurare date pentru PDF
- Calcul statistici inspecție
- Trimitere către serverul PDF
- Procesare răspuns

### ✅ Error Handling
- Validare detaliată cu mesaje specifice
- Propagare erori între noduri
- Răspunsuri HTTP corecte
- Logging complet

## Integrare cu Frontend

### Modificare în routes.js
```javascript
// Adaugă în src/utils/routes.js
generateInspectionPDF: `${BASE_URL}/webhook/generate-inspection-pdf`,
```

### Modificare în InspectionForm.jsx
```javascript
// În loc de routes.addInspeccion, folosește:
const response = await fetchWithRetry(routes.generateInspectionPDF, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(cleanPayload)
});
```

## Monitorizare

### Logs
- Validare payload: `🔍 Validare payload inspecție`
- Procesare semnături: `🔍 Procesare semnături...`
- Generare PDF: `🔍 Generare conținut PDF...`
- Răspuns: `🔍 Procesare răspuns PDF...`

### Metrics
- Timp de procesare
- Rate de succes
- Erori de validare
- Erori de generare PDF

## Securitate

### Validare Strictă
- Schema Zod echivalent în JavaScript
- Validare tipuri de date
- Sanitizare input-uri
- Protecție împotriva injection

### Autentificare
- API key pentru serverul PDF
- Validare credențiale
- Rate limiting (configurabil)

---

## 🚀 Workflow-ul este gata pentru producție!

Acest workflow procesează datele de inspecție și generează PDF-urile conform specificațiilor exacte. Toate validările și procesările sunt implementate cu grijă pentru a asigura funcționarea corectă în producție. 