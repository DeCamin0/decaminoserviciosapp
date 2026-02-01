# 🔐 Plan de Migrare Sistem Permisiuni - Backend Only

**Data creării:** 2025-01-28  
**Status:** 📋 Planificare  
**Prioritate:** 🔴 Critical

---

## 📋 Obiectiv

Refacerea completă a sistemului de permisiuni pentru a depinde **100% de tabelul `Permissions` din backend**, eliminând toate fallback-urile hardcoded (`isManager`, `isAdmin`, etc.) și centralizând logica într-un singur loc.

---

## 🎯 Probleme Actuale

### 1. **Logica Duplicată și Inconsistentă**
- Fiecare pagină verifică permisiunile diferit
- `DashboardPage.jsx`: verifică `isManager`, `isAdmin`, `hasPermission('dashboard')`, `hasPermission('pedidos')`, plus fallback-uri
- `PedidosPage.tsx`: verifică `isManager`, `hasBackendPedidosPermission`, fallback-uri
- `AdminDashboard.tsx`: verifică `isAdmin`, `isDeveloper`, `hasPermission('admin')`
- `MobileBottomNav.jsx`: verifică `isManager`, `hasPermission()`, fallback-uri
- `MobileMoreDrawer.jsx`: verifică `isManager`, `isAdmin`, `hasPermission()`, plus logica pentru `pedidos`

### 2. **Fallback-uri Multiple și Confuze**
```javascript
// Exemplu din MobileMoreDrawer:
const canAccess = 
  hasSpecialAccess || // Manager/Admin/Developer
  hasBackendPedidosPermission || 
  (!backendSystemExists && hasFieldPermission) || // Fallback 1
  (!backendSystemExists && hasGenericPermission); // Fallback 2
```

### 3. **ProtectedRoute Nu Blochează Accesul**
- `ProtectedRoute` verifică permisiunile dar **nu redirectează** dacă nu are acces
- Utilizatorii pot accesa pagini restricționate direct prin URL

### 4. **Inconsistențe în Numele Modulelor**
- `dashboard` vs `inicio`
- `cuadrantes-empleado` vs `cuadrantes-empleado`
- Unele pagini verifică `dashboard`, altele `inicio`

---

## 🏗️ Arhitectură Propusă

```
┌─────────────────────────────────────────┐
│   Backend: Tabela Permissions           │
│   grupo_module | permitted              │
│   Admin_dashboard | true                │
│   Empleado_empleados | false            │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   Frontend: usePermissions() Hook       │
│   - Încarcă permisiunile din backend    │
│   - Cache în memory                    │
│   - Returnează hasPermission(module)   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   ProtectedRoute cu Permission Check    │
│   - Verifică permisiunea pentru ruta    │
│   - Redirect dacă nu are acces          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   Paginile: Doar verifică hasPermission │
│   - Fără fallback-uri                   │
│   - Fără isManager/isAdmin hardcoded    │
└─────────────────────────────────────────┘
```

---

## 📝 Plan de Implementare

### **Etapa 1: Setup (Fără Breaking Changes)** ⏱️ 1-2 zile

#### 1.1. Creează Hook Centralizat `usePermissions()`

