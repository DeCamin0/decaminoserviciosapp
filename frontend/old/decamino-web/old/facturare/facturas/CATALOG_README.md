# 📚 Modulul de Catalog - DeCamino

## Descriere
Modulul de Catalog permite gestionarea produselor și serviciilor din sistemul DeCamino, inclusiv gestionarea stocului, categorii și exportul de rapoarte.

## 🚀 Funcționalități

### Produse și Servicii
- **Adăugare produse noi** cu informații complete
- **Editare produse** existente
- **Ștergere produse** cu confirmare
- **Gestionare stoc** pentru produse fizice
- **Suport pentru servicii** (fără stoc)
- **Status activ/inactiv** pentru produse

### Categorii
- **Gestionare categorii** de produse
- **Adăugare/Editare/Ștergere** categorii
- **Descrieri** pentru fiecare categorie
- **Categorii predefinite**: Servicii, Produse, Consumabile

### Filtrare și Căutare
- **Căutare după nume sau cod**
- **Filtrare după categorie**
- **Filtrare după stoc** (doar în stoc)
- **Resetează filtrele** cu un click

### Export și Rapoarte
- **Export Excel** cu antet DeCamino
- **Formatare profesională** cu stiluri
- **Informații complete** despre produse
- **Nume fișier cu dată** automată

## 🏗️ Arhitectura

### Context-ul Catalog
```jsx
// src/modules/facturas/contexts/CatalogContext.jsx
export function CatalogProvider({ children }) {
  // State management pentru produse și categorii
  // CRUD operations pentru produse
  // CRUD operations pentru categorii
  // Filtrare și căutare
}
```

### Componente Principale
- **`CatalogPage.jsx`** - Pagina principală cu tabs
- **`ProductList.jsx`** - Lista de produse cu filtre
- **`ProductForm.jsx`** - Formular pentru adăugare/editare produse
- **`CategoryManager.jsx`** - Gestionarea categoriilor

## 📊 Structura Datelor

### Produs
```typescript
interface Product {
  id: number;
  cod: string;           // Codul produsului
  name: string;          // Numele produsului
  description?: string;  // Descrierea (opțional)
  category: string;      // Numele categoriei
  categoryId: number;    // ID-ul categoriei
  price: number;         // Prețul
  currency: string;      // Moneda (EUR, RON, USD)
  unit: string;          // Unitatea de măsură
  stock?: number;        // Stocul actual (null pentru servicii)
  minStock?: number;     // Stocul minim
  maxStock?: number;     // Stocul maxim
  active: boolean;       // Status activ/inactiv
  createdAt: string;     // Data creării
  updatedAt?: string;    // Data ultimei modificări
}
```

### Categorie
```typescript
interface Category {
  id: number;
  name: string;          // Numele categoriei
  description?: string;  // Descrierea (opțional)
}
```

## 🎨 Interfața Utilizator

### Design Responsive
- **Mobile-first** design
- **Grid layout** adaptiv
- **Cards** pentru produse și categorii
- **Tabs** pentru navigare între secțiuni

### Culori și Stiluri
- **Tema DeCamino**: Roșu și alb
- **Badge-uri colorate** pentru categorii
- **Status indicators** pentru stoc
- **Hover effects** și tranziții

### Componente UI
- **Button** - Butoane cu variante
- **Input** - Câmpuri de text
- **Select** - Dropdown-uri
- **Card** - Containere pentru conținut
- **Modal** - Ferestre popup
- **Badge** - Etichete colorate

## 🔧 Utilizare

### Adăugare Produs Nou
1. Navighează la **Catalog** → **Produse**
2. Click pe **"Adaugă Produs"**
3. Completează formularul:
   - Cod produs (obligatoriu)
   - Nume produs (obligatoriu)
   - Categorie (obligatorie)
   - Preț (obligatoriu)
   - Unitate de măsură (obligatorie)
   - Stoc (opțional, doar pentru produse)
