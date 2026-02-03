# 🔐 Plan de Acțiune Complet - Sistem Permisiuni

**Data creării:** 2025-01-28  
**Status:** 📋 Planificare → 🔄 În Progres (Audit Completat)  
**Prioritate:** 🔴 Critical  
**Ultima actualizare:** 2026-02-02 (Audit Completat)

---

## 📋 Obiectiv Principal

Refacerea completă a sistemului de permisiuni pentru a depinde **100% de tabelul `Permissions` din backend**, eliminând toate fallback-urile hardcoded (`isManager`, `isAdmin`, etc.) și centralizând logica într-un singur loc.

---

## 🎯 Faza 0: Inventar și Pregătire

### 0.1. Module Existente în AccessMatrix (16 module)

| ID Modul | Nume | Rute Aferente | Status |
|----------|------|---------------|--------|
| `dashboard` | Panel Principal | `/inicio` | ✅ OK |
| `datos` | Datos Personales | `/datos` | ✅ OK |
| `empleados` | Empleados | `/empleados` | ✅ OK |
| `fichar` | Registro de Jornada | `/fichaje` | ✅ OK |
| `solicitudes` | Solicitudes | `/solicitudes` | ✅ OK |
| `documentos` | Documentos | `/documentos` | ✅ OK |
| `documentos-empleados` | Documentos Empleados | `/documentos-empleados`, `/prl-documentos` | ✅ OK |
| `cuadrantes` | Cuadrantes | `/cuadrantes` | ✅ OK |
| `cuadrantes-empleado` | Mi Horario | `/cuadrantes-empleado` | ✅ OK |
| `mis-inspecciones` | Mis Inspecciones | `/mis-inspecciones` | ✅ OK |
| `inspecciones` | Inspecciones | `/inspecciones` | ✅ OK |
| `aprobaciones` | Aprobaciones | `/aprobaciones` | ✅ OK |
| `estadisticas` | Estadísticas | `/estadisticas`, `/estadisticas-cuadrantes`, `/estadisticas-empleados`, `/estadisticas-fichajes` | ✅ OK |
| `clientes` | Clientes | `/clientes`, `/clientes/:nif` | ✅ OK |
| `pedidos` | Pedidos | `/pedidos`, `/empleado-pedidos` | ✅ OK |
| `admin` | Admin Panel | `/admin`, `/mensajes-enviados` | ✅ OK |

### 0.2. Module Lipsă - Trebuie Adăugate (4 module)

| ID Modul | Nume | Rute Aferente | Tip Acces | Observații |
|----------|------|---------------|-----------|-----------|
| `cuadernos` | Cuadernos | `/cuadernos`, `/cuadernos-centro` | Public cu permisiuni | Există în `ProtectedRoute.jsx` dar nu în AccessMatrix |
| `proveedores` | Proveedores | `/proveedores/:nif` | Manager/Admin | Legat de `clientes`, dar poate necesita permisiuni separate |
| `comunicados` | Comunicados | `/comunicados`, `/comunicados/:id`, `/comunicados/nuevo`, `/comunicados/:id/editar` | Public (citire) + Admin (gestionare) | `canManageComunicados()` - Developer, Admin, Supervisor, Manager, RRHH |
| `hall-of-fame` | Hall of Fame | `/hall-of-fame` | Public (citire) + Admin (calcul) | `canCalculate` - Manager, Admin, Developer, Supervisor |

### 0.3. Inventar Pagini și Verificări Actuale (Din Audit - 2026-02-02)

**📊 Statistici Generale:**
- **Total pagini analizate:** 31
- **Pagini cu backend complet:** 0
- **Pagini cu backend parțial:** 4 (DashboardPage, PedidosPage, AdminDashboard, AprobacionesPage)
- **Pagini cu sistem vechi:** 9
- **Pagini fără verificări:** 18
- **Total verificări:** 511
- **Media verificări/pagină:** 16.48

