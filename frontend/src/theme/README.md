# 🎨 Sistemul de Culori DeCamino

## 📋 Prezentare Generală

Sistemul de culori DeCamino este proiectat să fie complet consistent între:
- `src/theme.js` - Variabilele de culori
- `tailwind.config.js` - Configurația Tailwind CSS
- `src/utils/colors.js` - Utilități pentru culori
- Toate componentele React

## 🌈 Paleta de Culori

### Culori Primare (Roșii)
```javascript
primary: {
  50: '#fef2f2',   // Very light red
  100: '#fee2e2',  // Light red
  200: '#fecaca',  // Lighter red
  300: '#fca5a5',  // Light red
  400: '#f87171',  // Medium light red
  500: '#E53935',  // DeCamino primary red ⭐
  600: '#dc2626',  // Darker red
  700: '#b91c1c',  // Dark red
  800: '#991b1b',  // Very dark red
  900: '#7f1d1d',  // Darkest red
}
```

### Culori Secundare (Griuri)
```javascript
secondary: {
  50: '#ffffff',   // Pure white
  100: '#fafafa',  // Very light gray
  200: '#f5f5f5',  // DeCamino background ⭐
  300: '#e5e5e5',  // Light gray
  400: '#d4d4d4',  // Medium light gray
  500: '#737373',  // Medium gray
  600: '#525252',  // Medium dark gray
  700: '#404040',  // Dark gray
  800: '#262626',  // Very dark gray
  900: '#171717',  // Darkest gray
}
```

### Culori Semantice
```javascript
success: '#4CAF50',    // Green
warning: '#FF9800',    // Orange
error: '#F44336',      // Red
info: '#2196F3',       // Blue
border: '#E0E0E0',     // Light gray border
shadow: 'rgba(0, 0, 0, 0.1)', // Shadow
```

## 🎯 Utilizare în Componente

### Clase Tailwind CSS
```jsx
// În loc de culori hardcodate
<div className="bg-red-600 text-red-600 border-red-600">

// Folosește noile clase DeCamino
<div className="bg-primary-500 text-primary-500 border-primary-500">
```

### Import din Utilități
```jsx
import { BUTTON_COLORS, TEXT_COLORS } from '../utils/colors';

// Butoane predefinite
<button className={`px-4 py-2 rounded ${BUTTON_COLORS.primary}`}>
  Salvează
</button>

// Text colorat
<span className={TEXT_COLORS.primary}>Text important</span>
```

### Import din Theme
```jsx
import { TAILWIND_COLORS } from '../theme';

// Culori primare
<div className={TAILWIND_COLORS.primary[500]}>
  Conținut cu culoarea primară
</div>
```

## 🔧 Configurare

### Tailwind Config
```javascript
// tailwind.config.js
colors: {
  primary: {
    500: '#E53935',  // DeCamino red
    // ... restul culorilor
  },
  secondary: {
    200: '#F5F5F5',  // DeCamino background
    // ... restul culorilor
  }
}
```

### CSS Variables (opțional)
```css
:root {
  --color-primary: #E53935;
  --color-primary-light: #FFCDD2;
  --color-secondary: #FFFFFF;
  --color-background: #F5F5F5;
}
```

## 📱 Responsive Design

### Breakpoints
```javascript
// Tailwind default breakpoints
sm: '640px'   // Mobile landscape
md: '768px'   // Tablet
lg: '1024px'  // Desktop
xl: '1280px'  // Large desktop
2xl: '1536px' // Extra large
```

### Dark Mode (viitor)
```javascript
// Pentru implementarea viitoare
dark: {
  primary: {
    500: '#dc2626',  // Darker red pentru dark mode
  }
}
```

## 🚀 Best Practices

### 1. Consistență
- Folosește întotdeauna clasele DeCamino în loc de culori hardcodate
- Menține consistența între toate componentele

### 2. Accesibilitate
- Asigură-te că contrastul este suficient (WCAG AA)
- Testează cu screen readers

### 3. Performance
- Tailwind purge-ază automat culorile neutilizate
- Nu adăuga culori custom fără să fie necesare

### 4. Maintainability
- Actualizează culorile doar în `theme.js` și `tailwind.config.js`
- Documentează orice schimbare de culori

## 🔍 Verificare Consistență

### Comandă de Build
```bash
npm run build
```

### Linting
```bash
npm run lint
```

### Testare Vizuală
- Verifică că toate componentele folosesc noile culori
- Testează pe diferite dimensiuni de ecran
- Verifică contrastul și accesibilitatea

## 📚 Resurse

- [Tailwind CSS Colors](https://tailwindcss.com/docs/customizing-colors)
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [DeCamino Brand Guidelines](https://decaminoservicios.com)
