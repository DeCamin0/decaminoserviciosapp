# Cum recreezi template-ul presupuesto (presupuesto-template.docx)

Dacă template-ul s-a stricat, îl poți reface pornind de la documentul tău original (cel cu design: fundal roșu, logo, filigrane).

---

## Pas 1: Pune documentul original

Ai nevoie de **o copie curată** a documentului de referință (ex. „DE CAMINO - PRESUPUESTO 2026 - CP LOS JUNCOS - …” sau orice DOCX complet cu toate secțiunile și designul).

- Copiază acel fișier **.docx** în folderul **`backend/assets/`**.
- Redenumește-l în: **`presupuesto-original.docx`**.

(Sau poți lăsa un singur .docx în `backend/assets/` al cărui nume conține „PRESUPUESTO” – scriptul îl găsește automat.)

---

## Pas 2: Rulează scriptul care recreează template-ul

În terminal, din folderul **backend**:

```bash
cd backend
npm run presupuesto:create-from-original
```

Se va crea/ suprascrie **`backend/assets/presupuesto-template.docx`** pe baza originalului. În documentul original scriptul înlocuiește doar:
- numele clientului → `{cliente_nombre}`
- numărul presupuesto (ex. MAD260216C) → `{numero_presupuesto}`

Restul rămâne la fel (design, texte, tabele). După asta **trebuie să adaugi tu** în Word placeholders pentru INDICE, SERVICIOS OFERTADOS, blocuri condiționale și tabelul dinamic – vezi **Pas 3**.

---

## Pas 3: Ce trebuie să adaugi tu în Word după ce template-ul e recreat

Deschizi **presupuesto-template.docx** în Word și faci **doar** modificările de mai jos. Fără ele, la generare vor apărea toate serviciile mereu sau tabelul nu va fi dinamic.

### 3.1 Tabel OFERTA ECONOMICA (tabelul cu DESCRIPCION | MENSUALIDAD | ANUALIDAD)

1. Mergi la secțiunea **OFERTA ECONOMICA** și la **tabel**.
2. **Șterge** rândurile 2, 3, 4 (toate rândurile de date), păstrează doar:
   - Rând 1: antet (DESCRIPCION, MENSUALIDAD, ANUALIDAD)
   - Rând 2: **un singur** rând de date (gol sau orice text)
3. În acel **singur rând de date**, în fiecare celulă pui:

   | Coloana 1 (DESCRIPCION) | Coloana 2 (MENSUALIDAD) | Coloana 3 (ANUALIDAD) |
   |-------------------------|-------------------------|------------------------|
   | `{#filas_oferta}` apoi `{descripcion}` | `{mensualidad_sin_iva}` și pe rând nou `{mensualidad_con_iva}` | `{anualidad_sin_iva}` și pe rând nou `{anualidad_con_iva}` și la final `{/filas_oferta}` |

   - Celula 1: `{#filas_oferta}` imediat urmat de `{descripcion}`.
   - Celula 2: `{mensualidad_sin_iva}` pe un rând, `{mensualidad_con_iva}` pe rândul următor.
   - Celula 3: `{anualidad_sin_iva}` pe un rând, `{anualidad_con_iva}` pe rândul următor, apoi `{/filas_oferta}`.

### 3.2 INDICE – sub „2. DESCRIPCION OPERATIVA”

1. Găsești în INDICE cele 3 rânduri: *2.1 Auxiliar de Servicios*, *2.2 Servicio de Limpieza*, *2.3 Jardineria*.
2. **Ștergi** cele 3 rânduri.
3. În locul lor, pe **3 paragrafe separate** (fiecare cu Enter la final):
   - Paragraf 1: `{#indice_lineas}` → Enter
   - Paragraf 2: `{.}` → Enter
   - Paragraf 3: `{/indice_lineas}`

### 3.3 SERVICIOS OFERTADOS (lista 1., 2., 3.)

1. Găsești cele 3 paragrafe: *1. Auxiliar de Servicios…*, *2. Servicio de Limpieza…*, *3. Jardinería…*.
2. **Ștergi** cele 3 paragrafe.
3. În locul lor, pe **3 paragrafe separate**:
   - Paragraf 1: `{#servicios_ofertados_lista}` → Enter
   - Paragraf 2: `{.}` → Enter
   - Paragraf 3: `{/servicios_ofertados_lista}`

### 3.4 Blocuri condiționale (doar serviciile din ofertă)

Ca să apară doar secțiunile pentru serviciile alese (Auxiliares / Limpieza / Jardineria):

- **Înainte** de titlul „AUXILIARES DE SERVICIOS” (sau „TAREAS OPERATIVAS” auxiliares): adaugi pe o linie **`{#mostrar_auxiliares}`**
- **După** tot blocul auxiliares (înainte de LIMPIEZA): **`{/mostrar_auxiliares}`**
- **Înainte** de „LIMPIEZA”: **`{#mostrar_limpieza}`**
- **După** tot blocul limpieza (înainte de JARDINERIA): **`{/mostrar_limpieza}`**
- **Înainte** de „JARDINERIA”: **`{#mostrar_jardineria}`**
- **După** tot blocul jardineria: **`{/mostrar_jardineria}`**

### 3.5 (Opțional) Titlurile să înceapă sus pe pagină

Ca JARDINERIA / LIMPIEZA / AUXILIARES să nu apară la mijlocul paginii:

- Selectezi paragraful cu **JARDINERIA** → Paragraf → tab „Línea y saltos de página” → bifezi **„Salto de página anterior”** (Page break before). La fel pentru **LIMPIEZA** și **AUXILIARES DE SERVICIOS** dacă vrei.

### 3.6 Salvezi

Ctrl+S și închizi Word. Template-ul e gata.

---

## Rezumat comenzi

```bash
# 1. Copiezi documentul original în backend/assets/presupuesto-original.docx
# 2. Rulezi:
cd backend
npm run presupuesto:create-from-original
# 3. Deschizi backend/assets/presupuesto-template.docx în Word și aplici modificările din Pas 3
```

Dacă nu ai documentul original (s-a pierdut), trebuie să refaci un DOCX de referință cu același design și apoi să îl pui ca `presupuesto-original.docx` și să rulezi din nou scriptul.
