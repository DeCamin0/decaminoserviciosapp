# 🚀 DeCamino Web

Aplicație web React pentru managementul proiectelor DeCamino.

## 🛠️ Tehnologii

- **React 18** - Framework pentru UI
- **Vite** - Build tool și dev server
- **TailwindCSS** - Framework CSS pentru styling
- **React Router v6** - Rutare pentru aplicație
- **Context API** - State management pentru autentificare

## 🚀 Instalare și Rulare

### 1. Instalează dependențele
```bash
npm install
```

### 2. Rulează aplicația în mod development
```bash
npm run dev
```

### 3. Deschide browser-ul
Aplicația va fi disponibilă la `http://localhost:5173`

## 🔐 Autentificare Demo

Pentru a testa aplicația, folosește:
- **Email**: orice adresă de email validă (ex: `test@example.com`)
- **Parolă**: `1234`

## 📁 Structura Proiectului

```
src/
├── components/          # Componente reutilizabile
│   ├── MainLayout.jsx  # Layout principal cu navbar
│   └── ProtectedRoute.jsx # Protecție pentru rute
├── contexts/           # Context API
│   └── AuthContext.jsx # Context pentru autentificare
├── pages/              # Pagini ale aplicației
│   ├── LoginPage.jsx   # Pagina de autentificare
│   └── DashboardPage.jsx # Dashboard principal
├── App.jsx             # Componenta principală cu rutare
├── main.jsx           # Punct de intrare
└── index.css          # Stiluri globale
```

## ✨ Funcționalități

### 🔐 Autentificare
- Formular de login cu email și parolă
- Simulare login local (orice email + parola "1234")
- Persistența stării în localStorage
- Redirecționare automată după autentificare

### 🛡️ Protecție Pagini
- Paginile interne sunt accesibile doar utilizatorilor autentificați
- Redirecționare automată către `/login` pentru utilizatori neautentificați
- Protecție completă a rutelor

### 🎨 Layout General
- Navbar cu titlu și buton logout
- Layout consistent pentru toate paginile interne
- Design responsive cu TailwindCSS

## 🎯 Rute

- `/` - Redirect către dashboard sau login
- `/login` - Pagina de autentificare
- `/dashboard` - Dashboard principal (protejat)
- `/*` - Catch all - redirect către dashboard sau login

## 🔧 Scripturi Disponibile

- `npm run dev` - Rulează serverul de development
- `npm run build` - Construiește aplicația pentru producție
- `npm run preview` - Preview pentru build-ul de producție
- `npm run lint` - Rulează ESLint pentru verificarea codului

## 🎨 Design System

Aplicația folosește un design system consistent cu:
- **Culori primare**: Albastru (primary-600)
- **Culori secundare**: Gri (gray-500)
- **Componente**: Butoane, input-uri, card-uri cu stiluri predefinite
- **Responsive**: Design adaptat pentru mobile și desktop

## 🔄 State Management

- **AuthContext**: Gestionează starea utilizatorului și funcțiile de login/logout
- **useAuth Hook**: Hook personalizat pentru accesul la contextul de autentificare
- **Persistență**: Starea utilizatorului este salvată în localStorage

## 🚀 Următorii Pași

Aplicația este pregătită pentru extindere cu:
- Pagini suplimentare (proiecte, utilizatori, etc.)
- Integrare cu API backend
- Funcționalități de management de proiecte
- Sistem de notificări
- Profil utilizator 