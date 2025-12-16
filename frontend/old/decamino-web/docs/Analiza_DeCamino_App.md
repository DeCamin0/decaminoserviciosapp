# 📊 Analiză Aplicație React Native – DeCamino

## ✅ Paginile principale

### 🏠 **HomeScreen (ListaSolicitudesScreen)**
- **Descriere**: Pagina principală pentru gestionarea solicitărilor de vacanță și asunto propio
- **Funcționalități**:
  - Listare solicitări cu filtrare după tip (Vacaciones/Asunto Propio)
  - Filtrare după status (Pendiente/Aprobada/Rechazada) pentru manageri
  - Filtrare după lună și utilizator
  - Export CSV și PDF pentru manageri
  - Aprobare/respingere solicitări pentru manageri
  - Verificare alerte pentru pontaje incomplete

### 👤 **DatosScreen**
- **Descriere**: Pagina de profil și date personale ale utilizatorului
- **Funcționalități**: Afișare informații personale și statistici individuale

### 📝 **AddSolicitudScreen**
- **Descriere**: Formular pentru adăugarea de noi solicitări
- **Funcționalități**:
  - Creare solicitări de tip Vacaciones sau Asunto Propio
  - Validări specifice pentru fiecare tip de solicitare
  - Integrare cu API-ul n8n pentru salvare

### ⏰ **FicharScreen**
- **Descriere**: Sistem de pontaj cu geolocație
- **Funcționalități**:
  - Pontaj intrare/ieșire cu locație GPS
  - Istoric pontaje pentru utilizator
  - Gestionare pontaje pentru manageri (Registros Empleados)
  - Export pontaje în CSV/PDF

### 📅 **GenerarCuadranteScreen**
- **Descriere**: Generare automată de cuadrante (programe de lucru)
- **Funcționalități**:
  - Configurare rotații (3cu2, 4cu3, 5cu2, etc.)
  - Setări per angajat (ora start, durată tură)
  - Generare cuadrante pentru luni întregi
  - Previzualizare înainte de salvare

### 📊 **EstadisticasScreen**
- **Descriere**: Dashboard cu statistici comprehensive
- **Funcționalități**:
  - Statistici generale (total angajați, pontaje, solicitări)
  - Statistici per angajat și per centru
  - Analize detaliate pentru fichajes, cuadrantes, solicitudes
  - Navigare între diferite tipuri de statistici

### 👥 **AddUserScreen**
- **Descriere**: Gestionare utilizatori (doar pentru manageri)
- **Funcționalități**: Adăugare și editare utilizatori

### 📄 **DocumentosScreen**
- **Descriere**: Gestionare documente și semnături
- **Funcționalități**: Upload, download și semnare documente

## 🧩 Componente reutilizabile

### 🎨 **BannerAlerte**
- **Descriere**: Componentă pentru afișarea alertelor și erorilor
- **Props**: `erori` (array de mesaje)
- **Funcționalități**: Afișare alertă cu posibilitate de închidere

### 🎯 **UserContext**
- **Descriere**: Context React pentru gestionarea stării utilizatorului
- **Funcționalități**: 
  - Stocare informații utilizator (email, isManager, role)
  - Persistență în localStorage
  - Provider pentru întreaga aplicație

### 🎨 **Theme System**
- **Descriere**: Sistem de culori și stiluri consistente
- **Culori principale**:
  - `primary: '#E53935'` (roșu principal)
  - `primaryLight: '#FFCDD2'` (roșu deschis)
  - `white: '#fff'`
  - `gray: '#e5e7eb'`
  - `darkText: '#222'`

### 📱 **Navigation Components**
- **TabNavigator**: Navigare cu tab-uri pentru funcționalități principale
- **StackNavigator**: Navigare între pagini cu back button
- **MaterialTopTabs**: Tab-uri pentru secțiuni complexe (FicharScreen)

## 👥 Roluri definite în aplicație

### 👤 **EMPLEADO (Angajat)**
- **Permisiuni**:
  - Vizualizare propriile solicitări
  - Adăugare solicitări noi
  - Pontaj personal (Entrada/Salida)
  - Vizualizare cuadrante personale
  - Acces la documente personale
  - Statistici personale

### 👔 **SUPERVISOR (Manager)**
- **Permisiuni**:
  - Toate permisiunile angajaților
  - Gestionare toate solicitările
  - Aprobare/respingere solicitări
  - Gestionare pontaje pentru toți angajații
  - Generare cuadrante
  - Adăugare utilizatori noi
  - Statistici complete și raportări
  - Export date în CSV/PDF

### 🛠️ **Developer (Rol implicit)**
- **Permisiuni**: Acces complet la toate funcționalitățile

## 🔗 Funcționalități externe

### 🔄 **n8n Workflows**
- **Endpoint-uri principale**:
  - `https://n8n.decaminoservicios.com/webhook/lista-solicitudes` - Listare solicitări
  - `https://n8n.decaminoservicios.com/webhook/actualizar-estado` - Actualizare status solicitări
  - `https://n8n.decaminoservicios.com/webhook/solicitud-empleados` - Adăugare solicitări
  - `https://n8n.decaminoservicios.com/webhook/get-registros-EgZjaHJv` - Obținere pontaje
  - `https://n8n.decaminoservicios.com/webhook/get-cuadrantes-yyBov0qVQZEhX2TL` - Obținere cuadrante
  - `https://n8n.decaminoservicios.com/webhook/aec36db4-58d4-4175-8429-84d1c487e142` - Listare angajați

### 📊 **Google Sheets Integration**
- **Funcționalități**:
  - Salvare automată solicitări
  - Salvare pontaje cu geolocație
  - Salvare cuadrante generate
  - Sincronizare date angajați

