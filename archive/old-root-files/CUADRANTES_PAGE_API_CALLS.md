# Apeluri API - CuadrantesPage.jsx

## Legendă
- ✅ **BACKEND** = Endpoint migrat la backend NestJS (`/api/...`)
- ⚠️ **N8N** = Endpoint care încă folosește n8n direct sau prin proxy

---

## 1. Festivos (Zile Festive)

### Apeluri:
1. **`routes.getFestivos`** - ✅ **BACKEND** (`/api/festivos`)
   - **GET**: Listare zile festive
   - **Endpoint**: `${FESTIVOS_ENDPOINT}?accion=get&year={year}`
   - **Locație cod**: `loadFestivos()` funcție (linia ~629)
   - **Status**: ✅ MIGRAT la backend NestJS

2. **`routes.createFestivo`** - ✅ **BACKEND** (`/api/festivos`)
   - **GET**: Creare zi festivă (compatibil cu n8n - folosește GET cu query params)
   - **Locație cod**: `handleFestivoSave()` funcție (linia ~749)
   - **Status**: ✅ MIGRAT la backend NestJS

3. **`routes.editFestivo`** - ✅ **BACKEND** (`/api/festivos`)
   - **GET**: Editare zi festivă (compatibil cu n8n - folosește GET cu query params)
   - **Locație cod**: `handleFestivoSave()` funcție (linia ~749)
   - **Status**: ✅ MIGRAT la backend NestJS

4. **`routes.deleteFestivo`** - ✅ **BACKEND** (`/api/festivos`)
   - **GET**: Ștergere zi festivă
   - **Locație cod**: `confirmFestivoDelete()` funcție (linia ~852)
   - **Status**: ✅ MIGRAT la backend NestJS

---

## 2. Clientes (Clienți)

### Apeluri:
1. **`routes.getClientes`** - ✅ **BACKEND** (`/api/clientes`)
   - **GET**: Listare clienți pentru dropdown centru
   - **Locație cod**: `fetchClientes()` funcție (linia ~582)

---

## 3. Empleados (Angajați)

### Apeluri:
1. **`routes.getEmpleados`** - ✅ **BACKEND** (`/api/empleados`)
   - **GET**: Listare angajați pentru cuadrantes
   - **Locație cod**: `fetchAngajati()` funcție (linia ~922)

---

## 4. Cuadrantes (Programe de lucru)

### Apeluri:
1. **`routes.getCuadrantes`** - ✅ **BACKEND** (`/api/cuadrantes`)
   - **GET**: Listare cuadrantes existente
   - **Locație cod**: `loadCuadrantes()` funcție (linia ~3715)

2. **`routes.getCuadrantes`** - ✅ **BACKEND** (`/api/cuadrantes`)
   - **POST**: Verificare cuadrantes existente pentru angajat specific
   - **Body**: `{ email: emailAngajat }`
   - **Locație cod**: 
     - `verificaLunaExistenta()` funcție (linia ~1167)
     - `verificaLunaExistenta()` funcție (linia ~1548)
   - **Status**: ✅ MIGRAT la backend NestJS

3. **`routes.saveCuadrante`** - ✅ **BACKEND** (`/api/cuadrantes/save`)
   - **POST**: Salvare cuadrante (single)
   - **Body**: `{ CODIGO, EMAIL, NOMBRE, LUNA, CENTRO, ZI_1-ZI_31, ... }`
   - **Locație cod**: 
     - `handleSalveaza()` funcție (linia ~2063)
   - **Status**: ✅ MIGRAT la backend NestJS

4. **`routes.saveCuadrante`** - ✅ **BACKEND** (`/api/cuadrantes/save`)
   - **POST**: Salvare cuadrante pentru tot anul (bulk)
   - **Body**: `{ ...linieData }` (pentru fiecare linie)
   - **Locație cod**: 
     - `handleSalveazaAn()` funcție (linia ~1960)
   - **Status**: ✅ MIGRAT la backend NestJS

5. **`routes.updateCuadrantes`** - ✅ **BACKEND** (`/api/cuadrantes/update`)
   - **POST**: Update cuadrantes (bulk update)
   - **Body**: `{ cuadrantes: [...], centro: string, mesAno: string, action: 'update_cuadrantes', timestamp: string, user: string }`
   - **Locație cod**: `handleSaveChanges()` funcție (linia ~282)
   - **Status**: ✅ MIGRAT la backend NestJS

6. **`routes.getCuadrantes`** - ✅ **BACKEND** (`/api/cuadrantes`)
   - **GET**: Listare cuadrantes cu filtrare (centro, empleado, nombre, mesAno)
   - **Locație cod**: `loadCuadrantes()` funcție (linia ~3915)
   - **Status**: ✅ MIGRAT la backend NestJS (înlocuit endpoint-ul de test n8n)

