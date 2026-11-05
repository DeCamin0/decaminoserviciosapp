# Faza E — Resumen operativo (programados / pendientes fichar)

**Status:** CERRADO (A–E finalizate)  
**Endpoint:** `GET /api/inicio/resumen-operativo?periodo=hoy|mes`  
**Opt-in audit:** `?includeCodigos=1` → include `kpis.*.codigos` (necesită `empleados` **sau** `fichar-admin`; fără opt-in se returnează doar `count`).

## Logică

- Reutilizează `FichajeReminderService.scanHoyForOperativo` (aceleași reguli ca reminder: cuadrante / multicentro / horarios, baja, ausencia, festivo, Entrada nu înainte de `horaIn`).
- Scope: `EmpleadoGrupoScopeService` (Admin/Developer bypass pe rol/grup; altfel CODIGO din grupurile din scope).
- Fără modificări de schemă DB.

## UI

- **Previstos a trabajar hoy**
- **Pendientes de fichar hoy**
- Vizibile pe desktop (Resumen operativo) și mobil (Mi resumen compact), doar cu permisiune efectivă.

## Decizie amânată: HERA Admin și matricea de permisiuni

Pe tenant **HERA**, în tabelul `permissions` există rânduri explicite:

- `Admin_empleados=false`
- `Admin_fichar-admin=false`

Backend-ul Fazei E (și FE cu matricea nouă) **respectă `false` explicit** și pentru grupul Admin: KPI-urile E **nu** se calculează / nu se afișează pentru Admin HERA.

**Nu s-a modificat matricea** la închiderea Fazei E (cerere explicită).

### Decizie separată (backlog)

- Dacă Admin HERA trebuie să vadă aceste KPI-uri: actualizați `Admin_empleados` și/sau `Admin_fichar-admin` la `true` pe `hera_facility_db` (și aliniați FE).
- Alternativ: politică produs „Admin bypass indiferent de `false`” — schimbare de regulă globală, **nu** doar Faza E; necesită aprobare dedicată.

Developer HERA (`empleados` / `fichar-admin` = true) vede deja KPI-urile.

## Referință contract

Vezi transcript Inicio / Resumen operativo — contract `GET /api/inicio/resumen-operativo`.
