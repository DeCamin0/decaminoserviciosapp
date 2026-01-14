# 🔍 AUDIT COMPLET - Toate Apelurile API pe Toate Paginile

**Data:** 26 Decembrie 2025  
**Scop:** Identificare completă a tuturor apelurilor API (backend NestJS vs n8n) pentru continuarea migrării

---

## 📊 REZUMAT GENERAL

### Statistici:
- **Total Pagini Verificate:** 30+
- **Total Endpoint-uri Backend:** ~80+
- **Total Endpoint-uri n8n:** ~9+ (eliminate 22 endpoint-uri dead code + 2 pagini mutate în old/ + AutoFirma dead code din config + hardcodate eliminate)
- **Procent Migrat:** ~75%

---

## ✅ PAGINI COMPLET MIGRATE (0 apeluri n8n)

### 1. **ClientesPage.jsx** ✅
- `routes.getClientes` → ✅ Backend (`/api/clientes`)
- `routes.getProveedores` → ✅ Backend (`/api/clientes/proveedores`)
- `routes.crudCliente` → ✅ Backend (`/api/clientes`)
- `routes.crudProveedor` → ✅ Backend (`/api/clientes/proveedores`)

### 2. **ClienteDetallePage.jsx** ✅
- `routes.getClientes` → ✅ Backend (`/api/clientes`)

### 3. **ProveedorDetallePage.jsx** ✅
- `routes.getProveedores` → ✅ Backend (`/api/clientes/proveedores`)

### 4. **Fichaje.jsx** ✅ **COMPLET MIGRAT - 0 apeluri n8n**
- `routes.getBajasMedicas` → ✅ Backend (`/api/bajas-medicas`)
- `routes.getAusencias` → ✅ Backend (`/api/ausencias`)
- `routes.getRegistros` → ✅ Backend (`/api/registros`)
- `routes.getTargetOreGrupo` → ✅ Backend (`/api/horas-asignadas`)
- `routes.getEmpleados` → ✅ Backend (`/api/empleados`)
- `routes.getCuadrantes` → ✅ Backend (`/api/cuadrantes`)
- `routes.addAusencia` → ✅ Backend (`/api/ausencias`)
- `routes.deleteFichaje` → ✅ Backend (`/api/registros`)
- `API_ENDPOINTS.FICHAJE_ADD` → ✅ Backend (`/api/registros`)
- `API_ENDPOINTS.FICHAJE_UPDATE` → ✅ Backend (`/api/registros`)
- `API_ENDPOINTS.REGISTROS_EMPLEADOS` → ✅ Backend (`/api/registros/empleados`)
- `API_ENDPOINTS.REGISTROS_PERIODO` → ✅ Backend (`/api/registros/periodo`)

### 5. **SolicitudesPage.jsx** ✅
- `routes.getSolicitudesByEmail` → ✅ Backend (`/api/solicitudes`)
- `routes.uploadBajasMedicas` → ✅ Backend (`/api/bajas-medicas`)
- `routes.getBajasMedicas` → ✅ Backend (`/api/bajas-medicas`)
- `routes.updateBajasMedicas` → ✅ Backend (`/api/bajas-medicas`)
- `routes.getAusencias` → ✅ Backend (`/api/ausencias`)

### 6. **EmpleadosPage.jsx** ✅
- `routes.getAvatarBulk` → ✅ Backend (`/api/avatar/bulk`)
- `routes.getAvatar` → ✅ Backend (`/api/avatar`)
- `routes.getClientes` → ✅ Backend (`/api/clientes`)
- `routes.getContractTypes` → ✅ Backend (`/api/contract-types`)
- `routes.getGrupos` → ✅ Backend (`/api/grupos`)
- `routes.getEmpleados` → ✅ Backend (`/api/empleados`)
- `routes.getOnlineUsers` → ✅ Backend (`/api/online-users`)
- `routes.updateUser` → ✅ Backend (`/api/empleados`)
- `routes.sendNotificacion` → ✅ Backend (`/api/empleados/send-email`)