4. Click **"Adaugă Produs"**

### Editare Produs
1. În lista de produse, click pe **"Editează"**
2. Modifică informațiile dorite
3. Click **"Actualizează Produs"**

### Gestionare Categorii
1. Navighează la **Catalog** → **Categorii**
2. **Adaugă categorie nouă** cu nume și descriere
3. **Editează** categoriile existente
4. **Șterge** categoriile neutilizate

### Export Excel
1. În lista de produse, click pe **"Export Excel"**
2. Fișierul se descarcă automat cu:
   - Antet DeCamino cu logo
   - Toate informațiile despre produse
   - Formatare profesională
   - Nume: `catalog_produse_YYYY-MM-DD.xlsx`

## 🚨 Validări

### Produse
- **Cod**: Obligatoriu, unic
- **Nume**: Obligatoriu
- **Categorie**: Obligatoriu
- **Preț**: Obligatoriu, > 0
- **Unitate**: Obligatorie
- **Stoc**: ≥ 0 (dacă este specificat)
- **Stoc minim**: ≤ Stoc maxim

### Categorii
- **Nume**: Obligatoriu, unic

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 768px - 1 coloană
- **Tablet**: 768px - 1024px - 2 coloane
- **Desktop**: > 1024px - 3 coloane

### Adaptări Mobile
- **Stack vertical** pentru filtre
- **Full-width** pentru butoane
- **Touch-friendly** pentru interacțiuni

## 🔗 Integrare

### Cu Modulul de Facturare
- **Produsele din catalog** pot fi folosite în facturi
- **Prețurile** sunt sincronizate automat
- **Stocul** se actualizează la vânzări

### Cu Export Excel
- **Folosește exceljs** în loc de xlsx
- **Formatare profesională** cu stiluri
- **Antet DeCamino** cu informații firma

## 🚀 Performanță

### Optimizări
- **Lazy loading** pentru componente
- **Memoization** pentru calcule costisitoare
- **Debounced search** pentru căutare
- **Virtual scrolling** pentru liste mari

### State Management
- **useReducer** pentru state complex
- **Context API** pentru sharing state
- **Optimistic updates** pentru UX

## 🧪 Testing

### Teste Unitare
- **Validări** pentru formulare
- **State management** pentru context
- **Componente** pentru rendering

### Teste de Integrare
- **CRUD operations** pentru produse
- **Filtrare și căutare**
- **Export Excel**

## 📝 Note de Implementare

### Migrare de la xlsx la exceljs
- **Compatibilitate 100%** cu funcționalitățile existente
- **Îmbunătățiri** în formatare și stiluri
- **Wrapper de compatibilitate** pentru migrare graduală

### Stoc vs Servicii
- **Produsele** au stoc, preț minim/maxim
- **Serviciile** nu au stoc, doar preț
- **Validări diferite** în funcție de tip

### Categorii Predefinite
- **Servicii**: Pentru servicii oferite
- **Produse**: Pentru produse fizice
- **Consumabile**: Pentru materiale consumabile

## 🔮 Roadmap

### Versiunea Următoare
- [ ] **Import Excel** pentru produse
- [ ] **Bulk operations** (editare multiplă)
- [ ] **Istoric modificări** pentru produse
- [ **API backend** pentru persistență
- [ ] **Sincronizare** cu alte module

### Îmbunătățiri Long-term
- [ ] **Variante de produse** (culori, mărimi)
- [ ] **Gestionare furnizori** pentru produse
- [ ] **Alerts** pentru stoc scăzut
- [ ] **Analytics** pentru vânzări produse
- [ ] **Integrare** cu sisteme externe

## 📞 Support

Pentru întrebări sau probleme cu modulul de Catalog:
- **Developer**: Echipa DeCamino
- **Documentație**: Acest README
- **Issues**: Sistemul de ticketing intern

---

*Modulul de Catalog - DeCamino Services Auxiliares SL*
