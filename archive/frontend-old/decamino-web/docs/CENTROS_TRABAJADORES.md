# 🏢 CENTROS DE TRABAJO Y TRABAJADORES - DeCamino

## 🎯 Descriere

Sistemul de centre de lucru și muncitori permite filtrarea automată a muncitorilor în funcție de centrul selectat în formularele de inspecție.

## 🏗️ Funcționalități

### 📋 Centre de Lucru Disponibile:
1. **Edificio A - Calle Mayor 123** (4 muncitori)
2. **Edificio B - Plaza España 45** (4 muncitori)
3. **Centro Comercial Plaza Norte** (4 muncitori)
4. **Oficinas Centrales DeCamino** (4 muncitori)
5. **Residencial Los Pinos** (4 muncitori)
6. **Centro de Negocios La Castellana** (4 muncitori)
7. **Edificio Corporativo Torre Norte** (4 muncitori)
8. **Complejo Residencial Marina** (4 muncitori)
9. **Centro Comercial Gran Plaza** (4 muncitori)
10. **Oficinas Parque Empresarial** (4 muncitori)

### 👥 Muncitori per Centru:

#### Edificio A - Calle Mayor 123:
- María García López
- Juan Carlos Rodríguez
- Ana Isabel Martínez
- Carlos Alberto Sánchez

#### Edificio B - Plaza España 45:
- Carmen Elena Torres
- Miguel Ángel Jiménez
- Isabel Cristina Ruiz
- Francisco Javier Moreno

#### Centro Comercial Plaza Norte:
- Rosa María Fernández
- Antonio José González
- Lucía Patricia Herrera
- Diego Alejandro Silva

#### Oficinas Centrales DeCamino:
- Elena Victoria Castro
- Roberto Carlos Mendoza
- Sofia Alejandra Rojas
- Hector Manuel Vargas

#### Residencial Los Pinos:
- Natalia Andrea Morales
- Ricardo Enrique Paredes
- Valentina Sofia Rios
- Andres Felipe Acosta

#### Centro de Negocios La Castellana:
- Carolina Patricia Vega
- Oscar Daniel Fuentes
- Daniela Marcela Ortiz
- Javier Ignacio Salazar

#### Edificio Corporativo Torre Norte:
- Monica Alejandra Guzman
- Felipe Andres Herrera
- Camila Valentina Rojas
- Sebastian Alejandro Torres

#### Complejo Residencial Marina:
- Laura Marcela Silva
- Carlos Eduardo Mendoza
- Ana Sofia Castro
- David Alejandro Rios

#### Centro Comercial Gran Plaza:
- Maria Fernanda Lopez
- Jorge Luis Rodriguez
- Sofia Camila Martinez
- Alejandro Jose Sanchez

#### Oficinas Parque Empresarial:
- Valeria Andrea Torres
- Diego Fernando Jimenez
- Natalia Sofia Ruiz
- Carlos Alberto Moreno

## 🔄 Comportament

### 1. **Selecția Centrului:**
- Utilizatorul selectează un centru din dropdown
- Se afișează numărul de muncitori pentru fiecare centru
- Câmpul TRABAJADOR se activează doar după selecția centrului

### 2. **Filtrarea Muncitorilor:**
- Când se selectează un centru, lista de muncitori se filtrează automat
- Se afișează doar muncitorii care lucrează în centrul selectat
- Câmpul TRABAJADOR se resetează când se schimbă centrul

### 3. **Informații Contextuale:**
- Se afișează centrul selectat
- Se afișează numărul de muncitori disponibili
- Interfața este intuitivă și user-friendly

## 💾 Structura Datelor

### Format JSON pentru Centre:
```json
{
  "centros": [
    "Edificio A - Calle Mayor 123",
    "Edificio B - Plaza España 45",
    "Centro Comercial Plaza Norte",
    "Oficinas Centrales DeCamino",
    "Residencial Los Pinos",
    "Centro de Negocios La Castellana",
    "Edificio Corporativo Torre Norte",
    "Complejo Residencial Marina",
    "Centro Comercial Gran Plaza",
    "Oficinas Parque Empresarial"
  ]
}
```

### Format JSON pentru Muncitori:
```json
{
  "trabajadoresPorCentro": {
    "Edificio A - Calle Mayor 123": [
      "María García López",
      "Juan Carlos Rodríguez",
      "Ana Isabel Martínez",
      "Carlos Alberto Sánchez"
    ],
    "Edificio B - Plaza España 45": [
      "Carmen Elena Torres",
      "Miguel Ángel Jiménez",
      "Isabel Cristina Ruiz",
      "Francisco Javier Moreno"
    ]
  }
}
```

## 🚀 Integrare API

Pentru integrare cu backend real:

```javascript
// Încarcă centrele de la API
const loadCentros = async () => {
  try {
    const response = await fetch('/api/centros');
    const centros = await response.json();
    setCentrosTrabajo(centros);
  } catch (error) {
    console.error('Error loading centros:', error);
  }
};

// Încarcă muncitorii de la API
const loadTrabajadores = async () => {
  try {
    const response = await fetch('/api/trabajadores');
    const trabajadores = await response.json();
    setTrabajadoresPorCentro(trabajadores);
  } catch (error) {
    console.error('Error loading trabajadores:', error);
  }
};
```

## 🎨 UI/UX Features

### 1. **Dropdown Inteligent:**
- Afișează numărul de muncitori pentru fiecare centru
- Format: "Centro (X trabajadores)"

### 2. **Validare Contextuală:**
- TRABAJADOR este disabled până se selectează un CENTRO
- Mesaje clare pentru utilizator

### 3. **Feedback Vizual:**
- Card informativ cu centrul selectat
- Numărul de muncitori disponibili
- Stare de loading pentru încărcarea datelor

### 4. **Responsive Design:**
- Funcționează pe desktop, tablet și mobile
- Dropdown-uri optimizate pentru touch

## 🔧 Configurare

### Adăugare Centru Nou:
```javascript
// În InspectionForm.jsx
const CENTROS_TRABAJO = [
  // ... centrele existente
  'Nuevo Centro - Dirección 123'
];

const TRABAJADORES_POR_CENTRO = {
  // ... muncitorii existenți
  'Nuevo Centro - Dirección 123': [
    'Nuevo Trabajador 1',
    'Nuevo Trabajador 2'
  ]
};
```

### Modificare Muncitori:
```javascript
// Pentru a adăuga muncitori la un centru existent
TRABAJADORES_POR_CENTRO['Edificio A - Calle Mayor 123'].push('Nuevo Trabajador');
```

## 📊 Statistici

- **10 centre** de lucru
- **40 muncitori** în total
- **4 muncitori** per centru (în medie)
- **Filtrare automată** în timp real
- **Validare contextuală** completă

## 🎯 Beneficii

1. **Eficiență:** Nu mai trebuie să cauți muncitorii manual
2. **Precizie:** Doar muncitorii corecți sunt afișați
3. **Viteză:** Selecția este rapidă și intuitivă
4. **Validare:** Elimină erorile de selecție
5. **UX:** Interfața este clară și ușor de folosit

---

**Status:** ✅ Implementat complet
**Testat:** ✅ Funcțional
**Documentat:** ✅ Complet 