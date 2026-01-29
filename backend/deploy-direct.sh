#!/bin/bash

# Script de deploy pentru backend API - rulare directă (fără Docker)
# Usage: ./deploy-direct.sh

set -e

echo "🚀 Starting direct deploy (no Docker)"

# Navighează la folderul backend
cd "$(dirname "$0")"

# 1. Pull ultimele modificări
echo "📥 Pulling latest changes..."
git pull origin main

# 2. Instalează dependențele
echo "📦 Installing dependencies..."
npm install

# 3. Generează Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# 4. Șterge dist vechi
echo "🧹 Cleaning old build..."
rm -rf dist
rm -rf .nest

# 5. Build
echo "🔨 Building application..."
npm run build

# 6. Verifică că build-ul e OK
if [ ! -f "dist/src/main.js" ]; then
    echo "❌ Build failed - dist/src/main.js not found!"
    exit 1
fi

# 7. Verifică că controller-urile sunt în build
if [ ! -f "dist/src/controllers/prl-documents.controller.js" ]; then
    echo "⚠️  Warning: prl-documents.controller.js not found in build!"
fi

if [ ! -f "dist/src/controllers/diplomas.controller.js" ]; then
    echo "⚠️  Warning: diplomas.controller.js not found in build!"
fi

# 8. Oprește procesul vechi (dacă rulează)
echo "🛑 Stopping old process..."
pkill -f "node.*dist/src/main" || true
sleep 2

# 9. Verifică dacă portul 3000 e liber
if lsof -i :3000 > /dev/null 2>&1; then
    echo "⚠️  Port 3000 still in use, forcing kill..."
    fuser -k 3000/tcp || true
    sleep 2
fi

# 10. Pornește backend-ul
echo "▶️  Starting backend..."

# Verifică dacă PM2 e instalat
if command -v pm2 &> /dev/null; then
    echo "✅ Using PM2 to start backend..."
    pm2 stop decamino-backend || true
    pm2 delete decamino-backend || true
    pm2 start npm --name decamino-backend -- run start:prod
    pm2 save
    echo "📋 View logs: pm2 logs decamino-backend"
else
    echo "⚠️  PM2 not found, starting directly..."
    echo "   (Recomandat: instalează PM2 cu: npm install -g pm2)"
    nohup npm run start:prod > backend.log 2>&1 &
    echo "📋 View logs: tail -f backend.log"
fi

# 11. Așteaptă puțin
echo "⏳ Waiting for startup..."
sleep 5

# 12. Verifică health
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy!"
    echo "🌐 Health endpoint: http://localhost:3000/health"
else
    echo "⚠️  Health check failed. Check logs:"
    if command -v pm2 &> /dev/null; then
        echo "   pm2 logs decamino-backend"
    else
        echo "   tail -f backend.log"
    fi
    exit 1
fi

echo "✅ Deploy completed successfully!"