---

## 5. Horarios (Orar)

### Apeluri:
1. **`listSchedules(callApi)`** - ✅ **BACKEND** (`/api/horarios`)
   - **GET**: Listare toate horarios
   - **Funcție**: `listSchedules()` din `frontend/src/api/schedules.ts`
   - **Locație cod**: 
     - `useEffect` pentru tab "lista_horarios" (linia ~2023)
     - În componenta ScheduleEditor (linia ~2963)
     - În refresh după editare (linia ~4599)

2. **`deleteSchedule(callApi, id, centroNombre)`** - ✅ **BACKEND** (`/api/horarios`)
   - **POST**: Ștergere horario
   - **Body**: `{ action: 'delete', payload: { id, centroNombre } }`
   - **Funcție**: `deleteSchedule()` din `frontend/src/api/schedules.ts`
   - **Locație cod**: În lista horarios pentru butonul de ștergere (linia ~3180)

---

## Rezumat Apeluri

### ✅ BACKEND (14 apeluri):
1. `routes.getClientes` - GET `/api/clientes`
2. `routes.getEmpleados` - GET `/api/empleados`
3. `routes.getCuadrantes` - GET `/api/cuadrantes` (listare cu filtrare)
4. `routes.getCuadrantes` - POST `/api/cuadrantes` (verificare după email)
5. `routes.saveCuadrante` - POST `/api/cuadrantes/save` (salvare single)
6. `routes.saveCuadrante` - POST `/api/cuadrantes/save` (salvare anual bulk)
7. `routes.updateCuadrantes` - POST `/api/cuadrantes/update` (update bulk)
8. `listSchedules()` - GET `/api/horarios`
9. `deleteSchedule()` - POST `/api/horarios` (action: 'delete')
10. `routes.getFestivos` - GET `/api/festivos` (accion: 'get')
11. `routes.createFestivo` - GET `/api/festivos` (accion: 'nueva fiesta')
12. `routes.editFestivo` - GET `/api/festivos` (accion: 'edit')
13. `routes.deleteFestivo` - GET `/api/festivos` (accion: 'delete')

### ⚠️ N8N (0 apeluri):
**🎉 TOATE ENDPOINT-URILE AU FOST MIGRATE LA BACKEND NESTJS! 🎉**

---

## Probleme Identificate

### 1. URL-uri Hardcodate
Există mai multe URL-uri n8n hardcodate direct în cod în loc să folosească `routes.js`:
- `'https://n8n.decaminoservicios.com/webhook/get-cuadrantes-yyBov0qVQZEhX2TL'`
- `'https://n8n.decaminoservicios.com/webhook/guardar-cuadrante-yyBov0qVQZEhX2TL'`
- `'https://n8n.decaminoservicios.com/webhook/update/bce8a5c5-1ca7-4005-9646-22d6016945ab'`

**Recomandare**: Ar trebui să folosească `routes.saveCuadrante` și să se adauge în `routes.js` endpoint-urile pentru get și update cuadrantes.

### 2. Inconsistență Endpoints
- `routes.getCuadrantes` este definit în `routes.js` și folosește BACKEND, dar în cod se folosesc și endpoint-uri n8n hardcodate pentru verificare și salvare.

### 3. Endpoint-uri Duplicate
- Există două apeluri diferite pentru salvare cuadrante:
  - Unul pentru single (linia 1950)
  - Unul pentru bulk anual (linia 1847)
  - Ambele folosesc același endpoint n8n hardcodat

---

## Recomandări pentru Migrare

### Prioritate Înaltă:
1. ✅ **Migrare Festivos** - Toate operațiile CRUD pentru zile festive - COMPLETAT
2. ✅ **Migrare Get Cuadrantes (verificare email)** - Endpoint pentru verificare cuadrantes după email - COMPLETAT
3. ✅ **Migrare Save Cuadrantes** - Endpoint-urile de salvare (single și bulk anual) - COMPLETAT
4. ✅ **Migrare Update Cuadrantes Bulk** - Endpoint pentru update bulk cuadrantes - COMPLETAT

## ✅ MIGRARE COMPLETĂ!

**Toate endpoint-urile principale din CuadrantesPage.jsx au fost migrate la backend NestJS!** 🎉

### Prioritate Medie:
1. **Refactorizare URL-uri hardcodate** - Înlocuirea cu constante din `routes.js`
2. **Unificare endpoint-uri** - Folosirea aceluiași endpoint pentru single și bulk operations

