#!/bin/bash

# Script de deploy automat pentru backend pe VPS (Node.js direct)
# Folosire: ./deploy-backend.sh
# NOTĂ: Backend-ul rulează direct cu Node.js, nu în Docker
#       (Docker config există pentru viitor, dar nu e folosit)

set -e  # Oprește scriptul la prima eroare

echo "🚀 Starting backend deployment..."

# Culori pentru output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variabile
BACKEND_DIR="/opt/decaminoserviciosapp/backend"
LOG_FILE="/opt/decaminoserviciosapp/backend.log"

# Verifică dacă există directorul backend
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Backend directory not found: $BACKEND_DIR${NC}"
    exit 1
fi

cd "$BACKEND_DIR" || exit 1

# 1. Oprește procesul backend dacă rulează
echo -e "${YELLOW}📋 Step 1: Stopping existing backend process...${NC}"
OLD_PID=$(ps aux | grep "node dist" | grep -v grep | awk '{print $2}' | head -1)
if [ -n "$OLD_PID" ]; then
    echo "Found running backend (PID: $OLD_PID), stopping..."
    kill "$OLD_PID" 2>/dev/null || kill -9 "$OLD_PID" 2>/dev/null || true
    sleep 2
    echo -e "${GREEN}✅ Backend process stopped${NC}"
else
    echo -e "${YELLOW}⚠️  No running backend process found${NC}"
fi

# 2. Navighează la root și actualizează codul
echo -e "${YELLOW}📋 Step 2: Updating code from git...${NC}"
cd /opt/decaminoserviciosapp || exit 1

# Gestionează conflictele locale - stochează modificările locale
if [ -n "$(git status --porcelain deploy-backend.sh 2>/dev/null)" ]; then
    echo -e "${YELLOW}⚠️  Local changes detected in deploy-backend.sh, stashing...${NC}"
    git stash push -m "Local deploy-backend.sh changes before pull" deploy-backend.sh 2>/dev/null || true
fi

# Actualizează codul
git pull origin main || {
    echo -e "${RED}❌ Git pull failed!${NC}"
    exit 1
}
echo -e "${GREEN}✅ Code updated${NC}"

# 3. Intră în backend
cd "$BACKEND_DIR" || exit 1

# 4. Configurează .env dacă nu există sau dacă .env.production e mai nou
echo -e "${YELLOW}📋 Step 3: Configuring .env file...${NC}"
if [ -f ".env.production" ]; then
    # Verifică dacă .env.production are deja SMTP configurat
    HAS_SMTP_IN_PRODUCTION=$(grep -c "^SMTP_" .env.production 2>/dev/null || echo "0")
    
    if [ ! -f ".env" ] || [ ".env.production" -nt ".env" ]; then
        cp .env.production .env
        echo -e "${GREEN}✅ .env created/updated from .env.production${NC}"
        if [ "$HAS_SMTP_IN_PRODUCTION" -gt 0 ]; then
            echo -e "${GREEN}✅ SMTP configuration found in .env.production and copied to .env${NC}"
        fi
    else
        echo -e "${GREEN}✅ .env file exists and is up to date${NC}"
        # Dacă .env.production are SMTP dar .env nu are, copiază doar SMTP din .env.production
        if [ "$HAS_SMTP_IN_PRODUCTION" -gt 0 ] && ! grep -q "^SMTP_HOST=" .env; then
            echo -e "${YELLOW}⚠️  SMTP found in .env.production but missing in .env, copying...${NC}"
            grep "^SMTP_" .env.production >> .env
            echo -e "${GREEN}✅ SMTP configuration copied from .env.production to .env${NC}"
        fi
    fi
    
    # Construiește DATABASE_URL din variabile separate dacă nu există
    if ! grep -q "^DATABASE_URL=" .env; then
        echo -e "${YELLOW}⚠️  DATABASE_URL not found, building from DB_* variables...${NC}"
        
        # Citește variabilele din .env
        source .env 2>/dev/null || true
        
        # Construiește DATABASE_URL
        DB_HOST=${DB_HOST:-localhost}
        DB_PORT=${DB_PORT:-3306}
        DB_USERNAME=${DB_USERNAME:-root}
        DB_PASSWORD=${DB_PASSWORD:-}
        DB_NAME=${DB_NAME:-decaminoservicios}
        
        # Encodează parola pentru URL
        ENCODED_PASSWORD=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$DB_PASSWORD'))" 2>/dev/null || echo "$DB_PASSWORD")
        
        DATABASE_URL="mysql://${DB_USERNAME}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
        
        # Adaugă DATABASE_URL în .env
        echo "" >> .env
        echo "# Auto-generated DATABASE_URL from DB_* variables" >> .env
        echo "DATABASE_URL=\"${DATABASE_URL}\"" >> .env
        
        echo -e "${GREEN}✅ DATABASE_URL generated: mysql://${DB_USERNAME}:****@${DB_HOST}:${DB_PORT}/${DB_NAME}${NC}"
    else
        echo -e "${GREEN}✅ DATABASE_URL found in .env${NC}"
    fi
    
    # Verifică și adaugă variabilele SMTP dacă lipsesc
    echo -e "${YELLOW}📋 Checking SMTP configuration...${NC}"
    if ! grep -q "^SMTP_HOST=" .env; then
        # Verifică dacă există în .env.production
        if [ -f ".env.production" ] && grep -q "^SMTP_HOST=" .env.production; then
            echo -e "${YELLOW}⚠️  SMTP not in .env, copying from .env.production...${NC}"
            grep "^SMTP_" .env.production >> .env
            echo -e "${GREEN}✅ SMTP configuration copied from .env.production${NC}"
        else
            echo -e "${YELLOW}⚠️  SMTP variables not found, adding default SMTP configuration...${NC}"
            echo "" >> .env
            echo "# SMTP (pentru trimiterea email-urilor către gestoria)" >> .env
            echo "# IMPORTANT: Actualizează SMTP_PASSWORD cu parola reală!" >> .env
            echo "SMTP_HOST=smtp.serviciodecorreo.es" >> .env
            echo "SMTP_PORT=465" >> .env
            echo "SMTP_SECURE=true" >> .env
            echo "SMTP_USER=info@decaminoservicios.com" >> .env
            echo "SMTP_PASSWORD=your-password-here" >> .env
            echo "SMTP_FROM=De Camino Servicios Auxiliares SL <info@decaminoservicios.com>" >> .env
            echo -e "${YELLOW}⚠️  SMTP variables added. Please update SMTP_PASSWORD in .env with the real password!${NC}"
        fi
    else
        echo -e "${GREEN}✅ SMTP configuration found in .env${NC}"
    fi
