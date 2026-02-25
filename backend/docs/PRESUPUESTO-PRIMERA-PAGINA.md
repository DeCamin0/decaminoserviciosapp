# Prima pagină PDF Presupuesto – layout și imagini

## Cum e creată acum

- **Toată pagina** are fundal **roșu** (nu doar o bandă).
- **Stânga** (200px): logo sus, numele clientului (alb), PRESUPUESTO Nº (alb, subliniat), banda servicios, apoi web + telefon (alb).
- **Dreapta**: titlu PRESUPUESTO 2026 în **alb**, centrat; **filigrană** logo transparentă în fundal.
- **Footer** pe toată lățimea: text legal în alb.

## Imagini folosite (automat)

| Imagine         | Unde e folosită                              | Căi unde o caută codul |
|-----------------|----------------------------------------------|-------------------------|
| **logo.png**    | Stânga sus + filigrană pe zona dreaptă (pe roșu) | `backend/assets/logo.png`, `frontend/public/logo.png` |
| **servicios.png** | Bandă în panoul roșu (între nº și contact) | `backend/assets/servicios.png` |

- `logo.png`: în `backend/assets/` sau `frontend/public/`.
- `servicios.png`: în **`backend/assets/servicios.png`** (banda cu imagini servicii – camere, control, persoane etc.).

## Imagini opționale (dacă vrei exact ca în Word)

În documentul Word de referință apare și o **bandă orizontală cu 6 imagini mici** (cameră, ecran, persoană la birou, uniformă etc.) în panoul roșu, între număr presupuesto și contact.

Dacă vrei aceeași bandă în PDF, poți adăuga:

- **Variantă A**: 6 fișiere în `backend/assets/`:
  - `presupuesto-strip-1.png` … `presupuesto-strip-6.png`  
  (imagini pătrate mici, ex. 80×80 px fiecare)

- **Variantă B**: un singur fișier lung (bandă):
  - `presupuesto-strip.png`  
  (ex. 480×80 px – toate 6 imaginile alăturate)

După ce pui fișierele, spune și le integrăm în generator (momentan prima pagină se desenează fără bandă de imagini).

## Rezumat

- **Necesar**: `logo.png` (deja folosit).
- **Opțional**: 6 imagini mici sau 1 bandă `presupuesto-strip*.png` pentru panoul roșu.
