# Logo para PDFs de presupuesto

Los PDFs generados por el backend (presupuestos) incluyen el logo de la empresa **solo si existe** un fichero de imagen en esta carpeta.

- **Producción (VPS):** Coloca aquí **`logo.png`** (o `logo.jpg` / `logo.jpeg`).
  - Ruta en servidor: `backend/assets/logo.png`
  - Si en el repo solo tienes `logo.svg`, convierte a PNG (por ejemplo con [CloudConvert](https://cloudconvert.com/svg-to-png) o con Inkscape) y súbelo a esta carpeta en el VPS.

- **Desarrollo:** Si tienes el frontend en el mismo repo, el código también busca en `frontend/public/logo.png`.

Sin este fichero, el PDF se genera correctamente pero **sin logo** (solo texto y colores).
