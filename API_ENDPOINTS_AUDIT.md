# Audit Complet - Apeluri API pe Pagini

## Legendă
- ✅ **BACKEND** = Endpoint migrat la backend NestJS (`/api/...`)
- ⚠️ **N8N** = Endpoint care încă folosește n8n prin proxy (`/api/n8n/...`)

---

## 1. SolicitudesPage.jsx

### Apeluri API:
1. **`routes.getSolicitudesByEmail`** - ✅ **BACKEND** (`/api/solicitudes`)
   - GET: Listare solicitări (cu filtre email, codigo, MES, TIPO, ESTADO)
   - POST: Create/Update/Delete solicitări (cu `accion: 'create'|'update'|'delete'`)

2. **`routes.uploadBajasMedicas`** - ✅ **BACKEND** (`/api/bajas-medicas`)
   - POST: Upload fișier bajas médicas

3. **`routes.getBajasMedicas`** - ✅ **BACKEND** (`/api/bajas-medicas`)
   - GET: Listare bajas médicas

4. **`routes.updateBajasMedicas`** - ✅ **BACKEND** (`/api/bajas-medicas`)
   - POST: Update bajas médicas

5. **`API_ENDPOINTS.USERS`** (routes.getEmpleados) - ✅ **BACKEND** (`/api/empleados`)
   - GET: Listare angajați pentru calcul disponibilitate

6. **`routes.getAusencias`** - ✅ **BACKEND** (`/api/ausencias`)
   - GET: Listare ausencias

---

## 2. EmpleadosPage.jsx

### Apeluri API:
1. **`routes.getAvatarBulk`** - ✅ **BACKEND** (`/api/avatar/bulk`)
   - GET: Bulk avatare angajați

2. **`routes.getAvatar`** - ✅ **BACKEND** (`/api/avatar`)
   - GET: Avatar angajat specific

3. **`routes.getClientes`** - ✅ **BACKEND** (`/api/clientes`)
   - GET: Listare clienți

4. **`routes.getContractTypes`** - ✅ **BACKEND** (`/api/contract-types`)
   - GET: Listare tipuri contracte

5. **`routes.getGrupos`** - ✅ **BACKEND** (`/api/grupos`)
   - GET: Listare grupuri

6. **`API_ENDPOINTS.USERS`** (routes.getEmpleados) - ✅ **BACKEND** (`/api/empleados`)
   - GET: Listare angajați

7. **`routes.getOnlineUsers`** - ✅ **BACKEND** (`/api/online-users`)
   - GET: Listare utilizatori online

8. **`API_ENDPOINTS.UPDATE_USER`** (routes.updateUser) - ✅ **BACKEND** (`/api/empleados`)
   - PUT/PATCH: Update angajat

9. **`routes.sendNotificacion`** - ✅ **BACKEND** (`/api/empleados/send-email`)
   - POST: Trimite email notificare

---

## 3. DashboardPage.jsx

### Apeluri API:
1. **`routes.getEmpleadoMe`** - ✅ **BACKEND** (`/api/empleados/me`)
   - GET: Profil utilizator curent

2. **`routes.getAvatarMe` / `routes.getAvatar`** - ✅ **BACKEND** (`/api/avatar/me` sau `/api/avatar`)
   - GET: Avatar utilizator curent

---

## 4. CuadrantesPage.jsx

### Apeluri API:
1. **`routes.getFestivos`** - ⚠️ **N8N** (`/api/n8n/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0`)
   - GET: Listare zile festive

2. **`routes.createFestivo`** - ⚠️ **N8N** (`/api/n8n/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0`)
   - POST: Creare zi festivă

3. **`routes.editFestivo`** - ⚠️ **N8N** (`/api/n8n/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0`)
   - POST: Editare zi festivă

4. **`routes.deleteFestivo`** - ⚠️ **N8N** (`/api/n8n/webhook/2e91652c-bb34-43e8-9e38-5ba0e16b4ca0`)
   - POST: Ștergere zi festivă

