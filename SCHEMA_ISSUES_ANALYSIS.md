# Analiză Probleme Schema Prisma
## Tabele și Coloane Problematic

---

## 🔴 PROBLEME CRITICE

### 1. **Tabele fără Primary Key Valid (Prisma nu le poate folosi)**

#### `ArhivosFacturasRecibidas` (linia 193)
```prisma
model ArhivosFacturasRecibidas {
  id Int @default(autoincrement()) // ← Nu e @id!
  // ...
  @@ignore // ← Prisma nu o poate folosi
}
```
**Problemă:** Nu are primary key valid → Prisma nu o poate folosi  
**Impact:** Tabelă inaccesibilă prin Prisma Client  
**Fix:** Adaugă `@id` la `id` sau creează composite key

#### `Facturas` (linia 369)
```prisma
model Facturas {
  id String @db.VarChar(200) // ← Nu e @id!
  // ...
  @@ignore // ← Prisma nu o poate folosi
}
```
**Problemă:** Nu are primary key → Prisma nu o poate folosi  
**Impact:** Tabelă inaccesibilă  
**Fix:** Adaugă `@id` la `id` sau creează composite key

#### `SerieFormato` (linia 732)
```prisma
model SerieFormato {
  Serie String? @unique // ← Nu e @id!
  // ...
  @@ignore
}
```
**Problemă:** Nu are primary key → Prisma nu o poate folosi  
**Impact:** Tabelă inaccesibilă  
**Fix:** Adaugă `@id` la `Serie` sau creează autoincrement `id`

#### `notas_facturas` (linia 1000)
```prisma
model notas_facturas {
  titulo String // ← Nu e @id!
  // ...
  @@ignore
}
```
**Problemă:** Nu are primary key → Prisma nu o poate folosi  
**Impact:** Tabelă inaccesibilă  
**Fix:** Adaugă `id` autoincrement cu `@id`

---

## 🟡 PROBLEME MAJORE

### 2. **Tipuri de Date Greșite (String în loc de DateTime/Date)**

#### `User` (DatosEmpleados)
```prisma
FECHA_NACIMIENTO String? @map("FECHA NACIMIENTO") @db.VarChar(100) // ← Ar trebui DateTime
FECHA_DE_ALTA    String? @map("FECHA DE ALTA") @db.VarChar(100)    // ← Ar trebui DateTime
FECHA_BAJA       String? @map("FECHA BAJA") @db.VarChar(100)       // ← Ar trebui DateTime
```
**Problemă:** Date stocate ca String → nu poți face queries de date (WHERE, ORDER BY, etc.)  
**Impact:** Nu poți filtra/sortă după date corect  
**Fix:** Migrare la `DateTime @db.Date` sau `DateTime @db.Date`

#### `Ausencias`
```prisma
FECHA String @db.VarChar(50) // ← Ar trebui DateTime @db.Date
```
**Problemă:** Data absenței ca String  
**Impact:** Nu poți face calcule de durată, filtrare după perioadă  
**Fix:** `DateTime @db.Date`

#### `Fichaje`
```prisma
FECHA String? @db.VarChar(50) // ← Ar trebui DateTime
HORA  String? @db.VarChar(50) // ← Ar trebui DateTime @db.Time(0)
```
**Problemă:** Data și ora ca String  
**Impact:** Nu poți face queries temporale corect  
**Fix:** `FECHA: DateTime @db.Date`, `HORA: DateTime @db.Time(0)`

#### `solicitudes`
```prisma
fecha_fin String? @db.VarChar(50) // ← Ar trebui DateTime
```
**Problemă:** Data sfârșit ca String (în timp ce `fecha_inicio` e DateTime!)  
**Impact:** Inconsistență - nu poți compara date  
**Fix:** `DateTime? @db.Date`

#### `ContratosClientes`
```prisma
fecha_subida     String? @default(dbgenerated("(curdate())")) @db.VarChar(50) // ← Ar trebui DateTime
fecha_renovacion String? @db.VarChar(50) // ← Ar trebui DateTime
```
**Problemă:** Date ca String  
**Impact:** Nu poți face queries de expirare contracte  
**Fix:** `DateTime? @db.Date`

#### `CarpetasDocumentos`, `DocumentosOficiales`, `MaterialesDocumentos`
```prisma
fecha_creacion String? @default(dbgenerated("(current_timestamp())")) @db.VarChar(50)
```
**Problemă:** Timestamp ca String  
**Impact:** Nu poți sorta/filtra după data creării  
**Fix:** `DateTime @default(now()) @db.Timestamp(0)`