**🔍 Verificări Cele Mai Comune:**
- `isManager`: 177 verificări în 14 pagini
- `userPermissions`: 70 verificări în 4 pagini
- `canAccess`: 58 verificări în 3 pagini
- `hasPermission`: 34 verificări în 4 pagini
- `canManage`: 33 verificări în 5 pagini
- `canCalculate`: 29 verificări în 1 pagină (HallOfFamePage)

#### **🔴 Prioritate 1 - Pagini Critice (16 pagini)**

| Pagină | Complexitate | Verificări | Module Necesare | Status Backend | Probleme |
|--------|--------------|------------|-----------------|----------------|----------|
| `DashboardPage.jsx` | 147 | `isManager: 21`, `hasPermission: 26`, `userPermissions: 32` | `dashboard`, `pedidos`, `empleados`, `cuadrantes`, etc. | ⚠️ Parțial | Mixed system, High complexity |
| `SolicitudesPage.jsx` | 69 | `isManager: 69` | `solicitudes` | ❌ Nu | 69 isManager checks! |
| `PedidosPage.tsx` | 58 | `isManager: 4`, `hasPermission: 2`, `canAccess: 26` | `pedidos` | ⚠️ Parțial | Mixed system |
| `AdminDashboard.tsx` | 39 | `isManager: 4`, `hasPermission: 3`, `userPermissions: 12` | `admin` | ⚠️ Parțial | Mixed system |
| `AprobacionesPage.jsx` | 38 | `isManager: 6`, `hasPermission: 3`, `canAccess: 6` | `aprobaciones` | ⚠️ Parțial | Mixed system |
| `HallOfFamePage.jsx` | 36 | `isManager: 7`, `canCalculate: 29` | `hall-of-fame` | ❌ Nu | High complexity |
| `Fichaje.jsx` | 27 | `isManager: 27` | `fichar` | ❌ Nu | 27 isManager checks |
| `CuadrantesPage.jsx` | 15 | `isManager: 15` | `cuadrantes` | ❌ Nu | 15 isManager checks |
| `EstadisticasPage.jsx` | 14 | `isManager: 8`, `isAdmin: 3`, `isDeveloper: 3` | `estadisticas` | ❌ Nu | - |
| `EstadisticasCuadrantesPage.jsx` | 10 | `isManager: 2`, `isAdmin: 3`, `isSupervisor: 2` | `estadisticas` | ❌ Nu | - |
| `EstadisticasEmpleadosPage.jsx` | 10 | `isManager: 2`, `isAdmin: 3`, `isSupervisor: 2` | `estadisticas` | ❌ Nu | - |
| `EstadisticasFichajesPage.jsx` | 10 | `isManager: 2`, `isAdmin: 3`, `isSupervisor: 2` | `estadisticas` | ❌ Nu | - |
| `EmpleadosPage.jsx` | 9 | `canManage: 9` | `empleados` | ❌ Nu | - |
| `DocumentosEmpleadosPage.jsx` | 7 | `isManager: 7` | `documentos-empleados` | ❌ Nu | - |
| `InspeccionesPage.jsx` | 5 | `isManager: 3`, `isSupervisor: 2` | `inspecciones` | ❌ Nu | - |
| `ClientesPage.jsx` | 0 | - | `clientes`, `proveedores` | ❌ Nu | Fără verificări (necesită adăugare) |

#### **🟡 Prioritate 2 - Pagini Importante (1 pagină)**

| Pagină | Complexitate | Verificări | Module Necesare | Status Backend | Probleme |
|--------|--------------|------------|-----------------|----------------|----------|
| `MensajesEnviadosPage.jsx` | 8 | `canManage: 8` | `admin` | ❌ Nu | - |

#### **🟢 Prioritate 3 - Pagini Simple/Publice (14 pagini)**

