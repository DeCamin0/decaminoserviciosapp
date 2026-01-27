# Propunere: Sistem Cuadrantes cu Conformitate Legală (Spania)

**Data:** 2026-01-27  
**Status:** Propunere - Nu implementat  
**Context:** Limpieza + Auxiliar de Servicios - Legislație spaniolă

---

## 📋 CONTEXT LEGAL

### Cerințe legale:
- **Preaviz minim:** 5 zile pentru modificări
- **Practică acceptată:**
  - Cuadrant lunar publicat integral
  - Prima parte (zilele 1-15) = **DEFINITIVO** (nu se modifică după publicare)
  - A doua parte (zilele 16-31) = **PROVISIONAL** (se pot modifica cu preaviz minim 5 zile)
  - Orice modificare trebuie să:
    - Respecte minim 5 zile preaviz
    - Aibă motiv justificat
    - Lase istoric (audit trail)

---

## 1. LOGICĂ DE BUSINESS

### Reguli principale:

#### 1.1 Diviziunea lunii
- **Zilele 1-15** = **DEFINITIVO** (nu se modifică după publicare)
- **Zilele 16-31** = **PROVISIONAL** (se pot modifica cu preaviz minim 5 zile)

#### 1.2 Preaviz minim 5 zile
- O modificare în PROVISIONAL trebuie făcută cu **minim 5 zile înainte** de ziua modificată
- **Exemplu:** Pentru a modifica ziua 20, modificarea trebuie făcută până pe 15 (20 - 5 = 15)

#### 1.3 Publicare cuadrant
- La publicare, prima parte (1-15) devine **DEFINITIVO**
- A doua parte (16-31) rămâne **PROVISIONAL**

#### 1.4 Blocări
- **DEFINITIVO:** Nu se modifică (chiar dacă au trecut 5 zile)
- **PROVISIONAL:** Se modifică doar cu preaviz minim 5 zile
- **Zilele trecute:** Nu se modifică

---

## 2. STRUCTURĂ DE DATE (DB)

### 2.1 Tabela `cuadrante` - Câmpuri noi

```sql
-- Status cuadrant
estado VARCHAR(50) DEFAULT 'BORRADOR' 
  -- BORRADOR | PUBLICADO | ARCHIVADO

-- Data publicare (când devine DEFINITIVO pentru prima parte)
fecha_publicacion DATETIME NULL

-- Data ultimei modificări
fecha_ultima_modificacion DATETIME NULL

-- Utilizator care a publicat/modificat
publicado_por VARCHAR(50) NULL
modificado_por VARCHAR(50) NULL

-- Versiune (incrementată la fiecare modificare)
version INT DEFAULT 1

-- Flag pentru prima publicare
es_primera_publicacion BOOLEAN DEFAULT TRUE
```

### 2.2 Tabela nouă: `cuadrante_historial`

```sql
CREATE TABLE cuadrante_historial (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cuadrante_id INT NOT NULL, -- FK la cuadrante.id
  version INT NOT NULL,
  
  -- Date modificare
  fecha_modificacion DATETIME NOT NULL,
  modificado_por VARCHAR(50) NOT NULL,
  motivo_modificacion TEXT NOT NULL, -- OBLIGATORIU
  
  -- Zile modificate (JSON array: ["ZI_20", "ZI_21"])
  zile_modificate JSON,
  
  -- Valori vechi (JSON: {"ZI_20": "08:00-17:00", "ZI_21": "LIBRE"})
  valores_anteriores JSON,
  
  -- Valori noi (JSON)
  valores_nuevos JSON,
  
  -- Validare preaviz
  preaviz_dias INT, -- Câte zile preaviz a avut
  cumple_preaviz BOOLEAN, -- Dacă a respectat minim 5 zile
  
  -- Metadata
  ip_address VARCHAR(50),
  user_agent TEXT,
  
  INDEX idx_cuadrante_version (cuadrante_id, version),
  FOREIGN KEY (cuadrante_id) REFERENCES cuadrante(id) ON DELETE CASCADE
);
```

---

## 3. REGULI DE BLOCARE (UI + Backend)

### 3.1 Backend Validări

```typescript
// Pseudocod pentru validare
function puedeModificarZile(cuadrante, zileAModificar, fechaModificacion) {
  const hoy = new Date();
  const fechaPublicacion = cuadrante.fecha_publicacion;
  
  // 1. Verifică dacă cuadrantul este PUBLICADO
  if (cuadrante.estado !== 'PUBLICADO') {
    return { permitido: true, razon: 'Cuadrante no publicado aún' };
  }
  
  // 2. Pentru fiecare zi modificată
  for (const zi of zileAModificar) {
    const numZi = parseInt(zi.replace('ZI_', ''));
    
    // 2a. DEFINITIVO (1-15) - BLOCHAT
    if (numZi <= 15) {
      return { 
        permitido: false, 
        razon: `La zona DEFINITIVA (días 1-15) no puede modificarse después de la publicación` 
      };
    }
    
    // 2b. PROVISIONAL (16-31) - Verifică preaviz
    const fechaZi = new Date(cuadrante.LUNA + '-' + numZi);
    const diasPreaviz = Math.floor((fechaZi - hoy) / (1000 * 60 * 60 * 24));
    
    if (diasPreaviz < 5) {
      return { 
        permitido: false, 
        razon: `Modificación de día ${numZi} requiere mínimo 5 días de preaviso. Faltan ${diasPreaviz} días` 
      };
    }
    
    // 2c. Zile trecute - BLOCHAT
    if (fechaZi < hoy) {
      return { 
        permitido: false, 
        razon: `No se pueden modificar días pasados` 
      };
    }
  }
  
  return { permitido: true };
}
```

