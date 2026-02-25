# Flujo completo: «Aceptar y firmar» presupuesto

Así es el proceso de punta a punta cuando el cliente pulsa **«Firmar y aceptar»** en `firmar.html`.

---

## 1. Frontend (navegador) – `firmar.html`

### 1.1 Al hacer click en «Firmar y aceptar»
- Se valida: hay `?id=` en la URL, hay firma en el canvas, está marcado «Acepto el presupuesto…».
- Se construye el objeto **payload** con:
  - `quotation_id`, `numero_presupuesto`, `fecha_hora`
  - datos del formulario (nombre comunidad, CIF, dirección, representante, cargo, email, teléfono)
  - **`firma_base64`**: imagen de la firma en base64 (`signaturePad.toDataURL('image/png')`).
- El botón pasa a «Enviando...» y se deshabilita.

### 1.2 Generación del PDF (jsPDF)
- Se llama a **`generateAndDownloadPdf(payload, now)`**.
- Con **jsPDF** se crea un PDF en memoria con:
  - texto: «Documento firmado electrónicamente», nº presupuesto, fecha, comunidad, CIF, dirección, representante, email, teléfono.
  - imagen de la firma (`doc.addImage(payload.firma_base64, 'PNG', ...)`).
- Se obtiene el PDF como data URL:  
  **`pdfDataUrl = doc.output('dataurlstring')`**  
  Es un string largo del tipo:  
  `"data:application/pdf;base64,JVBERi0xLjQKJeLjz9M..."`  
  (solo caracteres ASCII base64: A–Z, a–z, 0–9, +, /, =).

### 1.3 Comprobar y adjuntar el PDF al payload
- Si `pdfDataUrl.length < 500` → se muestra error y se para (no se envía nada).
- Se hace **`payload.pdf_base64 = pdfDataUrl`** (el string completo, con prefijo `data:application/pdf;base64,...`).
- Se fuerza la **descarga** del PDF en el navegador (mismo `pdfDataUrl`).

### 1.4 Petición al backend
- **`fetch(API_BASE + '/api/presupuestos/firmado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })`**
- **API_BASE**: en local `http://localhost:3000`, en producción la URL del API.
- El **body** es JSON con todo el payload, incluido **`pdf_base64`** (string muy largo, ~500k caracteres).

---

## 2. Red / Servidor

- La petición llega al backend (NestJS).
- **Express** parsea el body con **`json({ limit: '500mb' })`**.
- Si el body es demasiado grande o está mal formado, podría truncarse o fallar aquí (en tu caso el body llega, ~494k caracteres).

---

## 3. Backend – `PresupuestosFirmadoController.firmado()`

### 3.1 Entrada
- **`body`**: objeto con `quotation_id`, `pdf_base64`, `fecha_hora`, datos del formulario, `firma_base64`, etc.
- **`body.pdf_base64`**: string tipo `"data:application/pdf;base64,JVBERi0..."`.

### 3.2 Comprobar presupuesto
- Se comprueba que exista el presupuesto con `body.quotation_id` en la base de datos.

### 3.3 Procesar el PDF (aquí falla si el base64 se corrompe)
- Se quita el prefijo:  
  `base64Raw = body.pdf_base64.replace(/^data:application\/pdf;base64,/, '')`
- Se sustituye espacio por `+`:  
  `base64Raw = base64Raw.replace(/ /g, '+')`
- Se quitan saltos de línea y tabuladores:  
  `base64Raw = base64Raw.replace(/[\r\n\t\f\v]/g, '')`
- Se normaliza a ASCII base64 (fullwidth → ASCII, etc.):  
  `base64Raw = normalizeBase64ToAscii(base64Raw)`
- **Decodificación**:  
  **`buffer = Buffer.from(base64Raw, 'base64')`**

**Problema actual:**  
- El string que llega tiene ~494 390 caracteres.
- Tras los pasos anteriores, la decodificación devuelve solo **20 bytes** y no empieza por `%PDF`.
- Eso indica que **casi todo el string base64 no se está decodificando bien** (caracteres que Node no considera base64 válido o que la normalización está eliminando).

### 3.4 Si el buffer es válido (más de 100 bytes y cabecera `%PDF`)
- Se guarda el PDF en disco:  
  `uploads/presupuestos-firmas/aceptacion-{id}-{timestamp}.pdf`
- Se rellena **`pdfPath`** para la base de datos.
- Se guarda el mismo **`buffer`** en **`pdfBuffer`** para el email.

### 3.5 Base de datos
- Se inserta una fila en **`presupuestos_firmas`** con:
  - todos los datos del formulario,
  - `firma_imagen_base64`,
  - **`pdf_path`** (si el PDF se guardó; si no, queda `null`).

### 3.6 Email
- Si hay **`pdfBuffer`** y **email del cliente**:
  - Se envía un correo a ese email con el PDF adjunto (mismo buffer).
- Si no hay buffer válido → no se envía email (y en log sale «no hay PDF válido»).

### 3.7 Respuesta
- Se devuelve:  
  `{ success: true, message: '...', quotation_id, email_enviado }`

---

## 4. Frontend – tras la respuesta

- Si la petición va bien: se muestra el mensaje de éxito y, si `email_enviado === true`, se añade «Se ha enviado una copia a su correo».
- El botón pasa a «Completado» y se queda deshabilitado.
- Si hay error de red o respuesta no OK: se muestra el error y el botón vuelve a «Firmar y aceptar».

---

## Resumen: dónde se «rompe» ahora

| Paso | Qué pasa | Dónde está el fallo |
|------|----------|----------------------|
| 1–2 | Frontend genera PDF y envía JSON con `pdf_base64` largo | OK (llegan ~494k caracteres). |
| 3.3 | Backend decodifica `base64Raw` → `Buffer.from(..., 'base64')` | **Aquí:** el buffer resultante es de 20 bytes y no es PDF válido. |
| 3.4 | Solo si buffer válido → se guarda PDF y `pdf_path` | No se cumple → `pdf_path` queda `null`. |
| 3.6 | Solo si hay `pdfBuffer` → se envía email | No hay buffer válido → no se envía email. |

Conclusión: el fallo está en **cómo se transforma el string `body.pdf_base64` en bytes en el backend** (paso 3.3). El string llega largo, pero algo (encoding del string, caracteres no-ASCII, o cómo Node decodifica) hace que solo se obtengan 20 bytes inválidos. El siguiente paso es hacer la decodificación más robusta (por ejemplo pasando por UTF-8 y quedarnos solo con bytes base64 válidos) y/o registrar los primeros bytes del string recibido para ver exactamente qué llega.
