# CHECKPOINT Visual Refresh V2 — 2026-08-18

**Obiectiv:** relua mâine de aici, fără reanaliză.  
**Limbă:** română. Start: „salut alecu”.  
**Scope:** UI/UX only. Fără logică, API, backend, DB, auth, permissions, payload-uri.

**Git:** nu s-a cerut commit în sesiunea V2. Modificările Fichaje/V2 sunt locale până la commit/push de către utilizator.

---

## UNDE NE OPRIM

- **Inicio:** CERRADO (referință vizuală).
- **Registro de Jornada / Fichaje:** CERRADO. **Nu se mai modifică.**
- **Solicitudes:** NU a început. Primul modul mâine, **doar după aprobare explicită**.
- **Toast/Notification global:** NU acum. Ulterior, o dată pentru toată aplicația.
- **Input/Select global:** NU schimba `Input.jsx` / `Select.jsx` dintr-o dată (blast radius). Adopție per pagină, ca la Fichaje.

**PARA.** Așteaptă „Aprobat” înainte de orice Val pe Solicitudes.

---

## A. CE ESTE DEJA ÎNCHIS

### Inicio — `/inicio`
- Fișiere: `frontend/src/pages/DashboardPage.jsx`, `DashboardPage.css`
- Tokens proprii aliniate la `--app-*`
- Referință vizuală pentru restul aplicației
- Nu folosește `PageHeader` (are propriul chrome)

### Registro de Jornada / Fichaje — `/fichaje` — CERRADO

Valuri făcute:

| Val | Ce |
|-----|----|
| 0 | tokens `app-ui.css`, PageHeader, AlertBanner, SegmentedControl, Button, AppShell safe-area, bottom nav „Jornada” |
| 1 | Mi Fichaje: Hoy, Entrada/Salida CTA, istoric segmented, lună, grid 5/7 de la 768px |
| 1.1 | polish Hoy/alerte/chips/FAB vs nav |
| 2 | taburi admin Fichaje/Equipo/Horas/Límites = SegmentedControl grid; FilterBar Equipo; chips semantic + disabled gri |
| 3 | chrome modal `app-modal*` (Ausencia, Baja, confirmări, Añadir/Editar) |
| 3.1 | istoric desktop compact; picker angajat; QA responsive; z-index modal > FAB |

**Nu atinge:** `handleFichar`, geo, cuadrante/horario, calcule, monthly alerts, regularizări, ausencia/baja logic, API, DB.

**Fișiere cheie V2 (kit reutilizabil):**
- `frontend/src/styles/app-ui.css`
- `frontend/src/components/ui/PageHeader.jsx`
- `frontend/src/components/ui/AlertBanner.jsx`
- `frontend/src/components/ui/SegmentedControl.jsx` (`layout="grid"`)
- `frontend/src/components/ui/Modal.jsx` / `ConfirmModal.jsx`
- `frontend/src/components/ui/Button.jsx` (parțial V2)
- Pattern picker: `.app-picker*` în `app-ui.css` + dropdown din Fichaje Añadir/Editar
- Pattern listă: `.fichaje-row*` (desktop) + `MobileRegistroItem` (mobil)

**Notă:** `PageHeader` e folosit **doar** pe Fichaje. Restul paginilor încă au `Back3DButton` + h1.

---

## B. KIT V2 — CE REUTILIZĂM MÂINE

Deja există, nu recrea:
- tokens `--app-*`, `--primary-color` (nu roșu DeCamino hardcodat)
- `PageHeader`, `AlertBanner`, `SegmentedControl`, `app-modal*`
- listă compactă mobil + rânduri desktop (fără glow, fără carduri 40px)
- picker angajat (search, scroll, empty, dark, Escape) — **aceeași filtrare business, alt chrome**
- FAB ChatBot: `bottom: calc(var(--app-nav-h) + 14px + safe-area)` pe ≤768px
- Bottom nav: Inicio · Jornada · Solicitudes · Empleados/Comunicados · Más

Nu crea librării noi. Nu global-fix Input/toast înainte de 2–3 pagini.

---

## C. CE URMEAZĂ — ORDINE (din audit 18.08.2026)

Pagină cu pagină. Un bloc + QA + CERRADO. Fără 10 faze interne.

