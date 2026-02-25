# Cum rămân doar serviciile contractate în INDICE (DOCX)

---

## Tabel OFERTA ECONOMICA – ce trebuie în template

Ca în documentul generat să apară **doar rândurile pe care le ai în ofertă** (nu mereu 3 rânduri), tabelul din template trebuie să aibă **un singur rând de date** (sub rândul de antet), cu placeholders, nu 3 rânduri fixe.

### Ce faci în Word în template

1. Deschizi **presupuesto-template.docx** în Word.
2. Mergi la secțiunea **OFERTA ECONOMICA** și la **tabel** (DESCRIPCION | MENSUALIDAD | ANUALIDAD).
3. **Ștergi** rândurile 2, 3, 4 (toate rândurile de date din tabel), astfel încât să rămână doar:
   - **Rândul 1:** antetul (DESCRIPCION, MENSUALIDAD, ANUALIDAD)
   - **Rândul 2:** un singur rând gol (sau cu orice text, îl vom înlocui)
4. În acel **singur rând de date** (al doilea rând al tabelului), în fiecare celulă pui **exact**:

   | Coloana 1 (DESCRIPCION) | Coloana 2 (MENSUALIDAD) | Coloana 3 (ANUALIDAD) |
   |-------------------------|-------------------------|------------------------|
   | `{#filas_oferta}` + `{descripcion}` | `{mensualidad_sin_iva}` și pe rând nou `{mensualidad_con_iva}` | `{anualidad_sin_iva}` și pe rând nou `{anualidad_con_iva}` + `{/filas_oferta}` |

   Adică:
   - **Celula 1:** `{#filas_oferta}` imediat urmat de `{descripcion}` (fără spații în interiorul acoladelor).
   - **Celula 2:** `{mensualidad_sin_iva}` și pe linia următoare `{mensualidad_con_iva}`.
   - **Celula 3:** `{anualidad_sin_iva}` și pe linia următoare `{anualidad_con_iva}` și la final `{/filas_oferta}`.

5. Salvezi template-ul.

### Ce se întâmplă la generare

- Aplicația înlocuiește **`{#filas_oferta} … {/filas_oferta}`** cu atâtea rânduri câte ai în ofertă (1, 2 sau 3).
- Dacă ai doar un serviciu → apare 1 rând în tabel; dacă ai 3 → apar 3 rânduri.

**Important:** Dacă lași în template **3 rânduri fixe** (Auxiliar, Limpieza, Jardinería), Word va afișa mereu 3 rânduri. Trebuie **un singur rând** cu aceste placeholders ca numărul de rânduri să fie dinamic.

---

**Problema:** În documentul generat apar mereu toate 3: Auxiliar de Servicios, Servicio de Limpieza, Jardineria. Vrei să apară doar cele din ofertă.

**Soluția (o singură dată, în template):** Înlocuiești cele 3 rânduri fixe din template cu un placeholder. La generare, aplicația pune acolo doar serviciile contractate.

---

## Pași exacți

1. **Deschide în Word** fișierul template:
   - `backend/assets/presupuesto-template.docx`
   - (sau de unde rulează aplicația – același fișier pe care îl folosește la „Generar presupuesto”.)

2. **Găsește în document** secțiunea **INDICE** și sub **„2. DESCRIPCION OPERATIVA”** cele 3 rânduri:
   - Auxiliar de Servicios  
   - Servicio de Limpieza  
   - Jardineria  

3. **Șterge** aceste 3 rânduri complet (cele 3 paragrafe/liniile de text).

4. **În locul lor** scrie **exact pe 3 paragrafe separate** (obligatoriu ca să iasă unul sub altul):
   - **Paragraf 1:** scrie doar `{#indice_lineas}` și apasă **Enter** (nu pune nimic altceva pe acest rând).
   - **Paragraf 2:** scrie doar `{.}` (punct între acolade) și apasă **Enter**.
   - **Paragraf 3:** scrie doar `{/indice_lineas}`.

   **Important:** Fiecare etichetă trebuie să fie **singurul text** pe acel paragraf. Dacă ai spații înainte/după sau toate pe un rând, va ieși tot lipit (2.1...2.2...2.3). Verifică cu Click în fața lui `{.}` și cu săgeata în jos – cursorul trebuie să treacă pe rândul următor, nu în același paragraf.

