#!/bin/bash
# Script pentru a corecta formatul SMTP în .env pe VPS

cd /opt/decaminoserviciosapp/backend

# Backup
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup creat: .env.backup.$(date +%Y%m%d_%H%M%S)"

# Elimină liniile SMTP vechi
sed -i '/^SMTP_HOST=/d' .env
sed -i '/^SMTP_PORT=/d' .env
sed -i '/^SMTP_SECURE=/d' .env
sed -i '/^SMTP_USER=/d' .env
sed -i '/^SMTP_PASSWORD=/d' .env
sed -i '/^SMTP_FROM=/d' .env

# Adaugă variabilele SMTP în format corect (fiecare pe linia sa)
cat >> .env << 'EOF'

# SMTP (pentru trimiterea email-urilor către gestoria)
SMTP_HOST=smtp.serviciodecorreo.es
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@decaminoservicios.com
SMTP_PASSWORD=Camino2@24.
SMTP_FROM=De Camino Servicios Auxiliares SL <info@decaminoservicios.com>
EOF

echo "✅ Format SMTP corectat în .env"
echo ""
echo "Verifică rezultatul:"
grep -E '^SMTP_' .env
echo ""
echo "Acum restart backend: systemctl restart decamino-backend.service"
