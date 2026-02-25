# 🚀 GHID COMPLET: Setup Client 2

**Data:** 15/02/2026  
**Scop:** Configurare completă pentru un client nou (Client 2)

---

## 📋 CHECKLIST COMPLET

### ✅ 0. Configurare DNS și Subdomeniu

#### 0.1. Subdomeniu Backend (API)
- **Subdomeniu:** `api.client2.com`
- **Tip:** A Record
- **Valoare:** IP-ul VPS-ului (ex: `217.154.102.115`)

#### 0.2. Subdomeniu Frontend (Opțional)
- **Subdomeniu:** `app.client2.com` sau `www.client2.com`
- **Tip:** A Record sau CNAME
- **Valoare:** IP-ul VPS-ului sau CDN (dacă folosești)

#### 0.3. Verificare DNS
```bash
# Verifică că DNS-ul este propagat
nslookup api.client2.com
# SAU
dig api.client2.com

# Ar trebui să returneze IP-ul VPS-ului
```

**⚠️ IMPORTANT:** Așteaptă propagarea DNS (poate dura până la 24h, de obicei 1-2h)

---

### ✅ 1. Baza de Date MySQL/MariaDB

#### 1.1. Creează baza de date nouă
```sql
-- Conectează-te la MySQL/MariaDB
mysql -u root -p

-- Creează baza de date
CREATE DATABASE client2_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Creează user dedicat (opțional, dar recomandat)
CREATE USER 'client2_user'@'%' IDENTIFIED BY 'ParolaClient2Secure123!';
GRANT ALL PRIVILEGES ON client2_db.* TO 'client2_user'@'%';
FLUSH PRIVILEGES;

-- Verifică
SHOW DATABASES;
```

#### 1.2. Configurare Backend `.env`

Editează `backend/.env`:
```env
# Server - IMPORTANT: Port diferit pentru Client 2!
# Client 1 (actual) rămâne pe portul său (ex: 3001), Client 2 (nou) folosește port nou (ex: 3002)
PORT=3002
HOST=0.0.0.0
NODE_ENV=production
API_URL=https://api.client2.com

# Database - CLIENT 2
DB_TYPE=mysql
DB_HOST=217.154.102.115  # sau host-ul tău
DB_PORT=3306
DB_USERNAME=client2_user
DB_PASSWORD=ParolaClient2Secure123!
DB_NAME=client2_db
DB_SYNC=false
DB_LOGGING=false

# Prisma folosește DATABASE_URL (se construiește automat sau setează manual)
DATABASE_URL=mysql://client2_user:ParolaClient2Secure123!@217.154.102.115:3306/client2_db?charset=utf8mb4
```

**⚠️ IMPORTANT:** Dacă parola conține caractere speciale, URL-encode-le:
```bash
# Exemplu: parola "P@ssw0rd!" devine "P%40ssw0rd%21"
DATABASE_URL=mysql://client2_user:P%40ssw0rd%21@217.154.102.115:3306/client2_db?charset=utf8mb4
```

---

### ✅ 2. Migrare Schema Prisma

#### 2.1. Verifică conexiunea
```bash
cd backend
npm run prisma:db:push  # Testează conexiunea (nu face migrare)
```

#### 2.2. Aplică schema completă
```bash
# Opțiunea 1: Push schema (recomandat pentru setup inițial)
npm run prisma:db:push

# SAU Opțiunea 2: Migrare (dacă vrei istoric migrări)
npm run prisma:migrate:deploy
```

**⚠️ NOTĂ:** 
- `prisma db push` - aplică schema direct (fără istoric migrări)
- `prisma migrate deploy` - aplică migrările existente (necesită folder `migrations/`)

#### 2.3. Verifică tabelele create
```bash
# Conectează-te la baza de date
mysql -u client2_user -p client2_db

# Verifică tabelele
SHOW TABLES;
```

Ar trebui să vezi toate tabelele din schema Prisma (User, Clientes, Pedidos, etc.)

---

### ✅ 3. Configurare Backend `.env` (Complet)

Editează `backend/.env` cu toate configurările:

```env
# ============================================
# SERVER - IMPORTANT: Port diferit pentru Client 2!
# Client 1 rămâne pe portul său actual, Client 2 folosește port nou (ex: 3002)
# ============================================
PORT=3002
HOST=0.0.0.0
NODE_ENV=production
API_URL=https://api.client2.com

# ============================================
# CORS
# ============================================
CORS_ORIGINS=https://app.client2.com,https://client2.com
# SAU pentru development:
# CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# ============================================
# DATABASE - CLIENT 2
# ============================================
DB_TYPE=mysql
DB_HOST=217.154.102.115
DB_PORT=3306
DB_USERNAME=client2_user
DB_PASSWORD=ParolaClient2Secure123!
DB_NAME=client2_db
DB_SYNC=false
DB_LOGGING=false
DATABASE_URL=mysql://client2_user:ParolaClient2Secure123!@217.154.102.115:3306/client2_db?charset=utf8mb4

# ============================================
# JWT
# ============================================
JWT_SECRET=client2-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# ============================================
# SMTP - CLIENT 2
# ============================================
SMTP_HOST=smtp.client2.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@client2.com
SMTP_PASSWORD=ParolaSMTPClient2
SMTP_FROM=CLIENT 2 SERVICIOS SL <info@client2.com>

# ============================================
# EMAIL BCC
# ============================================
EMAIL_BCC=client2.rrhh@client2.com,client2.admin@client2.com

# ============================================
# COMPANY INFO (pentru SMTP From fallback)
# ============================================
COMPANY_NAME=CLIENT 2 SERVICIOS SL
COMPANY_EMAIL=info@client2.com

# ============================================
# PEDIDOS EMAIL (opțional - dacă vrei email diferit pentru pedidos)
# ============================================
PEDIDOS_PROVIDER_EMAIL=pedidos@client2.com
PEDIDOS_PROVIDER_CC=manager@client2.com,admin@client2.com

# ============================================
# TELEGRAM (opțional)
# ============================================
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-client2
TELEGRAM_CHAT_ID=-your-chat-id-client2

# ============================================
# n8n (dacă mai folosești proxy)
# ============================================
N8N_BASE_URL=https://n8n.client2.com
N8N_TIMEOUT=30000

# ============================================
# MONITORING (opțional)
# ============================================
MONITORING_ENABLED=false
```

---

### ✅ 4. Configurare Frontend `.env`

Editează `frontend/.env`:

```env
# ============================================
# API URL
# ============================================
VITE_API_URL=https://api.client2.com
# SAU pentru development:
# VITE_API_URL=http://localhost:3000

# ============================================
# COMPANY INFO
# ============================================
VITE_COMPANY_NAME=CLIENT 2 SERVICIOS SL
VITE_COMPANY_CIF=B12345678
VITE_COMPANY_ADDRESS=Calle Ejemplo 123, Madrid, 28001
VITE_COMPANY_PHONE=912 345 678
VITE_COMPANY_EMAIL=info@client2.com

# ============================================
# BRANDING - CULORI
# ============================================
VITE_PRIMARY_COLOR=#0066CC
VITE_SECONDARY_COLOR=#004499

# ============================================
# BRANDING - LOGO
# ============================================
VITE_LOGO_PATH=logo-client2.svg
```

---

### ✅ 5. Logo-uri Client 2

#### 5.1. Logo UI (folosit în aplicație)
```bash
# Copiază logo-ul Client 2 în frontend/public/
cp /path/to/client2-logo.svg frontend/public/logo-client2.svg

# SAU dacă vrei să folosești același nume (logo.svg)
cp /path/to/client2-logo.svg frontend/public/logo.svg
```

#### 5.2. Logo PDF-uri (necesită rebuild)
```bash
# Pentru PDF-uri, înlocuiește logo-ul în assets
cp /path/to/client2-logo.svg frontend/src/assets/logo.svg

# Apoi faci rebuild frontend
cd frontend
npm run build
```

---

### ✅ 6. Verificare Setup

#### 6.1. Test Backend
```bash
cd backend
npm run start:dev

# Verifică în consolă:
# ✅ SMTP transporter initialized
# ✅ Database connection successful
# ✅ Server running on port 3000
```

#### 6.2. Test Frontend
```bash
cd frontend
npm run dev

# Deschide http://localhost:5173
# Verifică:
# - Logo-ul apare corect
# - Culorile sunt corecte
# - API calls funcționează
```

#### 6.3. Test Database
```bash
cd backend
npm run prisma:studio

# Deschide Prisma Studio
# Verifică că tabelele sunt create și goale (sau cu date de test)
```