**Fișier:** `frontend/src/hooks/usePermissions.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';

interface Permissions {
  [module: string]: boolean;
}

export const usePermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permissions>({});
  const [loading, setLoading] = useState(true);

  // Feature flag pentru a activa/dezactiva sistemul nou
  const USE_NEW_PERMISSIONS = import.meta.env.VITE_USE_NEW_PERMISSIONS === 'true';

  useEffect(() => {
    const grupo = user?.GRUPO || user?.grupo;
    if (!grupo || user?.isDemo) {
      setLoading(false);
      return;
    }

    const loadPermissions = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const url = `/api/permissions?grupo=${encodeURIComponent(grupo)}`;
        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`Failed to fetch permissions: ${response.status}`);
        }

        const data = await response.json();
        
        // Transformă array în obiect: { 'dashboard': true, 'empleados': false }
        const perms: Permissions = {};
        if (data.success && Array.isArray(data.permissions)) {
          data.permissions.forEach((p: any) => {
            const parts = p.grupo_module.split('_');
            if (parts.length >= 2) {
              const module = parts.slice(1).join('_');
              perms[module] = p.permitted === 'true' || p.permitted === true || p.permitted === 1;
            }
          });
        }
        
        setPermissions(perms);
      } catch (error) {
        console.error('Error loading permissions:', error);
        setPermissions({});
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user?.GRUPO, user?.grupo, user?.isDemo]);

  // Funcție helper pentru sistemul vechi (pentru comparație)
  const calculateOldPermission = useCallback((user: any, module: string): boolean => {
    const isManager = user?.isManager || false;
    const isAdmin = user?.GRUPO === 'Admin' || user?.grupo === 'Admin';
    const isDeveloper = user?.GRUPO === 'Developer' || user?.grupo === 'Developer';
    
    // Logica veche (fallback-uri)
    if (isAdmin || isDeveloper) return true;
    if (module === 'admin' && !isAdmin) return false;
    if (module === 'empleados' && !isManager) return false;
    if (module === 'cuadrantes' && !isManager) return false;
    if (module === 'estadisticas' && !isManager) return false;
    if (module === 'clientes' && !isManager) return false;
    if (module === 'aprobaciones' && !isManager) return false;
    if (module === 'inspecciones' && !isManager) return false;
    
    // Default: permite accesul pentru modulele de bază
    return true;
  }, []);

  // Funcție simplă pentru verificare
  const hasPermission = useCallback((module: string): boolean => {
    const newResult = permissions[module] === true;
    
    // 🔍 LOGGING COMPARATIV - compară cu sistemul vechi
    if (import.meta.env.DEV) {
      const oldResult = calculateOldPermission(user, module);
      
      if (newResult !== oldResult) {
        console.warn(`⚠️ PERMISSION DISCREPANCY [${module}]:`, {
          userGrupo: user?.GRUPO,
          module,
          newSystem: newResult,
          oldSystem: oldResult,
          permissions,
        });
        
        // Log în backend pentru analiză (opțional)
        if (import.meta.env.VITE_LOG_PERMISSION_DISCREPANCIES === 'true') {
          fetch('/api/logs/permission-discrepancy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userGrupo: user?.GRUPO,
              module,
              newResult,
              oldResult,
              timestamp: new Date().toISOString(),
            }),
          }).catch(() => {}); // Silent fail
        }
      }
    }
    
    return USE_NEW_PERMISSIONS ? newResult : calculateOldPermission(user, module);
  }, [permissions, user, USE_NEW_PERMISSIONS, calculateOldPermission]);

  return { 
    hasPermission, 
    loading, 
    permissions,
    // Helper pentru debugging
    getAllPermissions: () => permissions,
  };
};
```

**Checklist:**
- [ ] Creează fișierul `usePermissions.ts`
- [ ] Testează că hook-ul încarcă corect permisiunile din backend
- [ ] Verifică că logging-ul comparativ funcționează
- [ ] Testează cu diferite grupuri de utilizatori

#### 1.2. Modifică ProtectedRoute cu Mod de Testare

**Fișier:** `frontend/src/components/ProtectedRoute.jsx`

