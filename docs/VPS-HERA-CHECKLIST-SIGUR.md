# VPS: Adăugare HERA fără să strici n8n și Decamino

## Ce există acum pe VPS (NU atingeți)

| Componentă | Ce e | Unde / Cum |
|------------|------|-------------|
| **n8n** | Containere Docker | `n8n-docker-n8n-1`, `n8n-docker-traefik-1` – **nu modificăm, nu repornim** |
| **Traefik** | Proxy invers (SSL, routing) | Folosit de n8n și de backend Decamino – **nu îi schimbăm config-ul**; doar adăugăm un container nou cu label-uri noi |
| **Backend Decamino** | Node.js (systemd) | Serviciu `decamino-backend`, port **3000**, `.env` din `/opt/decaminoserviciosapp/backend` – **nu îl oprim, nu îi schimbăm .env** |
| **Proxy Decamino** | Container nginx | `decamino-backend-proxy`, config `/opt/traefik-backend-config/nginx.conf` – **nu modificăm acest fișier, nu repornim acest container** |

Regulă: **nu editezi fișiere existente pentru Decamino/n8n, nu repornești containere n8n sau decamino-backend-proxy.**

---

## Ce adăugăm (doar lucruri noi)

1. **Fișier nou:** `.env.client2` în același folder backend (nu înlocuiește `.env`).
2. **Serviciu nou:** `hera-backend.service` (al doilea proces Node, port **3002**).
3. **Container nou:** `hera-backend-proxy` (nginx doar pentru api.herafs.com).
4. **Traefik:** doar detectează noul container prin label-uri; nu modificăm niciun fișier de config Traefik.

---

## Pași pe VPS (în ordine)

### 0. Verificare rapidă înainte (opțional)

```bash
# Backend Decamino rulează pe 3000
systemctl status decamino-backend
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/

# n8n / Traefik containere rulează
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "n8n|traefik|decamino-backend-proxy"
```

Păstrezi aceste comenzi; le poți rula din nou după ce adaugi HERA ca să confirmi că totul e la fel.

---

### 1. Fișier .env.client2 (doar adăugare)

```bash
cd /opt/decaminoserviciosapp/backend
cp .env.client2.example .env.client2
nano .env.client2
```

Completezi/verifici:
- `DB_HOST=217.154.102.115` (sau `localhost` dacă MySQL e pe acest VPS)
- `DB_NAME=hera_facility_db`
- `DB_USERNAME=facturacion_user`
- `DB_PASSWORD=...`
- `PORT=3002`
- `CORS_ORIGINS=https://app.herafs.com,https://herafs.com`
- `API_URL=https://api.herafs.com`

**Nu ștergi și nu modifici `.env`** (rămâne pentru Decamino).

---

### 2. Serviciu systemd HERA (nou, separat de decamino-backend)

```bash
sudo nano /etc/systemd/system/hera-backend.service
```

Conținut (calea și node la fel ca la Decamino):

```ini
[Unit]
Description=Backend HERA (api.herafs.com) - Client 2
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/decaminoserviciosapp/backend
Environment=ENV_FILE=.env.client2
Environment=PORT=3002
ExecStart=/usr/bin/node dist/src/main.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Apoi:

```bash
sudo systemctl daemon-reload
sudo systemctl enable hera-backend
sudo systemctl start hera-backend
sudo systemctl status hera-backend
```

Verificare: `curl -s http://127.0.0.1:3002/` – trebuie răspuns de la HERA (nu de la 3000).

**Decamino rămâne pe 3000:** `curl -s http://127.0.0.1:3000/` încă răspunde.

---

### 3. Container nginx doar pentru api.herafs.com (nou)

Mai întâi afli IP-ul host-ului din rețeaua Traefik (ca să pui în nginx `proxy_pass`):

```bash
docker network inspect traefik-network 2>/dev/null | grep -A5 "Gateway" || true
# Sau:
ip addr show docker0 | grep inet
```