5. **`routes.getClientes`** - ✅ **BACKEND** (`/api/clientes`)
   - GET: Listare clienți

6. **`routes.getEmpleados`** - ✅ **BACKEND** (`/api/empleados`)
   - GET: Listare angajați

7. **`routes.getCuadrantes`** - ✅ **BACKEND** (`/api/cuadrantes`)
   - GET: Listare cuadrantes

8. **`routes.saveCuadrante`** - ⚠️ **N8N** (`/api/n8n/webhook/guardar-cuadrante-yyBov0qVQZEhX2TL`)
   - POST: Salvare cuadrante

---

## 5. DocumentosPage.jsx

### Apeluri API:
1. **`routes.getDocumentos`** - ✅ **BACKEND** (`/api/documentos`)
   - GET: Listare documente

2. **`routes.downloadDocumento`** - ✅ **BACKEND** (`/api/documentos/download`)
   - GET: Download document

3. **`routes.deleteDocumento`** - ✅ **BACKEND** (`/api/documentos/delete`)
   - POST: Ștergere document

4. **`routes.uploadDocumento`** - ✅ **BACKEND** (`/api/documentos/upload`)
   - POST: Upload document

---

## 6. DocumentosEmpleadosPage.jsx

### Apeluri API:
1. **`routes.getNominas`** - ✅ **BACKEND** (`/api/nominas`)
   - GET: Listare nóminas

2. **`routes.downloadNomina`** - ✅ **BACKEND** (`/api/nominas/download`)
   - GET: Download nómina

3. **`routes.deleteNomina`** - ✅ **BACKEND** (`/api/nominas/delete`)
   - POST: Ștergere nómina

4. **`routes.uploadNomina`** - ✅ **BACKEND** (`/api/nominas/upload`)
   - POST: Upload nómina

5. **`routes.getDocumentosOficiales`** - ✅ **BACKEND** (`/api/documentos-oficiales`)
   - GET: Listare documente oficiale

6. **`routes.downloadDocumentoOficial`** - ✅ **BACKEND** (`/api/documentos-oficiales/download`)
   - GET: Download document oficial

7. **`routes.deleteDocumentoOficial`** - ✅ **BACKEND** (`/api/documentos-oficiales/delete`)
   - POST: Ștergere document oficial

8. **`routes.uploadDocumentoOficial`** - ✅ **BACKEND** (`/api/documentos-oficiales/upload`)
   - POST: Upload document oficial

9. **`routes.guardarDocumentoSemnat`** - ✅ **BACKEND** (`/api/documentos-oficiales/save-signed`)
   - POST: Salvare document semnat

---

## 7. InspeccionesPage.jsx

### Apeluri API:
1. **`routes.getInspecciones`** - ✅ **BACKEND** (`/api/inspecciones`)
   - GET: Listare inspecciones (toate pentru managers)

2. **`routes.addInspeccion`** - ✅ **BACKEND** (`/api/inspecciones`)
   - POST: Creare inspección

3. **`routes.updateInspeccion`** - ⚠️ **N8N** (`/api/n8n/webhook/update-inspeccion`)
   - POST: Update inspección

4. **`routes.deleteInspeccion`** - ⚠️ **N8N** (`/api/n8n/webhook/delete-inspeccion`)
   - POST: Ștergere inspección

5. **`routes.downloadInspectionDocument`** - ✅ **BACKEND** (`/api/inspecciones/download`)
   - GET: Download document inspección

---

## 8. MisInspeccionesPage.jsx

### Apeluri API:
1. **`routes.getMisInspecciones`** - ✅ **BACKEND** (`/api/inspecciones`)
   - GET: Listare inspecciones utilizator curent

---

## 9. AprobacionesPage.jsx

### Apeluri API:
1. **`routes.getCambiosPendientes`** - ✅ **BACKEND** (`/api/empleados/cambios-pendientes`)
   - GET: Listare cereri modificare date pendiente