### 7. **CuadrantesPage.jsx** ✅
- `routes.getClientes` → ✅ Backend (`/api/clientes`)
- `routes.getEmpleados` → ✅ Backend (`/api/empleados`)
- `routes.getCuadrantes` → ✅ Backend (`/api/cuadrantes`)
- `routes.saveCuadrante` → ✅ Backend (`/api/cuadrantes/save`)
- `routes.updateCuadrantes` → ✅ Backend (`/api/cuadrantes/update`)
- `routes.getFestivos` → ✅ Backend (`/api/festivos`)
- `routes.createFestivo` → ✅ Backend (`/api/festivos`)
- `routes.editFestivo` → ✅ Backend (`/api/festivos`)
- `routes.deleteFestivo` → ✅ Backend (`/api/festivos`)

### 8. **InspeccionesPage.jsx** ✅
- `routes.getEmpleados` → ✅ Backend (`/api/empleados`)
- `API_ENDPOINTS.GET_INSPECCIONES` → ✅ Backend (`/api/inspecciones`)

### 9. **MisInspeccionesPage.jsx** ✅
- `routes.getMisInspecciones` → ✅ Backend (`/api/inspecciones`)

---

## ⚠️ PAGINI CU APELURI N8N (Necesită Migrare)

### 10. **AprobacionesPage.jsx** ✅ **COMPLET MIGRAT - 0 apeluri n8n**
**Backend:**
- ✅ `API_ENDPOINTS.GET_CAMBIOS_PENDIENTES` → `/api/empleados/cambios-pendientes`
- ✅ `API_ENDPOINTS.APPROVE_CAMBIO` → `/api/empleados/approve-cambio`
- ✅ `API_ENDPOINTS.REJECT_CAMBIO` → `/api/empleados/reject-cambio`

### 11. **DocumentosPage.jsx** ✅ **COMPLET MIGRAT - 0 apeluri n8n**
**Backend:**
- ✅ `routes.getNominas` → `/api/nominas`
- ✅ `routes.getDocumentosOficiales` → `/api/documentos-oficiales`
- ✅ `routes.getDocumentos` → `/api/documentos`
- ✅ `routes.downloadNomina` → `/api/nominas/download`
- ✅ `routes.downloadDocumentoOficial` → `/api/documentos-oficiales/download`
- ✅ `routes.downloadDocumento` → `/api/documentos/download`
- ✅ `routes.uploadDocumento` → `/api/documentos/upload`
- ✅ `routes.uploadDocumentoOficial` → `/api/documentos-oficiales/upload`
- ✅ `routes.deleteDocumento` → `/api/documentos/delete`
- ✅ `routes.deleteDocumentoOficial` → `/api/documentos-oficiales/delete`
- ✅ `routes.autofirmaWebhook` → `/api/documentos-oficiales/save-signed`

**Notă:** AutoFirma folosește direct `AutoScript.sign()` în `DocumentosPage.jsx` (fără n8n, fără signingApi.ts). `signingApi.ts` a fost mutat în `archive/frontend-old/autofirma-signing/` ca dead code.

### 12. **IncidenciasPage.jsx** ❌ **MUTATĂ ÎN OLD/**
**Status:** Pagina a fost mutată în `archive/frontend-old/` și nu mai este folosită
**Dead Code:** Endpoint-urile au fost eliminate din `routes.js` și `constants.js`
**NOTĂ:** `IncidenciasCentroPage.jsx` folosește hardcodat endpoint-ul n8n (nu folosește routes.js)

### 13. **ControlCorreoPage.jsx** ❌ **MUTATĂ ÎN OLD/**
**Status:** Pagina a fost mutată în `archive/frontend-old/` și nu mai este folosită
**Dead Code:** Endpoint-urile au fost eliminate din `routes.js` și `constants.js`

### 13b. **PaqueteriaCentroPage.jsx** ❌ **MUTATĂ ÎN OLD/**
**Status:** Pagina a fost mutată în `archive/frontend-old/` și nu mai este folosită
**Dead Code:** Ruta și import-urile au fost eliminate din `App.jsx` și `LazyPages.jsx`

### 13c. **TareasCentroPage.jsx** ❌ **MUTATĂ ÎN OLD/**
**Status:** Pagina a fost mutată în `archive/frontend-old/` și nu mai este folosită
**Dead Code:** Ruta și import-urile au fost eliminate din `App.jsx` și `LazyPages.jsx`
**Dead Code:** `routes.getTareasCentro` a fost eliminat din `routes.js`

