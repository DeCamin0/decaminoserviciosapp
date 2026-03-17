#!/bin/bash
# Verifică dacă .env are variabilele obligatorii pentru pornirea backend-ului.
# Rulează pe VPS: cd backend && bash scripts/check-env-required.sh

ENV_FILE="${1:-.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Fișier nu există: $ENV_FILE"
  exit 1
fi

echo "Verificare $ENV_FILE..."
MISSING=""

has_val() {
  key="$1"
  v=$(grep "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  [ -n "$v" ]
}

# COMPANY_LEGAL_NAME sau COMPANY_NAME
if has_val "COMPANY_LEGAL_NAME" || has_val "COMPANY_NAME"; then :; else MISSING="$MISSING COMPANY_LEGAL_NAME/COMPANY_NAME"; fi
# COMPANY_LEGAL_NAME_SHORT
if has_val "COMPANY_LEGAL_NAME_SHORT"; then :; else MISSING="$MISSING COMPANY_LEGAL_NAME_SHORT"; fi
# COMPANY_ADDRESS_LINE1 sau COMPANY_ADDRESS
if has_val "COMPANY_ADDRESS_LINE1" || has_val "COMPANY_ADDRESS"; then :; else MISSING="$MISSING COMPANY_ADDRESS_LINE1/COMPANY_ADDRESS"; fi
if has_val "COMPANY_CIF"; then :; else MISSING="$MISSING COMPANY_CIF"; fi
if has_val "COMPANY_EMAIL"; then :; else MISSING="$MISSING COMPANY_EMAIL"; fi
if has_val "FRONTEND_APP_URL"; then :; else MISSING="$MISSING FRONTEND_APP_URL"; fi

if [ -n "$MISSING" ]; then
  echo "❌ Lipsesc în $ENV_FILE:$MISSING"
  echo ""
  echo "Adaugă în .env (nano .env) apoi repornește: systemctl start decamino-backend"
  exit 1
fi
echo "✅ Toate variabilele obligatorii sunt setate în $ENV_FILE"