| Pagină | Complexitate | Verificări | Module Necesare | Status Backend | Observații |
|--------|--------------|------------|-----------------|----------------|------------|
| `ComunicadosPage.jsx` | 5 | `canManage: 5` | `comunicados` | ❌ Nu | Public cu gestionare |
| `ComunicadoDetailPage.jsx` | 4 | `canManage: 4` | `comunicados` | ❌ Nu | Public cu gestionare |
| `ComunicadoCreatePage.jsx` | 0 | - | `comunicados` | ❌ Nu | Fără verificări |
| `CuadernosPage.jsx` | 0 | - | `cuadernos` | ❌ Nu | Fără verificări |
| `CuadernosPorCentroPage.jsx` | 0 | - | `cuadernos` | ❌ Nu | Fără verificări |
| `CuadrantesEmpleadoPage.jsx` | 0 | - | `cuadrantes-empleado` | ❌ Nu | Fără verificări |
| `DatosPage.jsx` | 0 | - | `datos` | ❌ Nu | Fără verificări |
| `DocumentosPage.jsx` | 0 | - | `documentos` | ❌ Nu | Fără verificări |
| `EmpleadoPedidosPage.tsx` | 0 | - | `pedidos` | ❌ Nu | Fără verificări |
| `MisInspeccionesPage.jsx` | 0 | - | `mis-inspecciones` | ❌ Nu | Fără verificări |
| `ClienteDetallePage.jsx` | 0 | - | `clientes` | ❌ Nu | Fără verificări |
| `ProveedorDetallePage.jsx` | 0 | - | `proveedores` | ❌ Nu | Fără verificări |
| `PRLDocumentosPage.jsx` | 0 | - | `documentos-empleados` | ❌ Nu | Fără verificări |
| `LoginPage.jsx` | 0 | - | - | ❌ Nu | Pagină publică |

---

## 📝 Plan de Acțiune - Etape

### **ETAPA 1: Actualizare AccessMatrix** ⏱️ 1-2 ore

#### 1.1. Adaugă Modulele Lipsă în AccessMatrix

**Fișier:** `frontend/src/components/admin/AccessMatrix.jsx`

**Modificări necesare:**

```typescript
// Adaugă în array-ul modules (după linia 53):
{ id: 'cuadernos', name: 'Cuadernos', icon: '📔', description: 'Cuadernos y documentación por centro' },
{ id: 'proveedores', name: 'Proveedores', icon: '🏢', description: 'Gestión de proveedores' },
{ id: 'comunicados', name: 'Comunicados', icon: '📢', description: 'Anuncios y comunicaciones (gestionar)' },
{ id: 'hall-of-fame', name: 'Hall of Fame', icon: '🏆', description: 'Clasament y premios (calcular)' },
```

**Checklist:**
- [x] Adaugă `cuadernos` în array-ul `modules` ✅
- [x] Adaugă `proveedores` în array-ul `modules` ✅
- [x] Adaugă `comunicados` în array-ul `modules` ✅
- [x] Adaugă `hall-of-fame` în array-ul `modules` ✅
- [x] Actualizează `setDemoPermissions()` pentru noile module ✅
- [x] Actualizează `normalizePermissions()` pentru a inițializa toate modulele ✅
- [x] Testează că AccessMatrix se încarcă corect ✅
- [x] Testează că salvează corect noile permisiuni ✅

**Status:** ✅ **ETAPA 1 COMPLETĂ** (2026-02-02)  
**Timp estimat:** ✅ Completat

---

### **ETAPA 2: Inventar Complet Pagini** ⏱️ 2-3 ore

#### 2.1. Creează Script de Audit

**Fișier nou:** `frontend/scripts/audit-permissions.js`

**Funcționalitate:**
- Scanează toate paginile din `frontend/src/pages/`
- Identifică verificări de permisiuni (`isManager`, `isAdmin`, `hasPermission`, etc.)
- Generează raport JSON cu:
  - Lista paginilor
  - Verificările găsite
  - Modulele necesare
  - Status backend (da/nu/parțial)

**Checklist:**
- [x] Creează script-ul de audit ✅
- [x] Rulează script-ul și generează raport ✅
- [x] Analizează raportul și identifică discrepanțe ✅
- [x] Documentează rezultatele în acest plan ✅