### 14. **TareasPage.jsx** ⚠️
**N8N:**
- ⚠️ `routes.getTareasCentro` → `/api/n8n/webhook-test/f2035fa7-7fb7-4a28-bcc9-d24b7cc5294b`

### 15. **AdminDashboard.tsx** ⚠️
**N8N:**
- ⚠️ `routes.getAdminStats` → `/api/n8n/webhook/get-admin-stats-ZEhX2TL`
- ⚠️ `routes.getActivityLog` → `/api/n8n/webhook/get-activity-log-iM1jIgoWNn2a`
- ⚠️ `routes.getActivityLogDB` → `/api/n8n/webhook/get-logs-db`
- ⚠️ `routes.getAllLogs` → `/api/n8n/webhook/get-all-logs`
- ⚠️ `routes.getPermissions` → `/api/n8n/webhook/get-permissions-Rws95`
- ⚠️ `routes.getPermissionsAdmin` → `/webhook/be960529-6a0b-4a6d-b0b9-2c0eed38576e`
- ⚠️ `routes.savePermissions` → `/webhook/save-permissions-2c0ee`

### 16. **EstadisticasPage.jsx** ⚠️ **PARȚIAL MIGRAT**
**Backend:**
- ✅ `routes.getFichajes` → `/api/registros/all` (MIGRAT)
**N8N:**
- ⚠️ Hardcodate în `ChartsSection.jsx`:
  - `/webhook/2e9a332d-5e08-4993-889a-fac54d282c6e`
  - `/webhook/b8a9d8ae-2485-4ba1-bd9b-108535b1a76b`
  - `/webhook/be5911e1-28ad-4ab4-8ecd-a1fa65b6a0fb`

### 17. **EstadisticasEmpleadosPage.jsx** ✅ **COMPLET MIGRAT**
**Backend:**
- ✅ `routes.getFichajes` → `/api/registros/all` (MIGRAT)

### 18. **EstadisticasFichajesPage.jsx** ✅ **COMPLET MIGRAT**
**Backend:**
- ✅ `routes.getFichajes` → `/api/registros/all` (MIGRAT)

---

## 🔧 COMPONENTE CU APELURI N8N

### 19. **Componente cu n8n:**

#### **InspectionList.jsx** ✅ **COMPLET MIGRAT**
- ✅ `routes.getEmpleados` → Backend
- ✅ `routes.getClientes` → Backend
- ✅ `API_ENDPOINTS.GET_INSPECCIONES` → Backend
- ✅ `API_ENDPOINTS.DOWNLOAD_INSPECTION_DOCUMENT` → Backend

#### **InspectionForm.jsx** ✅
- ✅ `routes.getEmpleados` → Backend
- ✅ `routes.getClientes` → Backend
- ✅ `routes.addInspeccion` → Backend

#### **HorasPermitidas.tsx** ✅
- ✅ `routes.getHorasPermitidas` → Backend (`/api/horas-permitidas`)

#### **HorasTrabajadas.tsx** ⚠️
- ✅ `routes.getHorasTrabajadas` → Backend (`/api/horas-trabajadas`)
- ⚠️ Hardcodate:
  - `/webhook/4d72fc30-1843-4473-9614-e06f8583f3b5`
  - `/webhook/b8a9d8ae-2485-4ba1-bd9b-108535b1a76b`

#### **ChatBot.jsx** ⚠️
- ⚠️ `routes.chatAI` → `/webhook/chat-ai-6Ts3sq`

#### **ContractSigner.jsx** ✅
- ✅ `routes.guardarDocumentoSemnat` → Backend (`/api/documentos-oficiales/save-signed`)

#### **ClienteDetails.jsx** ⚠️
- ⚠️ Hardcodate:
  - `https://n8n.decaminoservicios.com/webhook/get-centros-trabajo`
  - `https://n8n.decaminoservicios.com/webhook/get-angajati`

#### **SendNotificationModal.jsx** ⚠️
- ⚠️ `/api/n8n/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142` (fallback)
- ✅ `/api/notifications/send` (backend - folosit când e disponibil)

---

## 📋 LISTA COMPLETĂ ENDPOINT-URI N8N (De Migrat)

**NOTĂ:** Endpoint-urile marcate cu ❌ sunt "dead code" - definite în routes.js/constants.js dar NU sunt folosite nicăieri în cod. Au fost eliminate din audit după verificare completă.

