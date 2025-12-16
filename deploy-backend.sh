#!/bin/bash

# Script de deploy automat pentru backend pe VPS
# Folosire: ./deploy-backend.sh

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

# 1. Oprește backend-ul dacă rulează
echo -e "${YELLOW}📋 Step 1: Stopping backend...${NC}"
BACKEND_PID=$(ps aux | grep "node dist" | grep -v grep | awk '{print $2}' | head -1)
if [ -n "$BACKEND_PID" ]; then
    echo "Found backend process: $BACKEND_PID"
    kill -9 "$BACKEND_PID" 2>/dev/null || true
    sleep 2
    echo -e "${GREEN}✅ Backend stopped${NC}"
else
    echo -e "${YELLOW}⚠️  No backend process found (might already be stopped)${NC}"
fi

# 2. Navighează la root și actualizează codul
echo -e "${YELLOW}📋 Step 2: Updating code from git...${NC}"
cd /opt/decaminoserviciosapp || exit 1
git pull origin main
echo -e "${GREEN}✅ Code updated${NC}"

# 3. Intră în backend
cd "$BACKEND_DIR" || exit 1

# 4. Configurează .env dacă nu există sau dacă .env.production e mai nou
echo -e "${YELLOW}📋 Step 3: Configuring .env file...${NC}"
if [ -f ".env.production" ]; then
    if [ ! -f ".env" ] || [ ".env.production" -nt ".env" ]; then
        cp .env.production .env
        echo -e "${GREEN}✅ .env created/updated from .env.production${NC}"
    else
        echo -e "${GREEN}✅ .env file exists and is up to date${NC}"
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
else
    if [ ! -f ".env" ]; then
        echo -e "${RED}❌ No .env or .env.production found!${NC}"
        echo "Please create .env file manually with DATABASE_URL and other required variables."
        exit 1
    else
        echo -e "${GREEN}✅ .env file exists${NC}"
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
if npx prisma migrate deploy 2>&1 | grep -q "P3005"; then
    echo -e "${YELLOW}⚠️  Database is not empty (P3005). Using db push instead...${NC}"
    npx prisma db push --accept-data-loss || {
        echo -e "${RED}❌ Database sync failed! Check your DATABASE_URL in .env${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ Database schema synchronized${NC}"
else
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Migrations applied${NC}"
    else
        echo -e "${RED}❌ Migration failed! Check your DATABASE_URL in .env${NC}"
        exit 1
    fi
fi

# 8. Recompilează
echo -e "${YELLOW}📋 Step 7: Building backend...${NC}"
npm run build
echo -e "${GREEN}✅ Backend built${NC}"

# 9. Repornește backend-ul
echo -e "${YELLOW}📋 Step 8: Starting backend...${NC}"
# NestJS compilează în dist/src/main.js (nu dist/main.js)
MAIN_JS="dist/src/main.js"
if [ ! -f "$MAIN_JS" ]; then
    # Fallback la dist/main.js dacă există
    MAIN_JS="dist/main.js"
fi
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
    echo "To check status: ps aux | grep 'node dist/main'"
else
    echo -e "${RED}❌ Backend failed to start!${NC}"
    echo "Check logs: $LOG_FILE"
    tail -20 "$LOG_FILE"
    exit 1
fi