else
    if [ ! -f ".env" ]; then
        echo -e "${RED}❌ No .env or .env.production found!${NC}"
        echo "Please create .env file manually with DATABASE_URL and other required variables."
        exit 1
    else
        echo -e "${GREEN}✅ .env file exists${NC}"
        # Verifică și adaugă variabilele SMTP dacă lipsesc
        if ! grep -q "^SMTP_HOST=" .env; then
            # Verifică dacă există în .env.production
            if [ -f ".env.production" ] && grep -q "^SMTP_HOST=" .env.production; then
                echo -e "${YELLOW}⚠️  SMTP not in .env, copying from .env.production...${NC}"
                grep "^SMTP_" .env.production >> .env
                echo -e "${GREEN}✅ SMTP configuration copied from .env.production${NC}"
            else
                echo -e "${YELLOW}⚠️  SMTP variables not found, adding default SMTP configuration...${NC}"
                echo "" >> .env
                echo "# SMTP (pentru trimiterea email-urilor către gestoria)" >> .env
                echo "# IMPORTANT: Actualizează SMTP_PASSWORD cu parola reală!" >> .env
                echo "SMTP_HOST=smtp.serviciodecorreo.es" >> .env
                echo "SMTP_PORT=465" >> .env
                echo "SMTP_SECURE=true" >> .env
                echo "SMTP_USER=info@decaminoservicios.com" >> .env
                echo "SMTP_PASSWORD=your-password-here" >> .env
                echo "SMTP_FROM=De Camino Servicios Auxiliares SL <info@decaminoservicios.com>" >> .env
                echo -e "${YELLOW}⚠️  SMTP variables added. Please update SMTP_PASSWORD in .env with the real password!${NC}"
            fi
        else
            echo -e "${GREEN}✅ SMTP configuration found in .env${NC}"
        fi
    fi
fi

# 5. Instalează dependențe
echo -e "${YELLOW}📋 Step 4: Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"

# 6. Regeneră Prisma client
echo -e "${YELLOW}📋 Step 5: Generating Prisma client...${NC}"
npx prisma generate
echo -e "${GREEN}✅ Prisma client generated${NC}"

# 7. Aplică migrări sau sincronizează schema
echo -e "${YELLOW}📋 Step 6: Applying database migrations...${NC}"

# Exportă DATABASE_URL explicit din .env
if [ -f ".env" ]; then
    # Citește DATABASE_URL din .env
    if grep -q "^DATABASE_URL=" .env; then
        export $(grep "^DATABASE_URL=" .env | xargs)
        echo -e "${GREEN}✅ DATABASE_URL exported from .env${NC}"
    else
        # Construiește din variabilele DB_*
        source .env 2>/dev/null || true
        DB_HOST=${DB_HOST:-localhost}
        DB_PORT=${DB_PORT:-3306}
        DB_USERNAME=${DB_USERNAME:-root}
        DB_PASSWORD=${DB_PASSWORD:-}
        DB_NAME=${DB_NAME:-decaminoservicios}
        ENCODED_PASSWORD=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$DB_PASSWORD'))" 2>/dev/null || echo "$DB_PASSWORD")
        export DATABASE_URL="mysql://${DB_USERNAME}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
        echo -e "${GREEN}✅ DATABASE_URL constructed and exported${NC}"
    fi
