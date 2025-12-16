#!/bin/bash

# Script pentru configurare automată .env din .env.production
# Folosire: ./setup-env.sh

cd "$(dirname "$0")" || exit 1

if [ -f ".env.production" ]; then
    if [ ! -f ".env" ]; then
        cp .env.production .env
        echo "✅ .env created from .env.production"
    else
        echo "⚠️  .env already exists. Skipping..."
    fi
else
    echo "❌ .env.production not found!"
    exit 1
fi

# Verifică dacă DATABASE_URL există în .env
if grep -q "DATABASE_URL" .env; then
    echo "✅ DATABASE_URL found in .env"
else
    echo "⚠️  WARNING: DATABASE_URL not found in .env"
    echo "Please add DATABASE_URL manually to .env"
fi

