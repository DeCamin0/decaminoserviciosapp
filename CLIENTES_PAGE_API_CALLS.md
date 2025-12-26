# ClientesPage.jsx - Audit Apeluri API

## 📋 Rezumat
Pagina `ClientesPage.jsx` gestionează clienții și furnizorii. Această pagină conține apeluri API pentru listare, creare, editare, ștergere și alte operații.

---

## 🔍 Apeluri API Identificate

### 1. **`routes.getClientes`** - ✅ **BACKEND**
   - **Endpoint:** `/api/clientes`
   - **Metodă:** `GET`
   - **Locație:** Linia 185
   - **Funcție:** `fetchClientes()`
   - **Descriere:** Obține lista de clienți (fără furnizori)
   - **Status:** ✅ Migrat la backend

### 2. **`routes.getProveedores`** - ✅ **BACKEND**
   - **Endpoint:** `/api/clientes/proveedores`
   - **Metodă:** `GET`
   - **Locație:** Linia 236
   - **Funcție:** `fetchProveedores()`
   - **Descriere:** Obține lista de furnizori
   - **Status:** ✅ Migrat la backend

### 3. **`routes.crudCliente`** - ✅ **BACKEND** (pentru clienți)
   - **Endpoint:** `/api/clientes` (POST cu `action: 'add'|'edit'|'delete'`)
   - **Metodă:** `POST`
   - **Locații:** 
     - Linia 325 (`handleAddItem`) - pentru clienți
     - Linia 429 (`handleEditItem`) - pentru clienți
     - Linia 461 (`handleDeleteItem`) - pentru clienți
   - **Descriere:** CRUD operations pentru clienți (add, edit, delete)
   - **Status:** ✅ Migrat la backend
   - **Structură:**
     - **Body:** `{ action: 'add'|'edit'|'delete', id?: number, ...câmpuri }`
     - **ADD:** Creează client nou în tabelul `Clientes`
     - **EDIT:** Actualizează client existent (WHERE id = ...)
     - **DELETE:** Șterge client (WHERE id = ...)
     - **Câmpuri:** NIF, NOMBRE O RAZON SOCIAL, TIPO, EMAIL, TELEFONO, MOVIL, FAX, DIRECCION, CODIGO POSTAL, POBLACION, PROVINCIA, PAIS, URL, DESCUENTO POR DEFECTO, LATITUD, LONGITUD, NOTAS PRIVADAS, CUENTAS BANCARIAS, Fecha Ultima Renovacion, Fecha Proxima Renovacion, ESTADO, CONTRACTO, CuantoPuedeGastar
     - **Response:** JSON cu `{ success: true, mensaje: string }`

### 3b. **`routes.crudProveedor`** - ✅ **BACKEND** (pentru furnizori)
   - **Endpoint:** `/api/clientes/proveedores` (POST cu `action: 'add'|'edit'|'delete'`)
   - **Metodă:** `POST`
   - **Locații:** 
     - Linia 325 (`handleAddItem`) - pentru furnizori
     - Linia 429 (`handleEditItem`) - pentru furnizori
     - Linia 461 (`handleDeleteItem`) - pentru furnizori
   - **Descriere:** CRUD operations pentru furnizori (add, edit, delete)
   - **Status:** ✅ Migrat la backend
   - **Structură n8n (Furnizori):**
     - **Switch pe `action`:** "add" | "edit" | "delete"
     - **ADD:** `INSERT INTO Proveedores` cu toate câmpurile
     - **EDIT:** `UPDATE Proveedores SET ... WHERE id = ...`
     - **DELETE:** `DELETE FROM Proveedores WHERE id = ...`
     - **Câmpuri:** NIF, NOMBRE O RAZÓN SOCIAL, EMAIL, TELEFONO, MÓVIL, FAX, DIRECCIÓN, CODIGO POSTAL, POBLACIÓN, PROVINCIA, PAÍS, URL, DESCUENTO POR DEFECTO, LATITUD, LONGITUD, NOTAS PRIVADAS, CUENTAS BANCARIAS, fecha_creacion, fecha_actualizacion, ESTADO
     - **Diferențe față de Clientes:**
       - Folosește tabelul `Proveedores` (nu `Clientes`)
       - Câmpuri cu acent: `NOMBRE O RAZÓN SOCIAL`, `MÓVIL`, `DIRECCIÓN`, `POBLACIÓN`, `PAÍS`
       - Are `fecha_creacion` și `fecha_actualizacion` (nu există la clienți)
       - Nu are: `TIPO`, `CONTRACTO`, `CuantoPuedeGastar`, `Fecha Ultima Renovacion`, `Fecha Proxima Renovacion`
     - **Response:** JSON cu `mensaje` (succes/eroare)