2. **`routes.approveCambio`** - ✅ **BACKEND** (`/api/empleados/approve-cambio`)
   - POST: Aprobare cerere modificare

3. **`routes.rejectCambio`** - ✅ **BACKEND** (`/api/empleados/reject-cambio`)
   - POST: Respingere cerere modificare

**Notă:** Secțiunea Fichajes a fost eliminată din această pagină (comentariu în cod: "Secțiunea Fichajes a fost eliminată"). Apelurile pentru Fichajes (`getFichajesPendientes`, `updateEstadoFichaje`, `getFichajeDetails`) nu mai sunt folosite aici.

---

## 10. Fichaje.jsx

### Status: ✅ **TOTALITATE MIGRAT LA BACKEND**

### Apeluri API:
1. **`routes.getBajasMedicas`** - ✅ **BACKEND** (`/api/bajas-medicas`)
   - GET: Verificare baja médica

2. **`routes.getAusencias`** - ✅ **BACKEND** (`/api/ausencias`)
   - GET: Listare ausencias

3. **`routes.getRegistros`** - ✅ **BACKEND** (`/api/registros`)
   - GET: Listare registros (fichajes)

4. **`routes.getTargetOreGrupo`** - ✅ **BACKEND** (`/api/horas-asignadas`)
   - GET: Ore asignate pentru grup

5. **`routes.addFichaje`** - ✅ **BACKEND** (`/api/registros`)
   - POST: Creare fichaje

6. **`routes.updateFichaje`** - ✅ **BACKEND** (`/api/registros`)
   - PUT: Update fichaje

7. **`routes.deleteFichaje`** - ✅ **BACKEND** (`/api/registros`)
   - DELETE: Ștergere fichaje

8. **`routes.getEmpleados`** - ✅ **BACKEND** (`/api/empleados`)
   - GET: Listare angajați

9. **`routes.getRegistrosEmpleados`** - ✅ **BACKEND** (`/api/registros/empleados`)
   - GET: Listare registros pentru toți angajații (manageri)

10. **`routes.getRegistrosPeriodo`** - ✅ **BACKEND** (`/api/registros/periodo`)
    - GET: Listare registros pe perioadă

11. **`routes.getCuadrantes`** - ✅ **BACKEND** (`/api/cuadrantes`)
    - POST: Obținere cuadrantes

12. **`routes.addAusencia`** - ✅ **BACKEND** (`/api/ausencias`)
    - POST: Creare ausencia (incidență)

**Notă:** Toate apelurile sunt migrate. Nu există apeluri către n8n în `Fichaje.jsx`.

---

## 11. EstadisticasPage.jsx

### Apeluri API:
1. **`routes.getHorasTrabajadas`** - ✅ **BACKEND** (`/api/horas-trabajadas`)
   - GET: Statistici ore lucrate

2. **`routes.getHorasPermitidas`** - ✅ **BACKEND** (`/api/horas-permitidas`)
   - GET: Ore permise

3. **`routes.getTargetOreGrupo`** (routes.getHorasAsignadas) - ✅ **BACKEND** (`/api/horas-asignadas`)
   - GET: Ore țintă per grup

---

## 12. ClientesPage.jsx

### Apeluri API:
1. **`routes.getClientes`** - ✅ **BACKEND** (`/api/clientes`)
   - GET: Listare clienți

2. **`routes.saveCliente`** - ⚠️ **N8N** (`/api/n8n/webhook/save-cliente`)
   - POST: Salvare client

3. **`routes.renovarContracto`** - ⚠️ **N8N** (`/api/n8n/webhook/renovar-contracto`)
   - POST: Reînnoire contract

---

## 12b. EstadisticasEmpleadosPage.jsx

### Apeluri API:
1. **`routes.getEmpleados`** - ✅ **BACKEND** (`/api/empleados`)
   - GET: Listare angajați

2. **`routes.getFichajes`** - ⚠️ **N8N** (`/api/n8n/webhook/95551bd2-fba3-401f-a14e-08e3ca037ce7`)
   - GET: Listare fichajes

