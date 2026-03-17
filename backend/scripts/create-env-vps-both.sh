#!/bin/bash
# Creează .env (Decamino) și .env.client2 (HERA) în backend/ cu toate variabilele.
# Rulează din backend:  bash scripts/create-env-vps-both.sh
# ATENȚIE: conține parole. Nu comita acest script (e în .gitignore).

set -e
cd "$(dirname "$0")/.."
BACKEND_DIR="$(pwd)"

echo "Creare .env (Decamino) și .env.client2 (HERA) în $BACKEND_DIR ..."

# ---------- .env DECAMINO (Client 1) ----------
cat > "$BACKEND_DIR/.env" << 'DECAMINO_EOF'
# Decamino – VPS production (Client 1)
PORT=3000
NODE_ENV=production
CORS_ORIGINS=https://app.decaminoservicios.com,https://decaminoservicios.com
API_URL=https://api.decaminoservicios.com

DB_TYPE=mysql
DB_HOST=217.154.102.115
DB_PORT=3306
DB_USERNAME=facturacion_user
DB_PASSWORD=ParolaTare123!
DB_NAME=decamino_db
DB_SYNC=false
DB_LOGGING=false
DATABASE_URL=mysql://facturacion_user:ParolaTare123!@217.154.102.115:3306/decamino_db

JWT_SECRET=d1BgMWTTjaLle/CZxeLSu4yLKa+tx/UgoRWBnlNkOdU=
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=7d

COMPANY_LEGAL_NAME=DE CAMINO SERVICIOS AUXILIARES, S.L.
COMPANY_LEGAL_NAME_SHORT=DE CAMINO SERVICIOS AUXILIARES SL
COMPANY_ADDRESS=Avda. Euzkadi 14, Local 5, 28702 San Sebastián de los Reyes (Madrid)
COMPANY_ADDRESS_LINE1=Avda. Euzkadi 14, Local 5
COMPANY_CP_POBLACION=28702 - San Sebastián de los Reyes
COMPANY_CIF=B-85524536
COMPANY_PHONE=645 111 999
COMPANY_EMAIL=info@decaminoservicios.com
COMPANY_EMAIL_BCC=decamino.rrhh@gmail.com,app@decaminoservicios.com
COMPANY_EMAIL_FROM_NAME=De Camino Servicios Auxiliares SL
COMPANY_WEBSITE=www.decaminoservicios.com
COMPANY_BRAND_RED=#CC0000
COMPANY_LOGO_PATH=logo.png
FRONTEND_APP_URL=https://app.decaminoservicios.com

N8N_BASE_URL=https://n8n.decaminoservicios.com
N8N_TIMEOUT=30000
N8N_RATE_LIMIT_MAX_BURST=10
N8N_RATE_LIMIT_RPS=5
N8N_RATE_LIMIT_MAX_QUEUE=500
N8N_BACKOFF_BASE_MS=200
N8N_BACKOFF_MAX_RETRIES=4
N8N_BACKOFF_JITTER_MS=150

SMTP_HOST=smtp.serviciodecorreo.es
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@decaminoservicios.com
SMTP_PASSWORD=Camino2@24.
SMTP_FROM=De Camino Servicios Auxiliares SL <info@decaminoservicios.com>

SMTP_PEDIDOS_HOST=smtp.serviciodecorreo.es
SMTP_PEDIDOS_PORT=465
SMTP_PEDIDOS_SECURE=true
SMTP_PEDIDOS_USER=produccion@decaminoservicios.com
SMTP_PEDIDOS_PASSWORD=Decamino2025.
SMTP_PEDIDOS_FROM=DE CAMINO Servicios Auxiliares SL <produccion@decaminoservicios.com>

TELEGRAM_BOT_TOKEN=8281047706:AAGUtaq6QgIw-h40D2NGFIXa9u6Wn6FRjjU
TELEGRAM_CHAT_ID=-4990173907
TELEGRAM_BOT_TOKEN_GENERAL=8569107195:AAGxioEcMvjaPMkopwFWLF_x8-JFlthnoNQ
TELEGRAM_CHAT_ID_GENERAL=-1003656363088
TELEGRAM_CLIENT_LABEL=DeCamino

