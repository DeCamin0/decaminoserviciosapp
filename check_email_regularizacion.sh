#!/bin/bash
# Comenzi pentru verificare pe VPS - Email regularizare

echo "=========================================="
echo "1. Verifică log-urile pentru email-uri de regularizare (ultimele 100 linii)"
echo "=========================================="
journalctl -u decamino-backend.service -n 100 | grep -i 'regularizacion\|email notification sent\|Error sending email'

echo ""
echo "=========================================="
echo "2. Verifică configurația SMTP la start (ultimele 50 linii)"
echo "=========================================="
journalctl -u decamino-backend.service -n 50 | grep -i 'SMTP\|Email service'

echo ""
echo "=========================================="
echo "3. Verifică dacă SMTP este configurat în .env (fără a afișa parola)"
echo "=========================================="
cd /opt/decaminoserviciosapp/backend && grep -E '^SMTP_(HOST|PORT|USER|SECURE|FROM)=' .env | sed 's/PASSWORD=.*/PASSWORD=***HIDDEN***/'

echo ""
echo "=========================================="
echo "4. Verifică ultimele email-uri trimise pentru regularizări (din BD)"
echo "=========================================="
echo "NOTA: Trebuie să rulezi manual cu parola MySQL:"
echo "mysql -u facturacion_user -p decamino_db -e \"SELECT id, recipient_email, subject, status, created_at FROM sent_emails WHERE subject LIKE '%regularizacion%' OR subject LIKE '%Regularización%' ORDER BY created_at DESC LIMIT 10;\""

echo ""
echo "=========================================="
echo "5. Verifică ultimele regularizări aprobate/respinse (din BD)"
echo "=========================================="
echo "NOTA: Trebuie să rulezi manual cu parola MySQL:"
echo "mysql -u facturacion_user -p decamino_db -e \"SELECT id, employee_codigo, workday_date, status, reviewed_at, reviewed_by FROM FichajeRegularizacion WHERE status IN ('CONFIRMED', 'REJECTED') ORDER BY reviewed_at DESC LIMIT 10;\""

echo ""
echo "=========================================="
echo "6. Verifică log-urile în timp real (apasă Ctrl+C pentru a opri)"
echo "=========================================="
echo "journalctl -u decamino-backend.service -f | grep -i 'regularizacion\|email'"