**Raport generat:** `frontend/docs/permissions/audit-report.json`  
**Data audit:** 2026-02-02  
**Rezultate:** Vezi secțiunea 0.3 de mai sus

**Timp estimat:** ✅ Completat

#### 2.2. Verificare Manuală Pagină cu Pagină

**Proces pentru fiecare pagină:**

1. **Deschide pagina în editor**
2. **Caută verificări de permisiuni:**
   - `isManager`
   - `isAdmin`
   - `isDeveloper`
   - `hasPermission()`
   - `canAccess()`
   - `canManage()`
   - `canCalculate()`
   - Alte verificări custom

3. **Documentează în tabel:**
   - Ce verifică acum
   - Ce modul ar trebui să verifice
   - Dacă folosește deja backend
   - Dacă are fallback-uri

4. **Prioritizează:**
   - 🔴 Critical - pagini critice de business
   - 🟡 Important - pagini importante
   - 🟢 Low - pagini simple/publice

**Checklist pentru fiecare pagină:**
- [ ] Identifică toate verificările de permisiuni
- [ ] Identifică modulul corect din AccessMatrix
- [ ] Verifică dacă folosește deja backend
- [ ] Documentează fallback-urile existente
- [ ] Estimează complexitatea migrării (1-5)

**Timp estimat:** 4-6 ore (pentru toate paginile)

---

### **ETAPA 3: Setup Infrastructură** ⏱️ 1-2 zile

#### 3.1. Creează Hook Centralizat `usePermissions()`

**Fișier:** `frontend/src/hooks/usePermissions.ts`

**Status:** ✅ Deja există parțial în planul vechi

**Verificări:**
- [x] Verifică dacă hook-ul există deja ✅
- [x] Creează hook-ul `usePermissions.ts` ✅
- [ ] Testează că încarcă corect permisiunile din backend
- [ ] Testează că logging-ul comparativ funcționează

**Status:** ✅ **Hook creat** (2026-02-02)  
**Timp estimat:** ✅ Completat (cod creat)

#### 3.2. Modifică ProtectedRoute cu Logging Comparativ

**Fișier:** `frontend/src/components/ProtectedRoute.jsx`

**Status:** ⚠️ Există dar nu blochează accesul

**Modificări necesare:**
- [ ] Adaugă mapare `ROUTE_TO_MODULE` completă (inclusiv noile module)
- [ ] Adaugă logging comparativ (sistem nou vs vechi)
- [ ] Activează redirect dacă nu are acces (cu feature flag)
- [ ] Testează că logging-ul apare în console

**Timp estimat:** 3-4 ore

#### 3.3. Creează Pagină de Testare

**Fișier:** `frontend/src/pages/PermissionTestPage.jsx`

**Status:** ✅ Deja există în planul vechi

**Verificări:**
- [ ] Verifică dacă pagina există deja
- [ ] Dacă nu există, creează-o conform planului vechi
- [ ] Adaugă ruta în `App.jsx`
- [ ] Testează că detectează corect discrepanțele

**Timp estimat:** 2-3 ore

---

### **ETAPA 4: Migrare Graduală - Pagină cu Pagină** ⏱️ 2-3 săptămâni

#### 4.1. Proces Standard pentru Fiecare Pagină

**Pentru fiecare pagină (în ordinea priorității):**

1. **Pregătire:**
   - [ ] Deschide pagina în editor
   - [ ] Identifică toate verificările de permisiuni
   - [ ] Identifică modulul corect din AccessMatrix

2. **Adaugă Hook:**
   - [ ] Import `usePermissions()` hook
   - [ ] Adaugă `const { hasPermission, loading } = usePermissions()`
   - [ ] Adaugă verificare pentru modulul corect

3. **Păstrează Fallback:**
   - [ ] Păstrează logica veche ca fallback
   - [ ] Adaugă feature flag `USE_NEW_PERMISSIONS`
   - [ ] Adaugă logging comparativ

