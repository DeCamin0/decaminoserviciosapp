# Idei & Features Viitoare

Acest fișier conține idei și features propuse pentru implementare ulterioară.

---

## 📥 Export Cuadrante Individual (CuadrantesEmpleadoPage)

**Data propunere:** 2026-01-30  
**Status:** 📝 Notat pentru implementare ulterioară

### Descriere
Adăugare buton de export în pagina `CuadrantesEmpleadoPage` pentru ca angajatul să poată:
- Descărcare cuadrante lunii selectate în format **PDF**
- Descărcare cuadrante lunii selectate în format **Excel**
- Trimite cuadrante pe email (PDF sau Excel)

### Locație UI
Buton lângă selectorul de lună (după linia 3672 în `CuadrantesEmpleadoPage.jsx`)

**UI propus:**
```
[📅 Selector Luna] [📥 Exportar ▼]
```

**Dropdown:**
- 📄 Descargar PDF
- 📊 Descargar Excel  
- ✉️ Enviar por email

### Backend - Endpoint-uri necesare

#### 1. Export PDF
```
GET /api/cuadrantes/export/pdf?codigo={CODIGO}&mes={YYYY-MM}
```
- Returnează PDF cu cuadrantul lunii pentru angajatul logat

#### 2. Export Excel
```
GET /api/cuadrantes/export/excel?codigo={CODIGO}&mes={YYYY-MM}
```
- Returnează Excel cu cuadrantul lunii

#### 3. Trimite email cu cuadrante
```
POST /api/cuadrantes/send-email
Body: { codigo, mes, format: 'pdf' | 'excel', emailDestinatario? }
```
- Generează PDF/Excel și trimite pe email (angajatului sau altui destinatar)

### Structură Excel

**Sheet 1: "Cuadrante {Luna}"**

| Zi | Data | Ziua Săptămânii | Status | Orar Programat | Entrada | Salida | Total Ore | Observații |
|----|------|-----------------|--------|----------------|---------|--------|-----------|-------------|
| 1  | 2026-01-01 | Miércoles | LIBRE | - | - | - | 0h | Fiesta |
| 2  | 2026-01-02 | Jueves | 8h | 08:00-16:00 | 08:05 | 16:10 | 8.08h | - |
| 3  | 2026-01-03 | Viernes | Vacaciones | - | - | - | 0h | - |

**Formatare:**
- Header: bold, fundal gri
- Status: culori (verde=laborable, roșu=libre, galben=sin fichar, albastru=vacaciones)
- Coloane: lățimi ajustate
- Total ore: sumă la final

**Sheet 2: "Resumen" (opțional)**
- Total ore programate
- Total ore lucrate
- Total zile libere
- Total zile vacaciones
- Total zile sin fichar

### Structură PDF

**Header:**
```
DE CAMINO SERVICIOS AUXILIARES
CUADRANTE MENSUAL - {NOMBRE} ({CODIGO})
Período: {Luna} (ex: Enero 2026)
Centro: {CENTRO}
```

**Tabel principal:**
- 7 coloane: Zi | Data | Status | Orar | Entrada | Salida | Total
- Grid cu linii
- Paginare automată (max 31 rânduri)

**Footer:**
```
Total Horas Programadas: {TotalHoras din cuadrante}
Total Horas Trabajadas: {sumă din fichajes}
Generado el: {data curentă}
```

### Date necesare pentru export

Pentru fiecare zi din lună (1-31):
- **Status din cuadrante:** `ZI_1` până la `ZI_31` (ex: "LIBRE", "8h", "Vacaciones", "Asunto Propio", "Baja Médica")
- **Fichajes:** din tabela `Fichaje` (ENTRADA/SALIDA, HORA, DURACION)
- **Ausencias:** din tabela `Ausencias` (TIPO, FECHA)
- **Informații angajat:** NOMBRE, CODIGO, EMAIL, CENTRO din cuadrante

### Algoritm de generare

**Pas 1: Obțin datele**
```typescript
// 1. Obțin cuadrante pentru CODIGO + LUNA
const cuadrante = await prisma.$queryRawUnsafe(`
  SELECT * FROM cuadrante 
  WHERE CODIGO = '${codigo}' AND LUNA = '${mes}'