| # | Pagină | Status | Cx / risc | Notă |
|---|--------|--------|-----------|------|
| 1 | **Solicitudes** `/solicitudes` | 🔴 de început | HIGH / HIGH | ~18k linii. Primul mâine |
| 2 | Datos `/datos` | 🟠 | MED / LOW–MED | self-service |
| 3 | Aprobaciones `/aprobaciones` | 🟠 | MED / MED | același flux HR |
| 4 | Documentos (eu) `/documentos` | 🔴 | HIGH / HIGH | AutoFirma = nu atinge |
| 5 | Comunicados (3 rute) | 🟡 | LOW / LOW | fișiere mici |
| 6 | Mis tareas + Tareas | 🟡 | LOW / LOW | aproape gata |
| 7 | Mi horario `/cuadrantes-empleado` | 🔴 | HIGH / MED | calendar vizual |
| 8 | Empleados `/empleados` | 🔴 | HIGH / HIGH | ~9.5k |
| 9 | Documentos empleados + Gestoría | 🔴 | HIGH / HIGH | matrix ulterior |
| 10 | Cuadrantes admin | 🔴 | HIGH / HIGH | grila 31 zile = CSS, nu motor |
| 11 | Inspecciones + Mis inspecciones | 🟠/🟡 | MED | scoate landing 3D |
| 12 | Pedidos admin + angajat | 🔴/🟠 | HIGH / HIGH | |
| 13 | Clientes | 🟠 | MED / MED | |
| 14 | Presupuestos V2 **chrome only** | 🟠 | MED / MED | produs ≠ Visual Refresh |
| 15 | Estadísticas / Admin / Mensajes | 🟡🟠 | MED | trafic mai mic |

**Defer:** Presupuestos **legacy** `/presupuestos-informes` · Login/portal · SuperAdmin tenants · Hall of Fame (gamificat) · Cuadernos stub · Leads.

**Solicitudes — ecrane interne (să nu le uităm):**
- Employee: Mis Solicitudes, Nueva (calendar vacaciones/AP)
- Admin: Todas (Asunto, Vacaciones, Control vacaciones, Ausencias, Bajas Médicas, Bajas Voluntarias, Aprobación), Estadísticas
- ~17 modale; picker angajat overlay vechi (ca Fichaje înainte de Val 3.1)
- Tabele late: Control vacaciones până la `min-w-[2100px]`, Estadísticas fără listă mobil

Dacă Solicitudes e prea mare pentru un singur Val: **un val employee (Mis+Nueva) + un val admin**, tot aceeași pagină, două închideri. Nu 10 faze.

---

## D. COMPONENTE GLOBALE (ulterior, nu mâine)

1. Notification / toast — amânat explicit
2. `Input.jsx` / `Select.jsx` — ring roșu, className pe wrapper nu pe control
3. `Card.jsx` — încă `rounded-lg p-6` gray; preferă `.app-card` per pagină
4. Overlay-uri dropdown angajat — reutiliza `.app-picker` (Solicitudes, Empleados)
5. MobileMoreDrawer — încă tile-uri gradient
6. AppShell — orbs/blur fundal (Val 0 parțial; nu prioritar)

---

## E. REGULI PENTRU MÂINE (Solicitudes și restul)

**Face:**
- Explain-first până la „Aprobat” / „Aplică” / „Implementează”
- Mobile-first, 375 / 390 / 430 / tablet / desktop, light + dark
- Reuse kit V2 de mai sus
- Lint + `npm run build:no-version` la închidere Val

**Nu face:**
- Nu modifica Fichaje
- Nu începe Solicitudes fără aprobare
- Nu business logic / API / backend / DB / auth / permissions / payload
- Nu calendar cupos, lock periods, aprobări, convertiri, PDF/Excel, cron ausencias
- Nu Notification global
- Nu Val 4 pe Fichaje
- Nu commit git decât dacă cere utilizatorul

⚠️ Dacă ceva cere schimbare funcțională: marchează `FUNCTIONAL / OUT OF VISUAL SCOPE` și oprește.

---

## F. FIȘIERE DE CONTEXT

- Acest checkpoint
- Audit conversație 18.08.2026 (clasificare 🟢🟡🟠🔴)
- `.cursorrules` — explain-first, română, multi-client DB
- Kit: `frontend/src/styles/app-ui.css`

---

*Notă internă de sesiune. Nu e documentație pentru utilizatorul final.*