4. **Testare:**
   - [ ] Testează cu Admin - ar trebui să aibă acces
   - [ ] Testează cu Supervisor - ar trebui să aibă acces
   - [ ] Testează cu Manager - ar trebui să aibă acces
   - [ ] Testează cu Empleado - ar trebui să fie blocat (dacă e cazul)
   - [ ] Verifică console-ul pentru discrepanțe

5. **Monitorizare:**
   - [ ] Activează feature flag doar pentru această pagină
   - [ ] Monitorizează 2-3 zile
   - [ ] Verifică că nu apar erori în producție

6. **Finalizare:**
   - [ ] Dacă totul e OK, elimină fallback-urile
   - [ ] Elimină feature flag-ul
   - [ ] Simplifică codul

**Timp estimat per pagină:** 2-4 ore + 2-3 zile monitorizare

#### 4.2. Ordinea Migrării

**Săptămâna 1 - Pagini Simple (Testare - Fără Verificări):**
1. `CuadernosPage.jsx` - 0 verificări, simplă
2. `CuadernosPorCentroPage.jsx` - 0 verificări, simplă
3. `CuadrantesEmpleadoPage.jsx` - 0 verificări, simplă
4. `DatosPage.jsx` - 0 verificări, simplă
5. `DocumentosPage.jsx` - 0 verificări, simplă
6. `MisInspeccionesPage.jsx` - 0 verificări, simplă
7. `EmpleadoPedidosPage.tsx` - 0 verificări, simplă

**Săptămâna 2 - Pagini Publice cu Gestionare:**
8. `ComunicadosPage.jsx` - 5 verificări (`canManage`)
9. `ComunicadoDetailPage.jsx` - 4 verificări (`canManage`)
10. `ComunicadoCreatePage.jsx` - 0 verificări (adaugă)
11. `HallOfFamePage.jsx` - 36 verificări (`canCalculate`) - complexă!

**Săptămâna 3 - Pagini Importante:**
12. `MensajesEnviadosPage.jsx` - 8 verificări (`canManage`)
13. `EmpleadosPage.jsx` - 9 verificări (`canManage`)
14. `DocumentosEmpleadosPage.jsx` - 7 verificări (`isManager`)
15. `EstadisticasPage.jsx` - 14 verificări (`isManager`, `isAdmin`)
16. `EstadisticasCuadrantesPage.jsx` - 10 verificări
17. `EstadisticasEmpleadosPage.jsx` - 10 verificări
18. `EstadisticasFichajesPage.jsx` - 10 verificări
19. `InspeccionesPage.jsx` - 5 verificări (`isManager`, `isSupervisor`)
20. `ClientesPage.jsx` - 0 verificări (adaugă!)

**Săptămâna 4 - Pagini Critice:**
21. `Fichaje.jsx` - 27 verificări (`isManager`) - URGENT!
22. `CuadrantesPage.jsx` - 15 verificări (`isManager`) - URGENT!
23. `AprobacionesPage.jsx` - 38 verificări (parțial migrată) - Finalizează!
24. `PedidosPage.tsx` - 58 verificări (parțial migrată) - Finalizează!
25. `AdminDashboard.tsx` - 39 verificări (parțial migrată) - Finalizează!

**Săptămâna 5 - Pagini Foarte Complexe:**
26. `SolicitudesPage.jsx` - 69 verificări (`isManager`) - FOARTE URGENT! ⚠️
27. `DashboardPage.jsx` - 147 verificări (parțial migrată) - FOARTE COMPLEXĂ! ⚠️

---

### **ETAPA 5: Finalizare și Cleanup** ⏱️ 1 săptămână

#### 5.1. Elimină Codul Vechi

**După 1 săptămână de monitorizare fără probleme:**

1. **Elimină funcțiile helper pentru sistemul vechi:**
   - [ ] `calculateOldPermission()` din `usePermissions()`
   - [ ] `calculateOldAccess()` din `ProtectedRoute`

2. **Simplifică `usePermissions()`:**
   - [ ] Elimină `USE_NEW_PERMISSIONS` flag
   - [ ] Elimină `calculateOldPermission()`
   - [ ] Folosește doar sistemul nou