---

### ✅ 7. Date Inițiale (Opțional)

#### 7.1. User Admin
```sql
-- Conectează-te la baza de date Client 2
mysql -u client2_user -p client2_db

-- Inserează user admin (exemplu)
INSERT INTO User (
  CODIGO,
  NOMBRE_APELLIDOS,
  NOMBRE,
  APELLIDO1,
  CORREO_ELECTRONICO,
  GRUPO,
  ESTADO,
  CONTRASENA
) VALUES (
  '10000001',
  'ADMIN CLIENT 2',
  'ADMIN',
  'CLIENT 2',
  'admin@client2.com',
  'Developer',
  'ACTIVO',
  '$2b$10$...'  -- Hash bcrypt pentru parola
);
```

#### 7.2. Grupos (Permisiuni)
```sql
-- Inserează grupos de bază
INSERT INTO Grupos (GRUPO, admin, empleados, ...) VALUES
('Developer', 1, 1, ...),
('Manager', 0, 1, ...),
('Employee', 0, 0, ...);
```

---

### ✅ 8. Configurare Reverse Proxy (Traefik/Nginx)

#### 8.1. Opțiunea 1: Traefik (Recomandat - dacă ai deja Traefik)

**Configurare Traefik pentru `api.client2.com`:**

Creează container nginx proxy pentru Client 2:
```bash
# Creează director pentru config nginx
mkdir -p /opt/traefik-backend-config-client2

# Creează nginx.conf pentru Client 2
cat > /opt/traefik-backend-config-client2/nginx.conf << 'EOF'
server {
    listen 80;
    server_name api.client2.com;
    
    location / {
        proxy_pass http://172.18.0.1:3002;  # Port pentru Client 2 (verifică ce port folosește Client 1!)
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

# Creează container nginx proxy
docker run -d \
  --name client2-backend-proxy \
  --network traefik-network \
  --restart unless-stopped \
  -v /opt/traefik-backend-config-client2/nginx.conf:/etc/nginx/conf.d/default.conf:ro \
  -l "traefik.enable=true" \
  -l "traefik.docker.network=traefik-network" \
  -l "traefik.http.routers.client2-backend-api.rule=Host(\`api.client2.com\`)" \
  -l "traefik.http.routers.client2-backend-api.entrypoints=websecure" \
  -l "traefik.http.routers.client2-backend-api.tls.certresolver=myresolver" \
  -l "traefik.http.routers.client2-backend-api.middlewares=client2-backend-headers,client2-backend-cors" \
  -l "traefik.http.services.client2-backend-api.loadbalancer.server.port=80" \
  -l "traefik.http.middlewares.client2-backend-headers.headers.customrequestheaders.X-Forwarded-Proto=https" \
  -l "traefik.http.middlewares.client2-backend-headers.headers.customrequestheaders.X-Forwarded-Port=443" \
  -l "traefik.http.middlewares.client2-backend-cors.headers.accesscontrolallowmethods=GET,POST,PUT,DELETE,PATCH,OPTIONS" \
  -l "traefik.http.middlewares.client2-backend-cors.headers.accesscontrolallowheaders=Content-Type,Authorization,X-App-Source,X-App-Version,X-Client-Type" \
  -l "traefik.http.middlewares.client2-backend-cors.headers.accesscontrolalloworiginlist=https://app.client2.com,https://client2.com" \
  -l "traefik.http.middlewares.client2-backend-cors.headers.accesscontrolallowcredentials=true" \
  -l "traefik.http.middlewares.client2-backend-cors.headers.accesscontrolmaxage=3600" \
  -l "traefik.http.middlewares.client2-backend-cors.headers.addvaryheader=true" \
  nginx:alpine
```

**⚠️ IMPORTANT:** 
- `172.18.0.1` este gateway IP-ul din `traefik-network` către host
- Portul `3002` este pentru Client 2 (Client 1 rămâne pe portul său actual - verifică!)
- Traefik va genera automat certificat SSL/TLS pentru `api.client2.com`

#### 8.2. Opțiunea 2: Nginx Direct (dacă nu ai Traefik)

