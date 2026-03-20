# Porcentaje de disponibilidad de vacaciones (mismo grupo, mismo día)

- **Tabla:** `vacaciones_disponibilidad_config` (fila `id = 1`, columna `porcentaje_grupo`, default `10.00`).
- **Backend:** `GET/PUT /api/solicitudes/vacaciones-disponibilidad-porcentaje` (PUT solo Admin/Developer/Manager/Supervisor).
- **UI:** Solicitudes → modal «Bloquear periodos para vacaciones» → bloque «Disponibilidad de vacaciones».

## Migración (obligatorio en las dos bases)

Desde la carpeta `backend`:

```bash
node scripts/run-vacaciones-disponibilidad-config-migration.js .env.decamino.local
node scripts/run-vacaciones-disponibilidad-config-migration.js .env.hera.local
```

Luego regenerar el cliente Prisma (cierra el servidor Nest si `EPERM` en Windows):

```bash
npx prisma generate
```
