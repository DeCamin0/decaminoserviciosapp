# 📊 RAPORT COMPLET: Audit Logging - Acțiuni Loguite vs Lipsă

**Data:** 2025-01-XX  
**Scop:** Identificare acțiuni loguite și acțiuni care trebuie loguite pentru logging complet

---

## ✅ ACȚIUNI DEJA LOGUITE

### 1. Autentificare & Sesions
- ✅ `login` - Logare utilizator
- ✅ `logout` - Delogare utilizator
- ✅ `demo_login` - Login demo/test
- ✅ `page_access` - Acces pagină (parțial implementat)

### 2. Fichajes (Pontaje)
- ✅ `fichaje_created` - Creare fichaje
- ✅ `fichaje_updated` - Actualizare fichaje
- ✅ `fichaje_deleted` - Ștergere fichaje
- ✅ `fichaje_approved` - Aprobare fichaje (metodă există, trebuie verificat utilizare)
- ✅ `fichaje_rejected` - Respingere fichaje (metodă există, trebuie verificat utilizare)

### 3. Solicitudes (Cereri)
- ✅ `solicitud_created` - Creare solicitare
- ✅ `solicitud_updated` - Actualizare solicitare
- ✅ `solicitud_deleted` - Ștergere solicitare (parțial - folosește logAction generic)
- ✅ `solicitud_approved` - Aprobare solicitare (metodă există, trebuie verificat utilizare)
- ✅ `solicitud_rejected` - Respingere solicitare (metodă există, trebuie verificat utilizare)

### 4. Cuadrantes
- ✅ `cuadrante_generated` - Generare cuadrante
- ✅ `cuadrante_saved` - Salvare cuadrante
- ✅ `cuadrante_updated` - Actualizare cuadrante

### 5. Empleados (Angajați)
- ✅ `user_created` - Creare angajat (parțial - folosește logAction generic)
- ✅ `user_updated` - Actualizare angajat
- ✅ `user_created_with_pdf` - Creare angajat cu PDF
- ⚠️ `empleado_deleted` - Ștergere angajat (metodă există, dar nu văzută utilizată)

### 6. Clientes (Clienți)
- ✅ `cliente_created` - Creare client
- ✅ `cliente_updated` - Actualizare client
- ⚠️ `cliente_deleted` - Ștergere client (metodă există, dar nu văzută utilizată)

### 7. Documentos
- ✅ `documento_uploaded` - Upload document
- ✅ `documento_downloaded` - Download document
- ✅ `documento_oficial_downloaded` - Download document oficial
- ✅ `documentos_fetched` - Citire documente (parțial)
- ✅ `documentos_fetch_error` - Eroare la citire documente
- ✅ `documento_upload` - Upload document (parțial)
- ✅ `documento_upload_error` - Eroare la upload

### 8. Export/Import
- ✅ `data_export` - Export date (Excel/PDF) - folosit pentru:
  - `solicitudes_excel`
  - `solicitudes_pdf`
  - `fichajes_excel`
  - `fichajes_pdf`
  - `empleados_excel`
  - `empleados_pdf`
- ⚠️ `data_import` - Import date (metodă există, dar nu văzută utilizată)

### 9. Admin Panel
- ✅ `permissions_saved` - Salvare permisiuni
- ✅ `admin_stats_viewed` - Vizualizare statistici admin
- ✅ `activity_log_viewed` - Vizualizare log-uri activitate

### 10. Tareas
- ✅ `tarea_created` - Creare task
- ✅ `tarea_updated` - Actualizare task

### 11. Notificări & Email
- ✅ `email_sent` - Trimitere email (parțial - folosește logAction generic)

---

## ❌ ACȚIUNI CARE LIPSESC - TREBUIE ADĂUGATE

### 1. Ausencias (Absențe) ⚠️ CRITIC
- ❌ `ausencia_created` - Creare absență (POST /api/ausencias)
- ❌ `ausencia_updated` - Actualizare absență
- ❌ `ausencia_deleted` - Ștergere absență
- ❌ `ausencia_approved` - Aprobare absență
- ❌ `ausencia_rejected` - Respingere absență

### 2. Bajas Médicas (Boli medicale) ⚠️ CRITIC
- ❌ `baja_medica_viewed` - Vizualizare bajas médicas
- ❌ `baja_medica_updated` - Actualizare bajas médicas
- ❌ `baja_medica_deleted` - Ștergere bajas médicas

### 3. Aprobaciones (Aprobări) ⚠️ CRITIC
- ❌ `aprobacion_fichaje_viewed` - Vizualizare fichaje pendiente
- ❌ `aprobacion_fichaje_approved` - Aprobare fichaje
- ❌ `aprobacion_fichaje_rejected` - Respingere fichaje
- ❌ `aprobacion_cambio_viewed` - Vizualizare cambios pendientes
- ❌ `aprobacion_cambio_approved` - Aprobare cambio personal
- ❌ `aprobacion_cambio_rejected` - Respingere cambio personal