5. **Salvează** template-ul (Ctrl+S) și închide Word.

---

## Ce se întâmplă la generare

- Când generezi un presupuesto **doar cu Auxiliar de Servicios** → în INDICE va apărea doar: **2.1 Auxiliar de Servicios**.
- Când ai **Auxiliar + Limpieza** → vor apărea: **2.1 Auxiliar de Servicios** și **2.2 Servicio de Limpieza**.
- Când ai toate 3 → vor apărea toate 3, numerotate 2.1, 2.2, 2.3.

Aplicația înlocuiește `{indice_descripcion_operativa}` cu aceste rânduri; nu se mai modifică XML-ul documentului, deci DOCX-ul se deschide mereu în Word.

---

## Dacă nu vezi placeholder-ul după salvare

- Asigură-te că ai scris **exact** `{#indice_lineas}{.}{/indice_lineas}` (litere mici, punct în `{.}`).
- După ce salvezi, în Word poți vedea în continuare `{indice_descripcion_operativa}` – e normal; înlocuirea se face **la generare** (când apeși „Generar presupuesto” / descarci DOCX-ul).

---

---

## Secțiunea „SERVICIOS OFERTADOS” (1. Auxiliar..., 2. Servicio..., 3. Jardinería...)

Ca să apară doar serviciile ofertate și aici (cu numerotare 1., 2., 3.):

1. În **același** template (**presupuesto-template.docx**) găsești secțiunea **SERVICIOS OFERTADOS** și textul de genul:
   - *1. Auxiliar de Servicios: Servicio 24 horas al día, 365 días al año.*
   - *2. Servicio de Limpieza: 4 horas diarias, de lunes a viernes. Festivos no incluidos.*
   - *3. Jardinería: 1 visita semanal. Festivos no incluidos.*
2. **Șterge** aceste 3 paragrafe.
3. În locul lor scrie cu **fiecare etichetă pe paragraful ei** (apasă Enter între ele):
   - **Paragraf 1:** `{#servicios_ofertados_lista}` apoi **Enter**.
   - **Paragraf 2:** doar `{.}` apoi **Enter**.
   - **Paragraf 3:** `{/servicios_ofertados_lista}`.

   Dacă pui totul pe un rând, textul va ieși lipit (1....2....3.). Trebuie **{.} pe rândul lui**.
4. Salvează template-ul.

La generare vor apărea doar liniile pentru serviciile din ofertă, numerotate 1., 2., 3., fiecare pe rândul ei.

---

## Blocuri DESCRIPCION OPERATIVA (AUXILIARES, LIMPIEZA, JARDINERIA)

Ca să apară **doar** secțiunile pentru serviciile ofertate (ex. doar JARDINERIA când oferta e doar jardineria, doar AUXILIARES când e doar auxiliar):

Aplicația trimite deja variabilele `mostrar_auxiliares`, `mostrar_limpieza`, `mostrar_jardineria`. În template trebuie să **înconjori** fiecare bloc mare cu etichete condiționale.

### 1. Bloc AUXILIARES DE SERVICIOS (TAREAS OPERATIVAS + TAREAS MANTENIMIENTO)

- **La începutul** blocului (înainte de „AUXILIARES DE SERVICIOS” / „TAREAS OPERATIVAS”) adaugă pe o linie: **`{#mostrar_auxiliares}`**
- **La sfârșitul** blocului (după ultimul paragraf cu „Reglamento de Seguridad Privada” și înainte de LIMPIEZA) adaugă: **`{/mostrar_auxiliares}`**

Astfel tot conținutul dintre cele două etichete (TAREAS OPERATIVAS + TAREAS MANTENIMIENTO) va apărea doar când în ofertă este Auxiliar de Servicios.

### 2. Bloc LIMPIEZA (TAREAS OPERATIVAS + tabelul SERVICIO DE LIMPIEZA)

- **Înainte de** „LIMPIEZA” / „TAREAS OPERATIVAS” (secțiunea de limpieza): **`{#mostrar_limpieza}`**
- **După** tot conținutul limpieza (tabel, texte) și înainte de JARDINERIA: **`{/mostrar_limpieza}`**