Creează config Nginx:
```nginx
# /etc/nginx/sites-available/api.client2.com
server {
    listen 80;
    server_name api.client2.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.client2.com;
    
    # SSL Certificate (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.client2.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.client2.com/privkey.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    location / {
        proxy_pass http://localhost:3002;  # Port pentru Client 2 (verifică ce port folosește Client 1!)
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

Activează config-ul:
```bash
# Creează symlink
ln -s /etc/nginx/sites-available/api.client2.com /etc/nginx/sites-enabled/

# Testează config-ul
nginx -t

# Reload Nginx
systemctl reload nginx
```

#### 8.3. SSL/TLS Certificate (Let's Encrypt)

```bash
# Instalează Certbot (dacă nu e instalat)
apt-get update
apt-get install certbot python3-certbot-nginx

# Obține certificat pentru api.client2.com
certbot --nginx -d api.client2.com

# Auto-renewal (deja configurat în cron)
certbot renew --dry-run
```

---

### ✅ 9. Configurare Backend Port (Client 2)

**IMPORTANT:** Client 2 trebuie să ruleze pe un port diferit decât Client 1!

- **Client 1 (actual):** Rămâne pe portul său actual (ex: `3001` - NU schimba!)
- **Client 2 (nou):** Folosește un port nou disponibil (ex: `3002` sau `3000`)

**Verifică ce port folosește Client 1:**
```bash
# Pe VPS, verifică ce port folosește Client 1
ps aux | grep "node.*main" | grep -v grep
# SAU
lsof -i :3000
lsof -i :3001
```

**Editează `backend/.env` pentru Client 2:**
```env
# Port NOU pentru Client 2 (NU folosi același port ca Client 1!)
# Exemplu: dacă Client 1 e pe 3001, Client 2 folosește 3002 sau 3000
PORT=3002
HOST=0.0.0.0
```

**Sau** rulează backend-ul Client 2 cu:
```bash
PORT=3002 npm run start:prod
```

**⚠️ NOTĂ:** Fiecare client trebuie să aibă port unic:
- Client 1: `3001` (actual - NU schimba!)
- Client 2: `3002` (nou)
- Client 3: `3003` (dacă mai adaugi)
- etc.

---

## 🎯 REZUMAT PAȘI

1. ✅ **Configurare DNS** (`api.client2.com` → IP VPS)
2. ✅ **Creează baza de date MySQL** (`client2_db`)
3. ✅ **Configurează `backend/.env`** (DB, SMTP, JWT, PORT=3002, etc. - port diferit de Client 1!)
4. ✅ **Migrează schema Prisma** (`npm run prisma:db:push`)
5. ✅ **Configurează Reverse Proxy** (Traefik/Nginx pentru `api.client2.com`)
6. ✅ **Obține SSL Certificate** (Let's Encrypt)
7. ✅ **Configurează `frontend/.env`** (API, company, branding)
8. ✅ **Copiază logo-urile** (UI + PDF)
9. ✅ **Testează** (backend, frontend, database)
10. ✅ **Inserează date inițiale** (user admin, grupos)

---

## ⚠️ NOTĂ IMPORTANTĂ

**Backward Compatibility:**
- Toate env vars au fallback-uri la valorile originale
- Dacă lipsește un env var, aplicația folosește default-ul
- **EXCEPȚIE:** `DATABASE_URL` - TREBUIE setat pentru Client 2!

---

## 🚨 PROBLEME COMUNE

### Eroare: "Can't reach database server"
- Verifică `DB_HOST` și `DB_PORT`
- Verifică firewall-ul
- Verifică că user-ul are permisiuni

### Eroare: "Access denied for user"
- Verifică `DB_USERNAME` și `DB_PASSWORD`
- Verifică că user-ul are `GRANT ALL PRIVILEGES`

### Eroare: "Unknown database"
- Verifică că baza de date există: `SHOW DATABASES;`
- Verifică `DB_NAME` în `.env`

### Eroare Prisma: "Migration failed"
- Verifică `DATABASE_URL` (URL-encode parola dacă are caractere speciale)
- Rulează `npm run prisma:db:push` în loc de migrate

---

## 📝 NEXT STEPS

După setup:
1. ✅ Testează login cu user admin
2. ✅ Testează crearea angajaților
3. ✅ Testează trimiterea email-urilor
4. ✅ Testează export-uri (PDF, Excel)
5. ✅ Verifică branding (logo, culori) în toată aplicația

---

## 🎉 GATA!

Aplicația Client 2 este configurată și gata de folosit!