```typescript
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextBase';
import { useEffect, useRef } from 'react';
import { usePermissions } from '../hooks/usePermissions';

// Mapare rute → module (standardizat)
const ROUTE_TO_MODULE = {
  '/inicio': 'dashboard',
  '/datos': 'datos',
  '/empleados': 'empleados',
  '/fichaje': 'fichar',
  '/solicitudes': 'solicitudes',
  '/documentos': 'documentos',
  '/documentos-empleados': 'documentos-empleados',
  '/prl-documentos': 'documentos-empleados', // Folosește același modul
  '/cuadrantes': 'cuadrantes',
  '/cuadrantes-empleado': 'cuadrantes-empleado',
  '/mis-inspecciones': 'mis-inspecciones',
  '/inspecciones': 'inspecciones',
  '/aprobaciones': 'aprobaciones',
  '/estadisticas': 'estadisticas',
  '/estadisticas-cuadrantes': 'estadisticas',
  '/estadisticas-empleados': 'estadisticas',
  '/estadisticas-fichajes': 'estadisticas',
  '/clientes': 'clientes',
  '/pedidos': 'pedidos',
  '/empleado-pedidos': 'pedidos', // Folosește același modul
  '/comunicados': null, // Public - nu necesită permisiune
  '/admin': 'admin',
  '/mensajes-enviados': 'admin',
  '/hall-of-fame': null, // Public
  '/cuadernos': null, // Public
  '/cuadernos-centro': null, // Public
};

// Funcție helper pentru sistemul vechi
function calculateOldAccess(user: any, pathname: string): boolean {
  const isManager = user?.isManager || false;
  const isAdmin = user?.GRUPO === 'Admin' || user?.grupo === 'Admin';
  const isDeveloper = user?.GRUPO === 'Developer' || user?.grupo === 'Developer';
  
  // Rute publice
  if (pathname.startsWith('/comunicados') || 
      pathname.startsWith('/hall-of-fame') ||
      pathname.startsWith('/cuadernos')) {
    return true;
  }
  
  // Admin routes
  if (pathname.startsWith('/admin') || pathname.startsWith('/mensajes-enviados')) {
    return isAdmin || isDeveloper;
  }
  
  // Manager routes
  if (['/empleados', '/cuadrantes', '/estadisticas', '/clientes', 
       '/aprobaciones', '/inspecciones', '/documentos-empleados'].some(r => pathname.startsWith(r))) {
    return isManager || isAdmin || isDeveloper;
  }
  
  // Default: permite accesul
  return true;
}

const ProtectedRoute = ({ children, requiredPermission }) => {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { hasPermission, loading: permsLoading } = usePermissions();
  const location = useLocation();
  const lastCheckedPath = useRef('');

  // Feature flag
  const USE_NEW_PROTECTION = import.meta.env.VITE_USE_NEW_PROTECTION === 'true';

  // Gestionare navigare pentru browser back button
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      sessionStorage.setItem('lastPath', location.pathname);
      console.log('Protected route accessed:', location.pathname);
    }
  }, [location, isAuthenticated, authLoading]);

  // Determină modulul necesar
  const module = requiredPermission || ROUTE_TO_MODULE[location.pathname];

  if (authLoading || permsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    sessionStorage.setItem('redirectAfterLogin', location.pathname);
    return <Navigate to="/login" replace />;
  }

  // Dacă nu există permisiune specifică, permite accesul (pentru rute publice)
  if (!module) {
    return children;
  }

  // Verificare cu sistemul nou
  const newSystemHasAccess = hasPermission(module);
  
  // Verificare cu sistemul vechi (pentru comparație)
  const oldSystemHasAccess = calculateOldAccess(user, location.pathname);

  // 🔍 LOGGING - compară ambele sisteme
  if (import.meta.env.DEV && location.pathname !== lastCheckedPath.current) {
    lastCheckedPath.current = location.pathname;
    
    if (newSystemHasAccess !== oldSystemHasAccess) {
      console.error(`🚨 ACCESS DISCREPANCY [${location.pathname}]:`, {
        path: location.pathname,
        module,
        newSystem: newSystemHasAccess,
        oldSystem: oldSystemHasAccess,
        userGrupo: user?.GRUPO,
        userIsManager: user?.isManager,
      });
      
      // Log în backend pentru analiză (opțional)
      if (import.meta.env.VITE_LOG_PERMISSION_DISCREPANCIES === 'true') {
        fetch('/api/logs/access-discrepancy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: location.pathname,
            module,
            newSystem: newSystemHasAccess,
            oldSystem: oldSystemHasAccess,
            userGrupo: user?.GRUPO,
            userIsManager: user?.isManager,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {}); // Silent fail
      }
    }
  }

  // Dacă sistemul nou e activat, folosește-l
  // Altfel, folosește sistemul vechi
  const shouldAllowAccess = USE_NEW_PROTECTION 
    ? newSystemHasAccess 
    : oldSystemHasAccess;

  if (!shouldAllowAccess) {
    console.warn(`🚫 Access denied to ${location.pathname} (module: ${module})`);
    return <Navigate to="/inicio" replace />;
  }

  return children;
};

export default ProtectedRoute;
```

**Checklist:**
- [ ] Modifică `ProtectedRoute.jsx` cu logging comparativ
- [ ] Testează că redirect-ul funcționează corect
- [ ] Verifică că logging-ul apare în console

#### 1.3. Creează Pagină de Testare

**Fișier:** `frontend/src/pages/PermissionTestPage.jsx`