### 3. Bloc JARDINERIA (TAREAS JARDINERIA + lista cu bullet-uri)

- **Înainte de** „JARDINERIA” / „TAREAS JARDINERIA”: **`{#mostrar_jardineria}`**
- **După** ultimul punct („El agua consumida será por cuenta del cliente.”): **`{/mostrar_jardineria}`**

### Exemplu (ordine în document)

```
{#mostrar_auxiliares}
AUXILIARES DE SERVICIOS
TAREAS OPERATIVAS
...
TAREAS MANTENIMIENTO
...
Quedan exentas...
{/mostrar_auxiliares}

{#mostrar_limpieza}
LIMPIEZA
TAREAS OPERATIVAS
...
SERVICIO DE LIMPIEZA | FRECUENCIA
...
{/mostrar_limpieza}

{#mostrar_jardineria}
JARDINERIA
TAREAS JARDINERIA
- Limpieza de malas hierbas...
...
{/mostrar_jardineria}
```

Dacă etichetele sunt pe rânduri proprii, păstrează un singur paragraf gol între blocuri dacă vrei spațiu. La generare, docxtemplater afișează doar blocurile pentru care `mostrar_...` e true (în funcție de serviciile din ofertă).

---

## Titlurile de secțiune să înceapă mereu sus pe pagină (JARDINERIA, LIMPIEZA, AUXILIARES)

Dacă vrei ca **JARDINERIA**, **LIMPIEZA** și **AUXILIARES DE SERVICIOS** să nu apară niciodată la mijlocul paginii (când deasupra e puțin conținut), ci mereu **de la începutul unei pagini noi**:

1. Deschide **presupuesto-template.docx** în Word.
2. Pentru fiecare titlu de secțiune mare:
   - **AUXILIARES DE SERVICIOS** (paragraful cu acest text)
   - **LIMPIEZA** (paragraful cu acest text)
   - **JARDINERIA** (paragraful cu acest text)
3. **Selectează** paragraful (click în text sau triplu-click pe rând).
4. Deschide setările de paragraf:
   - Click dreapta → **Paragraf** / **Paragraph**, sau
   - Din ribbon: **Inicio** → grup **Párrafo** → săgeata din colț („Parágrafo”).
5. Mergi la tab-ul **„Línea y saltos de página”** (sau „Line and Page Breaks”).
6. Bifează **„Salto de página anterior”** / **„Page break before”** (salt de pagină înainte).
7. Confirmă cu **Aceptar**.
8. Repetă pașii 3–7 pentru celelalte două titluri (LIMPIEZA, JARDINERIA).
9. Salvează template-ul (Ctrl+S).

**Rezultat:** La generare, Word va pune automat o pagină nouă **înainte** de fiecare dintre aceste titluri. Astfel, indiferent câte servicii sunt în ofertă și cât de lung e conținutul de mai sus, titlurile vor apărea mereu sus pe pagină.

---

## Rezumat

| Unde în template | Ce pui | Ce face la generare |
|------------------|--------|---------------------|
| **INDICE** (sub 2. DESCRIPCION OPERATIVA) | `{#indice_lineas}{.}{/indice_lineas}` | Doar 2.1 / 2.2 / 2.3, **unul sub altul** |
| **SERVICIOS OFERTADOS** (lista 1., 2., 3.) | `{#servicios_ofertados_lista}{.}{/servicios_ofertados_lista}` | Doar 1. / 2. / 3., **unul sub altul** |
| **Început bloc AUXILIARES** | `{#mostrar_auxiliares}` | Afișează blocul doar dacă oferta include Auxiliar |
| **Sfârșit bloc AUXILIARES** | `{/mostrar_auxiliares}` | |
| **Început bloc LIMPIEZA** | `{#mostrar_limpieza}` | Afișează blocul doar dacă oferta include Limpieza |
| **Sfârșit bloc LIMPIEZA** | `{/mostrar_limpieza}` | |
| **Început bloc JARDINERIA** | `{#mostrar_jardineria}` | Afișează blocul doar dacă oferta include Jardineria |
| **Sfârșit bloc JARDINERIA** | `{/mostrar_jardineria}` | |
