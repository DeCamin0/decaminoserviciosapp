# 🚀 Backend API - Deploy pe VPS Arsys

## ✅ Ce am pregătit

### 1. **Docker & Docker Compose**
- ✅ `Dockerfile` - Multi-stage build optimizat pentru producție
- ✅ `docker-compose.yml` - Configurare cu Traefik labels pentru `api.decaminoservicios.com`
- ✅ `.dockerignore` - Exclude fișiere inutile din build

### 2. **Configurare Environment**
- ✅ `.env.production.example` - Template cu toate variabilele necesare
- ✅ Rate limiting configurabil prin env vars
- ✅ `.gitignore` actualizat pentru a exclude `.env.production`

### 3. **Health Check**
- ✅ Endpoint `/health` deja implementat în `HealthController`
- ✅ Healthcheck în Dockerfile și docker-compose

### 4. **Deploy Script**
- ✅ `deploy.sh` - Script automatizat pentru deploy
- ✅ `DEPLOY.md` - Documentație detaliată pas cu pas

## 📋 Quick Start

### Pe VPS:

```bash
# 1. Clone repo
cd /opt
git clone <your-repo> decaminoserviciosapp
cd decaminoserviciosapp/backend

# 2. Configurează env
cp .env.production.example .env.production
nano .env.production  # Completează valorile reale

# 3. Deploy
./deploy.sh production
```

### Verifică:

```bash
# Local
curl http://localhost:3000/health

# Prin Traefik (după DNS propagation)
curl https://api.decaminoservicios.com/health
```

## 🔧 Configurare Traefik

Asigură-te că Traefik rulează și are:
- ✅ Network `traefik-network` creat
- ✅ Entrypoint `websecure` configurat
- ✅ Cert resolver `letsencrypt` configurat

## 📝 Variabile de Mediu Importante

**Obligatorii:**
- `DB_PASSWORD` - Parola MariaDB
- `JWT_SECRET` - Secret aleatoriu (generează cu `openssl rand -base64 32`)
- `CORS_ORIGIN` - Domeniul frontend-ului

**Opționale (rate limiting):**
- `N8N_RATE_LIMIT_MAX_BURST` - Default: 10
- `N8N_RATE_LIMIT_RPS` - Default: 5
- `N8N_RATE_LIMIT_MAX_QUEUE` - Default: 500

## 🎯 Next Steps

După ce `/health` funcționează:

1. **Populează modulele existente:**
   - `auth/` - Autentificare JWT ✅ (deja implementat)
   - `controllers/` - Endpoints API
   - `services/` - Business logic

2. **Adaugă module noi:**
   - `users/` - Gestionare utilizatori
   - `facturacion/` - Facturare
   - `permisos/` - Permisiuni

3. **Monitoring (opțional):**
   - Logging centralizat
   - Metrics (Prometheus)
   - Alerts

## 📚 Documentație

- `DEPLOY.md` - Ghid detaliat de deploy
- `ENV_EXAMPLE.md` - Explicații variabile de mediu

## 🆘 Troubleshooting

Vezi `DEPLOY.md` secțiunea "Troubleshooting" pentru probleme comune.
