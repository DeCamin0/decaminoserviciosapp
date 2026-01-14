# Checklist pentru verificarea .env

## Variabile OBLIGATORII

### Server
- [ ] `PORT=3000`
- [ ] `CORS_ORIGIN=http://localhost:5173` (sau URL-ul de producție)

### Database (MariaDB)
- [ ] `DB_TYPE=mysql`
- [ ] `DB_HOST=217.154.102.115` (sau host-ul tău)
- [ ] `DB_PORT=3306`
- [ ] `DB_USERNAME=facturacion_user` (sau username-ul tău)
- [ ] `DB_PASSWORD=ParolaTare123!` (sau parola ta)
- [ ] `DB_NAME=decamino_db` (sau numele bazei de date)
- [ ] `DB_SYNC=false` (IMPORTANT: false în producție!)
- [ ] `DB_LOGGING=true` (sau false în producție)

### JWT
- [ ] `JWT_SECRET=decamino-super-secret-key-change-in-production` (schimbă în producție!)
- [ ] `JWT_EXPIRES_IN=7d`

### n8n Proxy
- [ ] `N8N_BASE_URL=https://n8n.decaminoservicios.com`
- [ ] `N8N_TIMEOUT=30000`

### SMTP (pentru email notifications)
- [ ] `SMTP_HOST=smtp.serviciodecorreo.es`
- [ ] `SMTP_PORT=465`
- [ ] `SMTP_SECURE=true`
- [ ] `SMTP_USER=info@decaminoservicios.com`
- [ ] `SMTP_PASSWORD=your-password-here` (IMPORTANT: schimbă cu parola reală!)
- [ ] `SMTP_FROM=De Camino Servicios Auxiliares SL <info@decaminoservicios.com>`

### Telegram (pentru notificări Telegram)
- [ ] `TELEGRAM_BOT_TOKEN=8281047706:AAGUtaq6QgIw-h40D2NGFIXa9u6Wn6FRjjU` (sau token-ul tău)
- [ ] `TELEGRAM_CHAT_ID=-4990173907` (sau chat ID-ul tău)

## Variabile OPȚIONALE

### Push Notifications (VAPID)
- [ ] `VAPID_PUBLIC_KEY=your-vapid-public-key`
- [ ] `VAPID_PRIVATE_KEY=your-vapid-private-key`

### n8n Rate Limiting (opțional, au default-uri)
- [ ] `N8N_RATE_LIMIT_MAX_BURST=10`
- [ ] `N8N_RATE_LIMIT_RPS=5`
- [ ] `N8N_RATE_LIMIT_MAX_QUEUE=500`
- [ ] `N8N_BACKOFF_BASE_MS=200`
- [ ] `N8N_BACKOFF_MAX_RETRIES=4`
- [ ] `N8N_BACKOFF_JITTER_MS=150`

## Verificare rapidă

Rulează în backend:
```bash
# Verifică dacă toate variabilele obligatorii există
grep -E "^(PORT|CORS_ORIGIN|DB_HOST|DB_NAME|DB_USERNAME|DB_PASSWORD|JWT_SECRET|SMTP_HOST|SMTP_USER|SMTP_PASSWORD|TELEGRAM_BOT_TOKEN)=" .env
```

## Note importante

1. **SMTP_PASSWORD** - Trebuie să fie parola reală, nu "your-password-here"
2. **JWT_SECRET** - Trebuie să fie un secret puternic în producție
3. **DB_SYNC** - Trebuie să fie `false` în producție!
4. **TELEGRAM_BOT_TOKEN** - Trebuie să fie token-ul real al bot-ului

