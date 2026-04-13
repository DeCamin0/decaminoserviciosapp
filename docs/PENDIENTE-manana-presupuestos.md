# Pendiente — presupuestos PDF (próxima sesión)

**Fecha anotada:** 2026-04-14 (para mañana / următoarea sesiune)

## 1. Dos páginas fijas en *todos* los presupuestos (PDF)

- **Página A — Portal empresarial (administración):** texto orientativo, **enlace clicable** en el PDF, indicar que pueden **visitar como demo**.
- **Página B — Aplicación Vecindario:** igual: descripción, **enlace**, mención **demo**.

**Dónde implementar:** `backend/src/services/presupuesto-documento.service.ts` — insertar antes de la sección de aceptación/firma (p. ej. tras condiciones / oferta), con URLs leídas de **variables de entorno** (ej. `PRESUPUESTO_URL_PORTAL_ADMIN`, `PRESUPUESTO_URL_VECINDARIO`) + valores por defecto razonables en `.env.example`.

**Contexto:** debe aparecer **independientemente** de los servicios contratados en el presupuesto.

## 2. Más cosas por añadir

*(El usuario indicó que tiene más puntos para mañana; ir completando aquí o en nuevos bullets.)*

---

*Nota interna del equipo; no es documentación de usuario final.*