Dacă backend-ul HERA e pe host (systemd), din container nginx folosești de obicei `172.17.0.1` sau `172.18.0.1` (gateway-ul rețelei Docker). Poți testa mai întâi cu `172.17.0.1:3002`.

Creezi doar config și container noi:

```bash
sudo mkdir -p /opt/traefik-backend-config-hera
sudo tee /opt/traefik-backend-config-hera/nginx.conf << 'EOF'
server {
    listen 80;
    server_name api.herafs.com;
    client_max_body_size 50m;
    location / {
        proxy_pass http://172.17.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
```

Dacă `172.17.0.1` nu merge din container, înlocuiești cu IP-ul afișat la `docker network inspect traefik-network` pentru gateway (sau cu IP-ul real al host-ului în acea rețea).

Pornești **doar** containerul nou (rețeaua e cea existentă `traefik-network`):

```bash
docker run -d \
  --name hera-backend-proxy \
  --restart unless-stopped \
  --network traefik-network \
  -v /opt/traefik-backend-config-hera/nginx.conf:/etc/nginx/conf.d/default.conf:ro \
  -l "traefik.enable=true" \
  -l "traefik.http.routers.hera-backend-api.rule=Host(\`api.herafs.com\`)" \
  -l "traefik.http.routers.hera-backend-api.entrypoints=websecure" \
  -l "traefik.http.routers.hera-backend-api.tls=true" \
  -l "traefik.http.routers.hera-backend-api.tls.certresolver=myresolver" \
  -l "traefik.http.routers.hera-backend-api.middlewares=hera-backend-headers" \
  -l "traefik.http.middlewares.hera-backend-headers.headers.customrequestheaders.X-Forwarded-Port=443" \
  -l "traefik.http.middlewares.hera-backend-headers.headers.customrequestheaders.X-Forwarded-Proto=https" \
  -l "traefik.http.services.hera-backend-api.loadbalancer.server.port=80" \
  nginx:alpine
```

**Nu modifici și nu repornești** `decamino-backend-proxy`.

---

### 4. Verificare după

```bash
# Decamino neschimbat
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/
systemctl status decamino-backend

# HERA pe 3002
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3002/
systemctl status hera-backend

# Containere: n8n + decamino-backend-proxy + hera-backend-proxy
docker ps --format "table {{.Names}}\t{{.Status}}"
```

După propagare DNS și SSL (Traefik): `curl -sI https://api.herafs.com/` ar trebui să returneze 200 sau un răspuns de la backend-ul HERA.

**Verificare rapidă dacă ceva nu merge:**

```bash
# 1) Backend HERA răspunde pe localhost?
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3002/
# Așteptat: 200 sau 301/302

# 2) Label-uri Traefik pe proxy (trebuie websecure + tls)
docker inspect hera-backend-proxy --format '{{json .Config.Labels}}'

# 3) Răspuns prin HTTPS (de pe server)
curl -sI https://api.herafs.com/
# Așteptat: HTTP/2 200 (sau 404 pe / dacă API-ul nu expune root)

# 4) Nginx din container vede backend-ul? (în nginx.conf e proxy_pass la 172.17.0.1:3002)
docker exec hera-backend-proxy wget -q -O- http://172.17.0.1:3002/ 2>/dev/null | head -1
# Dacă 172.17.0.1 nu merge, verifică gateway: docker network inspect traefik-network
```

Dacă (1) dă 000 sau timeout, pornește HERA: `systemctl start hera-backend`. Dacă (3) dă 502, nginx nu ajunge la 3002: verifică IP-ul în `/opt/traefik-backend-config-hera/nginx.conf` (ex. `172.17.0.1` sau gateway-ul rețelei `traefik-network`).

---

### 5. Dacă apare "No seguro" (HTTP în loc de HTTPS)