```typescript
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { usePermissions } from '../hooks/usePermissions';
import { Card } from '../components/ui';

const PermissionTestPage = () => {
  const { user } = useAuth();
  const { hasPermission, permissions, loading } = usePermissions();
  const [discrepancies, setDiscrepancies] = useState([]);

  // Toate modulele disponibile
  const modules = [
    'dashboard',
    'datos',
    'empleados',
    'fichar',
    'solicitudes',
    'documentos',
    'documentos-empleados',
    'cuadrantes',
    'cuadrantes-empleado',
    'mis-inspecciones',
    'inspecciones',
    'aprobaciones',
    'estadisticas',
    'clientes',
    'pedidos',
    'admin',
  ];

  // Funcție helper pentru sistemul vechi
  const calculateOldPermission = (user: any, module: string): boolean => {
    const isManager = user?.isManager || false;
    const isAdmin = user?.GRUPO === 'Admin' || user?.grupo === 'Admin';
    const isDeveloper = user?.GRUPO === 'Developer' || user?.grupo === 'Developer';
    
    if (isAdmin || isDeveloper) return true;
    if (module === 'admin' && !isAdmin) return false;
    if (module === 'empleados' && !isManager) return false;
    if (module === 'cuadrantes' && !isManager) return false;
    if (module === 'estadisticas' && !isManager) return false;
    if (module === 'clientes' && !isManager) return false;
    if (module === 'aprobaciones' && !isManager) return false;
    if (module === 'inspecciones' && !isManager) return false;
    if (module === 'documentos-empleados' && !isManager) return false;
    
    return true;
  };

  useEffect(() => {
    if (loading || !user) return;

    const disc = [];
    modules.forEach(module => {
      const newResult = hasPermission(module);
      const oldResult = calculateOldPermission(user, module);
      
      if (newResult !== oldResult) {
        disc.push({
          module,
          newSystem: newResult,
          oldSystem: oldResult,
          userGrupo: user?.GRUPO,
          userIsManager: user?.isManager,
        });
      }
    });
    setDiscrepancies(disc);
  }, [user, permissions, loading, hasPermission]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Permission System Test</h1>
      
      <Card>
        <h2 className="text-lg font-semibold mb-4">User Info</h2>
        <pre className="bg-gray-100 p-4 rounded">
          {JSON.stringify({
            GRUPO: user?.GRUPO,
            grupo: user?.grupo,
            isManager: user?.isManager,
          }, null, 2)}
        </pre>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-4">Current Permissions (New System)</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(permissions, null, 2)}
        </pre>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-4">Permission Matrix</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Module</th>
                <th className="border p-2">New System</th>
                <th className="border p-2">Old System</th>
                <th className="border p-2">Match</th>
              </tr>
            </thead>
            <tbody>
              {modules.map(module => {
                const newResult = hasPermission(module);
                const oldResult = calculateOldPermission(user, module);
                const match = newResult === oldResult;
                
                return (
                  <tr key={module} className={match ? '' : 'bg-yellow-50'}>
                    <td className="border p-2 font-mono">{module}</td>
                    <td className="border p-2 text-center">
                      {newResult ? '✅' : '❌'}
                    </td>
                    <td className="border p-2 text-center">
                      {oldResult ? '✅' : '❌'}
                    </td>
                    <td className="border p-2 text-center">
                      {match ? '✅' : '⚠️'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {discrepancies.length > 0 && (
        <Card className="bg-yellow-50 border-yellow-200">
          <h2 className="text-lg font-semibold mb-4 text-yellow-800">
            ⚠️ Discrepancies Found: {discrepancies.length}
          </h2>
          <pre className="bg-yellow-100 p-4 rounded overflow-auto">
            {JSON.stringify(discrepancies, null, 2)}
          </pre>
        </Card>
      )}

      {discrepancies.length === 0 && (
        <Card className="bg-green-50 border-green-200">
          <h2 className="text-lg font-semibold text-green-800">
            ✅ No Discrepancies Found!
          </h2>
          <p className="text-green-700">
            Sistemul nou și cel vechi sunt în acord pentru toate modulele.
          </p>
        </Card>
      )}
    </div>
  );
};

export default PermissionTestPage;
```

**Adaugă ruta în `App.jsx`:**
```typescript
<Route
  path="/permission-test"
  element={
    <ProtectedRoute>
      <ResponsiveLayout>
        <PermissionTestPage />
      </ResponsiveLayout>
    </ProtectedRoute>
  }
/>
```

**Checklist:**
- [ ] Creează `PermissionTestPage.jsx`
- [ ] Adaugă ruta în `App.jsx`
- [ ] Testează cu diferite grupuri de utilizatori
- [ ] Verifică că discrepanțele sunt detectate corect

---

### **Etapa 2: Testare pe o Pagină (Pilot)** ⏱️ 2-3 zile

#### 2.1. Activează Feature Flag pentru `/empleados`

**Fișier:** `.env.local` (sau `.env.development`)
```bash
VITE_USE_NEW_PERMISSIONS=true
VITE_USE_NEW_PROTECTION=true
VITE_LOG_PERMISSION_DISCREPANCIES=true
```

**Modifică `ProtectedRoute.jsx` pentru a activa doar pe `/empleados`:**
```typescript
// Activează sistemul nou doar pentru /empleados
const USE_NEW_PROTECTION = 
  import.meta.env.VITE_USE_NEW_PROTECTION === 'true' && 
  location.pathname.startsWith('/empleados');
```

#### 2.2. Monitorizează Console-ul

- Verifică că nu apar discrepanțe în console
- Dacă apar, analizează și corectează permisiunile în backend

#### 2.3. Testează Manual

