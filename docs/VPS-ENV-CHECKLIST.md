# VPS: Verificare .env și pregătire Client 1 + Client 2

## 1. Verifici ce env ai acum (Client 1)

Pe VPS:
```bash
cd /opt/decaminoserviciosapp/backend
cat .env | grep -E "^[A-Z_]+=" | cut -d= -f1 | sort
```

Compară cu variabilele din **backend/.env.example** (lista de mai jos). Ce lipsește din `.env` pe VPS, completezi.

**Variabile obligatorii Client 1 (Decamino):**
- `PORT=3000`
- `CORS_ORIGINS`, `API_URL` (domenii producție)
- `DB_TYPE`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` (decamino_db)
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- Toate `COMPANY_*`, `FRONTEND_APP_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (gestoria); opțional `TELEGRAM_BOT_TOKEN_GENERAL`, `TELEGRAM_CHAT_ID_GENERAL`, `TELEGRAM_CLIENT_LABEL`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (push)
- Opțional: `N8N_BASE_URL`, `DATABASE_URL`

Când **.env pentru Client 1 e complet și corect**, treci la Client 2.

---

## 2. Pregătești .env pentru Client 2 (HERA)

**Variantă A – pornind de la .env Client 1 (copie + înlocuiri):**
```bash
cp .env .env.client2
# Apoi editezi .env.client2 și înlocuiești DOAR variabilele de mai jos cu valorile HERA.
```

**Variantă B – pornind de la șablonul HERA (recomandat):**
```bash
cp .env.client2.example .env.client2
nano .env.client2   # completezi parolele și ce e cu your-*
```

**Ce trebuie să fie în .env.client2 (diferit de Client 1):**

| Variabilă | Client 1 (.env) | Client 2 (.env.client2) |
|-----------|-----------------|-------------------------|
| `PORT` | 3000 | **3002** |
| `DB_NAME` | decamino_db | **hera_facility_db** |
| `DB_USERNAME` / `DB_PASSWORD` | (Decamino) | (user/parolă HERA) |
| `JWT_SECRET` | (secret Decamino) | **alt secret** (ex. hera-client2-secret-...) |
| `CORS_ORIGINS` | app.decaminoservicios.com,... | **https://app.herafs.com,https://herafs.com** |
| `API_URL` | api.decaminoservicios.com | **https://api.herafs.com** |
| `FRONTEND_APP_URL` | app.decaminoservicios.com | **https://app.herafs.com** |
| Toate `COMPANY_*` | DeCamino | **HERA** (vezi .env.client2.example) |
| `COMPANY_LOGO_PATH` | logo.png | **LOGO_hera.png** |
| `COMPANY_PORTADA_BG` | (lipsă → roșu) | **#9EC9E6** |
| `COMPANY_PORTADA_TEXT_COLOR` | (lipsă → alb) | **#1e3a5f** |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | gestoria Decamino | **gol** (HERA nu folosește gestoria) |
| `TELEGRAM_BOT_TOKEN_GENERAL` / `TELEGRAM_CHAT_ID_GENERAL` | (opțional) | **copie din .env** (același chat, mesaje [HERA]) |
| `TELEGRAM_CLIENT_LABEL` | DeCamino | **HERA** |
| `SMTP_*` (general) | Decamino | **gol** (sau alt SMTP HERA) |
| `SMTP_PEDIDOS_*` | (opțional) | **copie din .env** dacă HERA trimite email la pedidos |

**Nu copiazi din .env în .env.client2:** parole DB, JWT_SECRET (trebuie altul pentru HERA), COMPANY_* (toate sunt altele). Poți copia: TELEGRAM_BOT_TOKEN_GENERAL, TELEGRAM_CHAT_ID_GENERAL, eventual SMTP_PEDIDOS_* dacă e același server.

---

## 3. Pe VPS după ce ambele env sunt gata

- **Client 1:** serviciul `decamino-backend` folosește **.env** (implicit), port 3000.
- **Client 2:** serviciul `hera-backend` trebuie să aibă `Environment=ENV_FILE=.env.client2` și `PORT=3002` (vezi `docs/VPS-HERA-CHECKLIST-SIGUR.md`).

După deploy: `./deploy-backend.sh` actualizează codul și repornește ambele servicii (dacă `hera-backend.service` există).