### **Fichajes (Statistici):**
6. ✅ `routes.getFichajes` → `/api/registros/all` **MIGRAT**
   - **Folosit în:** EstadisticasPage.jsx, EstadisticasEmpleadosPage.jsx, EstadisticasFichajesPage.jsx
   - **NU este folosit în Fichaje.jsx** (Fichaje.jsx folosește `routes.getRegistros` care e migrat)
   - **Backend:** `GET /api/registros/all` (protejat cu JWT, returnează toate fichajes-urile)

### **Inspecciones:**
✅ **COMPLET MIGRAT** - toate endpoint-urile sunt migrate la backend

### **Incidencias:**
❌ **DEAD CODE ELIMINAT** - `IncidenciasPage.jsx` mutată în `archive/frontend-old/`
- ❌ `routes.getIncidencias` → eliminat din routes.js
- ❌ `routes.addIncidencia` → eliminat din routes.js
- ❌ `routes.updateIncidencia` → eliminat din routes.js
- ❌ `routes.rejectIncidencia` → eliminat din routes.js
**NOTĂ:** `IncidenciasCentroPage.jsx` folosește hardcodat endpoint-ul n8n (nu folosește routes.js)

### **Paqueteria (Control Correo):**
❌ **DEAD CODE ELIMINAT** - `ControlCorreoPage.jsx` și `PaqueteriaCentroPage.jsx` mutate în `archive/frontend-old/`
- ❌ `routes.getPaquetes` → eliminat din routes.js
- ❌ `routes.addPaquete` → eliminat din routes.js
- ❌ `routes.updatePaquete` → eliminat din routes.js
- ❌ `PaqueteriaCentroPage.jsx` → mutată în `archive/frontend-old/`, ruta și import-urile eliminate

### **Tareas:**
❌ **DEAD CODE ELIMINAT** - `TareasCentroPage.jsx` mutată în `archive/frontend-old/`
- ❌ `routes.getTareasCentro` → eliminat din routes.js

### **Notificaciones:**
❌ **DEAD CODE ELIMINAT** - `routes.getNotificaciones` nu e folosit
- ❌ `routes.getNotificaciones` → eliminat din routes.js
- ✅ Notificările folosesc direct endpoint-urile backend `/api/notifications` (GET, POST, PUT, DELETE)

### **Admin:**
17. ⚠️ `routes.getAdminStats` → `/api/n8n/webhook/get-admin-stats-ZEhX2TL`
18. ⚠️ `routes.getActivityLog` → `/api/n8n/webhook/get-activity-log-iM1jIgoWNn2a`
19. ⚠️ `routes.getActivityLogDB` → `/api/n8n/webhook/get-logs-db`
20. ⚠️ `routes.getAllLogs` → `/api/n8n/webhook/get-all-logs`
21. ⚠️ `routes.getPermissions` → `/api/n8n/webhook/get-permissions-Rws95`
22. ⚠️ `routes.getPermissionsAdmin` → `/webhook/be960529-6a0b-4a6d-b0b9-2c0eed38576e`
23. ⚠️ `routes.savePermissions` → `/webhook/save-permissions-2c0ee`

### **Notificaciones:**
24. ⚠️ `routes.getNotificaciones` → `/api/n8n/webhook/notificaciones`

### **AutoFirma:**
❌ **DEAD CODE ELIMINAT** - `signingApi.ts` mutat în `archive/frontend-old/autofirma-signing/`
- ❌ `routes.autofirmaPrepare` → nu există în routes.js (dead code în audit)
- ❌ `N8N_CONFIG.AUTOFIRMA.*` → eliminat din `config/n8n-endpoints.ts` (dead code)
- ❌ Funcțiile helper AutoFirma → eliminate din `config/n8n-endpoints.ts` (dead code)
- ❌ `signingApi.ts` → mutat în `archive/frontend-old/autofirma-signing/` (nu mai este folosit)
- ❌ `useAutofirmaSigning.ts` → mutat în `archive/frontend-old/autofirma-signing/` (nu mai este folosit)
- ❌ `SignWithAutoFirmaButton.tsx` → mutat în `archive/frontend-old/autofirma-signing/` (nu mai este folosit)
- ❌ `AUTOFIRMA_CONFIG.ENDPOINTS.PREPARE` → comentat în `config/autofirma.ts` (dead code - `/webhook/0f16c1e5-b9c6-4bcd-9e1d-2a7c8c62a29f`)
- ❌ `AUTOFIRMA_CONFIG.ENDPOINTS.STATUS` → comentat în `config/autofirma.ts` (dead code)
- ❌ `AUTOFIRMA_CONFIG.ENDPOINTS.DOWNLOAD` → comentat în `config/autofirma.ts` (dead code)
- ✅ `DocumentosPage.jsx` folosește direct `AutoScript.sign()` (fără n8n, fără signingApi.ts)
   - **Acțiune:** ✅ ELIMINAT din proiect (mutat în archive/frontend-old/)