#### `SolicitudesCambiosPersonales`
```prisma
data_creare   String? @default(dbgenerated("(current_timestamp())")) @db.VarChar(255)
data_aprobare String? @db.VarChar(255)
```
**Problemă:** Date ca String  
**Impact:** Nu poți face queries temporale  
**Fix:** `DateTime? @db.Timestamp(0)`

#### `Logs`
```prisma
timestamp String? @db.VarChar(255) // ← Ar trebui DateTime
```
**Problemă:** Timestamp ca String  
**Impact:** Nu poți face analiză temporală  
**Fix:** `DateTime? @db.Timestamp(0)`

#### `FacturasRecibidas`
```prisma
data String? @db.VarChar(55) // ← Ar trebui DateTime
ora String? @db.VarChar(55)  // ← Ar trebui DateTime @db.Time(0)
```
**Problemă:** Data și ora ca String  
**Impact:** Nu poți face queries temporale  
**Fix:** `DateTime? @db.Date` și `DateTime? @db.Time(0)`

---

### 3. **Tipuri de Date Greșite (String în loc de Decimal/Int)**

#### `User` (DatosEmpleados)
```prisma
SUELDO_BRUTO_MENSUAL String? @map("SUELDO BRUTO MENSUAL") @db.VarChar(300) // ← Ar trebui Decimal
HORAS_DE_CONTRATO    String? @map("HORAS DE CONTRATO") @db.VarChar(50)     // ← Ar trebui Decimal sau Int
```
**Problemă:** Sumă și ore ca String → nu poți face calcule  
**Impact:** Nu poți calcula salarii totale, medii, etc.  
**Fix:** `Decimal? @db.Decimal(10, 2)` și `Decimal? @db.Decimal(5, 2)`

#### `horaspermitidas`
```prisma
Horas_Anuales   String? @map("Horas Anuales") @db.VarChar(100)   // ← Ar trebui Decimal
Horas_Mensuales String? @map("Horas Mensuales") @db.VarChar(100) // ← Ar trebui Decimal
```
**Problemă:** Ore ca String  
**Impact:** Nu poți face calcule  
**Fix:** `Decimal? @db.Decimal(10, 2)`

#### `Clientes`
```prisma
CuantoPuedeGastar String? @db.VarChar(100) // ← Ar trebui Decimal
```
**Problemă:** Sumă ca String  
**Impact:** Nu poți face calcule  
**Fix:** `Decimal? @db.Decimal(10, 2)`

#### `FacturasRecibidas`
```prisma
baza_impozabila String? @db.Text  // ← Ar trebui Decimal
tva             String? @db.Text  // ← Ar trebui Decimal
total_platit    String? @db.Text  // ← Ar trebui Decimal
```
**Problemă:** Sume ca String  
**Impact:** Nu poți face calcule financiare  
**Fix:** `Decimal? @db.Decimal(10, 2)`

#### `Facturas`
```prisma
base_imponible String? @db.Text // ← Ar trebui Decimal
retencion      String? @db.Text // ← Ar trebui Decimal
iva            String? @db.Text // ← Ar trebui Decimal
total          String? @db.Text // ← Ar trebui Decimal
```
**Problemă:** Sume ca String  
**Impact:** Nu poți face calcule  
**Fix:** `Decimal? @db.Decimal(10, 2)`

---

### 4. **Coloane cu Spații în Nume (Necesită Backticks)**

**Tabele afectate:**
- `User` (DatosEmpleados): 15+ coloane cu spații
- `Clientes`: 5+ coloane cu spații
- `Proveedores`: 5+ coloane cu spații
- `Productos`: 20+ coloane cu spații
- `MutuaCasos`: 10+ coloane cu spații
- `horaspermitidas`: 2 coloane cu spații
- `InspeccionesDocumentos`: 1 coloană cu spațiu
- `Fichaje`: 2 coloane cu spații

**Exemple:**
```prisma
@map("NOMBRE / APELLIDOS")
@map("D.N.I. / NIE")
@map("SEG. SOCIAL")
@map("FECHA DE ALTA")
@map("TIPO DE CONTRATO")
@map("NOMBRE O RAZON SOCIAL")
@map("CODIGO POSTAL")
@map("DESCUENTO POR DEFECTO")
@map("NOTAS PRIVADAS")
@map("CUENTAS BANCARIAS")
@map("PRODUCTO VISIBLE (ACTIVO)")
@map("CÓDIGO DE PRODUCTO (SKU)")
@map("PRECIO VENTA - BASE IMPONIBLE")
@map("COSTE ADQUISICIÓN - BASE IMPONIBLE")
@map("AVISAR CUANDO EL NÚMERO DE UNIDADES SEA INFERIOR A")
@map("Nombre Supervisor")
```

