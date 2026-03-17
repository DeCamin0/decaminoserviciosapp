#!/bin/bash
# Verifică dacă VPS-ul e pregătit pentru deploy la ambele clienți (Decamino + HERA).
# Rulează pe VPS: cd /opt/decaminoserviciosapp/backend && bash scripts/check-vps-ready-for-both-clients.sh
# Sau din backend: bash scripts/check-vps-ready-for-both-clients.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKEND_DIR="${1:-.}"
[ "$BACKEND_DIR" = "." ] && BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BACKEND_DIR" || exit 1

echo ""
echo "=============================================="
echo "  Verificare VPS – Decamino + HERA"
echo "  Director: $BACKEND_DIR"
echo "=============================================="
echo ""

OK=0
FAIL=0

# --- 1. Fișier .env (Decamino)
if [ -f ".env" ]; then
  echo -e "${GREEN}✅ .env există${NC} (Decamino)"
  OK=$((OK + 1))
  if grep -q "^PORT=3000" .env 2>/dev/null; then
    echo -e "   ${GREEN}   PORT=3000${NC}"
  else
    echo -e "   ${YELLOW}   ⚠ PORT nu e 3000 în .env (verifică)${NC}"
  fi
  if grep -q "^DB_NAME=decamino" .env 2>/dev/null; then
    echo -e "   ${GREEN}   DB_NAME=decamino_*${NC}"
  else
    echo -e "   ${YELLOW}   ⚠ DB_NAME pentru Decamino (verifică)${NC}"
  fi
else
  echo -e "${RED}❌ .env lipsește${NC} (obligatoriu pentru Decamino)"
  FAIL=$((FAIL + 1))
fi

# --- 2. Fișier .env.client2 (HERA)
if [ -f ".env.client2" ]; then
  echo -e "${GREEN}✅ .env.client2 există${NC} (HERA)"
  OK=$((OK + 1))
  if grep -q "^PORT=3002" .env.client2 2>/dev/null; then
    echo -e "   ${GREEN}   PORT=3002${NC}"
  else
    echo -e "   ${YELLOW}   ⚠ PORT nu e 3002 în .env.client2 (verifică)${NC}"
  fi
  if grep -q "hera_facility_db" .env.client2 2>/dev/null; then
    echo -e "   ${GREEN}   DB_NAME=hera_facility_db${NC}"
  else
    echo -e "   ${YELLOW}   ⚠ DB_NAME pentru HERA (trebuie hera_facility_db)${NC}"
  fi
else
  echo -e "${RED}❌ .env.client2 lipsește${NC} (obligatoriu pentru HERA – copiază din .env.client2.example)"
  FAIL=$((FAIL + 1))
fi

# --- 3. Serviciu systemd Decamino
if systemctl list-unit-files 2>/dev/null | grep -q "decamino-backend.service"; then
  echo -e "${GREEN}✅ decamino-backend.service există${NC}"
  OK=$((OK + 1))
  if systemctl is-active --quiet decamino-backend 2>/dev/null; then
    echo -e "   ${GREEN}   activ${NC}"
  else
    echo -e "   ${YELLOW}   oprit (va fi pornit la deploy)${NC}"
  fi
else
  echo -e "${YELLOW}⚠ decamino-backend.service nu există${NC} (deploy-backend.sh poate folosi nohup pe 3000)"
fi

# --- 4. Serviciu systemd HERA
if systemctl list-unit-files 2>/dev/null | grep -q "hera-backend.service"; then
  echo -e "${GREEN}✅ hera-backend.service există${NC}"
  OK=$((OK + 1))
  if systemctl is-active --quiet hera-backend 2>/dev/null; then
    echo -e "   ${GREEN}   activ${NC}"
  else
    echo -e "   ${YELLOW}   oprit (va fi repornit la deploy)${NC}"
  fi
else
  echo -e "${RED}❌ hera-backend.service lipsește${NC} (crează-l ca HERA să pornească la deploy – vezi COMO_DESCHID_CLIENTII.txt)"
  FAIL=$((FAIL + 1))
fi

# --- 5. Port 3000 (Decamino)
if command -v ss >/dev/null 2>&1; then
  if ss -tuln 2>/dev/null | grep -q ":3000 "; then
    echo -e "${GREEN}✅ Port 3000 ascultă${NC} (Decamino)"
    OK=$((OK + 1))
  else
    echo -e "${YELLOW}⚠ Port 3000 nu ascultă${NC} (Decamino oprit sau nu a fost pornit)"
  fi
elif command -v netstat >/dev/null 2>&1; then
  if netstat -tuln 2>/dev/null | grep -q ":3000 "; then
    echo -e "${GREEN}✅ Port 3000 ascultă${NC} (Decamino)"
    OK=$((OK + 1))
  else
    echo -e "${YELLOW}⚠ Port 3000 nu ascultă${NC}"
  fi
fi

# --- 6. Port 3002 (HERA)
if command -v ss >/dev/null 2>&1; then
  if ss -tuln 2>/dev/null | grep -q ":3002 "; then
    echo -e "${GREEN}✅ Port 3002 ascultă${NC} (HERA)"
    OK=$((OK + 1))
  else
    echo -e "${YELLOW}⚠ Port 3002 nu ascultă${NC} (HERA oprit sau hera-backend.service lipsește)"
  fi
elif command -v netstat >/dev/null 2>&1; then
  if netstat -tuln 2>/dev/null | grep -q ":3002 "; then
    echo -e "${GREEN}✅ Port 3002 ascultă${NC} (HERA)"
    OK=$((OK + 1))
  else
    echo -e "${YELLOW}⚠ Port 3002 nu ascultă${NC}"
  fi
fi

# --- 7. Health Decamino (curl)
if curl -sf --connect-timeout 2 "http://127.0.0.1:3000/health" >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Decamino răspunde la http://127.0.0.1:3000/health${NC}"
  OK=$((OK + 1))
else
  echo -e "${YELLOW}⚠ Decamino nu răspunde la /health${NC} (backend oprit?)"
fi

# --- 8. Health HERA (curl)
if curl -sf --connect-timeout 2 "http://127.0.0.1:3002/health" >/dev/null 2>&1; then
  echo -e "${GREEN}✅ HERA răspunde la http://127.0.0.1:3002/health${NC}"
  OK=$((OK + 1))
else
  echo -e "${YELLOW}⚠ HERA nu răspunde la /health${NC} (backend oprit sau .env.client2 / hera-backend lipsește?)"
fi

# --- 9. Build existent (opțional)
if [ -f "dist/src/main.js" ] || [ -f "dist/main.js" ]; then
  echo -e "${GREEN}✅ Build backend există${NC} (dist/)"
else
  echo -e "${YELLOW}⚠ dist/ lipsește${NC} (se creează la deploy cu npm run build)"
fi

echo ""
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}Rezultat: $FAIL verificări eșuate. Repară înainte de deploy.${NC}"
  echo ""
  echo "Pași recomandați:"
  [ ! -f ".env.client2" ] && echo "  - Copiază .env.client2.example → .env.client2 și completează (PORT=3002, DB_NAME=hera_facility_db, JWT, COMPANY_* HERA)."
  systemctl list-unit-files 2>/dev/null | grep -q "hera-backend.service" || echo "  - Creează hera-backend.service (Environment=ENV_FILE=.env.client2, PORT=3002) – vezi COMO_DESCHID_CLIENTII.txt secțiunea 4."
  echo ""
  exit 1
else
  echo -e "${GREEN}VPS pregătit pentru deploy la ambele clienți.${NC}"
  echo "  Rulează: ./deploy-backend.sh"
  echo ""
  exit 0
fi