### 4. Notificări (Notifications) ⚠️ CRITIC
- ❌ `notification_read` - Marcare notificare ca citită (PUT /api/notifications/:id/read)
- ❌ `notification_read_all` - Marcare toate notificările ca citite (PUT /api/notifications/read-all)
- ❌ `notification_deleted` - Ștergere notificare (DELETE /api/notifications/:id)
- ❌ `notification_sent` - Trimitere notificare (POST /api/notifications/send)

### 5. Avatar (Profil utilizator) ⚠️ MEDIUM
- ❌ `avatar_uploaded` - Upload avatar (POST /api/avatar)
- ❌ `avatar_deleted` - Ștergere avatar (DELETE /api/avatar)
- ❌ `avatar_bulk_uploaded` - Upload bulk avatare (POST /api/avatar/bulk)

### 6. Inspecciones ⚠️ CRITIC
- ❌ `inspeccion_viewed` - Vizualizare inspecții
- ❌ `inspeccion_created` - Creare inspecție
- ❌ `inspeccion_updated` - Actualizare inspecție
- ❌ `inspeccion_deleted` - Ștergere inspecție
- ❌ `inspeccion_pdf_generated` - Generare PDF inspecție

### 7. Chat ⚠️ MEDIUM
- ❌ `chat_message_sent` - Trimitere mesaj chat
- ❌ `chat_room_created` - Creare cameră chat
- ❌ `chat_room_joined` - Intrare în cameră chat
- ❌ `chat_room_left` - Părăsire cameră chat
- ❌ `chat_message_read` - Citire mesaj chat

### 8. Push Notifications ⚠️ LOW
- ❌ `push_subscribed` - Subscribe push notifications (POST /api/push/subscribe)
- ❌ `push_unsubscribed` - Unsubscribe push notifications (DELETE /api/push/unsubscribe)

### 9. Horas (Ore lucrate/asignadas) ⚠️ MEDIUM
- ❌ `horas_asignadas_viewed` - Vizualizare ore asignate
- ❌ `horas_asignadas_updated` - Actualizare ore asignate (POST /api/horas-asignadas)
- ❌ `horas_permitidas_viewed` - Vizualizare ore permise
- ❌ `horas_permitidas_updated` - Actualizare ore permise (POST /api/horas-permitidas, PUT /api/horas-permitidas/:id)
- ❌ `horas_permitidas_deleted` - Ștergere ore permise (DELETE /api/horas-permitidas/:id)
- ❌ `horas_trabajadas_viewed` - Vizualizare ore lucrate

### 10. Monthly Alerts ⚠️ MEDIUM
- ❌ `alert_viewed` - Vizualizare alertă
- ❌ `alert_dismissed` - Ignorare alertă
- ❌ `alert_resolved` - Rezolvare alertă

### 11. Grupos ⚠️ MEDIUM
- ❌ `grupo_viewed` - Vizualizare grupuri
- ❌ `grupo_created` - Creare grup (dacă există endpoint)
- ❌ `grupo_updated` - Actualizare grup (dacă există endpoint)
- ❌ `grupo_deleted` - Ștergere grup (dacă există endpoint)

### 12. Contract Types ⚠️ LOW
- ❌ `contract_type_viewed` - Vizualizare tipuri contract
- ❌ `contract_type_created` - Creare tip contract (dacă există endpoint)
- ❌ `contract_type_updated` - Actualizare tip contract (dacă există endpoint)

### 13. Documentos Oficiales ⚠️ MEDIUM
- ❌ `documento_oficial_uploaded` - Upload document oficial
- ❌ `documento_oficial_deleted` - Ștergere document oficial

### 14. Nominas ⚠️ CRITIC
- ❌ `nomina_uploaded` - Upload nómina
- ❌ `nomina_downloaded` - Download nómina (parțial - există logAction generic)
- ❌ `nomina_deleted` - Ștergere nómina

### 15. Gastos (Cheltuieli) ⚠️ CRITIC
- ❌ `gasto_viewed` - Vizualizare gastos
- ❌ `gasto_created` - Creare gasto
- ❌ `gasto_updated` - Actualizare gasto
- ❌ `gasto_deleted` - Ștergere gasto
- ❌ `gasto_ocr_processed` - Procesare OCR gasto

### 16. Paquetes (Pachete/Coleturi) ⚠️ MEDIUM
- ❌ `paquete_viewed` - Vizualizare paquetes
- ❌ `paquete_created` - Creare paquete
- ❌ `paquete_updated` - Actualizare paquete
- ❌ `paquete_delivered` - Livrare paquete
- ❌ `paquete_deleted` - Ștergere paquete

### 17. Pedidos (Comenzi) ⚠️ CRITIC
- ❌ `pedido_viewed` - Vizualizare pedidos
- ❌ `pedido_created` - Creare pedido
- ❌ `pedido_updated` - Actualizare pedido
- ❌ `pedido_deleted` - Ștergere pedido
- ❌ `pedido_approved` - Aprobare pedido
- ❌ `pedido_rejected` - Respingere pedido

