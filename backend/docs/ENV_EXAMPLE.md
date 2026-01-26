# Environment Variables Example

Copy this to `.env` in the backend folder:

```env
# Server
PORT=3000
CORS_ORIGIN=http://localhost:5173

# n8n (for proxy endpoints that still use it)
N8N_BASE_URL=https://n8n.decaminoservicios.com
N8N_TIMEOUT=30000

# MariaDB Database
DB_TYPE=mysql
DB_HOST=217.154.102.115
DB_PORT=3306
DB_USERNAME=facturacion_user
DB_PASSWORD=ParolaTare123!
DB_NAME=decamino_db
DB_SYNC=false
DB_LOGGING=true

# JWT
JWT_SECRET=decamino-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# SMTP (pentru trimiterea email-urilor către gestoria)
# IMPORTANT: Configurează aceste variabile pentru a trimite email-uri!
# Configurație pentru serviciodecorreo.es
SMTP_HOST=smtp.serviciodecorreo.es
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@decaminoservicios.com
SMTP_PASSWORD=your-password-here
SMTP_FROM=De Camino Servicios Auxiliares SL <info@decaminoservicios.com>

# IMAP (pentru extragerea email-urilor și documentelor)
# Folosește aceleași credențiale ca SMTP (SMTP_USER și SMTP_PASSWORD)
# Opțional: poți seta IMAP_HOST și IMAP_PORT dacă diferă de default-uri
IMAP_HOST=imap.serviciodecorreo.es
IMAP_PORT=993
IMAP_SECURE=true
IMAP_MAILBOX=INBOX
# NOTĂ: IMAP_USER și IMAP_PASSWORD sunt opționale - se folosesc SMTP_USER și SMTP_PASSWORD dacă nu sunt setate
# Folder unde se mută mesajele procesate (după ce documentele sunt salvate cu succes)
IMAP_PROCESSED_MAILBOX=Extrase

# Telegram (pentru notificări pe Telegram)
# IMPORTANT: Configurează aceste variabile pentru a trimite notificări Telegram!

# Bot pentru gestoria (notificări despre ausencias, solicitudes, etc.)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here
TELEGRAM_CHAT_ID=-4990173907

# Bot general (pentru erori, notificări generale, monitoring, etc.)
# Opțional: dacă nu e configurat, se folosește bot-ul de gestoria ca fallback
TELEGRAM_BOT_TOKEN_GENERAL=your-general-telegram-bot-token-here
TELEGRAM_CHAT_ID_GENERAL=your-general-chat-id-here

# Monitoring (pentru alerting automat pe Telegram)
# IMPORTANT: Setează MONITORING_ENABLED=true pentru a activa monitoring-ul
# Monitoring-ul trimite alerte automat când:
# - Baza de date este down (după 2 eșecuri consecutive)
# - Latența DB este prea mare (> 1 secundă)
# - Erori critice în backend
MONITORING_ENABLED=false

# Push Notifications (VAPID keys - opțional)
# VAPID_PUBLIC_KEY=your-vapid-public-key
# VAPID_PRIVATE_KEY=your-vapid-private-key
```

## Important Notes:

- **DB_SYNC**: Set to `false` in production! TypeORM will NOT auto-sync schema.
- **DB_LOGGING**: Set to `true` for development, `false` in production.
- **DB_NAME**: The name of your MariaDB database (e.g., `decaminoservicios`)
- **Table name**: Update `@Entity('empleados')` in `user.entity.ts` if your table has a different name