### 4. **`routes.renovarContracto`** - ⚠️ **N8N**
   - **Endpoint:** `/api/n8n/webhook/renovar-contracto`
   - **Metodă:** `POST`
   - **Locație:** Linia 367
   - **Funcție:** `handleRenovarContract()`
   - **Descriere:** Reînnoiește contractul unui client/furnizor
   - **Status:** ⚠️ Încă prin n8n

### 5. **`routes.getContratosCliente`** - ✅ **BACKEND**
   - **Endpoint:** `/api/clientes/:nif/contracts`
   - **Metodă:** `GET`
   - **Locație:** `ClienteDetallePage.jsx` (linia 95)
   - **Funcție:** `fetchContracts()`
   - **Descriere:** Obține lista de contracte pentru un client după NIF
   - **Status:** ✅ Migrat la backend
   - **Query params:** `nif` (din URL path, nu query param)
   - **Response:** `{ success: true, data: [...], message: "..." }`

### 6. **`routes.crudContract`** - ✅ **BACKEND** (POST pentru upload/delete)
   - **Endpoint:** `/api/clientes/contracts` (POST cu `action: 'upload'|'delete'`)
   - **Metodă:** `POST`
   - **Locație:** `ClientesPage.jsx` (linia 657)
   - **Funcție:** `handleUploadContract()`
   - **Descriere:** Upload sau delete contract pentru client/furnizor
   - **Status:** ✅ Migrat la backend
   - **Structură:**
     - **Body:** `{ action: 'upload'|'delete', id?: number (pentru delete), nif, contractType, fechaSubida, archivo (base64), ... }`
     - **UPLOAD:** Upsert în `ContratosClientes` (actualizează dacă există deja)
     - **DELETE:** Șterge contract după ID
     - **Response:** JSON cu `{ success: true, mensaje: string }`

---

## 📊 Statistici

- **Total apeluri:** 7
- **✅ Backend:** 6 (86%) - getClientes, getProveedores, crudCliente (pentru clienți), crudProveedor (pentru furnizori), getContratosCliente, crudContract (upload/delete)
- **⚠️ N8N:** 1 (14%) - renovarContracto

---

## 🎯 Recomandări

### Prioritate Înaltă:
1. ✅ **Migrare `getProveedores`** - COMPLETAT - acum folosește `/api/clientes/proveedores`
2. ✅ **Migrare CRUD operations pentru clienți** - COMPLETAT - acum folosește `/api/clientes` cu `action`
3. ✅ **Migrare CRUD operations pentru furnizori** - COMPLETAT - acum folosește `/api/clientes/proveedores` cu `action`
4. ✅ **Migrare `getContratosCliente`** - COMPLETAT - acum folosește `/api/clientes/:nif/contracts`
5. ✅ **Migrare `crudContract` (upload/delete)** - COMPLETAT - acum folosește `/api/clientes/contracts` cu `action`
6. **Migrare `renovarContracto`** - Ar trebui să fie pe backend

---

## 📝 Note

- ✅ **Migrat:** `getClientes`, `getProveedores`, CRUD operations pentru clienți, CRUD operations pentru furnizori, `getContratosCliente` (GET contracts), `crudContract` (upload/delete contracts)
- ⚠️ **Rămas n8n:** 
  - `renovarContracto` (reînnoire contract) - webhook: `/webhook/renovar-contracto`
- `getCrudEndpoint()` acum folosește `routes.crudCliente` pentru clienți și `routes.crudProveedor` pentru furnizori
- `getContratosCliente(nif)` este o funcție care returnează URL-ul complet pentru endpoint-ul de contracte
- `routes.crudContract` este endpoint-ul pentru upload/delete contracte (action: 'upload'|'delete')

