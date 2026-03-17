# Crearea subdomeniului api.herafs.com

Ce trebuie făcut ca **https://api.herafs.com** să funcționeze (backend Client 2 – HERA).

---

## Cum rulează Decamino (Client 1) – referință

Din proiect reiese:

- **Backend:** Node.js direct (nu în Docker), în `/opt/decaminoserviciosapp/backend`.
- **Port:** 3000.
- **Serviciu:** systemd `decamino-backend.service` (start/stop cu `systemctl`). Dacă lipsește, deploy oprește procesul pe 3000 și pornește cu `nohup node dist/src/main.js`.
- **Reverse proxy:** Nginx într-un container Docker `decamino-backend-proxy`, config în `/opt/traefik-backend-config/nginx.conf`. Traefik (sau alt proxy) direcționează traficul către acest container, care face proxy către backend pe 3000.

Pentru HERA faci același tip de setup, dar pe port **3002** și cu domeniul **api.herafs.com**.

---

## 1. DNS

La providerul de domeniu (unde ai **herafs.com**):

- Adaugi un **înregistrare A** sau **CNAME**:
  - **Nume / Host:** `api` (sau `api.herafs.com`, după cum cere panoul)
  - **Valoare / Țintă:** IP-ul VPS-ului unde rulează (sau va rula) backend-ul HERA  
    (dacă e același VPS ca la Decamino, același IP ca pentru api.decaminoservicios.com)

Exemplu:
```text
Tip: A
Nume: api
Valoare: 217.154.102.115
TTL: 300 (sau implicit)
```

Aștepți 5–30 minute (uneori până la câteva ore) ca DNS-ul să se propage. Poți verifica cu:
```bash
ping api.herafs.com
# sau
nslookup api.herafs.com
```

---

## 2. Backend HERA pe VPS

Pe același VPS ca Decamino:

- **Decamino** rulează din `/opt/decaminoserviciosapp/backend`, port **3000**, serviciu **decamino-backend**.
- **HERA** trebuie să ruleze pe alt port, ex. **3002**, ca ambele să fie active în paralel.

**2.1. Director și cod**

Opțiune A – același repo, alt director (recomandat dacă vrei deploy-uri separate):

```bash
sudo mkdir -p /opt/herafs-app
# copiezi sau clonezi același repo (decaminoserviciosapp) în /opt/herafs-app
# în /opt/herafs-app/backend pui .env pentru Client 2 (din .env.client2.example)
```

Opțiune B – același director ca Decamino, alt .env și alt serviciu systemd (avansat): păstrezi `/opt/decaminoserviciosapp`, dar pornești un al doilea proces cu `ENV_FILE=.env.client2` și `PORT=3002`; necesită un script de start care setează env-ul.

**2.2. Fișier .env pentru HERA** (în `/opt/herafs-app/backend/.env` sau unde ai backend-ul HERA)

Copiezi din `backend/.env.client2.example` și completezi:

- `DB_HOST=localhost` (sau IP-ul MySQL/MariaDB)
- `DB_NAME=hera_facility_db`
- `DB_USERNAME=facturacion_user`
- `DB_PASSWORD=...`
- `PORT=3002`
- `CORS_ORIGINS=https://app.herafs.com,https://herafs.com`
- `API_URL=https://api.herafs.com`
- Restul (COMPANY_*, JWT, etc.) din `.env.client2.example`

**2.3. Pornire backend HERA (exemplu cu systemd)**

Creezi un serviciu separat față de Decamino, de ex. `hera-backend.service`:

```ini
# /etc/systemd/system/hera-backend.service
[Unit]
Description=Backend HERA Facility (Client 2)
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/herafs-app/backend
ExecStart=/usr/bin/node dist/src/main.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable hera-backend
sudo systemctl start hera-backend
sudo systemctl status hera-backend
```

Backend-ul HERA trebuie să asculte pe **3002** (sau portul ales în `.env`).

---

## 3. Reverse proxy: api.herafs.com → backend HERA

Trebuie ca traficul de pe **https://api.herafs.com** să fie dus la backend-ul HERA pe port **3002**.

### Variantă A: Traefik + container Nginx (ca la Decamino)

Dacă Decamino folosește **Traefik** și containerul **decamino-backend-proxy** (nginx) cu config în `/opt/traefik-backend-config/nginx.conf`, poți adăuga un container similar pentru HERA:

```bash
# Director pentru config nginx HERA
sudo mkdir -p /opt/traefik-backend-config-hera

# Config nginx care face proxy către backend HERA pe 3002
# (pe host, din container: 172.18.0.1 sau host.docker.internal; pe același host folosești IP-ul gateway-ului rețelei Docker sau localhost dacă nginx rulează pe host)
sudo tee /opt/traefik-backend-config-hera/nginx.conf << 'EOF'
server {
    listen 80;
    server_name api.herafs.com;
    client_max_body_size 50m;
    location / {
        proxy_pass http://172.18.0.1:3002;
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

Pornești containerul (adaptezi rețeaua și numele la cum ai Traefik-ul):

```bash
docker run -d \
  --name hera-backend-proxy \
  --restart unless-stopped \
  -v /opt/traefik-backend-config-hera/nginx.conf:/etc/nginx/conf.d/default.conf:ro \
  -l "traefik.enable=true" \
  -l "traefik.http.routers.hera-backend-api.rule=Host(\`api.herafs.com\`)" \
  -l "traefik.http.routers.hera-backend-api.entrypoints=websecure" \
  -l "traefik.http.routers.hera-backend-api.tls.certresolver=myresolver" \
  -l "traefik.http.services.hera-backend-api.loadbalancer.server.port=80" \
  nginx:alpine
```

**Notă:** `172.18.0.1` este de obicei gateway-ul rețelei Docker către host; dacă backend-ul HERA ascultă pe `127.0.0.1:3002` pe host, din container trebuie folosit acest IP. Verifică cu `ip addr` pe host sau cu rețeaua folosită de `decamino-backend-proxy`.

### Variantă B: Nginx direct pe VPS (fără Traefik)

**3.1. Site Nginx pentru api.herafs.com**

Creezi fișierul (cale tipică pe Debian/Ubuntu):

`/etc/nginx/sites-available/api.herafs.com`:

```nginx
# Redirect HTTP -> HTTPS
server {
    listen 80;
    server_name api.herafs.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.herafs.com;

    ssl_certificate /etc/letsencrypt/live/api.herafs.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.herafs.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3002;
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
```

**3.2. Activare**

```bash
sudo ln -s /etc/nginx/sites-available/api.herafs.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**3.3. SSL cu Let's Encrypt**

Înainte de a activa site-ul HTTPS (sau cu un server temporar pe 80), obții certificatul:

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.herafs.com
```

După ce certificatul e instalat, config-ul de mai sus cu `ssl_certificate` / `ssl_certificate_key` va funcționa (certbot poate fi creat inițial cu un server pe 80, apoi adaugi blocul `listen 443` dacă e nevoie).

---

### Variantă B: Traefik + container Nginx (dacă deja folosești Traefik)

- Creezi un config Nginx care face `proxy_pass` către `http://172.18.0.1:3002` (sau IP-ul hostului din rețeaua Traefik).
- În Traefik pui reguli pentru **Host(`api.herafs.com`)** către acel container, cu TLS (certificat resolver).
- Detalii similare cu cele din `archive/root-unused-mar2026/GUID_SETUP_CLIENT_2.md`, dar cu `api.herafs.com` și portul 3002.

---

## 4. Verificare

- **DNS:** `curl -I https://api.herafs.com` (după ce SSL e activ) → răspuns de la server.
- **Backend:** un endpoint simplu, ex. `https://api.herafs.com/api/health` (dacă există) sau login din frontend HERA cu `VITE_API_URL=https://api.herafs.com`.

---

## Rezumat

| Pas | Ce faci |
|-----|--------|
| 1 | DNS: înregistrare A (sau CNAME) pentru **api** → IP VPS |
| 2 | Pe VPS: backend HERA pe port **3002**, .env cu `DB_NAME=hera_facility_db`, `API_URL=https://api.herafs.com`, `PORT=3002` |
| 3 | Nginx (sau Traefik): **api.herafs.com** → `http://127.0.0.1:3002` |
| 4 | SSL: Let's Encrypt pentru **api.herafs.com** |

După acești pași, **api.herafs.com** este subdomeniul creat și folosit de frontend-ul HERA (build cu `VITE_API_URL=https://api.herafs.com`).