### 18. Cambios Personales ⚠️ MEDIUM
- ❌ `cambio_personal_viewed` - Vizualizare cambios personales
- ❌ `cambio_personal_created` - Creare cambio personal (POST /api/empleados/cambio-aprobacion)
- ❌ `cambio_personal_approved` - Aprobare cambio personal
- ❌ `cambio_personal_rejected` - Respingere cambio personal

### 19. Clientes (Operațiuni suplimentare) ⚠️ MEDIUM
- ❌ `cliente_deleted` - Ștergere client (metodă există, dar trebuie verificată utilizarea)
- ❌ `cliente_contract_renewed` - Reînnoire contract client
- ❌ `cliente_contract_viewed` - Vizualizare contracte client

### 20. Proveedores (Furnizori) ⚠️ MEDIUM
- ❌ `proveedor_viewed` - Vizualizare proveedores
- ❌ `proveedor_created` - Creare proveedor (dacă există endpoint)
- ❌ `proveedor_updated` - Actualizare proveedor (dacă există endpoint)
- ❌ `proveedor_deleted` - Ștergere proveedor (dacă există endpoint)

### 21. Estadisticas (Statistici) ⚠️ LOW
- ❌ `statistics_viewed` - Vizualizare statistici
- ❌ `statistics_exported` - Export statistici

### 22. AutoFirma (Semnătură electronică) ⚠️ CRITIC
- ❌ `autofirma_session_created` - Creare sesiune semnătură
- ❌ `autofirma_signed` - Semnare document
- ❌ `autofirma_failed` - Eșec semnătură

---

## 📋 PRIORITIZARE ACȚIUNI DE ADĂUGAT

### 🔴 CRITIC (Trebuie loguite imediat)
1. **Ausencias** - toate operațiunile
2. **Bajas Médicas** - toate operațiunile
3. **Aprobaciones** - toate operațiunile (fichajes, cambios)
4. **Notificări** - toate operațiunile (read, delete, send)
5. **Inspecciones** - toate operațiunile
6. **Nominas** - upload, download, delete
7. **Gastos** - toate operațiunile (inclusiv OCR)
8. **Pedidos** - toate operațiunile
9. **AutoFirma** - toate operațiunile

### 🟡 MEDIUM (Trebuie loguite în curând)
10. **Avatar** - upload, delete, bulk
11. **Chat** - toate operațiunile
12. **Horas** - toate operațiunile (asignadas, permitidas, trabajadas)
13. **Monthly Alerts** - toate operațiunile
14. **Grupos** - toate operațiunile (dacă există CRUD)
15. **Documentos Oficiales** - upload, delete
16. **Paquetes** - toate operațiunile
17. **Cambios Personales** - toate operațiunile
18. **Clientes** - delete, contract operations
19. **Proveedores** - toate operațiunile (dacă există CRUD)

### 🟢 LOW (Nice to have)
20. **Push Notifications** - subscribe/unsubscribe
21. **Contract Types** - toate operațiunile (dacă există CRUD)
22. **Estadisticas** - view, export

---

## 📊 STATISTICI ACTUALE

- **Acțiuni loguite:** ~35-40
- **Acțiuni care lipsesc:** ~70-80
- **Procent acoperire:** ~35-40%
- **Procent target:** 100%

---

## 🎯 PLAN DE ACȚIUNE

### Faza 1: Migrare endpoint logging la backend
1. Creează `ActivityLogsService` și `ActivityLogsController`
2. Implementează `POST /api/activity-logs`
3. Actualizează `activityLogger.js` să folosească noul endpoint
4. Testează migrarea

### Faza 2: Adaugă logging pentru acțiuni critice
1. Ausencias - toate operațiunile
2. Bajas Médicas - toate operațiunile
3. Aprobaciones - toate operațiunile
4. Notificări - toate operațiunile
5. Inspecciones - toate operațiunile

### Faza 3: Adaugă logging pentru acțiuni medium
1. Avatar, Chat, Horas, Alerts, etc.

### Faza 4: Adaugă logging pentru acțiuni low
1. Push, Contract Types, Statistics, etc.

---

## 📝 NOTIȚE TEHNICE

### Probleme identificate cu structura actuală:
1. `userAgent` - Frontend trimite în `body.browser.userAgent`, dar backend trebuie să extragă din `headers['user-agent']`
2. `ip` - Frontend nu trimite, trebuie extras de backend din headers (`x-forwarded-for` sau `x-real-ip`)
3. `updateby` - Frontend nu trimite explicit, trebuie mapeat din `details.user` sau `details.email`

### Recomandări:
- Backend trebuie să extragă automat `userAgent` și `ip` din request headers
- Backend trebuie să adauge automat `updateby` din `details.user` sau `details.email`
- Pentru acțiunile critice, logging-ul trebuie să fie **sincron** (blocking) pentru a nu pierde log-uri
- Pentru acțiunile non-critice, logging-ul poate rămâne **asincron** (non-blocking)

---

**Generat:** 2025-01-XX  
**Status:** Audit completat, pregătit pentru implementare
