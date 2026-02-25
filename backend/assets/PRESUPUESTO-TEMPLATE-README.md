# Plantilla DOCX para presupuestos

La plantilla **`presupuesto-template.docx`** se genera automáticamente con:

```bash
npm run presupuesto:build-template
```

Ese script crea un documento con los placeholders `{cliente_nombre}`, `{numero_presupuesto}`, `{fecha}` y la tabla de oferta con `{#filas_oferta}` … `{/filas_oferta}`. **No hace falta cargar ni editar nada a mano**: la plantilla ya viene incluida en el repo (generada por el script anterior).

---

### Opcional: usar tu documento original (portada roja, logo, filigrane)

Pentru același design ca documentul tău (fundal roșu, logo hexagonal, filigrane, culori):

1. Copiază documentul tău original (cel cu designul complet) în `backend/assets/` și redenumește-l în **`presupuesto-original.docx`**.
2. Rulează:
   ```bash
   npm run presupuesto:create-from-original
   ```
3. Se generează `presupuesto-template.docx` cu același design; scriptul înlocuiește automat textul client/număr cu `{cliente_nombre}` și `{numero_presupuesto}`.
4. (Opțional) Deschide template-ul în Word: în tabelul OFERTA ECONOMICA lasă un singur rând de date și pune în celule: `{#filas_oferta}{descripcion}`, `{mensualidad_sin_iva}`, `{mensualidad_con_iva}`, `{anualidad_sin_iva}`, `{anualidad_con_iva}{/filas_oferta}`. Salvează.
5. **Índice – solo servicios contratados (recomendado):** Para que en el DOCX generado aparezcan solo 2.1 / 2.2 / 2.3 según lo contratado:
   - Abre **presupuesto-template.docx** en Word.
   - En la sección **INDICE**, localiza las tres líneas: "2.1 Auxiliar de Servicios", "2.2 Servicio de Limpieza", "2.3 Jardineria".
   - **Bórralas** y escribe en su lugar **una sola línea** con exactamente: **`{indice_descripcion_operativa}`** (con las llaves).
   - Guarda el template.
   Así la aplicación reemplazará ese placeholder por solo las líneas contratadas (ej. "2.1 Auxiliar de Servicios" o "2.1 ... 2.2 ..." etc.). Es la forma más fiable; la eliminación por código de párrafos puede fallar si Word guarda el índice con numeración automática u otra estructura.

Dacă nu faci asta, aplicația folosește plantilla simplă generată de `presupuesto:build-template`.