---

## 12c. EstadisticasFichajesPage.jsx

### Apeluri API:
1. **`routes.getEmpleados`** - ✅ **BACKEND** (`/api/empleados`)
   - GET: Listare angajați

2. **`routes.getFichajes`** - ⚠️ **N8N** (`/api/n8n/webhook/95551bd2-fba3-401f-a14e-08e3ca037ce7`)
   - GET: Listare fichajes

---

## 12d. CuadrantesEmpleadoPage.jsx

### Apeluri API:
1. **`routes.getEmpleados`** - ✅ **BACKEND** (`/api/empleados`)
   - GET: Listare angajați

2. **`routes.getCuadrantes`** - ✅ **BACKEND** (`/api/cuadrantes`)
   - GET: Listare cuadrantes

3. **`routes.getRegistros`** - ✅ **BACKEND** (`/api/registros`)
   - GET: Listare registros (fichajes)

4. **`routes.getAusencias`** - ✅ **BACKEND** (`/api/ausencias`)
   - GET: Listare ausencias

5. **`routes.getBajasMedicas`** - ✅ **BACKEND** (`/api/bajas-medicas`)
   - GET: Listare bajas médicas

6. **`routes.addFichaje`** - ✅ **BACKEND** (`/api/registros`)
   - POST: Creare fichaje

---

## 12e. PedidosPage.tsx

### Apeluri API:
1. **`routes.getClientes`** - ✅ **BACKEND** (`/api/clientes`)
   - GET: Listare clienți

2. **`getN8nUrl('/webhook/catalogo/bae4f329-a1be-4e66-9792-6b35aa2f4a51')`** - ⚠️ **N8N**
   - GET: Catalog produse

3. **`getN8nUrl('/webhook/96759745-6289-41d4-9e5e-f253fbfab08c')`** - ⚠️ **N8N**
   - POST: Adăugare produs

4. **`getN8nUrl('/webhook/5c49e67b-b81c-4187-8d0f-37bb32e9f217')`** - ⚠️ **N8N**
   - POST: Editare/Ștergere produs

5. **`getN8nUrl('/webhook/2498ba38-1402-4b73-bb5b-c8b1097ecf4b')`** - ⚠️ **N8N**
   - POST: Permisiuni

6. **`getN8nUrl('/webhook/8c8aa198-5b57-4203-bdd7-7f8ff060bf68')`** - ⚠️ **N8N**
   - GET: Încărcare permisiuni

7. **`getN8nUrl('/webhook/b127e72a-df77-4c07-acc3-1e9d931d4f95')`** - ⚠️ **N8N**
   - GET: Detalii comandă

---

## 12f. IncidenciasCentroPage.jsx

### Apeluri API:
1. **`routes.getEmpleados`** - ✅ **BACKEND** (`/api/empleados`)
   - GET: Listare angajați

---

## 12g. TareasCentroPage.jsx

### Apeluri API:
1. **`routes.getClientes`** - ✅ **BACKEND** (`/api/clientes`)
   - GET: Listare clienți

2. **`routes.getTareasCentro`** - ⚠️ **N8N** (`/api/n8n/webhook-test/f2035fa7-7fb7-4a28-bcc9-d24b7cc5294b`)
   - GET: Listare tareas per centru

---

## 13. ClienteDetallePage.jsx

### Apeluri API:
1. **`routes.getClientes`** - ✅ **BACKEND** (`/api/clientes`)
   - GET: Detalii client

---

## 14. IncidenciasPage.jsx

### Apeluri API:
1. **`routes.getIncidencias`** - ⚠️ **N8N** (`/api/n8n/webhook/48ab52db-0279-4e86-aef7-2c8548fb0f5b`)
   - GET: Listare incidencias

2. **`routes.addIncidencia`** - ⚠️ **N8N** (`/api/n8n/webhook/31f2b085-58f1-4f61-9368-3703566323f9`)
   - POST: Creare incidencia

