# Deploy Backend API pe VPS Arsys

## ⚠️ IMPORTANT: Izolare completă de n8n

**Acest deploy NU modifică:**
- ❌ Container-ul `n8n-docker-n8n-1`
- ❌ Container-ul `n8n-docker-traefik-1`
- ❌ Configurațiile Traefik pentru `n8n.decaminoservicios.com`
- ❌ Volume-urile sau environment-urile n8n
- ❌ Certificatele sau routerele existente

**Ce face:**
- ✅ Creează un container nou `decamino-backend`
- ✅ Folosește network-ul existent `traefik-network` (doar read-only)
- ✅ Adaugă labels Traefik DOAR pentru `api.decaminoservicios.com`
- ✅ Complet izolat de serviciile existente

## Prerequisituri

- VPS Arsys cu Docker și docker-compose instalat
- Traefik configurat și rulează pe același VPS (pentru n8n)
- Network `traefik-network` există (folosit de n8n/Traefik)
- Domeniu `api.decaminoservicios.com` pointat către IP-ul VPS-ului (217.154.100.239)

## Pași de Deploy

### 1. Clonează repo-ul pe VPS

```bash
cd /opt  # sau altă locație preferată
git clone <your-repo-url> decaminoserviciosapp
cd decaminoserviciosapp/backend
```

### 2. Configurează variabilele de mediu

```bash
# Copiază template-ul
cp .env.production.example .env.production

# Editează cu valorile reale
nano .env.production
```

**Important:** Actualizează:
- `DB_PASSWORD` - parola reală pentru MariaDB
- `JWT_SECRET` - secret aleatoriu puternic (generează cu: `openssl rand -base64 32`)
- `CORS_ORIGIN` - domeniul frontend-ului (ex: `https://decaminoservicios.com`)

### 3. Verifică că Traefik network există

```bash
docker network ls | grep traefik-network
```

**IMPORTANT:** Network-ul `traefik-network` ar trebui să existe deja (folosit de n8n/Traefik). 
Dacă nu există, creează-l:
```bash
docker network create traefik-network
```

**NU modifica** network-ul existent dacă n8n/Traefik îl folosesc deja!

### 4. Build și start container-ul

```bash
# Build imaginea
docker-compose build

# Start container-ul
docker-compose up -d

# Verifică logs
docker-compose logs -f backend
```

### 5. Verifică health endpoint

```bash
# Local pe VPS
curl http://localhost:3000/health

# Prin Traefik (după ce DNS-ul e propagat)
curl https://api.decaminoservicios.com/health
```

Ar trebui să vezi:
```json
{
  "status": "ok",
  "timestamp": "2025-01-XX...",
  "n8nBaseUrl": "https://n8n.decaminoservicios.com"
}
```

## Comenzi Utile

### Logs
```bash
docker-compose logs -f backend
docker-compose logs --tail=100 backend
```

### Restart
```bash
docker-compose restart backend
```

### Stop/Start
```bash
docker-compose stop backend
docker-compose start backend
```

### Rebuild după schimbări de cod
```bash
docker-compose build --no-cache backend
docker-compose up -d backend
```

### Verifică status
```bash
docker-compose ps
docker inspect decamino-backend | grep Health -A 10
```

## Troubleshooting

### Container nu pornește
```bash
# Verifică logs
docker-compose logs backend

# Verifică .env.production
cat .env.production

# Testează build local
docker-compose build
```

### Health check eșuează
```bash
# Verifică dacă portul 3000 e liber
netstat -tulpn | grep 3000

# Testează manual în container
docker exec -it decamino-backend sh
wget -qO- http://localhost:3000/health
```

### Traefik nu routează
```bash
# Verifică labels
docker inspect decamino-backend | grep -A 20 Labels

# Verifică Traefik logs
docker logs traefik  # sau numele container-ului Traefik
```

### Probleme de conectivitate la DB
```bash
# Testează conexiunea din container
docker exec -it decamino-backend sh
# În container:
apk add mysql-client
mysql -h 217.154.102.115 -u facturacion_user -p decamino_db
```

## Update Flow (când faci schimbări)

```bash
# 1. Pull ultimele schimbări
git pull origin main

# 2. Rebuild și restart
docker-compose build --no-cache backend
docker-compose up -d backend

# 3. Verifică logs
docker-compose logs -f backend
```

## Securitate

- ✅ `.env.production` este în `.gitignore` - nu se commite niciodată
- ✅ Container rulează cu user non-root
- ✅ Healthcheck activ pentru monitoring
- ✅ HTTPS prin Traefik cu Let's Encrypt
- ✅ CORS configurat doar pentru domeniul frontend-ului

## Next Steps

După ce `/health` funcționează:
1. Populează modulele (auth, users, facturación)
2. Configurează logging centralizat (opțional: ELK, Loki, etc.)
3. Adaugă monitoring (opțional: Prometheus + Grafana)
