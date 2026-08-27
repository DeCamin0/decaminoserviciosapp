# CHECKPOINT DeCamino — 2026-08-13

**Objetivo:** retomar mañana exactamente aquí, sin reanalizar todo.  
**Regla viva:** Legacy `/presupuestos-informes` y su PDF/API **no se tocan**.  
**Git (fin de sesión):** `main` @ `543baad` (incluye `e5f9d75` V2 + impersonación).  
**Deploy:** código pusheado; backend VPS = `cd /opt/decaminoserviciosapp/backend && ./deploy-backend.sh`. Frontend Decamino `frontend/dist/` está en `.gitignore` (build local); HERA `dist-client2/` va en git.

---

## 1. Presupuestos V2

### DONE (implementado hoy / estado estructural)

| Área | Estado |
|------|--------|
| Fundación V2 separada (`/api/v2/*`, UI `/presupuestos-v2`) | DONE — Legacy intacto |
| Configuración (servicios, parámetros, series, empresa/marca) | DONE |
| Servicios comerciales configurables | DONE |
| Motores de cálculo (1 servicio → 1 motor) | DONE |
| Parámetros + auditoría | DONE |
| Cálculo backend | DONE |
| Borradores | DONE |
| Numeración configurable al Emitir | DONE |
| Snapshots (emit) | DONE |
| Cliente snapshot | DONE |
| Company / brand | DONE |
| Multi-servicio | DONE |
| Opciones / variantes | DONE |
| Alternativa / Extra | DONE |
| Nueva versión (preserva contenido local) | DONE |
| Combinado `Auxiliar de Servicios y Limpieza` (`auxiliar_limpieza` + motor auxiliares) | DONE |
| Jornada / horarios / festivos | DONE |
| Servicios periódicos (contenido, no acumulables) | DONE |
| Digitales / Vecindario (nivel documento) | DONE |
| Contenido local por línea/presupuesto | DONE |
| Restaurar desde plantilla | DONE |
| Upload logo marca → R2 | DONE |
| Contenido/bloques desde Legacy + seed boot | DONE |
| Config → pestaña Contenido / Plantillas | DONE |
| PDF V2 comercial (`v2-pdf-6`: portada, índice, operativa, economía, etc.) | DONE código |
| `Pendiente de cálculo` en PDF | DONE |
| Garantía / condiciones / aceptación visual (brand) | DONE |
| Snapshots + PDF EMITIDO inmutables | DONE |

**Producto lock (no romper):** 1 Servicio Comercial → 1 Motor; sin motor compuesto / selection groups; variantes EXCLUSIVAS; periódicos = contenido; Vecindario = digitales documento; **PARA antes de Email/Firma/Portal**.

**Paths clave:**
- BE: `backend/src/presupuestos-v2/`
- FE: `frontend/src/pages/PresupuestosV2Page.jsx`, `frontend/src/pages/presupuestos-v2/`
- Migraciones: `backend/prisma/migrations/20260813160000_*` … `20260813240000_*`
- Permisos seed: `backend/scripts/add-presupuestos-v2-permissions.js`

### EN PRUEBAS — PDF / editor NO cerrados

Generator/editor V2 = **structuralmente complet**.  
PDF **no** se considera aprobado hasta review visual.

Checklist probe (hacer mañana):
- [ ] Crear presupuesto real
- [ ] Caso Guadalajara
- [ ] Revisar PDF completo: portada, índice, descripciones, tareas, horarios, periódicos, variantes, Vecindario, propuesta económica, garantía, condiciones, aceptación, paginación
- [ ] Responsive / editor UX

### PENDIENTE (después de aprobar PDF — NO implementar ahora)

1. Email / envío del presupuesto  
2. Flujo aceptación cliente  
3. Selección opciones: exactamente 1 alternativa; 0..N extras; total final  
4. Firma digital  
5. PDF firmado / documento aceptado  
6. Portal cliente (si se integra en el mismo flujo)  
7. Audit/status: Emitido, Enviado, Visto?, Aceptado, Rechazado, Caducado, Anulado…  
8. Conversión Presupuesto → Contrato / Factura — **NO ahora**

*(En código hay util `sumSelectedOptions` comentada como “future firma”; no hay endpoints V2 de email/aceptación/firma.)*

---

## 2. Recuperación / restablecimiento de contraseña

**Marca: EN PRUEBAS — NO CERRADO** (no asumir production-ready).

### Implementado (código)

