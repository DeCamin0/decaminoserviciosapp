# TODO – Presupuestos Piscina (22 feb 2026)

Resumen de todo lo hecho hoy para saber dónde hemos quedado.

---

## Hecho hoy

### 1. Formulario piscina – Horas, Días y precio mensual
- [x] Añadidos campos **Horas** y **Días** al estado `presupuestoCalculoPiscina` y `presupuestoCalculoPiscinaRest`.
- [x] En el formulario de piscina: inputs **Concepto**, **Horas**, **Días**, **Precio sin IVA**.
- [x] Descripción tipo "Mantenimiento verano: X horas – Y días" cuando hay horas y días (en oferta y backend).

### 2. Precio solo por temporada (no anual) en piscina
- [x] En el formulario de piscina: **eliminado** el bloque "Anual sin IVA / Anual con IVA".
- [x] Precio en piscina es **solo por temporada** (no se muestra ni calcula anual en el form).

### 3. Formato español del precio (12.600 = 12600)
- [x] Helper **parsePrecioEurosSpanish**: punto = miles, coma = decimal (12.600 → 12600, 1.234,56 → 1234,56).
- [x] Cálculos IVA y Total en el form piscina usan este parser.
- [x] **normalizarPiscinaParaPayload** convierte el precio con este formato antes de enviar (backend recibe 12600, no 12,6).
- [x] Input precio piscina: `type="text"` con placeholder "Ej: 12600 o 12.600" para poder escribir 12.600.

### 4. OFERTA ECONÓMICA – Solo 2 columnas para piscina
- [x] Cuando **todas** las filas son piscina: tabla con **2 columnas** (DESCRIPCION, MENSUALIDAD) — sin columna ANUALIDAD.
- [x] Lo mismo en el modal de **vista previa** del presupuesto.

### 5. Etiqueta "Temporada" en vez de "Mensualidad" para piscina
- [x] En el **formulario** piscina: "Precio sin IVA (€/temporada)" y "Total con IVA (temporada)".
- [x] En la **tabla OFERTA ECONÓMICA** (frontend): cuando solo hay piscina, cabecera de la columna de precio = **TEMPORADA** (no MENSUALIDAD).
- [x] En el **PDF** (backend): cuando la oferta es solo piscina, tabla con 2 columnas (DESCRIPCIÓN, **TEMPORADA**) y **sin** columna ANUALIDAD.

### 6. Variantes para piscina
- [x] En "Presupuesto para" (tags de servicios): botón **"+ variante"** y **papelera** también para el servicio **piscina**.
- [x] Añadir variante: duplica el servicio en la lista y añade un bloque de cálculo piscina (copia de la última variante).
- [x] Eliminar variante: quita la fila y actualiza estado (si se borra la 1ª, la 2ª pasa a ser la 1ª).
- [x] En el bloque de formulario piscina: título "Mantenimiento integral piscina comunitaria — Variante 1", "Variante 2", etc. cuando hay más de una.

---

## Archivos tocados

- **Frontend:** `frontend/src/pages/PresupuestosInformesPage.jsx`
  - Estado piscina (horas, dias), normalizer, descripcionPiscina, parsePrecioEurosSpanish.
  - Form piscina (inputs, sin bloque anual, label temporada).
  - OFERTA: 2 columnas si solo piscina, cabecera TEMPORADA.
  - Variantes: + variante y eliminar para piscina en el map de tags.
- **Backend:** `backend/src/services/presupuesto-documento.service.ts`
  - Descripción piscina con "Mantenimiento verano: X horas – Y días" si hay horas/días.
  - PDF oferta económica: si solo piscina → 2 columnas (DESCRIPCIÓN, TEMPORADA), sin ANUALIDAD.

---

## Por si acaso mañana

- Si hace falta **DOCX** (plantilla Word) con tabla "TEMPORADA" para piscina, habría que revisar cómo se rellenan las celdas en el servicio DOCX (placeholders tipo `{#filas_oferta}` y si se puede omitir anualidad o cambiar etiqueta por fila).
- Probar guardar/cargar presupuesto con varias **variantes** piscina y generar PDF para confirmar que todo persiste y se imprime bien.

---

*Última actualización: 22 feb 2026.*