`);

// 2. Obțin fichajes pentru lună
const fichajes = await prisma.$queryRawUnsafe(`
  SELECT * FROM Fichaje 
  WHERE CODIGO = '${codigo}' 
  AND FECHA LIKE '${mes}%'
  ORDER BY FECHA, HORA
`);

// 3. Obțin ausencias pentru lună
const ausencias = await prisma.$queryRawUnsafe(`
  SELECT * FROM Ausencias 
  WHERE CODIGO = '${codigo}' 
  AND FECHA LIKE '${mes}%'
`);
```

**Pas 2: Construiesc array-ul de zile**
```typescript
const [year, month] = mes.split('-').map(Number);
const daysInMonth = new Date(year, month, 0).getDate();
const rows = [];

for (let day = 1; day <= daysInMonth; day++) {
  const fecha = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dayOfWeek = new Date(year, month - 1, day).toLocaleDateString('es-ES', { weekday: 'long' });
  
  // Status din cuadrante
  const status = cuadrante[`ZI_${day}`] || 'LIBRE';
  
  // Fichajes pentru ziua respectivă
  const fichajesDia = fichajes.filter(f => f.FECHA === fecha);
  const entrada = fichajesDia.find(f => f.TIPO === 'Entrada')?.HORA || '-';
  const salida = fichajesDia.find(f => f.TIPO === 'Salida')?.HORA || '-';
  const totalHoras = calculateTotalHours(fichajesDia);
  
  rows.push({
    zi: day,
    fecha,
    dayOfWeek,
    status,
    orar: extractOrarFromStatus(status), // "8h" → "08:00-16:00"
    entrada,
    salida,
    totalHoras,
    observaciones: getObservaciones(ausencias, fecha)
  });
}
```

**Pas 3: Generez Excel** (ExcelJS)
- Headers cu formatare
- Rânduri cu conditional formatting (culori pe status)
- Total row la final

**Pas 4: Generez PDF** (PDFKit)
- Header cu logo/informații
- Tabel cu grid
- Footer cu totaluri
- Paginare automată

### Funcții helper necesare

```typescript
// Extrage orar din status (ex: "8h" → "08:00-16:00")
function extractOrarFromStatus(status: string): string {
  if (status.includes('h')) {
    const hours = parseInt(status);
    return `${String(hours).padStart(2, '0')}:00-${String(hours + 8).padStart(2, '0')}:00`;
  }
  return '-';
}

// Calculează total ore din fichajes
function calculateTotalHours(fichajes: any[]): string {
  const total = fichajes.reduce((sum, f) => {
    const duration = parseFloat(f.DURACION?.replace('h', '') || '0');
    return sum + duration;
  }, 0);
  return `${total.toFixed(2)}h`;
}

// Obține observații (ausencias, fiestas, etc.)
function getObservaciones(ausencias: any[], fecha: string): string {
  const ausencia = ausencias.find(a => a.FECHA === fecha);
  if (ausencia) return ausencia.TIPO;
  return '-';
}
```

### Fișiere de modificat

**Backend:**
1. `backend/src/services/cuadrantes.service.ts` - adaugă metodele de export
2. `backend/src/controllers/cuadrantes.controller.ts` - adaugă 3 endpoint-uri
3. `backend/src/services/email.service.ts` - deja existent (folosit)

**Frontend:**
1. `frontend/src/pages/CuadrantesEmpleadoPage.jsx` - adaugă butonul de export (după linia 3672)
2. `frontend/src/utils/routes.js` - adaugă rutele noi pentru export

### Biblioteci necesare (deja instalate)
- ✅ `exceljs` - pentru Excel
- ✅ `pdfkit` - pentru PDF
- ✅ `nodemailer` - pentru email (EmailService existent)

### Impact
- **Pozitiv:** Angajatul poate exporta/trimite cuadrantul
- **Backend:** 3 endpoint-uri noi, metode de export în service
- **Frontend:** Un buton cu dropdown
- **Compatibilitate:** Nu afectează funcționalitățile existente

---

## 📝 Alte idei viitoare

_(Adaugă aici alte idei când apar)_