3. **Simplifică `ProtectedRoute`:**
   - [ ] Elimină `USE_NEW_PROTECTION` flag
   - [ ] Elimină `calculateOldAccess()`
   - [ ] Folosește doar sistemul nou

4. **Simplifică paginile:**
   - [ ] Elimină toate verificările `isManager`, `isAdmin`, etc.
   - [ ] Folosește doar `hasPermission(module)`
   - [ ] Elimină fallback-urile

**Checklist:**
- [ ] Elimină codul vechi din toate paginile
- [ ] Testează că totul funcționează
- [ ] Verifică că nu există erori în console
- [ ] Testează cu toate grupurile de utilizatori

**Timp estimat:** 1 săptămână

---

## 📊 Metrici de Succes

- ✅ Zero discrepanțe între sistemul nou și cel vechi
- ✅ Toate paginile funcționează corect
- ✅ Zero utilizatori blocați incorect
- ✅ Performanță similară sau mai bună
- ✅ Cod mai simplu și mai ușor de întreținut

---

## 🚨 Rollback Plan

Dacă apar probleme critice:

1. **Dezactivează feature flag-urile:**
   ```bash
   VITE_USE_NEW_PERMISSIONS=false
   VITE_USE_NEW_PROTECTION=false
   ```

2. **Sistemul revine automat la logica veche**

3. **Analizează problemele și corectează**

4. **Reactivează după corecții**

---

## 📝 Note Importante

1. **Nu elimina codul vechi până nu ești 100% sigur că sistemul nou funcționează**
2. **Testează cu toate grupurile de utilizatori**
3. **Monitorizează console-ul pentru discrepanțe**
4. **Corectează permisiunile în backend dacă e necesar**
5. **Documentează orice probleme găsite**

---

## 🔗 Referințe

- **Backend Permissions Controller:** `backend/src/controllers/permissions.controller.ts`
- **Backend Permissions Schema:** `backend/prisma/schema.prisma`
- **Frontend Admin API:** `frontend/src/hooks/useAdminApi.js`
- **Frontend Protected Route:** `frontend/src/components/ProtectedRoute.jsx`
- **Frontend Access Matrix:** `frontend/src/components/admin/AccessMatrix.jsx`
- **Plan de Migrare Original:** `frontend/docs/permissions/PERMISSIONS_MIGRATION_PLAN.md`

---

---

## 📊 Rezultate Audit (2026-02-02)

### Top 5 Pagini Cele Mai Complexe:
1. **DashboardPage.jsx** - 147 verificări (parțial migrată)
2. **SolicitudesPage.jsx** - 69 verificări (sistem vechi)
3. **PedidosPage.tsx** - 58 verificări (parțial migrată)
4. **AdminDashboard.tsx** - 39 verificări (parțial migrată)
5. **AprobacionesPage.jsx** - 38 verificări (parțial migrată)

### Probleme Identificate:
- ⚠️ **SolicitudesPage.jsx**: 69 verificări `isManager` - necesită migrare urgentă
- ⚠️ **DashboardPage.jsx**: Sistem mixt (backend + vechi) - 147 verificări totale
- ⚠️ **Fichaje.jsx**: 27 verificări `isManager` - necesită migrare
- ⚠️ **CuadrantesPage.jsx**: 15 verificări `isManager` - necesită migrare
- ✅ **4 pagini** deja parțial migrate (DashboardPage, PedidosPage, AdminDashboard, AprobacionesPage)

### Module Cel Mai Des Folosite:
- `empleados`: 18 pagini
- `dashboard`: 20 pagini
- `datos`: 16 pagini
- `admin`: 17 pagini
- `fichar`: 10 pagini

**Raport complet:** `frontend/docs/permissions/audit-report.json`

---

**Ultima actualizare:** 2026-02-02 (Audit Completat)  
**Următoarea verificare:** După finalizarea Etapa 1 (Actualizare AccessMatrix)
