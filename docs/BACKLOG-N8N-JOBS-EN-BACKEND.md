# Backlog: migrare job-uri n8n → backend

Notă pentru implementare viitoare (fără obligație de dată). Surse analizate: exporturi JSON n8n din repo.

---

## 1) Cron absente → backend

**Fișier sursă:** `backend/n8n-snapshots/Cron absente.json` (și copie la rădăcină repo dacă există).

**Comportament actual (n8n):**

- Trigger cron: **zilnic 09:15 și 19:30**.
- Query MySQL pe `Ausencias`: absențe care intersectează **[azi, azi + 10 zile]** (parse `FECHA` interval / zi unică).
- Formatare mesaj (RO) + **Telegram** (`parse_mode` Markdown), chat ID din workflow.

**Implementare backend (orientativ):**

- Job programat (ex. `@nestjs/schedule` / cron) cu **timezone** explicit (ex. `Europe/Madrid`).
- Același SQL sau echivalent via serviciu + client DB existent.
- Apel **Telegram Bot API** (`sendMessage`): token + `chatId` din **env** (nu hardcodat).
- **Multi-client:** rulează per tenant / per bază (`decamino_db` + `hera_facility_db`) — vezi `.cursor/rules/multi-client-databases.mdc`.

**După migrare:** dezactivat workflow-ul în n8n ca să nu se dubleze notificările.

---

## 2) Notificări fichaje „universal” → backend

**Fișier sursă:** `notificari fichaje universal.json` (rădăcină proiect).

**Comportament actual (n8n):**

- Trigger cron: **7:45, 9:15, 13:15, 17:15, 19:45, 23:15** (nod denumit „Cron 08:00” în export).
- Listă angajați din `DatosEmpleados` cu filtre (în snapshot: centru fix **Officina - DE CAMINO…**, email obligatoriu, activi).
- Per angajat: `cuadrante` (slot zi) **sau** ramură `horarios` (centro + grupo); logică **Ausencias**, **fiestas**, **MutuaCasos**, verdict `estado_fichaje`.
- Verificare ultim **`Fichaje`** azi; trimitere **email SMTP** (HTML), BCC RRHH din workflow.

**Implementare backend (orientativ):**

- Job(e) programate cu aceleași ore (sau config din env).
- Parametrizare **centru / clienți** — astăzi nu e „universal” în JSON (centru hardcodat); pentru HERA trebuie env sau listă configurabilă.
- SMTP din env (deja pattern posibil în backend); **rate limiting** / coadă dacă sunt mulți destinatari.
- Păstrare **ambele ramuri** (cuadrante vs horarios) și diferențele de SQL **MutuaCasos** între ramuri.
- Verificare nod nefolosit în export: `MySQL - Empleados Developer1` (fără conexiuni) — ignorat sau curățat la portare.

**După migrare:** dezactivat workflow-ul în n8n.

---

## Referințe rapide

| Item            | Canal   | Artefact JSON                          |
|-----------------|---------|----------------------------------------|
| Absențe 10 zile | Telegram | `backend/n8n-snapshots/Cron absente.json` |
| Fichaje         | Email   | `notificari fichaje universal.json`    |

---

*Adăugat: backlog notificări n8n → backend (sesiune martie 2026).*
