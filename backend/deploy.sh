#!/bin/bash

# Script simplu de deploy pentru backend API
# Usage: ./deploy.sh [production|staging]

set -e

ENV=${1:-production}
ENV_FILE=".env.${ENV}"

echo "🚀 Starting deploy for environment: ${ENV}"

# Verifică dacă .env file există
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: ${ENV_FILE} not found!"
    echo "   Copy .env.production.example to ${ENV_FILE} and fill in values"
    exit 1
fi

# Verifică dacă docker-compose e disponibil
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: docker-compose not found!"
    exit 1
fi

# Verifică dacă traefik-network există
if ! docker network ls | grep -q traefik-network; then
    echo "⚠️  Warning: traefik-network not found."
    echo "   Network-ul ar trebui să existe deja (folosit de n8n/Traefik)."
    echo "   Creez network-ul nou..."
    docker network create traefik-network
else
    echo "✅ traefik-network exists (folosit de n8n/Traefik - nu-l modificăm)"
fi

# Build și start
echo "📦 Building Docker image..."
docker-compose build --no-cache backend

echo "🔄 Starting container..."
docker-compose up -d backend

echo "⏳ Waiting for health check..."
sleep 5

# Verifică health
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy!"
    echo "🌐 Health endpoint: http://localhost:3000/health"
    echo "📋 Logs: docker-compose logs -f backend"
else
    echo "⚠️  Health check failed. Check logs:"
    echo "   docker-compose logs backend"
    exit 1
fi
