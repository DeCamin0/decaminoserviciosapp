# Presupuesto Piscina — Implementado

## Hecho
- **Botón "Crear nuevo presupuesto piscina"**: al pulsar se abre el modal en modo piscina (solo se elige cliente; el servicio es fijo: SERVICIO DE MANTENIMIENTO INTEGRAL EN PISCINA COMUNITARIA). No se muestran checkboxes de servicios.
- **Servicio piscina**: si no existe en la lista, se crea automáticamente al abrir el modal (nombre + descripción operativa).
- **Tipo "piscina" en frontend**: `derivarTipoDesdeServicio`, estado `presupuestoCalculoPiscina` / `presupuestoCalculoPiscinaRest`, bloque de formulario (concepto + precio sin IVA), OFERTA ECONOMICA, payload, carga al cargar presupuesto.
- **Backend PDF/DOCX**: `derivarTipoDesdeServicio` con `'piscina'`, `serviceTitles`, oferta económica, descripción operativa (2.x Mantenimiento integral piscina comunitaria), bullets en servicios ofertados.

## Opcional (mejoras futuras)
- Botón "Crear PISCINA" en la pestaña Servicios (como Crear JARDINERIA, CUBOS, etc.) por si se quiere crear el servicio manualmente.
- Ajustar textos o descripción del servicio de piscina si hace falta.
