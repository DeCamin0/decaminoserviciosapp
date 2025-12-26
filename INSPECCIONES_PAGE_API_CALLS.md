# InspeccionesPage.jsx - Audit Apeluri API

## 📋 Rezumat
**Fișier:** `frontend/src/pages/InspeccionesPage.jsx`  
**Data audit:** 2025-12-26

---

## ✅ Apeluri API Identificate

### 1. **`routes.getEmpleados`** - ✅ **BACKEND**
   - **Locație:** Linia 46
   - **Endpoint:** 
     - Dev: `http://localhost:3000/api/empleados`
     - Prod: `https://api.decaminoservicios.com/api/empleados`
   - **Metodă:** GET
   - **Scop:** Încărcare statistici centre (totalCentros, totalEmpleados, centrosActivos)
   - **Headers:** 
     - `X-App-Source: DeCamino-Web-App`
     - `X-App-Version: <version>`
     - `X-Client-Type: web-browser`
     - `User-Agent: DeCamino-Web-Client/1.0`
   - **⚠️ Observație:** Nu include token JWT în headers (dar endpoint-ul `/api/empleados` GET nu necesită autentificare conform controller-ului)

---

### 2. **`API_ENDPOINTS.GET_INSPECCIONES`** (alias `routes.getInspecciones`) - ✅ **BACKEND**
   - **Locație:** Linia 508 (în componenta `RecentInspections`)
   - **Endpoint:** 
     - Dev: `http://localhost:3000/api/inspecciones`
     - Prod: `https://api.decaminoservicios.com/api/inspecciones`
   - **Metodă:** GET
   - **Scop:** Încărcare lista inspecții recente (ultimele 5)
   - **Headers:** 
     - `Content-Type: application/json`
     - `Accept: application/json`
     - `Authorization: Bearer <token>` ✅ (adăugat recent)
   - **Polling:** Da, la fiecare 30 secunde (+ jitter max 6s) cu `usePolling` hook
   - **Status:** ✅ Migrat la backend (nu mai folosește n8n)

---

## 📊 Statistici

- **Total apeluri:** 2
- **Backend (NestJS):** 2 ✅
- **n8n:** 0 ✅
- **Cu autentificare JWT:** 1 (GET_INSPECCIONES)
- **Fără autentificare:** 1 (getEmpleados - endpoint-ul nu necesită)

---

## ✅ Concluzie

**Toate apelurile din `InspeccionesPage.jsx` sunt migrate la backend NestJS.**  
Nu există apeluri către n8n în acest fișier.

---

## 📝 Note

1. **`routes.getEmpleados`** - Endpoint-ul `/api/empleados` GET nu necesită autentificare (vezi `backend/src/controllers/empleados.controller.ts` linia 38-40), deci lipsa token-ului JWT este normală.

2. **`API_ENDPOINTS.GET_INSPECCIONES`** - Endpoint-ul `/api/inspecciones` necesită autentificare (vezi `backend/src/controllers/inspecciones.controller.ts` linia 18 - `@UseGuards(JwtAuthGuard)`), deci token-ul JWT a fost adăugat recent pentru a rezolva eroarea 401.

3. **Polling:** Componenta `RecentInspections` folosește polling automat cu `usePolling` hook pentru a actualiza lista de inspecții la fiecare 30 de secunde.