3. **`routes.updateIncidencia`** - ⚠️ **N8N** (`/api/n8n/webhook/c3a21775-6010-4708-9c0a-dd2f978e54da`)
   - POST: Update incidencia

4. **`routes.rejectIncidencia`** - ⚠️ **N8N** (`/api/n8n/webhook/be5911e1-28ad-4ab4-8ecd-a1fa65b6a0fb`)
   - POST: Respingere incidencia

---

## 15. ControlCorreoPage.jsx

### Apeluri API:
1. **`routes.getPaquetes`** - ⚠️ **N8N** (`/api/n8n/webhook/6d752a3a-bed9-4c48-a6a9-8a2583875ef9`)
   - GET: Listare paquetes

2. **`routes.addPaquete`** - ⚠️ **N8N** (`/api/n8n/webhook/028926ba-398d-45a4-96b5-f145fb687fa6`)
   - POST: Creare paquete

3. **`routes.updatePaquete`** - ⚠️ **N8N** (`/api/n8n/webhook/9a16282e-3651-4ac6-a3da-c31ad18c480b`)
   - POST: Update paquete

---

## 16. TareasPage.jsx

### Apeluri API:
1. **`routes.getTareasCentro`** - ⚠️ **N8N** (`/api/n8n/webhook-test/f2035fa7-7fb7-4a28-bcc9-d24b7cc5294b`)
   - GET: Listare tareas per centru

---

## 17. ComunicadosPage.jsx

### Apeluri API:
1. **`routes.getComunicados`** - ✅ **BACKEND** (`/api/comunicados`)
   - GET: Listare comunicados

---

## 18. DatosPage.jsx

### Apeluri API:
1. **`routes.getEmpleadoMe`** - ✅ **BACKEND** (`/api/empleados/me`)
   - GET: Profil utilizator curent

2. **`routes.updateUser`** - ✅ **BACKEND** (`/api/empleados`)
   - PUT/PATCH: Update date personale

3. **`routes.cambioAprobacion`** - ✅ **BACKEND** (`/api/empleados/cambio-aprobacion`)
   - POST: Cerere aprobare modificare date

---

## 19. Chat (WebSocket + REST)

### Apeluri API:
1. **`routes.chatRooms`** - ✅ **BACKEND** (`/chat/rooms`)
   - GET: Listare camere chat

2. **`routes.chatColleagues`** - ✅ **BACKEND** (`/chat/colleagues`)
   - GET: Listare colegi

3. **`routes.chatSupervisors`** - ✅ **BACKEND** (`/chat/supervisors`)
   - GET: Listare supervisori

4. **`routes.chatCreateSupervisorGroup`** - ✅ **BACKEND** (`/chat/rooms/supervisor-group`)
   - POST: Creare grup supervisori

5. **`routes.chatCreateCentro`** - ✅ **BACKEND** (`/chat/rooms/centro`)
   - POST: Creare cameră centru

6. **`routes.chatCreateDM`** - ✅ **BACKEND** (`/chat/rooms/dm`)
   - POST: Creare mesaj direct

7. **`routes.chatRoomMessages(roomId)`** - ✅ **BACKEND** (`/chat/rooms/{roomId}/messages`)
   - GET: Mesaje cameră

8. **`routes.chatSendMessage(roomId)`** - ✅ **BACKEND** (`/chat/rooms/{roomId}/messages`)
   - POST: Trimite mesaj

9. **`routes.chatMarkMessagesRead(roomId)`** - ✅ **BACKEND** (`/chat/rooms/{roomId}/messages/read`)
   - POST: Marchează mesaje ca citite

10. **`routes.chatRoomPresence(roomId)`** - ✅ **BACKEND** (`/chat/rooms/{roomId}/presence`)
    - GET: Prezență cameră

11. **`routes.chatDeleteRoom(roomId)`** - ✅ **BACKEND** (`/chat/rooms/{roomId}`)
    - DELETE: Ștergere cameră

---

## 20. Notificaciones (WebSocket + REST)