### **Chat AI:**
26. ⚠️ `routes.chatAI` → `/webhook/chat-ai-6Ts3sq`

### **Contractos:**
27. ⚠️ `routes.renovarContracto` → `/api/n8n/webhook/renovar-contracto` (NU MAI FOLOSIT - funcționalități eliminate)

### **Hardcodate (Direct în cod - NECESITĂ MIGRARE):**
28. ⚠️ `/webhook/2e9a332d-5e08-4993-889a-fac54d282c6e` (ChartsSection.jsx - RENDIMIENTO_ENDPOINT)
30. ⚠️ `/webhook/be5911e1-28ad-4ab4-8ecd-a1fa65b6a0fb` (ChartsSection.jsx - AUSENCIAS_ENDPOINT)

### **Hardcodate (DEAD CODE ELIMINAT):**
❌ `/webhook/b8a9d8ae-2485-4ba1-bd9b-108535b1a76b` → nu găsit în cod (probabil eliminat)
❌ `/webhook/4d72fc30-1843-4473-9614-e06f8583f3b5` → nu găsit în cod (probabil eliminat, HorasTrabajadas.tsx folosește routes.getMonthlyAlerts)
❌ `https://n8n.decaminoservicios.com/webhook/get-centros-trabajo` → MIGRAT (ClienteDetails.jsx folosește routes.getClientes)
❌ `https://n8n.decaminoservicios.com/webhook/get-angajati` → MIGRAT (ClienteDetails.jsx folosește routes.getEmpleados)
❌ `/api/n8n/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142` → ELIMINAT din routes.js (routes.getUsuarios nu mai este folosit, folosește routes.getEmpleados)
❌ `/webhook/6cb6b98c-9127-494c-8201-f097d14b9c13` → ELIMINAT din routes.js (downloadContract nu este folosit)

---

## 🎯 PRIORITĂȚI DE MIGRARE

### **Prioritate Înaltă (Folosite frecvent):**
✅ **ControlCorreoPage** - mutată în archive/frontend-old/, endpoint-urile eliminate

### **Prioritate Medie:**
5. **TareasPage** - `getTareasCentro`

### **Prioritate Scăzută:**
8. **AdminDashboard** - stats, logs, permissions (folosite rar)
9. **ChatBot** - `chatAI` (feature secundar)
10. **EstadisticasPage** - hardcodate în ChartsSection (folosite rar)

---

## 📝 NOTĂ IMPORTANTĂ

**Endpoint-uri eliminate (nu mai trebuie migrate):**
- ❌ `routes.renovarContracto` - funcționalitățile de contracte au fost eliminate complet
- ❌ `routes.saveCliente` - deja migrat la `routes.crudCliente`

---

## 🔄 URMĂTORII PAȘI

1. **Migrare EstadisticasPage** - `getFichajes` endpoint (folosit în 3 pagini de statistici) ✅ MIGRAT
5. **Migrare Inspecciones** - Update și Delete
6. **Migrare TareasPage** - Get tareas por centro
7. **Migrare AdminDashboard** - Stats, logs, permissions
9. **Migrare ChatBot** - Chat AI
10. **Migrare EstadisticasPage** - Charts endpoints

---

## ✅ CONCLUZIE

**Status actual:** ~75% migrat la backend NestJS  
**Rămân de migrat:** ~25 endpoint-uri n8n  
**Pagini complet migrate:** 10+ pagini  
**Pagini parțial migrate:** 5+ pagini

**Progres excelent!** Continuăm cu migrarea endpoint-urilor rămase în ordinea priorităților.

