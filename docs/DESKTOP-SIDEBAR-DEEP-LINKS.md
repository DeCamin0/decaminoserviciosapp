# Desktop sidebar — deep-links (tab / vista)

Documentație deep-linkuri folosite de sidebar-ul global desktop (≥1200px).  
Compatibile cu URL-uri existente; paramii noi sunt doar `?tab=` / `?vista=` pe rutele deja definite.

## Navigare globală

| Element | Comportament |
|--------|----------------|
| Breakpoint | Sidebar doar `min-width: 1200px` |
| Persist collapse | `localStorage` key `decamino.desktopSidebar.collapsed` |
| Categorii open | `decamino.desktopSidebar.openCategories` |
| Permisiuni | Aceleași ca Inicio (`buildNavItems` + matricea existentă) |

## Deep-links pe module

### Solicitudes — `?vista=`
| URL | Secțiune |
|-----|----------|
| `/solicitudes?vista=lista` | Mis solicitudes |
| `/solicitudes?vista=nueva` | Nueva solicitud |
| `/solicitudes?vista=todas` | Todas (admin) |
| `/solicitudes?vista=estadisticas` | Estadísticas (admin) |

Filtre KPI Inicio (neschimbate): `seccion`, `periodo`, `estado`, `tipoAusencia`.

### Aprobaciones — `?tab=`
| URL | Tab |
|-----|-----|
| `/aprobaciones?tab=cambios` | Cambios de datos |
| `/aprobaciones?tab=regularizaciones` | Regularizaciones |
| `/aprobaciones?tab=rm` | Registro de jornada |

### Empleados — `?tab=` (+ `?estado=` existent)
| URL | Tab |
|-----|-----|
| `/empleados?tab=lista` | Lista |
| `/empleados?tab=adauga` | Añadir |
| `/empleados?tab=corregir-nombres` | Corregir nombres |
| `/empleados?tab=estadisticas` | Estadísticas |

`?estado=ACTIVO` (KPI Inicio) rămâne valid pe lista.

### Documentos empleados — `?tab=`
`empleados` | `gestoria-nominas` | `coste-personal` | `diplomas` | `certificados-retenciones`

### Cuadrantes — `?tab=`
`generar` | `lista_cuadrantes` | `lista_horarios` | `horarios` | `festivos` | `horario_multicentro` | `preview`

### Clientes — `?tab=`
`clientes` | `proveedores`

### Pedidos (admin) — `?tab=`
`nuevo-pedido` | `gestionar-pedidos` | `permisos` | `catalogo` | `notas`

### Pedidos (empleado) — `?tab=`
`/empleado-pedidos?tab=mis-pedidos` | `nuevo-pedido`

### Mensajes enviados — `?tab=`
`enviar` | `historial` | `automaticos` | `fichajeReminders` | `chatAi`

### Presupuestos V2 — `?tab=`
`lista` | `nuevo` | `editor` | `config`

## Sursă comună FE

- `frontend/src/navigation/buildNavItems.js`
- `frontend/src/navigation/navModuleChildren.js`
- `frontend/src/contexts/NavModulesContext.jsx`
- `frontend/src/hooks/useSyncedTab.js`
- `frontend/src/components/navigation/DesktopSidebar.jsx`

## Backend

Nicio modificare. Fără permisiuni noi.