### Apeluri API:
1. **`routes.getNotificaciones`** - ⚠️ **N8N** (`/api/n8n/webhook/notificaciones`)
   - GET: Listare notificări

---

## 21. Admin / Permissions

### Apeluri API:
1. **`routes.getPermissions`** - ⚠️ **N8N** (`/api/n8n/webhook/get-permissions-Rws95`)
   - GET: Permisiuni navigare

2. **`routes.getPermissionsAdmin`** - ⚠️ **N8N** (`/webhook/be960529-6a0b-4a6d-b0b9-2c0eed38576e`)
   - GET: Toate permisiunile (admin)

3. **`routes.savePermissions`** - ⚠️ **N8N** (`/webhook/save-permissions-2c0ee`)
   - POST: Salvare permisiuni

4. **`routes.getAdminStats`** - ⚠️ **N8N** (`/api/n8n/webhook/get-admin-stats-ZEhX2TL`)
   - GET: Statistici admin

5. **`routes.logActivity`** - ✅ **BACKEND** (`/api/activity-logs`)
   - POST: Log activitate

6. **`routes.getActivityLog`** - ⚠️ **N8N** (`/api/n8n/webhook/get-activity-log-iM1jIgoWNn2a`)
   - GET: Log activitate

---

## 22. Horarios

### Apeluri API:
1. **`routes.getHorarios`** - ✅ **BACKEND** (`/api/horarios`)
   - GET: Listare horarios
   - POST: Create/Update/Delete (cu `action: 'create'|'update'|'delete'`)

---

## 23. AutoFirma

### Apeluri API:
1. **`routes.autofirmaPrepare`** - ⚠️ **N8N** (`/api/n8n/webhook/918cd7f3-c0b6-49da-9218-46723702224d`)
   - POST: Pregătire AutoFirma

2. **`routes.autofirmaWebhook`** - ✅ **BACKEND** (`/api/documentos-oficiales/save-signed`)
   - POST: Webhook AutoFirma (salvare document semnat)

---

## 24. Monthly Alerts

### Apeluri API:
1. **`routes.getMonthlyAlerts`** - ✅ **BACKEND** (`/api/monthly-alerts`)
   - GET: Alerte lunare

2. **`routes.getMonthlyAlertsResumen`** - ✅ **BACKEND** (`/api/monthly-alerts/resumen`)
   - GET: Rezumat alerte lunare

---

## Rezumat

### ✅ BACKEND (Migrat):
- Auth (login, me, permissions)
- Empleados (CRUD, avatar, cambio aprobacion)
- Registros/Fichajes (CRUD)
- Cuadrantes (GET)
- Solicitudes (CRUD)
- Bajas Médicas (CRUD)
- Documentos (CRUD)
- Nominas (CRUD)
- Documentos Oficiales (CRUD)
- Inspecciones (GET, POST, download)
- Clientes (GET)
- Contract Types (GET)
- Grupos (GET)
- Ausencias (GET, POST)
- Horas (asignadas, permitidas, trabajadas)
- Horarios (CRUD)
- Chat (REST + WebSocket)
- Notificaciones (WebSocket)
- Online Users
- Monthly Alerts
- Activity Logs (POST)

### ⚠️ N8N (Încă prin proxy):
- Festivos (CRUD)
- Save Cuadrante (POST)
- Update/Delete Inspeccion
- Fichajes Pendientes
- Get Fichajes (vechi endpoint)
- Cambios Pendientes
- Incidencias (CRUD)
- Paquetes/Control Correo (CRUD)
- Tareas Centro
- Notificaciones (REST GET)
- Admin Stats
- Activity Logs (GET)
- Permissions (GET/POST)
- Save Cliente
- Renovar Contracto
- AutoFirma Prepare
- Delete Fichaje
- Get Usuarios (vechi endpoint)
- Pedidos/Catalog (CRUD)

---

## Statistici

- **Total Endpoints BACKEND**: ~60+
- **Total Endpoints N8N**: ~20
- **Procent Migrat**: ~75%

