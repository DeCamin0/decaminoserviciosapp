# AprobacionesPage.jsx - Audit API Calls

## 📋 Rezumat

Pagina `AprobacionesPage.jsx` conține următoarele apeluri API:

---

## ✅ BACKEND (NestJS)

### 1. **`getPermissions(userGrupo)`** - Hook `useAdminApi`
   - **Endpoint:** `/api/permissions?grupo={grupo}`
   - **Metodă:** GET
   - **Locație:** `frontend/src/hooks/useAdminApi.js`
   - **Descriere:** Obține permisiunile utilizatorului pentru a verifica accesul la pagina de aprobări
   - **Folosit în:** `useEffect` pentru verificarea permisiunilor (linia 86-106)

### 2. **`API_ENDPOINTS.APPROVE_CAMBIO`** - Aprobare cambio
   - **Endpoint:** `/api/empleados/approve-cambio`
   - **Metodă:** POST
   - **Locație:** `frontend/src/utils/routes.js` (linia 307-309)
   - **Descriere:** Aprobă o modificare de date a unui angajat
   - **Folosit în:** `confirmApproveCambio()` (linia 368)
   - **Body:** 
     ```json
     {
       "id": "string",
       "codigo": "string",
       "email": "string",
       "nombre": "string",
       "campo": "string",
       "valor": "string",
       "enviarAGestoria": "true" (optional),
       "emailBody": "string" (optional),
       "emailSubject": "string" (optional),
       "updatedBy": "string" (optional)
     }
     ```

### 3. **`API_ENDPOINTS.REJECT_CAMBIO`** - Respingere cambio
   - **Endpoint:** `/api/empleados/reject-cambio`
   - **Metodă:** POST
   - **Locație:** `frontend/src/utils/routes.js` (linia 311-313)
   - **Descriere:** Respinge o modificare de date a unui angajat
   - **Folosit în:** `confirmRejectCambio()` (linia 487)
   - **Body:**
     ```json
     {
       "id": "string",
       "codigo": "string",
       "email": "string",
       "nombre": "string",
       "campo": "string",
       "valor": "string",
       "valoare_noua": "string",
       "motiv": "string",
       "status": "rechazada",
       "data_creare": "string",
       "data_aprobare": "string"
     }
     ```

### 4. **`activityLogger.logAprobacionCambioApproved()`** - Logging
   - **Endpoint:** Backend (prin `activityLogger`)
   - **Metodă:** POST
   - **Descriere:** Loghează aprobarea unui cambio
   - **Folosit în:** `confirmApproveCambio()` (linia 387)

### 5. **`activityLogger.logAprobacionCambioRejected()`** - Logging
   - **Endpoint:** Backend (prin `activityLogger`)
   - **Metodă:** POST
   - **Descriere:** Loghează respingerea unui cambio
   - **Folosit în:** `confirmRejectCambio()` (linia 506-510)

---

## ✅ BACKEND (NestJS) - Continuare

### 6. **`API_ENDPOINTS.GET_CAMBIOS_PENDIENTES`** - Lista cambios pendientes
   - **Endpoint:** `/api/empleados/cambios-pendientes`
   - **Metodă:** GET
   - **Locație:** `frontend/src/utils/routes.js` (linia 305-308)
   - **Descriere:** Obține lista de modificări de date în așteptare de aprobare
   - **Folosit în:** `fetchPendingCambios()` (linia 192)
   - **Status:** ✅ **MIGRAT LA BACKEND**

---

## 📊 Rezumat

| Endpoint | Metodă | Backend/N8N | Status |
|----------|--------|-------------|--------|
| `getPermissions` | GET | ✅ BACKEND | Migrat |
| `APPROVE_CAMBIO` | POST | ✅ BACKEND | Migrat |
| `REJECT_CAMBIO` | POST | ✅ BACKEND | Migrat |
| `logAprobacionCambioApproved` | POST | ✅ BACKEND | Migrat |
| `logAprobacionCambioRejected` | POST | ✅ BACKEND | Migrat |
| `GET_CAMBIOS_PENDIENTES` | GET | ✅ BACKEND | **Migrat** ✅ |

---

## ✅ Status Final

**Toate endpoint-urile din `AprobacionesPage.jsx` sunt migrate la backend NestJS!**

- ✅ `getPermissions` - Backend
- ✅ `APPROVE_CAMBIO` - Backend
- ✅ `REJECT_CAMBIO` - Backend
- ✅ `GET_CAMBIOS_PENDIENTES` - **Migrat acum la backend**
- ✅ `logAprobacionCambioApproved` - Backend
- ✅ `logAprobacionCambioRejected` - Backend

---

## 📝 Note

- Toate endpoint-urile sunt migrate la backend NestJS
- Hook-ul `useAdminApi` pentru permisiuni folosește backend-ul
- Endpoint-ul `GET_CAMBIOS_PENDIENTES` a fost migrat la `/api/empleados/cambios-pendientes`

