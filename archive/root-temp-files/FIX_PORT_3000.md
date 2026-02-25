# Fix: Port 3000 ocupat

## Problema
Backend-ul nu pornește pentru că portul 3000 este deja ocupat.

## Soluție rapidă

### Pe VPS, rulează:

```bash
# 1. Găsește procesul care folosește portul 3000
lsof -ti:3000
# SAU
fuser 3000/tcp
# SAU
ss -tulpn | grep :3000

# 2. Oprește procesul (înlocuiește <PID> cu PID-ul găsit)
kill <PID>
# SAU force kill
kill -9 <PID>

# 3. Verifică că portul e liber
lsof -ti:3000
# Nu ar trebui să returneze nimic

# 4. Repornește backend-ul
cd /opt/decaminoserviciosapp/backend
nohup node dist/src/main.js > ../backend.log 2>&1 &

# 5. Verifică că rulează
ps aux | grep "node dist"
tail -f ../backend.log
```

## Soluție automată (one-liner)

```bash
# Oprește toate procesele Node.js care folosesc portul 3000
kill -9 $(lsof -ti:3000) 2>/dev/null || fuser -k 3000/tcp 2>/dev/null || true

# Așteaptă 2 secunde
sleep 2

# Repornește backend-ul
cd /opt/decaminoserviciosapp/backend
nohup node dist/src/main.js > ../backend.log 2>&1 &

# Verifică
sleep 3
curl http://localhost:3000/health
```

## Dacă problema persistă

```bash
# Verifică toate procesele Node.js
ps aux | grep node

# Oprește manual toate procesele backend
pkill -f "node.*dist/src/main"
pkill -f "node.*dist/main"

# Verifică din nou portul
netstat -tulpn | grep :3000
# SAU
ss -tulpn | grep :3000

# Dacă tot e ocupat, verifică dacă e alt serviciu (nginx, docker, etc.)
```