### 3.2 UI - Blocări Vizuale

- **DEFINITIVO (1-15):** Câmpuri disabled + badge "DEFINITIVO"
- **PROVISIONAL (16-31):** Editabile, dar cu validare
- **Zile trecute:** Disabled
- **Zile cu preaviz < 5 zile:** Disabled + tooltip "Requiere 5 días de preaviso"

---

## 4. UX - Angajat vs Admin

### 4.1 Angajat (CuadrantesEmpleadoPage)

**Vizualizare:**
- Badge "DEFINITIVO" pe zilele 1-15
- Badge "PROVISIONAL" pe zilele 16-31
- **Nu poate modifica** (doar vizualizare)

**Notificări:**
- Notificare când cuadrantul este publicat
- Notificare când se modifică partea PROVISIONAL (cu minim 5 zile preaviz)

### 4.2 Admin (CuadrantesPage)

**Creare cuadrant:**
- Modul "BORRADOR" - toate zilele editabile
- Buton "Publicar Cuadrante" - devine PUBLICADO

**Modificare după publicare:**
- Zilele 1-15: **Disabled** + tooltip "Zona DEFINITIVA - No modificable"
- Zilele 16-31: **Editabile**, dar cu validare
- **Modal pentru modificare:**
  - Selectează zilele de modificat
  - Câmp obligatoriu: "Motivo de la modificación"
  - Validare preaviz (afișează câte zile preaviz are)
  - Confirmare cu warning dacă preaviz < 5 zile

**Istoric:**
- Tab "Historial" cu toate modificările
- Afișează: data, utilizator, motiv, zile modificate, preaviz

---

## 5. REDUCERE RISC LEGAL

### 5.1 Audit Trail
- Toate modificările în `cuadrante_historial`
- Log IP, user agent, timestamp
- Export PDF al istoricului pentru inspecții

### 5.2 Notificări
- Email automat la publicare cuadrant
- Email automat la modificări PROVISIONAL (cu minim 5 zile preaviz)
- Notificare push în aplicație

### 5.3 Export/Backup
- Export PDF lunar cu versiunea finală
- Backup automat înainte de fiecare modificare
- Export JSON pentru audit

### 5.4 Validări Suplimentare
- Nu permite modificări în weekend (dacă e cazul)
- Nu permite modificări în zilele de sărbătoare
- Confirmare în 2 pași pentru modificări importante

---

## 6. IMPLEMENTARE PRACTICĂ

### 6.1 Backend

1. **Adaugă câmpuri noi în `cuadrante`** (migrare Prisma)
2. **Creează tabela `cuadrante_historial`**
3. **Modifică `saveCuadrante`** pentru a valida regulile
4. **Endpoint nou:** `POST /api/cuadrantes/publicar` (publică cuadrantul)
5. **Endpoint nou:** `POST /api/cuadrantes/modificar` (modifică cu validare)

### 6.2 Frontend

1. **Badge-uri** pentru DEFINITIVO/PROVISIONAL
2. **Modal pentru modificare** (cu câmp motiv)
3. **Validare în timp real** (preaviz)
4. **Tab "Historial"** pentru admin
5. **Notificări** pentru angajați

---

## 7. ÎNTREBĂRI PENTRU CLARIFICARE

1. **Diviziunea 1-15 / 16-31** este fixă sau configurabilă?
2. **La publicare**, toate zilele 1-15 devin DEFINITIVO simultan sau progresiv?
3. **Dacă un cuadrant nu este publicat**, poate fi modificat fără restricții?
4. **Există cazuri excepționale** când se pot modifica zilele DEFINITIVO (forță majoră, etc.)?

---

## 8. STRUCTURA ACTUALĂ (Referință)

### Tabela `cuadrante` (actuală):
- `id`, `CODIGO`, `EMAIL`, `NOMBRE`, `LUNA`, `CENTRO`
- `ZI_1` ... `ZI_31`, `TotalHoras`
- Unique constraint: `(CODIGO, LUNA)`

### Endpoint-uri actuale:
- `POST /api/cuadrantes` - GET cuadrantes
- `POST /api/cuadrantes/save` - Save cuadrante (INSERT cu ON DUPLICATE KEY UPDATE)
- `POST /api/cuadrantes/update` - Update bulk

---

**Notă:** Această propunere este salvată pentru implementare viitoare. Nu a fost implementată încă.
