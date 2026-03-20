# Relația dintre tabelele `solicitudes` și `Ausencias`

## În rezumat

- **solicitudes** = cererea (formularul) – o înregistrare per cerere (Vacaciones, Permiso, Ausencias justificada, Baja Voluntaria etc.).
- **Ausencias** = zilele/absențele efective aprobate – legate de cerere prin `solicitud_id`.
- **Legătura:** `Ausencias.solicitud_id` = `solicitudes.id` (un **1 : N** – o solicitare poate avea una sau mai multe ausencias).

---

## 1. Tabelul `solicitudes`

- **Rol:** stochează **cererea** făcută de angajat sau manager (vacanțe, permisiuni, ausencias justificada, baja voluntaria etc.).
- **Cheie primară:** `id` (String, de ex. `"1773919331749"` – generat în frontend, de obicei timestamp).
- **Câmpuri relevante:** `codigo`, `nombre`, `email`, `tipo`, `estado` (Pendiente / Aprobada / Rechazada), `fecha_inicio`, `fecha_fin`, `motivo`, `fecha_solicitud`, `origen` (EMPLEADO/MANAGER), plus câmpuri specifice (ex. `tipo_justificante`, `hora_cita` pentru Ausencias justificada, `fecha_ultimo_dia_trabajo` pentru Baja Voluntaria).

**Unde se creează:** Backend `SolicitudesService.createSolicitud()` (API POST creare solicitare). ID-ul vine din frontend.

---

## 2. Tabelul `Ausencias`

- **Rol:** stochează **absențele efective** (zile/ore) care sunt deja **aprobate** și folosite în calendar, cuadrante, statistici.
- **Cheie primară:** `id` (Int, autoincrement).
- **Legătura cu solicitudes:** `solicitud_id` (String) = `solicitudes.id`.
- **Constraint:** `@@unique([solicitud_id, CODIGO])` – per cerere (`solicitud_id`) și per angajat (`CODIGO`) există cel mult o ausencia (în practică unele tipuri pot genera una per interval, altele una per zi – depinde de logică).
- **Câmpuri relevante:** `CODIGO`, `NOMBRE`, `TIPO`, `FECHA` (sau interval `"YYYY-MM-DD - YYYY-MM-DD"`), `HORA`, `LOCACION`, `MOTIVO`, `DURACION`, `UNIDAD_DURACION`, `no_necesita_justificante`, `ausencia_asociada_id`.

**Unde se creează/actualizează:**
- La **creare** solicitare: dacă `estado === 'Aprobada'` și tipul nu e `BAJA_VOLUNTARIA`, în aceeași tranzacție cu INSERT în `solicitudes` se face și INSERT în `Ausencias` cu `solicitud_id = data.id`.
- La **update** solicitare: dacă `estado` devine `Aprobada` → INSERT/UPDATE în `Ausencias`; dacă `estado` nu e Aprobada → DELETE din `Ausencias` pentru acel `solicitud_id` + `CODIGO`.
- La **ștergere** solicitare: se șterg mai întâi rândurile din `Ausencias` cu acel `solicitud_id`, apoi rândul din `solicitudes`.

---

## 3. Flux în aplicație

### Creare cerere (angajat sau manager)

1. Frontend generează un `id` (ex. timestamp) și trimite POST cu datele cererii.
2. Backend `createSolicitud()`:
   - INSERT în `solicitudes` cu acel `id`.
   - Dacă `estado === 'Aprobada'` și tipul nu e Baja Voluntaria → INSERT în `Ausencias` cu `solicitud_id = id` (același id).

### Aprobare / respingere cerere

1. Frontend trimite update (ex. POST cu `accion: 'update'`, `estado: 'Aprobada'`).
2. Backend `updateSolicitud()`:
   - UPDATE în `solicitudes` (estado, etc.).
   - Dacă `estado === 'Aprobada'` → INSERT/UPDATE în `Ausencias` pentru acel `solicitud_id`.
   - Dacă `estado !== 'Aprobada'` → DELETE din `Ausencias` pentru acel `solicitud_id` (și codigo).

### Ștergere cerere

1. Backend `deleteSolicitud()` șterge mai întâi din `Ausencias` (WHERE `solicitud_id` = id), apoi din `solicitudes`.

### Ștergere ausencia (un rând din Ausencias)

1. Backend `deleteAusencia(id)` șterge rândul din `Ausencias`.
2. **Consistență:** dacă nu mai există nici o ausencia cu același `solicitud_id`, se șterge și rândul corespunzător din `solicitudes` (ca să nu rămână cereri „Aprobada” fără zile).

### Afișare în UI (ex. Mis Solicitudes)

1. Se încarcă **ausencias** (GET `/api/ausencias?codigo=...`) → vin din `Ausencias` (cereri deja aprobate).
2. Se încarcă **solicitudes** (GET by email/codigo) → vin din `solicitudes` (toate stările: Pendiente, Aprobada, Rechazada).
3. Frontend combină listele: afișează ausencias (aprobate) + solicitări în așteptare/respinse, astfel încât utilizatorul să vadă atât zilele aprobate cât și cererile în curs.

---

## 4. De ce două tabele?

- **solicitudes:** fluxul de **aprobare** (Pendiente → Aprobada/Rechazada), date cerere (motiv, date, tip, etc.).
- **Ausencias:** **calendar / operativ** – doar ce e aprobat și contează pentru zile de absență, justificante, cuadrante, rapoarte. La respingere sau ștergere cerere, ausencias pentru acel `solicitud_id` dispar.

Astfel, o **solicitud** = o cerere (1 rând în `solicitudes`); **ausencias** = înregistrările de absență efective legate de acea cerere (1 sau mai multe rânduri în `Ausencias` cu același `solicitud_id`).

---

## 5. Tabelul `ausencia_justificantes` (nou)

Leagă **fiecare ausencia** (din `Ausencias`) de justificantele ei (cerere + presencia) prin `ausencia_id` = `Ausencias.id`, nu prin tipo + dată. Vezi implementarea și fallback-ul pe logica veche în cod.