**Impact:** 
- Necesită backticks în toate query-urile raw SQL (200+ locuri)
- Cod mai greu de citit și întreținut
- Erori ușoare de făcut (uitat backticks)

**Fix:** Migrare la nume fără spații (dar RISC MARE - vezi analiza anterioară)

---

## 🟠 PROBLEME MEDII

### 5. **Structuri Denormalizate (31 Coloane pentru Zile)**

#### `cuadrante` (linia 802)
```prisma
model cuadrante {
  ZI_1  String? @db.VarChar(50)
  ZI_2  String? @db.VarChar(50)
  // ... ZI_3 până ZI_31
  ZI_31 String? @db.VarChar(50)
}
```
**Problemă:** 31 coloane separate pentru fiecare zi din lună  
**Impact:** 
- Greu de întreținut
- Nu poți face queries pe zile (WHERE zi = X)
- Structură rigidă (doar 31 zile max)

**Fix (ideal):** Tabelă separată `cuadrante_dias`:
```prisma
model CuadranteDia {
  id          Int      @id @default(autoincrement())
  cuadrante_id Int
  dia         Int      // 1-31
  horas       String?  @db.VarChar(50)
  cuadrante   cuadrante @relation(...)
}
```

**Dar:** RISC MARE - ar trebui să refactorizezi toată logica de cuadrantes!

#### `horario_multicentro` (linia 931)
**Aceeași problemă:** 31 coloane ZI_1 până ZI_31

---

### 6. **Lipsă Relații Foreign Key**

#### `Ausencias`
```prisma
model Ausencias {
  CODIGO String @db.VarChar(50) // ← Nu e foreign key către User!
  // ...
}
```
**Problemă:** Nu are relație cu `User` → nu poți face JOIN automat  
**Impact:** Trebuie să faci JOIN manual în query-uri  
**Fix:** 
```prisma
empleado User @relation(fields: [CODIGO], references: [CODIGO])
```

#### `Fichaje`
```prisma
model Fichaje {
  CODIGO String? @db.VarChar(50) // ← Nu e foreign key!
  // ...
}
```
**Problemă:** Nu are relație cu `User`  
**Fix:** Adaugă relație

#### `cuadrante`
```prisma
model cuadrante {
  CODIGO String? @db.VarChar(50) // ← Nu e foreign key!
  // ...
}
```
**Problemă:** Nu are relație cu `User`  
**Fix:** Adaugă relație

#### `solicitudes`
```prisma
model solicitudes {
  codigo String? @db.VarChar(50) // ← Nu e foreign key!
  // ...
}
```
**Problemă:** Nu are relație cu `User`  
**Fix:** Adaugă relație

#### `MutuaCasos`
```prisma
model MutuaCasos {
  Codigo_Empleado String? @db.VarChar(64) // ← Nu e foreign key!
  // ...
}
```
**Problemă:** Nu are relație cu `User`  
**Fix:** Adaugă relație

**Impact general:** 
- Nu poți folosi Prisma relations (`.include()`, `.connect()`, etc.)
- Trebuie să faci JOIN-uri manuale
- Nu ai cascade delete/update automat

---

### 7. **Naming Inconsistencies**

**Mix de limbi:**
- Spaniolă: `DatosEmpleados`, `Fichaje`, `Cuadrante`, `Ausencias`
- Română: `NotificariFichaje`, `valoare_veche`, `valoare_noua`
- Engleză: `Notification`, `ChatRoom`, `User` (dar mapat la `DatosEmpleados`)

**Mix de convenții:**
- `snake_case`: `fecha_creacion`, `created_at`
- `PascalCase`: `Fecha_Antig_edad`, `Fecha_Ultima_Renovacion`
- `UPPER_CASE`: `CODIGO`, `NOMBRE`, `ESTADO`
- `camelCase`: `centroTrabajo`, `fechaEntrega`

**Impact:** Confuzie, greu de întreținut  
**Fix:** Standardizează (dar RISC MARE - multe locuri de schimbat)

---

### 8. **Coloane Nullable Excesive**

**Aproape toate coloanele sunt nullable** (`String?`, `Int?`, etc.)

**Exemple:**
```prisma
model User {
  NOMBRE String? // ← Ar trebui să fie obligatoriu?
  DNI_NIE String? // ← Ar trebui să fie obligatoriu?
  // ...
}
```

**Impact:** 
- Nu ai validare la nivel de DB
- Trebuie să validezi în cod
- Date incomplete în DB

**Fix:** Adaugă `NOT NULL` unde e logic (dar RISC - poate există date incomplete)

---

### 9. **Default Values ciudate**