1. **În browser:** deschide **https://api.herafs.com** (cu **https**, nu http). Dacă mergi la `http://api.herafs.com`, browserul arată mereu "No seguro".
2. **Pe VPS:** containerul `hera-backend-proxy` trebuie să aibă label-uri Traefik pentru HTTPS:
   - `traefik.http.routers.hera-backend.entrypoints=websecure` (port 443)
   - `traefik.http.routers.hera-backend.tls.certresolver=myresolver` (sau numele resolver-ului Let's Encrypt din Traefik)
3. Verificare: `docker inspect hera-backend-proxy --format '{{json .Config.Labels}}'` și confirmă că există `traefik.http.routers.hera-backend-api.entrypoints=websecure` (sau `hera-backend`).
4. Dacă containerul a fost creat cu `entrypoints=web` (doar HTTP), recreează-l cu `entrypoints=websecure` și `tls.certresolver=myresolver` ca în pasul 3 din acest document.
5. DNS: `api.herafs.com` trebuie să pointeze la IP-ul VPS-ului unde rulează Traefik, ca Traefik să poată obține certificatul SSL pentru acel domeniu.

---

## Rezumat: ce NU atingem

- ❌ Containere n8n (n8n-docker-n8n-1, n8n-docker-traefik-1)
- ❌ Configurații Traefik existente (fișiere pe disc)
- ❌ Serviciul `decamino-backend` și portul 3000
- ❌ Fișierul `.env` din `/opt/decaminoserviciosapp/backend`
- ❌ Containerul `decamino-backend-proxy` și `/opt/traefik-backend-config/nginx.conf`

## Rezumat: ce adăugăm

- ✅ `.env.client2` (fișier nou)
- ✅ `hera-backend.service` (serviciu nou, port 3002)
- ✅ Container `hera-backend-proxy` + `/opt/traefik-backend-config-hera/nginx.conf` (tot nou)

Astfel n8n și aplicația Decamino deployată rămân neschimbate.

---

## Stare implementare (actualizat 27.02.2026)

### ✅ Ce s-a făcut (cod + config local)

| Lucru | Detalii |
|-------|--------|
| **Logo HERA în presupuesto PDF** | `LOGO_hera.png` în `frontend/public/` + copie în `backend/assets/`; `COMPANY_LOGO_PATH=LOGO_hera.png` în `.env.client2.local` / `.env.client2.example` |
| **Chenar logo dreptunghiular** | Logo pe portadă adaptat la raportul de aspect (max 280×160), nu pătrat fix; pachet `image-size`, `getLogoSizeForPortada()` |
| **Culoare presupuesto = albastrul aplicației** | `COMPANY_BRAND_RED=#2563A8` în env HERA (același ca `VITE_PRIMARY_COLOR` din frontend) |
| **Telegram: același chat, etichetă [HERA]** | `TELEGRAM_CLIENT_LABEL=HERA`; toate mesajele Telegram prefixate cu `[HERA]` din `TelegramService` |
| **Telegram gestoria HERA** | În `.env.client2.local` / `.env.client2.example`: linii explicite pentru `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_BOT_TOKEN_GENERAL`, `TELEGRAM_CHAT_ID_GENERAL`; completare cu valori (copiate din Client 1 sau chat dedicat HERA) |
| **.env.example Client 1** | Șablon complet: PORT, CORS, N8N, DB, JWT, Company, SMTP, Telegram (gestoria + general + CLIENT_LABEL), VAPID, DATABASE_URL |

### ⏳ Ce rămâne de făcut

| Lucru | Unde / cum |
|-------|------------|
| **Pe VPS: pașii din acest checklist** | Creare `.env.client2`, serviciu `hera-backend.service`, container `hera-backend-proxy` (pașii 1–4 de mai sus) |
| **Pe VPS: .env.client2 complet** | Inclusiv Telegram (cele 4 variabile), `COMPANY_BRAND_RED=#2563A8`, `COMPANY_LOGO_PATH=LOGO_hera.png`, `ENV_FILE=.env.client2` la serviciu; fișier `LOGO_hera.png` în `backend/assets/` pe server |
| **Deploy frontend HERA** | Dacă nu e deja: build + hosting pentru app HERA (domeniu / reverse proxy) |
| **Verificare HTTPS api.herafs.com** | Dacă apare „No seguro”, vezi secțiunea 5 din acest document |

Continuare mâine.
