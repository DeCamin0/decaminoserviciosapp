# 🔍 AUDIT COMPLET - AdminDashboard.tsx - Toate Apelurile API

## 📋 Pagina Principală: AdminDashboard.tsx
**Status:** ✅ Nu are apeluri API directe
- Folosește doar componente care fac apeluri

---

## 🧩 Componente Folosite în AdminDashboard

### 1. **UserStats.jsx**
**Apeluri API:**
- ✅ `useAdminApi.getAdminStats()` → folosește `getActivityLog()` (vezi mai jos)
- ✅ `useAdminApi.getAllUsers()` → **✅ BACKEND** (`routes.getEmpleados`) - **MIGRAT**

**Detalii:**
- `getAdminStats()` generează statistici din `getActivityLog()` (nu face apel direct)
- `getAllUsers()` face apel la n8n pentru lista de utilizatori

---

### 2. **ActivityLog.jsx**
**Apeluri API:**
- ✅ `useAdminApi.getActivityLog()` → **✅ BACKEND** (`/api/activity-logs`) - **MIGRAT**

**Detalii:**
- Endpoint: `/api/activity-logs` (backend NestJS)
- Folosit pentru a obține logurile de activitate

---

### 3. **AccessMatrix.jsx**
**Apeluri API:**
- ✅ `routes.getEmpleados` → **✅ BACKEND** (`/api/empleados`)
- ✅ `routes.permissions` → **✅ BACKEND** (`/api/permissions`)
- ✅ `routes.getPermissionsAdmin` → **✅ BACKEND** (`/api/permissions`) - **MIGRAT**
- ✅ `routes.savePermissions` → **✅ BACKEND** (`/api/permissions` POST) - **MIGRAT**

**Detalii:**
- `getEmpleados` - backend NestJS ✅
- `permissions` - backend NestJS ✅
- `getPermissionsAdmin` - backend NestJS ✅ (folosește `/api/permissions`)
- `savePermissions` - backend NestJS ✅ (folosește `/api/permissions` POST)

---

### 4. **PushSubscribersList.tsx**
**Apeluri API:**
- ✅ `/api/push/subscribers` → **✅ BACKEND** (NestJS)

**Detalii:**
- Endpoint backend: `http://localhost:3000/api/push/subscribers` (dev)
- Endpoint backend: `https://api.decaminoservicios.com/api/push/subscribers` (prod)

---

### 5. **EmpleadosStatusList.tsx**
**Apeluri API:**
- ✅ `/api/empleados/stats` → **✅ BACKEND** (NestJS)

**Detalii:**
- Endpoint backend: `http://localhost:3000/api/empleados/stats` (dev)
- Endpoint backend: `https://api.decaminoservicios.com/api/empleados/stats` (prod)

---

## 📊 Hook: useAdminApi.js

### Apeluri API identificate:

1. **`getAdminStats()`**
   - ✅ **NU face apel direct** - folosește `getActivityLog()` care e migrat ✅
   - Generează statistici din logurile de activitate (frontend processing)

2. **`getPermissions()`**
   - ✅ `routes.permissions` → **✅ BACKEND** (`/api/permissions`)

3. **`getAllPermissions()`**
   - ✅ `routes.permissions` → **✅ BACKEND** (`/api/permissions`) - **MIGRAT**

4. **`savePermissions()`**
   - ✅ `routes.permissions` (POST) → **✅ BACKEND** (`/api/permissions`) - **MIGRAT**

5. **`getAllUsers()`**
   - ✅ `routes.getEmpleados` → **✅ BACKEND** (`/api/empleados`) - **MIGRAT**

6. **`getActivityLog()`**
   - ✅ `/api/activity-logs` → **✅ BACKEND** - **MIGRAT**

### ⚠️ DEAD CODE (definite în routes.js dar NU sunt folosite):
- ❌ `routes.getAdminStats` → `/api/n8n/webhook/get-admin-stats-ZEhX2TL` - **NU E FOLOSIT**
- ❌ `routes.getActivityLogDB` → `/api/n8n/webhook/get-logs-db` - **NU E FOLOSIT**
- ❌ `routes.getAllLogs` → `/api/n8n/webhook/get-all-logs` - **NU E FOLOSIT**
- ❌ `routes.getPermissions` (n8n) → `/api/n8n/webhook/get-permissions-Rws95` - **NU E FOLOSIT** (se folosește `routes.permissions` backend)

---

## 📝 REZUMAT

### ✅ BACKEND (NestJS) - TOATE MIGRATE! 🎉
1. `routes.getEmpleados` → `/api/empleados`
2. `routes.permissions` → `/api/permissions` (GET)
3. `/api/push/subscribers` → Push subscribers
4. `/api/empleados/stats` → Employee statistics
5. `getAllUsers()` → `/api/empleados` ✅ **MIGRAT**
6. `getActivityLog()` → `/api/activity-logs` ✅ **MIGRAT**
7. `getAllPermissions()` → `/api/permissions` (GET) ✅ **MIGRAT**
8. `savePermissions()` → `/api/permissions` (POST) ✅ **MIGRAT**
9. `getAdminStats()` → folosește `getActivityLog()` (backend) ✅ **INDIRECT MIGRAT**
10. `getPermissions()` → `/api/permissions` ✅ **MIGRAT**

### ⚠️ N8N - NICIUN APEL RĂMAS! ✅

### 🗑️ DEAD CODE ELIMINAT ✅
- ❌ `routes.getAdminStats` → `/api/n8n/webhook/get-admin-stats-ZEhX2TL` - **ELIMINAT din routes.js**
- ❌ `routes.getActivityLogDB` → `/api/n8n/webhook/get-logs-db` - **ELIMINAT din routes.js**
- ❌ `routes.getAllLogs` → `/api/n8n/webhook/get-all-logs` - **ELIMINAT din routes.js**
- ❌ `routes.getPermissions` (n8n) → `/api/n8n/webhook/get-permissions-Rws95` - **ELIMINAT din routes.js**

**Notă:** Aceste rute au fost eliminate din `routes.js` deoarece nu erau folosite nicăieri în aplicație.

---

## 🎯 Total Apeluri:
- **Backend:** 10 apeluri ✅
- **N8N:** 0 apeluri ✅ **COMPLET MIGRAT!**
- **Dead Code:** 4 rute n8n nefolosite (pot fi eliminate din routes.js)