| Pieza | Detalle |
|-------|---------|
| Self-serve forgot | `POST /api/auth/forgot-password` → `PasswordResetService` |
| Self-serve reset | `POST /api/auth/reset-password` con token |
| FE | `ForgotPasswordPage`, `ResetPasswordPage` (`/restablecer-contrasena?token=`) |
| Login link | «¿Has olvidado tu contraseña?» |
| Token | random 32 bytes base64url; **solo hash SHA-256** en DB (`password_reset_tokens`) |
| TTL | **60 min** (`PASSWORD_RESET_TTL_MS`) |
| Un solo uso | `usedAt`; tokens previos activos del usuario se invalidan al pedir uno nuevo |
| Email | HTML con botón + URL; requiere SMTP (`EmailService.isConfigured()`); si no hay SMTP → respuesta genérica OK sin mail |
| Anti-enumeración | siempre mensaje genérico |
| Rate limit | in-memory sliding window (IP + email forgot; IP reset) — **por proceso Node** |
| Password | bcrypt; bump `AUTH_VERSION` (invalida JWT/refresh) |
| Admin reset | sigue existiendo: `POST /api/empleados/reset-password/:codigo` (temporal + email) — aparte del self-serve |
| Tests unitarios | `password-reset.service.spec.ts`, utils specs |

### Commits relacionados

- `a26566e` feat bcrypt + self-serve reset  
- `18b9f10` builds frontend post-reset  

### Qué falta / verificar en pruebas

- [ ] Flujo real E2E en staging/prod: forgot → email llega → link → nueva pass → login  
- [ ] `FRONTEND_APP_URL` / `company.frontendAppUrl` correcto por tenant (Decamino vs HERA)  
- [ ] SMTP prod configurado en ambos backends  
- [ ] Usuarios INACTIVO: forgot no envía (mensaje genérico) — OK by design; validar UX  
- [ ] Rate limit multi-instancia (in-memory no se comparte entre procesos)  
- [ ] Migración bcrypt usuarios legacy aún en plaintext (métrica: `GET /api/auth/password-migration-stats`)  
- [ ] No hay checklist QA formal cerrado en docs

---

## 3. Otras piezas abiertas (solo lo real)

### Impersonación «Entrar como este empleado» — EN PRUEBAS (hoy)

- BE: `POST /api/auth/impersonate/:codigo` (Manager/Developer + scope; permite INACTIVO; no nested)  
- FE: botón en ficha Empleados; banner AppShell «Volver a mi cuenta»; backup tokens en `sessionStorage`  
- **Sin QA E2E documentado** → probar mañana: entrar / ver como empleado / volver / logout limpia backup  

### Config V2 429 Throttler — mitigado

- Causa: loop FE `loadAll` + callbacks inestables  
- Fix: load once + refs; `@SkipThrottle()` en controllers `/api/v2/config` y `/api/v2/presupuestos`  
- Verificar que no reaparezca tras deploy  

### Deploy / builds

- Backend: falta confirmar `./deploy-backend.sh` en VPS (migrate V2 + restart)  
- Frontend Decamino: `npm run build:frontend:decamino:prod` → subir `frontend/dist/` (no está en git)  
- HERA: `dist-client2` en `543baad`  

### Docs Legacy (no V2)

- `docs/PENDIENTE-manana-presupuestos.md` (abr 2026): páginas fijas Portal/Vecindario en **PDF Legacy** — pendiente Legacy, **no** es el next de V2  

### Carpetas locales sin commit

- `_contrato_preview/`, `cuadrante test/` — no forman parte del checkpoint de producto  

---

## 4. NEXT exact (mañana)

1. **Confirmar deploy backend** (migraciones V2 aplicadas) + FE Decamino en prod si hace falta.  
2. **Probe reales Presupuestos V2** (lista §1 EN PRUEBAS), especialmente PDF Guadalajara — **sin** empezar Email/Firma.  
3. En paralelo o después del PDF: **cerrar pruebas** password reset + smoke **impersonación**.  

No implementar Email / aceptación / firma / portal V2 hasta **PARA** visual del PDF.

---

## 5. Comandos útiles para retomar

```bash
# Local FE
cd frontend && npm run build:frontend:prod:all

# VPS backend
cd /opt/decaminoserviciosapp/backend && ./deploy-backend.sh

# Permisos V2 (si faltan en un tenant)
node scripts/add-presupuestos-v2-permissions.js

# Tests reset (backend)
npx jest password-reset --passWithNoTests
```

Rutas UI: `/presupuestos-v2`, login → forgot → `/restablecer-contrasena`, Empleados → ficha → «Entrar como este empleado».

---

*Checkpoint escrito 2026-08-13 — solo documentación, sin cambios de funcionalidad.*