### 📄 **Document Management**
- **Funcționalități**:
  - Upload documente
  - Semnare electronică
  - Download și sharing
  - Gestionare versiuni

### 📍 **Geolocație**
- **Funcționalități**:
  - Captare locație GPS la pontaj
  - Reverse geocoding pentru adrese
  - Validare locație pentru pontaje

## ⚙️ Reguli logice personalizate

### 📅 **Generare Cuadrante**
- **Rotații disponibile**:
  - `3cu2`: 3 zile muncă, 2 zile libere
  - `4cu3`: 4 zile muncă, 3 zile libere
  - `5cu2`: 5 zile muncă, 2 zile libere
  - `2cu2`: 2 zile muncă, 2 zile libere
  - `6cu3`, `3cu6`, `4cu4`: Rotații suplimentare

- **Reguli de generare**:
  - Continuare de la starea finală a lunii precedente
  - Configurare ora start și durată tură per angajat
  - Zile libere marcate ca "LIBRE"
  - Ture marcate ca "T1 08:00-16:00" (exemplu)

### ⏰ **Pontaj Orar**
- **Validări**:
  - Verificare intrare înainte de ieșire
  - Calcul diferență între intrare și ieșire
  - Comparare cu programul din cuadrante
  - Alertă pentru zile lucrătoare fără pontaj complet

- **Calcul statistici**:
  - Total ore lucrate per zi/lună
  - Diferențe vs. programul planificat
  - Overtime și undertime

### 📊 **Calcul Statistici**
- **Statistici generale**:
  - Total angajați activi/inactivi
  - Pontaje zilnice (entradas/salidas)
  - Solicitări pendiente/aprobadas/rechazadas
  - Cuadrante active

- **Statistici per angajat**:
  - Pontaje totale și per lună
  - Solicitări și status-uri
  - Ore lucrate vs. programate

- **Statistici per centru**:
  - Agregare date per centru de lucru
  - Comparații între centre

### ✅ **Validări Specifice Solicitări**

#### 🏖️ **Vacaciones**
- **Validări**:
  - Maxim 31 zile consecutive
  - Data fin >= data inicio
  - Status automat "Pendiente" (necesită aprobare)

#### 🏠 **Asunto Propio**
- **Validări**:
  - Minim 5 zile înainte de data solicitată
  - Status automat "Aprobada" (nu necesită aprobare)
  - Maxim 1 zi per solicitare

## 🗂️ Structură recomandată de foldere pentru viitoarea aplicație React Web

```
src/
├── components/
│   ├── common/
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Modal.jsx
│   │   ├── Loading.jsx
│   │   └── Alert.jsx
│   ├── layout/
│   │   ├── Header.jsx
│   │   ├── Sidebar.jsx
│   │   ├── Navigation.jsx
│   │   └── Footer.jsx
│   ├── forms/
│   │   ├── SolicitudForm.jsx
│   │   ├── UserForm.jsx
│   │   └── CuadranteForm.jsx
│   └── charts/
│       ├── StatisticsChart.jsx
│       ├── FichajesChart.jsx
│       └── CuadranteChart.jsx
├── pages/
│   ├── auth/
│   │   ├── Login.jsx
│   │   └── RoleSelect.jsx
│   ├── dashboard/
│   │   ├── Home.jsx
│   │   ├── Statistics.jsx
│   │   └── Profile.jsx
│   ├── solicitudes/
│   │   ├── List.jsx
│   │   ├── Add.jsx
│   │   └── Detail.jsx
│   ├── fichajes/
│   │   ├── Personal.jsx
│   │   ├── Management.jsx
│   │   └── Reports.jsx
│   ├── cuadrantes/
│   │   ├── Generate.jsx
│   │   ├── Preview.jsx
│   │   └── View.jsx
│   └── admin/
│       ├── Users.jsx
│       ├── Settings.jsx
│       └── Reports.jsx
├── hooks/
│   ├── useAuth.js
│   ├── useSolicitudes.js
│   ├── useFichajes.js
│   └── useStatistics.js
├── services/
│   ├── api.js
│   ├── auth.js
│   ├── solicitudes.js
│   ├── fichajes.js
│   └── cuadrantes.js
├── utils/
│   ├── constants.js
│   ├── helpers.js
│   ├── validators.js
│   └── formatters.js
├── context/
│   ├── AuthContext.js
│   ├── UserContext.js
│   └── ThemeContext.js
├── styles/
│   ├── theme.js
│   ├── global.css
│   └── components.css
└── assets/
    ├── images/
    ├── icons/
    └── logos/
```

## 📋 Dependințe și tehnologii utilizate

### 📦 **Dependințe principale**
- `react-native`: 0.79.5
- `expo`: 53.0.20
- `@react-navigation/*`: Navigare
- `axios`: HTTP requests
- `react-native-vector-icons`: Iconuri
- `expo-location`: Geolocație
- `expo-print`: Generare PDF
- `expo-sharing`: Sharing fișiere
- `expo-file-system`: Gestionare fișiere

### 🎨 **UI/UX**
- Tema roșu-albă (#E53935 + #fff)
- Design modern cu carduri și umbre
- Responsive pentru web și mobile
- Iconuri MaterialCommunityIcons

### 🔧 **Arhitectură**
- React Native cu Expo
- Context API pentru state management
- Navigation cu React Navigation
- API integration cu n8n workflows
- LocalStorage pentru persistență

---

**📅 Data generării**: 19 Decembrie 2024

**🔍 Analiză realizată de**: AI Assistant

**📝 Notă**: Această analiză oferă o privire de ansamblu asupra aplicației React Native DeCamino, inclusiv funcționalitățile, componentele și structura recomandată pentru migrarea către o aplicație React Web. 