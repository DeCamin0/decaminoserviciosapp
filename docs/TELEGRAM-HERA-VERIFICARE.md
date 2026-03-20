# Verificare Telegram HERA (client 2) – nu același bot/chat ca Decamino

## Problema

Dacă pe producție HERA folosește **același** `TELEGRAM_BOT_TOKEN` și `TELEGRAM_CHAT_ID` ca Decamino, toate notificările de gestoria HERA (nóminas, documentos, ausencias, pedidos, firmas, etc.) ajung în **chat-ul Telegram al Decamino**, nu într-unul dedicat HERA.

## Variabile care contează (backend)

| Variabilă | Rol | HERA trebuie DIFERIT de Decamino? |
|-----------|-----|-----------------------------------|
| `TELEGRAM_BOT_TOKEN` | Bot pentru notificări **gestoria** (nóminas, documentos, ausencias, pedidos, etc.) | **Da** – bot dedicat HERA |
| `TELEGRAM_CHAT_ID` | Chat-ul unde merg mesajele gestoria | **Da** – grup/canal dedicat HERA |
| `TELEGRAM_BOT_TOKEN_GENERAL` | Bot pentru erori / alerte generale | Opțional diferit |
| `TELEGRAM_CHAT_ID_GENERAL` | Chat pentru erori / alerte | Opțional diferit |
| `TELEGRAM_CLIENT_LABEL` | Doar prefix în mesaje, ex. `[HERA]` | `HERA` (nu schimbă destinatarul) |

**Concluzie:** Pentru ca notificările HERA să meargă în chat-ul HERA, pe serverul HERA în `.env` (sau `.env.client2`) trebuie să fie setate **TELEGRAM_BOT_TOKEN** și **TELEGRAM_CHAT_ID** cu valorile **bot-ului și chat-ului HERA**, nu cu cele de la Decamino.

---

## Ce să verifici pe serverul HERA (producție)

1. **Unde e .env-ul HERA**  
   Exemplu: `/opt/decamino/backend/.env.client2` sau cum pornești tu backend-ul HERA (`ENV_FILE=.env.client2`).

2. **Ce token/chat folosește** (fără a afișa tokenul complet):
   ```bash
   cd /path/to/backend
   # Primele caractere din token (să vezi dacă e același ca la Decamino)
   grep -E '^TELEGRAM_BOT_TOKEN=' .env.client2 | sed 's/\(.\{20\}\).*/\1.../'
   grep -E '^TELEGRAM_CHAT_ID=' .env.client2
   ```
   Compară cu ce ai pe serverul Decamino pentru `.env` (client 1). Dacă tokenul și chat ID-ul sunt **identice** cu Decamino, notificările HERA merg în chat-ul Decamino.

3. **Endpoint health (dacă e deschis)**  
   `GET https://api.herafs.com/health/telegram` (sau URL-ul tău HERA) – arată dacă botul gestoria e configurat; nu expune tokenul.

---

## Cum corectezi

1. **Creează un bot dedicat HERA** (dacă nu există): Telegram → @BotFather → New Bot → copiază tokenul.
2. **Creează un grup Telegram** pentru echipa HERA (sau un canal), adaugă botul în grup, ia **chat ID** (ex. `-100xxxxxxxxxx` pentru supergrup).
3. Pe serverul HERA, în fișierul `.env` folosit la pornirea backend-ului HERA (ex. `.env.client2`):
   - Setează `TELEGRAM_BOT_TOKEN=<token_bot_HERA>`
   - Setează `TELEGRAM_CHAT_ID=<chat_id_grup_HERA>`
4. Repornește backend-ul HERA.
5. (Opțional) Trimite un mesaj de test: `POST .../health/telegram/test` cu body `{"message":"Test HERA"}` – ar trebui să apară în grupul HERA.

După ce faci schimbarea, notificările de gestoria de la HERA vor merge în chat-ul HERA, nu în cel Decamino.