#### `CarpetasDocumentos`, `DocumentosOficiales`, etc.
```prisma
fecha_creacion String? @default(dbgenerated("(current_timestamp())")) @db.VarChar(50)
```
**Problemă:** String cu default SQL function → nu funcționează corect  
**Impact:** Default-ul nu se aplică automat  
**Fix:** `DateTime @default(now()) @db.Timestamp(0)`

#### `ContratosClientes`
```prisma
fecha_subida String? @default(dbgenerated("(curdate())")) @db.VarChar(50)
```
**Problemă:** String cu default SQL  
**Fix:** `DateTime @default(now()) @db.Date`

---

## 🟢 PROBLEME MINORE

### 10. **Tabele cu Nume ciudate**

#### `cuadrante` (linia 802)
**Problemă:** Nume tabelă cu literă mică (nu PascalCase)  
**Impact:** Inconsistență  
**Fix:** `Cuadrante` (dar necesită migrare)

#### `fiestas` (linia 847)
**Problemă:** Nume cu literă mică  
**Fix:** `Fiestas`

#### `horarios` (linia 864)
**Problemă:** Nume cu literă mică  
**Fix:** `Horarios`

#### `horaspermitidas` (linia 924)
**Problemă:** Nume cu literă mică, fără underscore  
**Fix:** `HorasPermitidas`

---

### 11. **Coloane Redundante**

#### `User` (DatosEmpleados)
```prisma
NOMBRE_APELLIDOS String? @map("NOMBRE / APELLIDOS")
NOMBRE_APELLIDOS_BACKUP String? // ← Backup? De ce?
NOMBRE String?
APELLIDO1 String?
APELLIDO2 String?
```
**Problemă:** 5 coloane pentru nume (redundant)  
**Impact:** Confuzie, date duplicate  
**Fix:** Păstrează doar `NOMBRE`, `APELLIDO1`, `APELLIDO2` (sau doar `NOMBRE_APELLIDOS`)

---

### 12. **Lipsă Indexuri**

**Multe tabele nu au indexuri pe coloane folosite frecvent în queries:**
- `Fichaje`: Nu are index pe `TIPO`, `Estado`
- `solicitudes`: Nu are index pe `estado`, `tipo`
- `FacturasRecibidas`: Nu are index pe `Estado`, `TipoGasto`

**Impact:** Queries lente  
**Fix:** Adaugă indexuri (dar verifică mai întâi dacă sunt necesare)

---

## 📊 SUMAR PROBLEME

### După Severitate:

**🔴 CRITICE (Blochează funcționalitate):**
- 4 tabele fără primary key valid (`@@ignore`)

**🟡 MAJORE (Afectează funcționalitate):**
- 50+ coloane cu tipuri greșite (String în loc de DateTime/Decimal)
- 50+ coloane cu spații în nume (necesită backticks)
- 10+ tabele fără foreign keys (lipsă relații)

**🟠 MEDII (Afectează calitate cod):**
- Structuri denormalizate (31 coloane pentru zile)
- Naming inconsistencies
- Coloane nullable excesive

**🟢 MINORE (Cosmetice):**
- Nume tabele cu literă mică
- Coloane redundante
- Lipsă indexuri

---

## 💡 RECOMANDĂRI

### Ce să repari ACUM (Safe, Low Risk):

1. ✅ **Adaugă `@id` la tabelele cu `@@ignore`** (dacă ai nevoie de ele)
2. ✅ **Adaugă indexuri** pe coloane folosite frecvent (safe, nu strică nimic)
3. ✅ **Documentează** coloanele problematice (pentru viitor)

### Ce să repari MAI TÂRZIU (După template stabil):

1. ⏳ **Migrare tipuri de date** (String → DateTime/Decimal) - RISC MEDIUM
2. ⏳ **Normalizare structuri** (31 coloane → tabelă separată) - RISC HIGH
3. ⏳ **Adaugă foreign keys** - RISC MEDIUM
4. ⏳ **Standardizează naming** - RISC HIGH

### Ce să NU repari (RISC PREA MARE):

1. ❌ **Coloane cu spații** - Prea multe locuri afectate (200+), nu merită riscul
2. ❌ **Refactoring major** - Păstrează pentru viitor, când ai timp dedicat

---

## 🎯 CONCLUZIE

**Schema are multe probleme, dar:**
- ✅ **Funcționează** - Prisma gestionează automat multe probleme
- ✅ **Nu blochează template-ul** - Toate problemele sunt "cosmetice" sau "calitate cod"
- ⚠️ **Nu e necesar să repari acum** - Focus pe template, nu pe refactoring

**Prioritizează:**
1. Template-ul reutilizabil (acum)
2. Fix-uri safe (indexuri, documentație)
3. Refactoring major (mai târziu, când ai timp)
