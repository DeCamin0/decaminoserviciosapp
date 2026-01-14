#!/bin/bash

# Script para desplegar la aplicación con proxy para resolver CORS

echo "🚀 Iniciando despliegue con proxy..."

# 1. Instalar dependencias del proxy
echo "📦 Instalando dependencias del proxy..."
cd /path/to/your/project
npm install --prefix . express http-proxy-middleware cors

# 2. Construir la aplicación frontend
echo "🔨 Construyendo aplicación frontend..."
npm run build

# 3. Iniciar el proxy server
echo "🌐 Iniciando proxy server..."
node ../proxy-server.js &

# 4. Servir la aplicación estática
echo "📁 Sirviendo archivos estáticos..."
npx serve -s dist -l 3000 &

echo "✅ Despliegue completado!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔄 Proxy: http://localhost:3001"
echo "📡 n8n: https://n8n.decaminoservicios.com"
