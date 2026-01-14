# Manual de Utilizare - De Camino Servicios Auxiliares

## 📋 Cuprins

1. [Introducere](#introducere)
2. [Autentificare](#autentificare)
3. [Pagina Principală (Dashboard)](#pagina-principală-dashboard)
4. [Registro de Jornada (Fichaje)](#registro-de-jornada-fichaje)
5. [Solicitudes](#solicitudes)
6. [Empleados](#empleados)
7. [Documentos](#documentos)
8. [Cuadrantes](#cuadrantes)
9. [Aprobaciones](#aprobaciones)
10. [Comunicados](#comunicados)
11. [Inspecciones](#inspecciones)
12. [Clientes](#clientes)
13. [Estadísticas](#estadísticas)
14. [Pedidos](#pedidos)
15. [Chat AI](#chat-ai)
16. [Admin Panel](#admin-panel)
17. [Salón de la Fama](#salón-de-la-fama)

---

## Introducere

Această aplicație web este sistemul de gestionare al companiei **De Camino Servicios Auxiliares**. Permite gestionarea angajaților, programelor de lucru, documentelor, solicitărilor și multe altele.

### Caracteristici principale:
- ✅ Autentificare securizată
- ✅ Interfață responsive (desktop și mobil)
- ✅ Notificări în timp real
- ✅ Gestionare completă a angajaților
- ✅ Control de ore și programe
- ✅ Documente și nóminas
- ✅ Chat AI pentru manageri

---

## Autentificare

### Accesare aplicație

1. **Deschide aplicația** în browser sau aplicația mobilă
2. **Vezi pagina de login** cu logo-ul companiei

### Câmpuri de autentificare

#### Email (Correo Electrónico)
- **Ce este**: Adresa ta de email folosită pentru autentificare
- **Format**: `tu@email.com`
- **Validare**: Trebuie să fie un email valid
- **Icon**: 📧 (apare în câmp)

#### Parolă (Contraseña)
- **Ce este**: Parola ta de acces
- **Format**: Text ascuns (••••••••)
- **Buton vizibilitate**: Click pe iconița de ochi pentru a vedea/ascunde parola
- **Validare**: Câmp obligatoriu

### Butoane

#### "Iniciar Sesión"
- **Funcție**: Trimite datele de autentificare
- **Stare loading**: Afișează "Iniciando sesión..." când se procesează
- **După succes**: Te redirecționează automat la pagina principală

#### "Conéctate como DEMO"
- **Funcție**: Accesare în mod demo cu date simulate
- **Disponibilitate**: Apare doar dacă nu ești deja în mod demo
- **Utilizare**: Pentru explorarea aplicației fără date reale

### Mesaje de eroare

- **Email/parolă greșită**: Mesaj roșu cu detalii
- **Conexiune**: Erori de rețea sunt afișate automat

### Link-uri utile

- **Termeni și condiții**: Link în partea de jos a formularului
- **Website companie**: Click pe logo pentru a accesa site-ul

---

## Pagina Principală (Dashboard)

### Accesare

După autentificare, ești redirecționat automat la `/inicio` (Dashboard).

### Elemente principale

#### 1. Banner de Binevenire

**Conținut:**
- **Avatar utilizator**: Poza ta de profil (sau inițiale dacă nu ai poza)
- **Nume**: "¡Bienvenido, [Nume]!"
- **Descriere**: Informații despre companie și funcționalități
- **Buton "Ver perfil"**: Link către pagina de date personale

**Banner Recordatorio - Baja Médica** (dacă este activ):
- **Când apare**: Până pe 15 februarie 2026
- **Conținut**: Reminder despre comunicarea bazei medicale
- **Buton închidere**: X în colțul dreapta sus
- **Acțiune**: Click pe X pentru a închide banner-ul

#### 2. Alertas Mensuales

**Când apare**: Dacă ai zile cu alerte de ore în luna curentă

**Conținut:**
- **⚠️ Icon**: Indicator vizual
- **Titlu**: "Alertas mensuales detectadas"
- **Detalii**: 
  - Zile cu exces (ai lucrat mai mult decât programat)
  - Zile cu deficit (nu ai fichat sau ai lucrat mai puțin)
- **Link**: "Revisa el tab Horas Trabajadas → Alertas"

#### 3. Acceso Rápido (Quick Access Orb)

**Ce este**: Un orb interactiv cu toate funcționalitățile principale

**Elemente disponibile** (în funcție de permisiuni):

##### Pentru toți utilizatorii:
- **📋 Datos personales**: Informații despre tine
- **⏰ Registro de Jornada**: Înregistrare ore
- **📝 Solicitudes**: Solicitări (vacaciones, permisos, etc.)
- **📄 Documentos**: Nóminas și documente
- **📅 Mi horario**: Programul tău personal
- **✅ Mis inspecciones**: Inspecțiile tale
- **📢 Comunicados**: Anunțuri oficiale
- **🏆 Salón de la Fama**: Clasament lunar

##### Pentru manageri/supervisori:
- **👥 Gestionar empleados**: Gestionare angajați
- **📁 Documentos empleados**: Documente pentru toți angajații
- **📅 Cuadrantes**: Gestionare programe
- **✅ Aprobaciones**: Aprobări solicitări
- **🔍 Inspecciones**: Realizare inspecții
- **🛒 Pedidos**: Gestionare comenzi
- **📊 Estadísticas**: Statistici avansate
- **🏢 Clientes**: Gestionare clienți
- **⚙️ Admin Panel**: Panou de administrare
- **📨 Mensajes Enviados**: Mesaje trimise

**Cum funcționează**:
1. Click pe orice element din orb
2. Te redirecționează automat la pagina respectivă
3. Elementele sunt organizate în cerc pentru acces rapid

#### 4. Butoane pentru Manageri/Developeri

**"Enviar Notificación"**:
- **Funcție**: Trimite notificări către angajați
- **Disponibilitate**: Doar pentru manageri, supervizori, developeri
- **Acțiune**: Deschide modal pentru trimitere notificări

**"Probar Notificación Push"** (doar developeri):
- **Funcție**: Testează notificările push
- **Acțiune**: Trimite o notificare de test

### Navigare

**Mobile Bottom Navigation** (pe mobil):
- **Inicio**: Pagina principală
- **Registro de Jornada**: Fichaje
- **Solicitudes**: Solicitări
- **Empleados/Comunicados**: În funcție de permisiuni
- **Más**: Deschide drawer cu toate opțiunile

**Desktop Sidebar** (pe desktop):
- Meniu lateral cu toate secțiunile
- Grupate logic pentru acces rapid

---

## Registro de Jornada (Fichaje)

### Accesare

- **Rută**: `/fichaje`
- **Din Dashboard**: Click pe "Registro de Jornada" din Quick Access Orb
- **Din navigare**: Click pe iconița de ceas din meniu

### Funcționalități principale

#### 1. Fichar (Înregistrare ore)

**Buton "Fichar"**:
- **Funcție**: Înregistrează intrarea sau ieșirea
- **Cum funcționează**:
  1. Click pe buton
  2. Sistemul detectează automat dacă e intrare sau ieșire
  3. Se salvează ora și locația (GPS)
  4. Apare confirmare vizuală

**Indicatori**:
- **🟢 Verde**: Ai fichat intrarea
- **🔴 Roșu**: Ai fichat ieșirea
- **⏰ Ora**: Se afișează ora exactă de fichaje

#### 2. Anunciar Baja Médica

**Buton "Anunciar Baja Médica"**:
- **Funcție**: Anunță o bază medicală
- **Când folosești**: Când ai o bază medicală și trebuie să o comunici
- **Acțiune**: 
  1. Click pe buton
  2. Completează formularul cu datele bazei medicale
  3. Trimite solicitarea

#### 3. Confirmar Jornada

**Buton "Confirmar Jornada"**:
- **Funcție**: Confirmă o zi de lucru completă
- **Când folosești**: La sfârșitul zilei pentru a confirma că ai lucrat conform programului
- **Acțiune**: 
  1. Click pe buton
  2. Selectează data
  3. Confirmă

#### 4. Tabs principale

##### Tab "Registros" (Implicit)
- **Conținut**: Lista tuturor fichajelor tale
- **Coloane**:
  - Data
  - Hora entrada
  - Hora salida
  - Duración
  - Estado (Confirmado/Pendiente)
- **Acțiuni**:
  - **✏️ Edit**: Editează un fichaje
  - **🗑️ Delete**: Șterge un fichaje
  - **🔄 Refresh**: Reîncarcă lista

##### Tab "Horas Trabajadas"
- **Conținut**: Statistici despre orele lucrate
- **Informații**:
  - Ore lucrate pe lună
  - Comparație cu orele programate
  - Alertas (exces/deficit)
- **Butoane**:
  - **Filtru perioadă**: Selectează luna/an
  - **Export**: Descarcă raport

##### Tab "Horas Permitidas"
- **Conținut**: Orele permise conform programului
- **Informații**: 
  - Ore programate pe lună
  - Zile lucrătoare
  - Zile festivo

##### Tab "Alertas"
- **Conținut**: Zile cu probleme (exces/deficit de ore)
- **Culori**:
  - **🟢 Verde**: Totul OK
  - **🟡 Galben**: Atenție (deficit mic)
  - **🔴 Roșu**: Problemă (exces sau deficit mare)

##### Tab "Regularizaciones"
- **Conținut**: Solicitări de regularizare a fichajelor
- **Acțiuni**:
  - **➕ Nueva Regularización**: Creează o nouă solicitare
  - **📋 Lista**: Vezi toate regularizările tale
  - **Estado**: Pendiente/Aprobada/Rechazada

**Buton "Request Regularización"**:
- **Funcție**: Solicită regularizarea unui fichaje
- **Când folosești**: Când ai uitat să fichezi sau ai o eroare
- **Acțiune**:
  1. Click pe buton
  2. Selectează data și ora corectă
  3. Adaugă motiv (opțional)
  4. Trimite solicitarea

#### 5. Filtre și căutare

**Filtru perioadă**:
- **Selectare lună**: Dropdown cu luni
- **Selectare an**: Dropdown cu ani
- **Buton "Aplicar"**: Aplică filtrele

**Căutare**:
- **Câmp text**: Caută după dată sau oră
- **Auto-completare**: Sugestii în timp real

---

## Solicitudes

### Accesare

- **Rută**: `/solicitudes`
- **Din Dashboard**: Click pe "Solicitudes" din Quick Access Orb
- **Din navigare**: Click pe iconița de clipboard din meniu

### Tabs principale

#### Tab "Vacaciones"
- **Conținut**: Solicitări de vacanță
- **Butoane**:
  - **➕ Nueva Solicitud**: Creează o nouă solicitare de vacanță
  - **📋 Lista**: Vezi toate solicitările tale
- **Informații afișate**:
  - Data început
  - Data sfârșit
  - Zile solicitate
  - Estado (Pendiente/Aprobada/Rechazada)
  - Saldo disponibil

**Formular "Nueva Solicitud de Vacaciones"**:
- **Câmpuri**:
  - Fecha inicio (Data început)
  - Fecha fin (Data sfârșit)
  - Motivo (opțional)
- **Butoane**:
  - **Guardar**: Salvează solicitarea
  - **Cancelar**: Anulează

#### Tab "Asuntos Propios"
- **Conținut**: Solicitări de "asuntos propios" (treburi personale)
- **Funcționalitate**: Similar cu Vacaciones

#### Tab "Permisos"
- **Conținut**: Solicitări de permise
- **Tipuri**:
  - Permiso Retribuido
  - Permiso Recuperable
  - Permiso No Retribuido
  - Permiso médico
  - Permiso sin sueldo

#### Tab "Ausencias"
- **Conținut**: Absențe înregistrate
- **Acțiuni**:
  - **➕ Nueva Ausencia**: Adaugă o absență
  - **✏️ Edit**: Editează o absență
  - **🗑️ Delete**: Șterge o absență

#### Tab "Baja"
- **Conținut**: Baze medicale
- **Acțiuni**:
  - **➕ Anunciar Baja Médica**: Anunță o bază medicală
  - **📤 Upload PDF**: Încarcă documentul de bază medicală
  - **📋 Lista**: Vezi toate bazele medicale

**Formular "Anunciar Baja Médica"**:
- **Câmpuri**:
  - Fecha baja (Data început)
  - Fecha alta (Data sfârșit, opțional)
  - Días de baja (Zile)
  - Upload PDF (opțional)
- **Butoane**:
  - **Guardar**: Salvează
  - **Cancelar**: Anulează

#### Tab "Baja Voluntaria"
- **Conținut**: Solicitări de demisie
- **Acțiuni** (doar pentru manageri):
  - **👁️ Preview**: Vezi PDF-ul
  - **✅ Aprobar**: Aprobă și trimite la gestoría
  - **❌ Rechazar**: Respinge solicitarea

### Filtre

**Filtru lună**:
- **Dropdown**: Selectează luna
- **Opțiune "Todas las meses"**: Vezi toate lunile

**Căutare**:
- **Câmp text**: Caută după tip, dată sau status

### Indicatori vizuali

**Status badges**:
- **🟡 Pendiente**: Solicitare în așteptare
- **🟢 Aprobada**: Solicitare aprobată
- **🔴 Rechazada**: Solicitare respinsă

---

## Empleados

### Accesare

- **Rută**: `/empleados`
- **Disponibilitate**: Doar pentru manageri, supervizori, admini
- **Din Dashboard**: Click pe "Gestionar empleados" din Quick Access Orb

### Funcționalități principale

#### 1. Lista de angajați

**Tabel cu coloane**:
- **Avatar**: Poza de profil
- **Nombre**: Nume complet
- **Código**: Codul angajatului
- **Email**: Email
- **Centro**: Centrul de lucru
- **Grupo**: Grupul (Manager, Supervisor, etc.)
- **Estado**: Status (Activo/Inactivo)
- **Acciones**: Butoane de acțiune

**Acțiuni pe rând**:
- **👁️ Ver**: Vezi detalii complete
- **✏️ Edit**: Editează datele
- **🗑️ Delete**: Șterge angajatul (cu confirmare)

#### 2. Căutare și filtrare

**Câmp căutare**:
- **Funcție**: Caută după nume, cod sau email
- **Auto-completare**: Sugestii în timp real

**Filtre**:
- **Centro**: Dropdown cu centre
- **Grupo**: Dropdown cu grupuri
- **Estado**: Activo/Inactivo/Todos

**Buton "Limpiar filtros"**:
- **Funcție**: Resetează toate filtrele

#### 3. Adăugare angajat nou

**Buton "➕ Nuevo Empleado"**:
- **Funcție**: Deschide formularul de adăugare
- **Câmpuri obligatorii**:
  - Nombre / Apellidos
  - D.N.I. / NIE
  - Correo Electrónico
  - Centro
  - Grupo
- **Câmpuri opționale**:
  - Dirección
  - Teléfono
  - Fecha de Nacimiento
  - Nacionalidad
  - Nº Cuenta (IBAN)
  - Fecha de Alta
  - Avatar (upload imagine)

**Butoane formular**:
- **Guardar**: Salvează angajatul nou
- **Cancelar**: Anulează

#### 4. Editare inline

**Cum funcționează**:
1. Click pe orice câmp din tabel
2. Se activează modul de editare
3. Modifici valoarea
4. Click pe "✓" pentru a salva sau "✗" pentru a anula

**Câmpuri editabile**:
- Nombre
- Email
- Centro
- Grupo
- Dirección
- Teléfono
- Și multe altele

#### 5. Tabs suplimentare

##### Tab "Corregir Nombres"
- **Funcție**: Corectează numele duplicate sau greșite
- **Acțiuni**:
  - Vezi lista de nume care necesită corecție
  - Selectează numele corecte
  - Aplică corecțiile

##### Tab "Estadísticas"
- **Conținut**: Statistici despre angajați
- **Informații**:
  - Număr total angajați
  - Angajați pe centro
  - Angajați pe grupo
  - Grafici și diagrame

**Butoane export**:
- **📊 Export Excel**: Descarcă statistici în Excel
- **📄 Export PDF**: Descarcă statistici în PDF

#### 6. Funcții avansate

**Buton "📤 Generar PDF"**:
- **Funcție**: Generează PDF cu datele unui angajat
- **Acțiune**: Click pe buton → Selectează angajatul → Descarcă PDF

**Buton "🔄 Reset Password"**:
- **Funcție**: Resetează parola unui angajat
- **Disponibilitate**: Doar pentru admini
- **Acțiune**: Click → Confirmă → Parola nouă este generată automat

**Buton "📧 Enviar Email"**:
- **Funcție**: Trimite email unui angajat
- **Acțiune**: Click → Completează formularul → Trimite

---

## Documentos

### Accesare

- **Rută**: `/documentos`
- **Din Dashboard**: Click pe "Documentos" din Quick Access Orb
- **Din navigare**: Click pe iconița de document din meniu

### Tabs principale

#### Tab "Nóminas"

**Conținut**: Toate nóminas-urile tale

**Lista nóminas**:
- **Coloane**:
  - Mes (Luna)
  - Año (Anul)
  - Archivo (Nume fișier)
  - Fecha subida (Data încărcării)
  - Estado (Disponible/Pendiente)
- **Acțiuni**:
  - **👁️ Preview**: Vezi nómina în browser
  - **⬇️ Descargar**: Descarcă PDF-ul
  - **📧 Enviar por Email**: Trimite nómina pe email
  - **🗑️ Eliminar**: Șterge nómina (doar admini)

**Filtre**:
- **Mes**: Selectează luna
- **Año**: Selectează anul
- **Căutare**: Caută după nume fișier

#### Tab "Mis Documentos"

**Conținut**: Documentele tale personale

**Lista documente**:
- **Coloane**:
  - Tipo (Tip document)
  - Archivo (Nume fișier)
  - Fecha subida (Data încărcării)
  - Estado (Firmado/Pendiente)
- **Acțiuni**:
  - **👁️ Ver**: Vezi documentul
  - **⬇️ Descargar**: Descarcă documentul
  - **✏️ Editar**: Editează documentul
  - **🗑️ Eliminar**: Șterge documentul

**Buton "➕ Subir Documento"**:
- **Funcție**: Încarcă un document nou
- **Acțiune**:
  1. Click pe buton
  2. Selectează tipul de document:
     - Contrato
     - Certificado Médico
     - DNI/NIE
     - Certificado Handicap
     - Altro (personalizat)
  3. Selectează fișierul (PDF, JPG, PNG)
  4. Click pe "Subir"

**Tipuri de documente disponibile**:
- Contrato
- Certificado Médico
- DNI/NIE
- Certificado Handicap
- Certificado de Antigüedad
- Certificado de Salario
- Certificado de Trabajo
- Altro (poți introduce un tip personalizat)

#### Tab "Documentos Oficiales"

**Conținut**: Documente oficiale (Alta SS, etc.)

**Lista documente**:
- Similar cu "Mis Documentos"
- Documente oficiale încărcate de administrație

**Acțiuni**:
- **👁️ Ver**: Vezi documentul
- **⬇️ Descargar**: Descarcă documentul
- **✍️ Firmar**: Semnează documentul (dacă este necesar)

#### Tab "Documentos Solicitados"

**Conținut**: Documente solicitate de tine sau de administrație

**Lista solicitări**:
- **Coloane**:
  - Tipo (Tip document)
  - Solicitado por (Cine a solicitat)
  - Fecha solicitud (Data solicitării)
  - Estado (Pendiente/Completado)
- **Acțiuni**:
  - **✅ Marcar como Completado**: Marchează ca finalizat
  - **👁️ Ver detalles**: Vezi detalii

**Buton "➕ Nueva Solicitud"**:
- **Funcție**: Solicită un document nou
- **Acțiune**:
  1. Click pe buton
  2. Selectează tipul de document
  3. Adaugă observații (opțional)
  4. Trimite solicitarea

### Funcții speciale

#### Firma digitală (AutoFirma)

**Când apare**: Când un document necesită semnătură

**Cum funcționează**:
1. Click pe "✍️ Firmar"
2. Se deschide modalul de semnătură
3. Opțiuni:
   - **AutoFirma**: Semnează cu AutoFirma (dacă este instalat)
   - **Firma manuală**: Desenează semnătura pe ecran
4. Confirmă semnătura
5. Documentul este salvat cu semnătura

#### Preview documente

**Cum funcționează**:
1. Click pe "👁️ Preview" sau "👁️ Ver"
2. Se deschide modal cu documentul
3. Opțiuni:
   - Zoom in/out
   - Navigare pagini (pentru PDF)
   - Descărcare directă

---

## Cuadrantes

### Accesare

- **Rută**: `/cuadrantes`
- **Disponibilitate**: Doar pentru manageri, supervizori
- **Din Dashboard**: Click pe "Cuadrantes" din Quick Access Orb

### Tabs principale

#### Tab "Generar Cuadrante"

**Funcție**: Generează programe pentru angajați

**Pași**:
1. **Selectează Centro**: Alege centrul de lucru
2. **Selectează Grupo**: Alege grupul (opțional)
3. **Selectează Mes**: Alege luna
4. **Selectează Año**: Alege anul
5. **Click pe "Generar Cuadrante"**

**Rezultat**:
- Se generează un preview cu programul
- Poți edita programul manual
- Poți salva sau genera pentru tot anul

**Butoane**:
- **💾 Guardar Mes**: Salvează programul pentru luna selectată
- **📅 Generar Todo el Año**: Generează programul pentru tot anul
- **← Atrás**: Revine la selecție

#### Tab "Lista Cuadrantes"

**Conținut**: Lista tuturor programelor generate

**Lista**:
- **Coloane**:
  - Centro
  - Mes
  - Año
  - Fecha creación
  - Acciones
- **Acțiuni**:
  - **👁️ Ver**: Vezi programul
  - **✏️ Editar**: Editează programul
  - **🗑️ Eliminar**: Șterge programul
  - **📄 Export PDF**: Descarcă ca PDF
  - **📊 Export Excel**: Descarcă ca Excel

**Filtre**:
- **Centro**: Filtrează după centru
- **Mes**: Filtrează după lună
- **Año**: Filtrează după an

#### Tab "Lista Horarios"

**Conținut**: Lista tuturor programelor (horarios) definite

**Lista**:
- **Coloane**:
  - Nombre (Nume program)
  - Horas (Ore)
  - Días (Zile)
  - Acciones
- **Acțiuni**:
  - **✏️ Editar**: Editează programul
  - **🗑️ Eliminar**: Șterge programul
  - **📋 Copiar**: Copiază programul

**Buton "➕ Nuevo Horario"**:
- **Funcție**: Creează un program nou
- **Acțiune**:
  1. Click pe buton
  2. Completează formularul:
     - Nombre (Nume program)
     - Horas entrada (Ora intrare)
     - Horas salida (Ora ieșire)
     - Días (Zile lucrătoare)
  3. Salvează

#### Tab "Crear Horario"

**Funcție**: Creează un program personalizat

**Editor de program**:
- **Interfață vizuală**: Calendar cu zile
- **Drag & drop**: Trage orele pentru fiecare zi
- **Copiere**: Copiază programul de la o zi la alta
- **Template-uri**: Programe predefinite (3cu2, 4cu3, etc.)

**Butoane**:
- **💾 Guardar**: Salvează programul
- **🔄 Reset**: Resetează la programul inițial
- **📋 Copiar**: Copiază programul

#### Tab "Festivos"

**Conținut**: Gestionare zile festivo

**Lista festivos**:
- **Coloane**:
  - Fecha
  - Nombre
  - CCAA (Comunidad Autónoma)
  - Tipo (Nacional/Regional)
  - Acciones
- **Acțiuni**:
  - **✏️ Editar**: Editează ziua festivo
  - **🗑️ Eliminar**: Șterge ziua festivo

**Butoane**:
- **➕ Nuevo Festivo**: Adaugă o zi festivo nouă
- **📥 Importar**: Importă zile festivo dintr-un fișier

**Filtre**:
- **Año**: Filtrează după an
- **Mes**: Filtrează după lună
- **CCAA**: Filtrează după comunitate

**Formular "Nuevo Festivo"**:
- **Câmpuri**:
  - Fecha (Data)
  - Nombre (Nume)
  - CCAA (Comunidad Autónoma, opțional)
  - Tipo (Nacional/Regional)
- **Butoane**:
  - **Guardar**: Salvează
  - **Cancelar**: Anulează

### Funcții avansate

#### Editor de program (ScheduleEditor)

**Caracteristici**:
- **Vizualizare calendar**: Vezi programul pe o lună întreagă
- **Editare inline**: Click pe orice zi pentru a edita
- **Template-uri**: Programe predefinite (3cu2, 4cu3, etc.)
- **Copiere**: Copiază programul de la o săptămână la alta

**Acțiuni**:
- **Click pe zi**: Deschide editor pentru ziua respectivă
- **Drag & drop**: Trage orele
- **Buton "Copiar semana"**: Copiază programul săptămânii

#### Generare automată

**Opțiuni**:
- **Generar por rotación**: Generează programe rotative
- **Generar por horario fijo**: Generează programe fixe
- **Generar personalizado**: Generează programe personalizate

---

## Aprobaciones

### Accesare

- **Rută**: `/aprobaciones`
- **Disponibilitate**: Doar pentru manageri, supervizori, admini
- **Din Dashboard**: Click pe "Aprobaciones" din Quick Access Orb

### Tabs principale

#### Tab "Cambios de Datos"

**Conținut**: Solicitări de modificare a datelor angajaților

**Lista solicitări**:
- **Coloane**:
  - Empleado (Angajat)
  - Campo (Câmp modificat)
  - Valor anterior (Valoare veche)
  - Valor nuevo (Valoare nouă)
  - Fecha solicitud (Data solicitării)
  - Estado (Pendiente/Aprobada/Rechazada)
  - Acciones
- **Acțiuni**:
  - **👁️ Ver detalles**: Vezi detalii complete
  - **✅ Aprobar**: Aprobă modificarea
  - **❌ Rechazar**: Respinge modificarea

**Buton "👁️ Ver detalles"**:
- **Funcție**: Deschide modal cu detalii complete
- **Conținut**:
  - Informații despre angajat
  - Câmpul modificat
  - Valoarea veche vs. nouă
  - Motivele modificării
- **Butoane în modal**:
  - **✅ Aprobar modificación**: Aprobă
  - **❌ Rechazar modificación**: Respinge
  - **Cerrar**: Închide modalul

**Filtre**:
- **Estado**: Pendiente/Aprobada/Rechazada/Todos
- **Empleado**: Caută după nume
- **Campo**: Filtrează după câmp

#### Tab "Regularizaciones de Fichajes"

**Sub-tabs**:
- **Pendientes**: Regularizări în așteptare
- **Confirmadas**: Regularizări confirmate

##### Sub-tab "Pendientes"

**Lista regularizări**:
- **Coloane**:
  - Empleado (Angajat)
  - Fecha (Data)
  - Hora entrada (Ora intrare)
  - Hora salida (Ora ieșire)
  - Motivo (Motiv)
  - Fecha solicitud (Data solicitării)
  - Acciones
- **Acțiuni**:
  - **✅ Aprobar**: Aprobă regularizarea
  - **❌ Rechazar**: Respinge regularizarea

**Buton "✅ Aprobar"**:
- **Funcție**: Aprobă regularizarea
- **Acțiune**: Click → Confirmă → Regularizarea este aprobată

**Buton "❌ Rechazar"**:
- **Funcție**: Respinge regularizarea
- **Acțiune**:
  1. Click pe buton
  2. Se deschide modal pentru motiv
  3. Introduci motivul respingerii
  4. Opțiune: "Crear ausencia automáticamente"
  5. Confirmă respingerea

##### Sub-tab "Confirmadas"

**Lista regularizări confirmate**:
- Similar cu "Pendientes"
- Doar regularizările deja aprobate
- **Acțiuni**: Doar vizualizare (nu poți modifica)

### Funcții speciale

#### Modal de aprobare

**Când apare**: Când click pe "✅ Aprobar"

**Conținut**:
- **Confirmare**: "¿Estás seguro de que quieres aprobar esta modificación?"
- **Detalii**: Informații despre modificare
- **Butoane**:
  - **✅ Sí, aprobar**: Confirmă aprobarea
  - **❌ Cancelar**: Anulează

#### Modal de respingere

**Când apare**: Când click pe "❌ Rechazar"

**Conținut**:
- **Câmp "Motivo"**: Introdu motivul respingerii
- **Checkbox**: "Crear ausencia automáticamente" (opțional)
- **Butoane**:
  - **❌ Rechazar**: Confirmă respingerea
  - **Cancelar**: Anulează

### Notificări

**Când apare**: După aprobare/respingere

**Tipuri**:
- **✅ Success**: "Modificación aprobada correctamente"
- **❌ Error**: "Error al procesar la solicitud"
- **⚠️ Warning**: "Atención: Esta acción no se puede deshacer"

---

## Comunicados

### Accesare

- **Rută**: `/comunicados`
- **Disponibilitate**: Pentru toți utilizatorii
- **Din Dashboard**: Click pe "Comunicados" din Quick Access Orb
- **Badge**: Număr de comunicados necitiți (dacă există)

### Funcționalități principale

#### 1. Lista de comunicados

**Card-uri comunicados**:
- **Titlu**: Titlul comunicatului
- **Preview**: Primele linii de conținut
- **Fecha**: Data publicării
- **Autor**: Cine a creat comunicatul
- **Badge "Nuevo"**: Dacă este necitit
- **Acțiuni**:
  - **👁️ Leer más**: Vezi comunicatul complet
  - **✅ Marcar como leído**: Marchează ca citit

**Filtre**:
- **Todos**: Toate comunicados
- **No leídos**: Doar necitiți
- **Leídos**: Doar citiți

**Căutare**:
- **Câmp text**: Caută după titlu sau conținut

#### 2. Vizualizare comunicado

**Când apare**: Click pe "👁️ Leer más"

**Conținut**:
- **Titlu**: Titlul complet
- **Contenido**: Conținutul complet (formatat)
- **Fecha publicación**: Data publicării
- **Autor**: Cine a creat
- **Adjuntos**: Fișiere atașate (dacă există)
- **Acțiuni**:
  - **⬇️ Descargar adjuntos**: Descarcă fișierele
  - **✅ Marcar como leído**: Marchează ca citit
  - **← Volver**: Revine la listă

**Pentru admini/manageri** (acțiuni suplimentare):
- **✏️ Editar**: Editează comunicatul
- **🗑️ Eliminar**: Șterge comunicatul
- **📢 Publicar**: Publică comunicatul (dacă este draft)
- **🔔 Notificar de nuevo**: Retrimite notificări push

#### 3. Creare comunicado (doar admini/manageri)

**Buton "➕ Nuevo Comunicado"**:
- **Disponibilitate**: Doar pentru admini, developeri, supervizori, manageri, RRHH
- **Funcție**: Deschide formularul de creare

**Formular**:
- **Câmpuri**:
  - **Título** (obligatoriu): Titlul comunicatului
  - **Contenido** (obligatoriu): Conținutul (editor rich text)
  - **Adjuntos** (opțional): Încarcă fișiere
  - **Fecha publicación** (opțional): Data publicării (implicit: acum)
  - **Publicar inmediatamente**: Checkbox pentru publicare imediată
- **Butoane**:
  - **💾 Guardar**: Salvează ca draft
  - **📢 Publicar**: Publică imediat
  - **Cancelar**: Anulează

**Editor rich text**:
- **Formatare**: Bold, italic, underline
- **Liste**: Bullet points, numbered lists
- **Link-uri**: Adaugă link-uri
- **Imagini**: Inserează imagini

#### 4. Editare comunicado

**Accesare**: Click pe "✏️ Editar" din pagina de detalii

**Funcționalitate**: Similar cu crearea, dar cu datele existente pre-completate

**Butoane**:
- **💾 Guardar Cambios**: Salvează modificările
- **Cancelar**: Anulează modificările

#### 5. Notificări push

**Cum funcționează**:
- Când un comunicado este publicat, toți angajații primesc o notificare push
- Notificarea apare în browser și pe aplicația mobilă
- Click pe notificare → Deschide comunicatul

**Buton "🔔 Notificar de nuevo"** (doar admini):
- **Funcție**: Retrimite notificări push pentru un comunicado deja publicat
- **Când folosești**: Când vrei să atragi atenția asupra unui comunicado vechi

### Funcții speciale

#### Marcare ca citit

**Cum funcționează**:
- Click pe "✅ Marcar como leído"
- Comunicatul este marcat ca citit
- Badge-ul "Nuevo" dispare
- Contorul de comunicados necitiți se actualizează

#### Descărcare adjuntos

**Cum funcționează**:
- Click pe "⬇️ Descargar adjuntos"
- Se descarcă toate fișierele atașate
- Dacă există mai multe fișiere, se descarcă ca arhivă ZIP

---

## Inspecciones

### Accesare

- **Rută**: `/inspecciones` (pentru manageri) sau `/mis-inspecciones` (pentru angajați)
- **Din Dashboard**: Click pe "Inspecciones" sau "Mis inspecciones" din Quick Access Orb

### Pentru angajați: Mis Inspecciones

#### Lista inspecții

**Card-uri inspecții**:
- **Título**: Titlul inspecției
- **Fecha**: Data inspecției
- **Estado**: Pendiente/Completada
- **Centro**: Centrul de lucru
- **Acțiuni**:
  - **👁️ Ver detalles**: Vezi detalii
  - **✏️ Completar**: Completează inspecția

#### Completare inspecție

**Formular**:
- **Câmpuri** (în funcție de tipul de inspecție):
  - Observaciones
  - Fotos (upload)
  - Checklist items
  - Firma (opțional)
- **Butoane**:
  - **💾 Guardar**: Salvează progresul
  - **✅ Completar**: Finalizează inspecția
  - **Cancelar**: Anulează

### Pentru manageri: Inspecciones

#### Lista inspecții

**Tabel**:
- **Coloane**:
  - Título
  - Fecha
  - Centro
  - Asignado a (Cui este asignată)
  - Estado
  - Acciones
- **Acțiuni**:
  - **👁️ Ver**: Vezi detalii
  - **✏️ Editar**: Editează inspecția
  - **🗑️ Eliminar**: Șterge inspecția
  - **📄 Descargar PDF**: Descarcă raportul

#### Creare inspecție nouă

**Buton "➕ Nueva Inspección"**:
- **Funcție**: Deschide formularul de creare

**Formular**:
- **Câmpuri**:
  - **Título** (obligatoriu)
  - **Tipo** (Tip inspecție)
  - **Centro** (obligatoriu)
  - **Fecha** (obligatoriu)
  - **Asignado a** (Cui este asignată)
  - **Descripción**
  - **Checklist items** (opțional)
- **Butoane**:
  - **💾 Guardar**: Salvează
  - **Cancelar**: Anulează

---

## Clientes

### Accesare

- **Rută**: `/clientes`
- **Disponibilitate**: Doar pentru manageri, supervizori, admini
- **Din Dashboard**: Click pe "Clientes" din Quick Access Orb

### Funcționalități principale

#### 1. Lista de clienți

**Tabel**:
- **Coloane**:
  - Nombre o Razón Social
  - NIF
  - Dirección
  - Teléfono
  - Email
  - Tipo (Cliente/Proveedor)
  - Acciones
- **Acțiuni**:
  - **👁️ Ver detalles**: Vezi detalii complete
  - **✏️ Editar**: Editează clientul
  - **🗑️ Eliminar**: Șterge clientul

#### 2. Căutare și filtrare

**Câmp căutare**:
- Caută după nume, NIF sau email

**Filtre**:
- **Tipo**: Cliente/Proveedor/Todos
- **Centro**: Filtrează după centru asociat

#### 3. Adăugare client nou

**Buton "➕ Nuevo Cliente"**:
- **Funcție**: Deschide formularul de adăugare

**Formular**:
- **Câmpuri obligatorii**:
  - Nombre o Razón Social
  - NIF
- **Câmpuri opționale**:
  - Dirección
  - Teléfono
  - Email
  - Tipo (Cliente/Proveedor)
- **Butoane**:
  - **Guardar**: Salvează
  - **Cancelar**: Anulează

#### 4. Detalii client

**Când apare**: Click pe "👁️ Ver detalles"

**Conținut**:
- **Informații generale**: Toate datele clientului
- **Contratos**: Lista contractelor asociate
- **Centros**: Centrele asociate
- **Empleados**: Angajații care lucrează pentru acest client

**Acțiuni**:
- **➕ Nuevo Contrato**: Adaugă un contract nou
- **📄 Ver contrato**: Vezi un contract
- **🗑️ Eliminar contrato**: Șterge un contract

---

## Estadísticas

### Accesare

- **Rută**: `/estadisticas`
- **Disponibilitate**: Doar pentru manageri, supervizori, admini
- **Din Dashboard**: Click pe "Estadísticas" din Quick Access Orb

### Tabs principale

#### Tab "General"

**Conținut**: Statistici generale

**Informații**:
- Număr total angajați
- Ore lucrate (total)
- Ore programate (total)
- Diferență ore
- Grafici și diagrame

#### Tab "Empleados"

**Conținut**: Statistici despre angajați

**Informații**:
- Angajați pe centro
- Angajați pe grupo
- Angajați activi vs. inactivi
- Grafici

**Butoane export**:
- **📊 Export Excel**
- **📄 Export PDF**

#### Tab "Fichajes"

**Conținut**: Statistici despre fichajes

**Informații**:
- Fichajes pe lună
- Media ore lucrate
- Zile cu probleme
- Grafici

#### Tab "Cuadrantes"

**Conținut**: Statistici despre programe

**Informații**:
- Programe generate
- Programe active
- Acoperire programe
- Grafici

### Funcții export

**Butoane disponibile**:
- **📊 Export Excel**: Descarcă statistici în Excel
- **📄 Export PDF**: Descarcă statistici în PDF
- **📈 Export Gráfico**: Descarcă doar graficele

---

## Pedidos

### Accesare

- **Rută**: `/pedidos` (pentru manageri) sau `/empleado-pedidos` (pentru angajați)
- **Din Dashboard**: Click pe "Pedidos" din Quick Access Orb

### Pentru angajați: Empleado Pedidos

#### Creare pedido nou

**Buton "➕ Nuevo Pedido"**:
- **Funcție**: Deschide formularul de creare

**Formular**:
- **Câmpuri**:
  - **Producto** (obligatoriu): Selectează din catalog
  - **Cantidad** (obligatoriu): Cantitatea
  - **Observaciones** (opțional)
- **Butoane**:
  - **💾 Guardar**: Salvează pedido
  - **Cancelar**: Anulează

#### Lista pedidos

**Card-uri pedidos**:
- **Producto**: Numele produsului
- **Cantidad**: Cantitatea
- **Fecha**: Data solicitării
- **Estado**: Pendiente/Aprobado/Rechazado
- **Acțiuni**:
  - **👁️ Ver detalles**: Vezi detalii
  - **✏️ Editar**: Editează (dacă este pendiente)
  - **🗑️ Eliminar**: Șterge (dacă este pendiente)

### Pentru manageri: Pedidos

#### Lista pedidos (toate)

**Tabel**:
- **Coloane**:
  - Empleado
  - Producto
  - Cantidad
  - Fecha
  - Estado
  - Acciones
- **Acțiuni**:
  - **✅ Aprobar**: Aprobă pedido
  - **❌ Rechazar**: Respinge pedido
  - **👁️ Ver detalles**: Vezi detalii

#### Gestionare catalog

**Tab "Catálogo"**:
- **Lista produse**:
  - Nombre
  - Descripción
  - Precio
  - Stock
  - Acciones
- **Acțiuni**:
  - **➕ Nuevo Producto**: Adaugă produs nou
  - **✏️ Editar**: Editează produs
  - **🗑️ Eliminar**: Șterge produs

---

## Chat AI

### Accesare

- **Disponibilitate**: Doar pentru manageri, supervizori, developeri
- **Locație**: Buton flotant în colțul dreapta jos (pe desktop)

### Funcționalități

#### Deschidere chat

**Buton "💬"**:
- **Funcție**: Deschide/închide chat-ul
- **Când apare**: Doar pentru utilizatorii cu permisiuni

#### Interacțiune

**Cum funcționează**:
1. Click pe buton "💬"
2. Se deschide fereastra de chat
3. Scrie întrebarea ta
4. Apasă Enter sau click pe "Send"
5. AI-ul răspunde

#### Funcții speciale

**Butoane de acțiune**:
- Unele răspunsuri AI includ butoane de acțiune
- Exemple:
  - "Descargar Excel": Descarcă un fișier Excel
  - "Ver estadísticas": Deschide pagina de statistici
  - "Generar reporte": Generează un raport

**Istoric**:
- Chat-ul păstrează istoricul conversației
- Poți continua conversația anterioară

---

## Admin Panel

### Accesare

- **Rută**: `/admin`
- **Disponibilitate**: Doar pentru admini și developeri
- **Din Dashboard**: Click pe "Admin Panel" din Quick Access Orb

### Funcționalități principale

#### 1. Gestionare permisiuni

**Tab "Permisos"**:
- **Lista grupuri**: Toate grupurile (Manager, Supervisor, etc.)
- **Module**: Toate modulele aplicației
- **Checkbox-uri**: Activează/dezactivează permisiuni
- **Butoane**:
  - **💾 Guardar**: Salvează modificările
  - **🔄 Reset**: Resetează la valorile implicite

#### 2. Activity Logs

**Tab "Activity Logs"**:
- **Lista acțiuni**: Toate acțiunile utilizatorilor
- **Filtre**:
  - Usuario (Utilizator)
  - Fecha (Data)
  - Acción (Acțiune)
- **Export**: Descarcă logs în Excel/PDF

#### 3. Gestionare utilizatori

**Tab "Usuarios"**:
- Similar cu pagina "Empleados"
- Funcții suplimentare pentru admini

#### 4. Configurare sistem

**Tab "Configuración"**:
- **Setări generale**:
  - Nombre empresa
  - Email contacto
  - Teléfono
- **Setări notificări**:
  - Activar/desactivar notificări push
  - Configurare email
- **Butoane**:
  - **💾 Guardar**: Salvează setările

---

## Salón de la Fama

### Accesare

- **Rută**: `/hall-of-fame`
- **Disponibilitate**: Pentru toți utilizatorii
- **Din Dashboard**: Click pe "Salón de la Fama" din Quick Access Orb

### Funcționalități

#### 1. Clasament lunar

**Lista angajați**:
- **Coloane**:
  - Posición (Poziție)
  - Nombre
  - Puntos (Puncte)
  - Badges (Insigne)
- **Sortare**: După puncte (descendent)

#### 2. Detalii angajat

**Click pe un angajat**:
- **Conținut**:
  - Puncte totale
  - Badges câștigate
  - Istoric performanță
  - Grafic evoluție

#### 3. Badges disponibile

**Lista badges**:
- **Tipuri**:
  - ⭐ Punctualidad (Punctualitate)
  - 💪 Esfuerzo (Efort)
  - 🎯 Objetivos (Obiective)
  - 🤝 Colaboración (Colaborare)
- **Cum se câștigă**: Automat bazat pe performanță

---

## Funcții generale

### Notificări

**Cum funcționează**:
- **Icon 🔔**: În header (desktop) sau meniu (mobil)
- **Badge**: Număr de notificări necitite
- **Click**: Deschide lista de notificări
- **Acțiuni**:
  - **👁️ Marcar como leída**: Marchează ca citită
  - **🗑️ Eliminar**: Șterge notificarea
  - **🔗 Ir a**: Mergi la pagina asociată

### Tema (Dark/Light Mode)

**Buton toggle**:
- **Locație**: În header (lângă notificări)
- **Funcție**: Schimbă între modul dark și light
- **Preferință**: Se salvează automat

### Logout

**Buton "Salir"**:
- **Locație**: În header (desktop) sau meniu (mobil)
- **Funcție**: Deconectează utilizatorul
- **Confirmare**: Nu (se deconectează imediat)

### Căutare globală

**Câmp căutare** (dacă este disponibil):
- **Funcție**: Caută în toată aplicația
- **Rezultate**: Pagini, angajați, documente, etc.

---

## Sfaturi și trucuri

### Navigare rapidă

1. **Quick Access Orb**: Folosește orb-ul din Dashboard pentru acces rapid
2. **Keyboard shortcuts**: 
   - `Ctrl/Cmd + K`: Căutare globală (dacă este disponibil)
   - `Esc`: Închide modale

### Gestionare eficientă

1. **Filtre**: Folosește filtrele pentru a găsi rapid informații
2. **Export**: Exportă datele când ai nevoie de backup
3. **Notificări**: Activează notificările push pentru a fi la curent

### Securitate

1. **Parolă**: Folosește o parolă puternică
2. **Logout**: Deconectează-te când termini
3. **Dispozitiv**: Nu partaja dispozitivul cu alții

---

## Suport și ajutor

### Reportare probleme

**Buton "Reportar error"** (dacă este disponibil):
- **Funcție**: Deschide WhatsApp pentru a raporta probleme
- **Număr**: +34 635 289 087

### Contact

- **Email**: info@decaminoservicios.com
- **Website**: https://decaminoservicios.com

---

## Concluzie

Acest manual acoperă toate funcționalitățile principale ale aplicației. Pentru întrebări suplimentare sau probleme, contactează echipa de suport.

**Versiune manual**: 1.0  
**Data actualizare**: 2025-01-XX  
**Aplicație**: De Camino Servicios Auxiliares Web App