VAPID_PUBLIC_KEY=BOUbpxugch8yg4eHUQLXrI4VEiFGMQARL5SLXmIhWD8mEOzPVrd5SqKRc94rp6TyxqFIr2pTdfh1r2Oomv0EJJs
VAPID_PRIVATE_KEY=U5y6UbLXUJcB3Ja3CREXl5krNWjYFdJ9CNwQja0B-HI

LOG_LEVEL=info
MONITORING_ENABLED=true
IMAP_PROCESSED_MAILBOX=Extrase
DECAMINO_EOF

# ---------- .env.client2 HERA (Client 2) ----------
cat > "$BACKEND_DIR/.env.client2" << 'HERA_EOF'
# HERA – VPS (Client 2), port 3002
PORT=3002
NODE_ENV=production
DB_TYPE=mysql
DB_HOST=217.154.102.115
DB_PORT=3306
DB_USERNAME=facturacion_user
DB_PASSWORD=ParolaTare123!
DB_NAME=hera_facility_db
DATABASE_URL=mysql://facturacion_user:ParolaTare123!@217.154.102.115:3306/hera_facility_db

JWT_SECRET=hera-client2-secret-key-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=7d

COMPANY_LEGAL_NAME=HERA FACILITY SERVICES SL
COMPANY_LEGAL_NAME_SHORT=HERA FACILITY SERVICES SL
COMPANY_ADDRESS_LINE1=Calle Gran Capitan 5 - Piso 3 D
COMPANY_CP_POBLACION=28802 - Alcalá de Henares
COMPANY_CIF=B85974558
COMPANY_PHONE=918 28 03 12
COMPANY_EMAIL=administracion@herafs.com
COMPANY_GESTORIA_EMAIL=emilia@prasser.net
COMPANY_GESTORIA_CC=paula@prasser.net
COMPANY_EMAIL_FROM_NAME=HERA FACILITY SERVICES SL
COMPANY_WEBSITE=https://herafs.com
COMPANY_BRAND_RED=#2563A8
COMPANY_PORTADA_BG=#9EC9E6
COMPANY_PORTADA_TEXT_COLOR=#1e3a5f
COMPANY_LOGO_PATH=LOGO_hera.png
COMPANY_STAMP_PATH=stampila_hera-removebg-preview.png
COMPANY_PRESUPUESTO_PRESENTACION_KEY=hera
FRONTEND_APP_URL=https://app.herafs.com

CORS_ORIGINS=https://app.herafs.com,https://herafs.com
API_URL=https://api.herafs.com

TELEGRAM_BOT_TOKEN=8281047706:AAGUtaq6QgIw-h40D2NGFIXa9u6Wn6FRjjU
TELEGRAM_CHAT_ID=-4990173907
TELEGRAM_BOT_TOKEN_GENERAL=8569107195:AAGxioEcMvjaPMkopwFWLF_x8-JFlthnoNQ
TELEGRAM_CHAT_ID_GENERAL=-1003656363088
TELEGRAM_CLIENT_LABEL=HERA

SMTP_HOST=lh004.interdominios.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=administracion@herafs.com
SMTP_PASSWORD=herafs2019.
SMTP_FROM=HERA FACILITY SERVICES SL <administracion@herafs.com>

SMTP_PEDIDOS_HOST=smtp.serviciodecorreo.es
SMTP_PEDIDOS_PORT=465
SMTP_PEDIDOS_SECURE=true
SMTP_PEDIDOS_USER=produccion@decaminoservicios.com
SMTP_PEDIDOS_PASSWORD=Decamino2025.
SMTP_PEDIDOS_FROM=HERA FACILITY SERVICES SL <produccion@decaminoservicios.com>

VAPID_PUBLIC_KEY=BOUbpxugch8yg4eHUQLXrI4VEiFGMQARL5SLXmIhWD8mEOzPVrd5SqKRc94rp6TyxqFIr2pTdfh1r2Oomv0EJJs
VAPID_PRIVATE_KEY=U5y6UbLXUJcB3Ja3CREXl5krNWjYFdJ9CNwQja0B-HI

LOG_LEVEL=info
MONITORING_ENABLED=true
HERA_EOF

echo "✅ .env (Decamino) creat."
echo "✅ .env.client2 (HERA) creat."
echo ""
echo "Apoi: systemctl start decamino-backend   și (dacă ai serviciul) systemctl start hera-backend"
echo "Sau:  ./deploy-backend.sh"