else
    echo -e "${RED}❌ .env file not found!${NC}"
    exit 1
fi

# Verifică dacă DATABASE_URL este setat
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL is not set!${NC}"
    exit 1
fi

# Încearcă să ruleze migrațiile
MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1)
MIGRATE_EXIT_CODE=$?

if echo "$MIGRATE_OUTPUT" | grep -q "P3005"; then
    echo -e "${YELLOW}⚠️  Database is not empty (P3005). Using db push instead...${NC}"
    npx prisma db push --accept-data-loss || {
        echo -e "${RED}❌ Database sync failed! Check your DATABASE_URL in .env${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ Database schema synchronized${NC}"
elif [ $MIGRATE_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Migrations applied${NC}"
else
    echo -e "${RED}❌ Migration failed!${NC}"
    echo "$MIGRATE_OUTPUT"
    echo -e "${RED}Check your DATABASE_URL in .env${NC}"
    exit 1
fi

# 8. Recompilează
echo -e "${YELLOW}📋 Step 7: Building backend...${NC}"
npm run build
echo -e "${GREEN}✅ Backend built${NC}"

# 8. Verifică și actualizează configurația nginx pentru upload-uri mari
echo -e "${YELLOW}📋 Step 8: Checking nginx configuration for file uploads...${NC}"
NGINX_CONF="/opt/traefik-backend-config/nginx.conf"
if [ -f "$NGINX_CONF" ]; then
    if ! grep -q "client_max_body_size" "$NGINX_CONF"; then
        echo -e "${YELLOW}⚠️  Adding client_max_body_size to nginx config...${NC}"
        # Adaugă client_max_body_size în server block sau http block
        if grep -q "server {" "$NGINX_CONF"; then
            # Adaugă în server block
            sed -i '/server {/a\    client_max_body_size 50m;' "$NGINX_CONF"
        elif grep -q "http {" "$NGINX_CONF"; then
            # Adaugă în http block
            sed -i '/http {/a\    client_max_body_size 50m;' "$NGINX_CONF"
        else
            # Adaugă la începutul fișierului
            sed -i '1i\client_max_body_size 50m;' "$NGINX_CONF"
        fi
        echo -e "${GREEN}✅ client_max_body_size 50m added to nginx config${NC}"
        
        # Repornește containerul nginx dacă rulează
        if docker ps | grep -q "decamino-backend-proxy"; then
            echo -e "${YELLOW}🔄 Restarting nginx container...${NC}"
            docker restart decamino-backend-proxy
            sleep 2
            echo -e "${GREEN}✅ Nginx container restarted${NC}"
        fi
    else
        # Verifică dacă valoarea este suficientă (>= 50m)
        CURRENT_SIZE=$(grep "client_max_body_size" "$NGINX_CONF" | head -1 | awk '{print $2}' | sed 's/[^0-9]//g')
        if [ -n "$CURRENT_SIZE" ] && [ "$CURRENT_SIZE" -lt 50 ]; then
            echo -e "${YELLOW}⚠️  Updating client_max_body_size to 50m...${NC}"
            sed -i 's/client_max_body_size.*/client_max_body_size 50m;/' "$NGINX_CONF"
            if docker ps | grep -q "decamino-backend-proxy"; then
                docker restart decamino-backend-proxy
                sleep 2
            fi
            echo -e "${GREEN}✅ client_max_body_size updated to 50m${NC}"
        else
            echo -e "${GREEN}✅ Nginx config already has client_max_body_size >= 50m${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Nginx config not found at $NGINX_CONF - skipping nginx update${NC}"
    echo -e "${YELLOW}   You may need to manually add 'client_max_body_size 50m;' to your nginx config${NC}"
fi

# 9. Repornește backend-ul
echo -e "${YELLOW}📋 Step 9: Starting backend...${NC}"
# NestJS compilează în dist/src/main.js (nu dist/main.js)
MAIN_JS="dist/src/main.js"
if [ ! -f "$MAIN_JS" ]; then
    # Fallback la dist/main.js dacă există
    MAIN_JS="dist/main.js"
fi

# Pornește backend-ul în background
nohup node "$MAIN_JS" > "$LOG_FILE" 2>&1 &
sleep 3

# 10. Verifică că rulează
NEW_PID=$(ps aux | grep "node dist" | grep -v grep | awk '{print $2}' | head -1)
if [ -n "$NEW_PID" ]; then
    echo -e "${GREEN}✅ Backend started successfully (PID: $NEW_PID)${NC}"
    echo -e "${GREEN}📝 Logs: $LOG_FILE${NC}"
    echo ""
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo ""
    echo "To view logs: tail -f $LOG_FILE"
    echo "To check status: ps aux | grep 'node dist'"
    echo "To stop backend: kill $NEW_PID"
else
    echo -e "${RED}❌ Backend failed to start!${NC}"
    echo "Check logs: $LOG_FILE"
    tail -20 "$LOG_FILE"
    exit 1
fi