- Testează cu Admin: ar trebui să aibă acces
- Testează cu Supervisor: ar trebui să aibă acces
- Testează cu Empleado: ar trebui să fie blocat

**Checklist:**
- [ ] Activează feature flag doar pentru `/empleados`
- [ ] Monitorizează console-ul pentru discrepanțe
- [ ] Testează manual cu diferite grupuri
- [ ] Corectează permisiunile în backend dacă e necesar

---

### **Etapa 3: Rollout Gradual** ⏱️ 1 săptămână

#### 3.1. Activează pentru Pagini Non-Critice

**Săptămâna 1:**
- `/documentos`
- `/solicitudes`
- `/cuadrantes-empleado`
- `/mis-inspecciones`

**Monitorizează 2-3 zile**

#### 3.2. Activează pentru Pagini Critice

**Săptămâna 2:**
- `/empleados`
- `/cuadrantes`
- `/estadisticas`
- `/clientes`
- `/aprobaciones`
- `/inspecciones`

**Monitorizează 2-3 zile**

**Checklist:**
- [ ] Activează pentru pagini non-critice
- [ ] Monitorizează 2-3 zile
- [ ] Activează pentru pagini critice
- [ ] Monitorizează 2-3 zile

---

### **Etapa 4: Full Rollout** ⏱️ 1 săptămână

#### 4.1. Activează pentru Toate Paginile

**Modifică `ProtectedRoute.jsx`:**
```typescript
// Activează sistemul nou pentru toate paginile
const USE_NEW_PROTECTION = import.meta.env.VITE_USE_NEW_PROTECTION === 'true';
```

#### 4.2. Elimină Codul Vechi

După 1 săptămână de monitorizare fără probleme:

1. **Elimină funcțiile helper pentru sistemul vechi:**
   - `calculateOldPermission()`
   - `calculateOldAccess()`

2. **Simplifică `usePermissions()`:**
   - Elimină `USE_NEW_PERMISSIONS` flag
   - Elimină `calculateOldPermission()`
   - Folosește doar sistemul nou

3. **Simplifică `ProtectedRoute`:**
   - Elimină `USE_NEW_PROTECTION` flag
   - Elimină `calculateOldAccess()`
   - Folosește doar sistemul nou

4. **Simplifică paginile:**
   - Elimină toate verificările `isManager`, `isAdmin`, etc.
   - Folosește doar `hasPermission(module)`

**Checklist:**
- [ ] Activează pentru toate paginile
- [ ] Monitorizează 1 săptămână
- [ ] Elimină codul vechi
- [ ] Testează că totul funcționează

---

## 🔍 Verificări în Timp Real

### 1. Logging Automat

**Backend Endpoint (opțional):** `backend/src/controllers/logs.controller.ts`

```typescript
@Post('permission-discrepancy')
async logPermissionDiscrepancy(@Body() data: any) {
  // Salvează în DB sau log file
  console.log('[PERMISSION DISCREPANCY]', data);
  return { success: true };
}

@Post('access-discrepancy')
async logAccessDiscrepancy(@Body() data: any) {
  // Salvează în DB sau log file
  console.log('[ACCESS DISCREPANCY]', data);
  return { success: true };
}
```

### 2. Dashboard de Monitorizare

- Pagină admin care arată:
  - Toate discrepanțele găsite
  - Utilizatori afectați
  - Module cu probleme
  - Statistici de acces

### 3. Alertă pentru Discrepanțe Critice

- Dacă un Admin pierde acces la `/admin` → alertă imediată
- Dacă > 10% utilizatori au discrepanțe → alertă

---

## ✅ Checklist de Testare

### Pentru Fiecare Grup de Utilizatori:

- [ ] **Admin:** verifică acces la toate paginile
- [ ] **Supervisor:** verifică acces la paginile corecte
- [ ] **Manager:** verifică acces la paginile corecte
- [ ] **Empleado:** verifică că nu are acces la pagini restricționate

### Pentru Fiecare Pagină:

- [ ] Verifică că apare în navigation dacă are permisiune
- [ ] Verifică că nu apare dacă nu are permisiune
- [ ] Verifică că `ProtectedRoute` blochează accesul direct
- [ ] Verifică că nu există discrepanțe în console

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

## 📊 Metrici de Succes

- ✅ Zero discrepanțe între sistemul nou și cel vechi
- ✅ Toate paginile funcționează corect
- ✅ Zero utilizatori blocați incorect
- ✅ Performanță similară sau mai bună

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

---

**Ultima actualizare:** 2025-01-28  
**Următoarea verificare:** 2025-02-01 (peste 3-4 zile)
