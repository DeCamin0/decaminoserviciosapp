## n8n snapshots for migration

Pune aici fișierele JSON exportate din n8n, câte unul per endpoint/flux. Recomandări:

- Denumește-le clar: `empleados-get.json`, `avatar-get.json`, `alertas-mensuales-detalle.json`, etc.
- Include în fișier (sau în același folder, un `_meta.txt`) parametrii folosiți (query/body) și o scurtă descriere a cazului.
- Nu include date sensibile (token-uri, date personale). Dacă trebuie, anonimizează-le.
- Dacă un endpoint are mai multe forme de răspuns, salvează mostre separate: `*-ok.json`, `*-error.json`, `*-empty.json`.

Folosim aceste mostre pentru a recrea/înlocui apelurile n8n în backend-ul Nest și pentru a valida că frontend-ul primește aceleași câmpuri.

