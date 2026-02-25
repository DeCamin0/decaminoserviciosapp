# Plan de Transformare în Template Reutilizabil
## DeCamino Servicios → Template Multi-Companie

**Data:** Ianuarie 2025  
**Scop:** Transformarea aplicației DeCamino Servicios într-un template reutilizabil pentru deploy-uri separate per companie (izolare completă, nu multi-tenant)

---

## 1) ÎNȚELEGERE PROIECT

### Arhitectură Actuală

#### Frontend (`frontend/`)
- **Stack:** React 18 + Vite + Capacitor Android + PWA
- **State Management:** Context API (AuthContext, NotificationsContext, ChatContext)
- **API Client:** `utils/routes.js` - centralizează toate endpoint-urile
- **Configurare:**
  - Development: `http://localhost:3000` (backend NestJS local)
  - Production: `https://api.decaminoservicios.com` (backend NestJS pe VPS)
- **WebSocket:** Socket.io pentru `/notifications` și `/chat`
- **PWA:** Service Worker, offline support, cache management
- **Build:** Vite, output static pentru CDN/server separat

#### Backend (`backend/`)
- **Stack:** NestJS cu Prisma 100% (nu TypeORM)
- **Database:** MySQL/MariaDB (schema în `backend/prisma/schema.prisma`)
- **Auth:** JWT (`/api/auth/login`, `/api/auth/me`), `JwtAuthGuard`, `@CurrentUser()` decorator
- **n8n Proxy:** `N8nProxyService` pentru endpoint-uri nemigrate (`/api/n8n/*`)
- **WebSocket:** `/notifications` și `/chat` namespaces cu JWT handshake
- **Deploy:** Node.js direct pe VPS (nu Docker în producție), Traefik reverse proxy

#### Automatizări (n8n)
- **Locație:** Container Docker separat pe VPS
- **URL:** `https://n8n.decaminoservicios.com`
- **Workflows:** 50+ workflows în `backend/n8n-snapshots/`
- **Funcții:** Email ingestion, PDF generation, Google Sheets sync, Telegram notifications, OCR, document processing

#### Database
- **Provider:** MySQL/MariaDB
- **Host:** `217.154.102.115` (VPS Arsys)
- **Database:** `decamino_db`
- **Schema:** Prisma cu 80+ tabele (User, Permissions, Notification, ChatRoom, Fichaje, Cuadrante, etc.)
- **Caracteristici:** Coloane cu spații în nume (necesită backticks), multe tabele legacy

#### Integrări Externe
- **Email:** SMTP (serviciodecorreo.es), IMAP pentru ingestion
- **Telegram:** Bot pentru notificări gestoria și generale
- **Push Notifications:** Web Push (VAPID keys)
- **PDF Generation:** pdfkit, pdfmake, pdf-lib
- **OCR:** Integrat în n8n workflows
- **Google Sheets:** Sincronizare date (prin n8n)

### Flow de Date End-to-End

1. **Frontend → Backend:**
   - React app face request-uri către `api.decaminoservicios.com`
   - Backend NestJS procesează (JWT auth, Prisma queries)
   - Pentru endpoint-uri nemigrate: Backend face proxy către n8n

2. **Backend → Database:**
   - Prisma Client pentru toate operațiile DB
   - Queries directe pe MySQL (fără ORM intermediar)
   - Migrations prin Prisma

3. **Backend → n8n:**
   - `N8nProxyService` cu rate limiting și backoff
   - Endpoint-uri: `/api/n8n/webhook/...`
   - Pentru: Cuadrantes POST, Solicitudes, Inspecciones, AutoFirma

4. **n8n → Servicii Externe:**
   - Email (SMTP), Telegram, Google Sheets, OCR, PDF generation

5. **WebSocket:**
   - Frontend conectat la backend NestJS
   - Namespaces: `/notifications`, `/chat`
   - JWT handshake, reconectare automată

### Autentificare, Roluri, Permisiuni

- **Auth:** JWT tokens (7 zile expiry)
- **User Identity:** Tabela `User` (CODIGO ca primary key)
- **Roluri:** Bazate pe câmpul `GRUPO` (Admin, Developer, Manager, Supervisor, Empleado)
- **Permisiuni:** Tabela `Permissions` (grupo_module → permitted)
- **Guards:** `JwtAuthGuard` pentru protecție endpoint-uri
- **Decorator:** `@CurrentUser()` pentru acces user curent în controllers

---

## 2) ANALIZĂ DATE SPECIFICE COMPANIEI

### Date Hardcodate Identificate

#### Informații Companie (Hardcodate)
- **Nume:** `DE CAMINO SERVICIOS AUXILIARES SL`
- **CIF:** `B85524536`
- **Adresă:** `Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España`
- **Telefon:** `910 440 275`
- **Email:** `info@decaminoservicios.com`
- **Locații:**
  - `frontend/src/utils/exportExcel.ts` (COMPANY_INFO)
  - `backend/deploy-backend.sh` (SMTP_FROM)
  - `backend/src/services/hall-of-fame.service.ts` (BCC emails)

#### Domenii și URL-uri
- **API Production:** `https://api.decaminoservicios.com`
- **n8n:** `https://n8n.decaminoservicios.com`
- **Frontend:** `https://app.decaminoservicios.com` / `https://decaminoservicios.com`
- **CORS Origins:** Hardcodate în `backend/src/main.ts`:
  - `https://app.decaminoservicios.com`
  - `https://decaminoservicios.com`

#### Database Connection
- **Host:** `217.154.102.115` (hardcodat în `backend/docs/ENV_EXAMPLE.md`)
- **Database:** `decamino_db` (default în PrismaService)
- **Username:** `facturacion_user` (exemplu în docs)

#### Email Configuration
- **SMTP Host:** `smtp.serviciodecorreo.es`
- **SMTP User:** `info@decaminoservicios.com`
- **SMTP From:** `De Camino Servicios Auxiliares SL <info@decaminoservicios.com>`
- **IMAP Host:** `imap.serviciodecorreo.es`
- **BCC Emails:** `decamino.rrhh@gmail.com`, `app@decaminoservicios.com`

#### Telegram
- **Chat ID:** `-4990173907` (hardcodat în docs)

#### File Storage
- **Uploads:** `backend/uploads/` (local pe server)
- **Pedidos Notas:** `backend/uploads/pedidos-notas/`
- **Documente:** Stocate în DB (Bytes) sau local

#### Branding UI
- **Logo:** `frontend/public/logo.svg` (hardcodat în MainLayout)
- **Culori:** Hardcodate în `exportExcel.ts` (CC0000, 0066CC, etc.)
- **User-Agent:** `DeCamino-Web-Client/1.0` (hardcodat în multiple locuri)

#### n8n Workflows
- **50+ workflows** în `backend/n8n-snapshots/` - toate specifice companiei
- **Webhook URLs:** Hardcodate în workflows (decaminoservicios.com)
- **Credentials:** Stocate în n8n (nu în repo)

#### Reguli de Business Specifice
- **Convenios:** Configurații specifice (dias_vacaciones_anuales, etc.)
- **Horarios:** Reguli de pontaj specifice
- **Fiestas:** Sărbători specifice Spaniei
- **Hall of Fame:** Algoritmi de calcul specifice

---

## 3) STRATEGIE TEMPLATE

### Abordare: Template-Based Cloning

#### Concept
- **Template Master:** Proiectul actual devine template-ul master
- **Clone per Companie:** Fiecare companie primește un clone complet al template-ului
- **Configurație Injectată:** Date specifice companiei prin environment variables și config files
- **Izolare Completă:** Fiecare companie = deployment separat, DB separat, n8n separat

#### Structură Template

```
template-master/
├── frontend/          # React app (generic)
├── backend/           # NestJS API (generic)
├── n8n-snapshots/     # Workflows template (generic)
├── config/            # Config files template
│   ├── company.env.example
│   ├── company.config.json.example
│   └── branding/
│       ├── logo.svg.example
│       └── colors.json.example
└── scripts/
    ├── clone-company.sh
    └── setup-company.sh
```

#### Externalizare Configurație

**1. Environment Variables (`.env` per companie)**
```env
# Company Identity
COMPANY_NAME=De Camino Servicios Auxiliares SL
COMPANY_CIF=B85524536
COMPANY_ADDRESS=Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España
COMPANY_PHONE=910 440 275
COMPANY_EMAIL=info@decaminoservicios.com

# Domains
API_DOMAIN=api.decaminoservicios.com
N8N_DOMAIN=n8n.decaminoservicios.com
FRONTEND_DOMAIN=app.decaminoservicios.com
CORS_ORIGINS=https://app.decaminoservicios.com,https://decaminoservicios.com

# Database
DB_HOST=217.154.102.115
DB_NAME=decamino_db
DB_USERNAME=facturacion_user
DB_PASSWORD=...

# Email
SMTP_HOST=smtp.serviciodecorreo.es
SMTP_USER=info@decaminoservicios.com
SMTP_FROM=De Camino Servicios Auxiliares SL <info@decaminoservicios.com>
EMAIL_BCC=decamino.rrhh@gmail.com,app@decaminoservicios.com

# Telegram
TELEGRAM_CHAT_ID=-4990173907

# Branding
LOGO_PATH=/path/to/logo.svg
PRIMARY_COLOR=#CC0000
SECONDARY_COLOR=#0066CC
```

**2. Config File (`company.config.json`)**
```json
{
  "company": {
    "name": "De Camino Servicios Auxiliares SL",
    "cif": "B85524536",
    "address": "...",
    "phone": "...",
    "email": "..."
  },
  "branding": {
    "logo": "/logo.svg",
    "colors": {
      "primary": "#CC0000",
      "secondary": "#0066CC"
    }
  },
  "features": {
    "hallOfFame": true,
    "chat": true,
    "notifications": true
  }
}
```

**3. Refactoring Cod pentru Template**

**Frontend:**
- `utils/exportExcel.ts`: Înlocuiește `COMPANY_INFO` hardcodat cu `import.meta.env.VITE_COMPANY_*` sau config file
- `components/MainLayout.jsx`: Logo din config/env
- `utils/routes.js`: URL-uri din env vars

**Backend:**
- `src/main.ts`: CORS origins din env
- `src/services/hall-of-fame.service.ts`: BCC emails din env
- `deploy-backend.sh`: Variabile din env, nu hardcodate

**n8n:**
- Workflows template cu placeholders pentru domenii
- Script de substituție la clone

---

## 4) PLAN MIGRARE PAS-CU-PAS

### Faza 1: Preparare Template (Fără Breaking Changes)

**1.1. Creează Structură Config**
- [ ] Creează `config/company.env.example` cu toate variabilele necesare
- [ ] Creează `config/company.config.json.example` pentru branding
- [ ] Creează `config/branding/logo.svg.example`
- [ ] Documentează toate variabilele în `docs/TEMPLATE_CONFIG.md`

**1.2. Externalizează Hardcodate (Backward Compatible)**
- [ ] **Frontend:**
  - [ ] `exportExcel.ts`: Adaugă fallback la env vars, păstrează hardcodat ca default
  - [ ] `MainLayout.jsx`: Logo din env, fallback la `/logo.svg`
  - [ ] `routes.js`: URL-uri din `import.meta.env.VITE_API_URL`, fallback la hardcodat
- [ ] **Backend:**
  - [ ] `main.ts`: CORS origins din `CORS_ORIGINS` env var, fallback la hardcodat
  - [ ] `hall-of-fame.service.ts`: BCC emails din `EMAIL_BCC` env var, fallback la hardcodat
  - [ ] `deploy-backend.sh`: Toate valorile din env vars, cu defaults

**1.3. Creează Scripturi Clonare**
- [ ] `scripts/clone-company.sh`: Clonează repo, substituie placeholders
- [ ] `scripts/setup-company.sh`: Setup inițial pentru companie nouă
- [ ] `scripts/validate-config.sh`: Validează configurația companiei

**Complexitate:** Low  
**Risc:** Low (backward compatible)  
**Timp estimat:** 2-3 zile

### Faza 2: Refactoring Cod Core (Minimal)

**2.1. Frontend Config System**
- [ ] Creează `src/config/company.js` care citește din env vars + config file
- [ ] Înlocuiește toate hardcodate cu `companyConfig.name`, `companyConfig.email`, etc.
- [ ] Testează că toate funcționează cu config din env

**2.2. Backend Config Module**
- [ ] Extinde `ConfigModule` cu `CompanyConfig` (citește din env)
- [ ] Injectează `CompanyConfig` în servicii care au nevoie
- [ ] Păstrează defaults pentru backward compatibility

**2.3. n8n Workflows Template**
- [ ] Creează versiuni template ale workflows cu placeholders (`{{COMPANY_DOMAIN}}`, etc.)
- [ ] Script de substituție: `scripts/n8n-replace-placeholders.sh`
- [ ] Documentează workflow-urile care necesită configurare manuală

**Complexitate:** Medium  
**Risc:** Medium (necesită testare extensivă)  
**Timp estimat:** 3-5 zile

### Faza 3: Documentație și Testare

**3.1. Documentație Template**
- [ ] `docs/TEMPLATE_SETUP.md`: Ghid complet setup template
- [ ] `docs/CLONING_GUIDE.md`: Pași detaliați pentru clonare companie
- [ ] `docs/COMPANY_CONFIG_REFERENCE.md`: Referință completă variabile config

**3.2. Testare Template**
- [ ] Clonează template într-un environment de test
- [ ] Configurează cu date de test
- [ ] Testează toate funcționalitățile
- [ ] Validează izolarea (DB, n8n, file storage)

**Complexitate:** Low  
**Risc:** Low  
**Timp estimat:** 2-3 zile

### Faza 4: Deployment Model (Opțional - Viitor)

**4.1. Docker Compose Template**
- [ ] Creează `docker-compose.template.yml` cu toate serviciile
- [ ] Configurare per companie prin env files
- [ ] Network isolation per companie

**4.2. Kubernetes Manifests (Opțional)**
- [ ] Helm charts pentru template
- [ ] Namespace isolation per companie

**Complexitate:** High  
**Risc:** High (schimbă arhitectura deployment)  
**Timp estimat:** 1-2 săptămâni

---

## 5) MODEL DEPLOYMENT

### Deployment per Companie (Recomandat)

#### Servicii per Companie

**1. Frontend**
- **Opțiune A:** Static files pe CDN (Cloudflare, AWS S3+CloudFront)
  - Build: `npm run build` → upload la CDN
  - Config: Environment variables la build time
  - Cost: ~$5-10/lună per companie
- **Opțiune B:** Server static (Nginx pe VPS)
  - Locație: `/opt/{company-name}/frontend/`
  - Config: Nginx virtual host per domeniu
  - Cost: Partajat pe VPS

**2. Backend (NestJS)**
- **Locație:** `/opt/{company-name}/backend/`
- **Runtime:** Node.js direct (sau Docker container)
- **Port:** Port unic per companie (3000, 3001, 3002, ...)
- **Process:** PM2 sau systemd service
- **Logs:** `/opt/{company-name}/backend.log`
- **Cost:** ~$10-20/lună per companie (pe VPS partajat)

**3. Database (MySQL)**
- **Opțiune A:** Database separat per companie pe același server
  - Database: `{company_name}_db`
  - User: `{company_name}_user`
  - Izolare: MySQL users și grants
- **Opțiune B:** Server DB separat (recomandat pentru producție)
  - Server dedicat sau managed DB (AWS RDS, DigitalOcean)
  - Cost: ~$15-30/lună per companie

**4. n8n (Workflows)**
- **Opțiune A:** Container Docker separat per companie
  - Container: `n8n-{company-name}`
  - Volume: `/opt/{company-name}/n8n-data/`
  - Network: `{company-name}-network`
- **Opțiune B:** n8n Cloud (managed)
  - Cost: ~$20/lună per companie

**5. File Storage**
- **Locație:** `/opt/{company-name}/uploads/`
- **Backup:** Script automat backup la S3/Backblaze
- **Cost:** ~$5/lună per companie (storage + backup)

#### Izolare

**Network Isolation:**
- Docker networks separate per companie
- Sau: Firewall rules pe VPS

**Database Isolation:**
- Database și user MySQL separat per companie
- Grants restrictive (doar acces la DB-ul propriu)

**File Storage Isolation:**
- Directoare separate cu permisiuni restrictive
- Sau: S3 buckets separate

**n8n Isolation:**
- Container/instance separat
- Credentials separate
- Workflows separate (nu shared)

#### Naming Conventions

**Directoare:**
- `/opt/{company-slug}/` (ex: `/opt/decamino/`, `/opt/compania2/`)

**Database:**
- `{company_slug}_db` (ex: `decamino_db`, `compania2_db`)

**Docker Containers:**
- `{company-slug}-backend`
- `{company-slug}-n8n`
- `{company-slug}-nginx` (dacă e nevoie)

**Domains:**
- `api.{company-domain}.com`
- `n8n.{company-domain}.com`
- `app.{company-domain}.com`

#### Traefik Configuration

**Labels per Container:**
```yaml
traefik.enable=true
traefik.http.routers.{company-slug}-api.rule=Host(`api.{company-domain}.com`)
traefik.http.routers.{company-slug}-api.entrypoints=websecure
traefik.http.routers.{company-slug}-api.tls.certresolver=myresolver
```

### Costuri Estimate per Companie

**Opțiune Minimală (VPS Partajat):**
- VPS: $20/lună (partajat între 5-10 companii) = $2-4/companie
- Database: $0 (pe același VPS) = $0/companie
- Storage: $5/lună/companie
- **Total: ~$7-9/lună per companie**

**Opțiune Recomandată (Servicii Separate):**
- VPS Backend: $10/lună/companie
- Managed Database: $15/lună/companie
- n8n Cloud: $20/lună/companie
- Storage + Backup: $5/lună/companie
- **Total: ~$50/lună per companie**

---

## 6) CHECKLIST CLONARE COMPANIE NOUĂ

### Pre-Clonare

- [ ] **Verifică Prerequisituri:**
  - [ ] VPS/server disponibil sau spațiu pe VPS existent
  - [ ] Domain-uri configurate (api.{domain}, n8n.{domain}, app.{domain})
  - [ ] SSL certificates (Let's Encrypt prin Traefik)
  - [ ] MySQL server disponibil sau creat

### Clonare Template

- [ ] **Clonează Repository:**
  ```bash
  git clone <template-repo-url> /opt/{company-slug}
  cd /opt/{company-slug}
  ```

- [ ] **Creează Branch pentru Companie (Opțional):**
  ```bash
  git checkout -b company/{company-slug}
  ```

### Configurare Environment

- [ ] **Backend `.env`:**
  - [ ] Copiază `backend/.env.example` → `backend/.env`
  - [ ] Completează toate variabilele:
    - [ ] `COMPANY_NAME`, `COMPANY_CIF`, `COMPANY_ADDRESS`, etc.
    - [ ] `API_DOMAIN`, `N8N_DOMAIN`, `FRONTEND_DOMAIN`
    - [ ] `DB_HOST`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`
    - [ ] `SMTP_*`, `TELEGRAM_*`
    - [ ] `JWT_SECRET` (generează nou: `openssl rand -base64 32`)
    - [ ] `CORS_ORIGINS`

- [ ] **Frontend Config:**
  - [ ] Creează `frontend/.env.production` cu:
    - [ ] `VITE_API_URL=https://api.{company-domain}.com`
    - [ ] `VITE_COMPANY_NAME=...`
    - [ ] `VITE_COMPANY_EMAIL=...`
    - [ ] Alte variabile necesare

- [ ] **Company Config File:**
  - [ ] Copiază `config/company.config.json.example` → `config/company.config.json`
  - [ ] Completează branding (logo, culori)

### Setup Database

- [ ] **Creează Database:**
  ```sql
  CREATE DATABASE {company_slug}_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER '{company_slug}_user'@'%' IDENTIFIED BY 'strong-password';
  GRANT ALL PRIVILEGES ON {company_slug}_db.* TO '{company_slug}_user'@'%';
  FLUSH PRIVILEGES;
  ```

- [ ] **Run Prisma Migrations:**
  ```bash
  cd backend
  npx prisma migrate deploy
  # sau: npx prisma db push (dacă DB e goală)
  ```

### Setup n8n

- [ ] **Clonează Workflows:**
  - [ ] Copiază `n8n-snapshots/` → `/opt/{company-slug}/n8n-data/workflows/`
  - [ ] Rulează script de substituție:
    ```bash
    ./scripts/n8n-replace-placeholders.sh {company-domain}
    ```

- [ ] **Configurează n8n Container:**
  ```bash
  docker run -d \
    --name n8n-{company-slug} \
    --network {company-slug}-network \
    -v /opt/{company-slug}/n8n-data:/home/node/.n8n \
    -e N8N_HOST=n8n.{company-domain}.com \
    -e N8N_PROTOCOL=https \
    n8nio/n8n
  ```

- [ ] **Importă Workflows în n8n:**
  - [ ] Accesează n8n UI
  - [ ] Importă workflows din `/opt/{company-slug}/n8n-data/workflows/`
  - [ ] Configurează credentials (SMTP, Telegram, Google Sheets, etc.)

### Deploy Backend

- [ ] **Build și Deploy:**
  ```bash
  cd /opt/{company-slug}/backend
  ./deploy-backend.sh
  # sau manual:
  npm install
  npx prisma generate
  npm run build
  nohup node dist/src/main.js > ../backend.log 2>&1 &
  ```

- [ ] **Verifică Backend:**
  - [ ] `curl https://api.{company-domain}.com/health` (dacă există endpoint)
  - [ ] Verifică logs: `tail -f /opt/{company-slug}/backend.log`

### Deploy Frontend

- [ ] **Build Frontend:**
  ```bash
  cd /opt/{company-slug}/frontend
  npm install
  npm run build
  ```

- [ ] **Deploy Static Files:**
  - [ ] **Opțiune A (CDN):** Upload `dist/` la S3/Cloudflare
  - [ ] **Opțiune B (Nginx):** Configurează Nginx virtual host:
    ```nginx
    server {
      listen 443 ssl;
      server_name app.{company-domain}.com;
      root /opt/{company-slug}/frontend/dist;
      # ... SSL config
    }
    ```

### Configurare Traefik (dacă folosește)

- [ ] **Adaugă Labels la Containers:**
  - [ ] Backend container: Labels pentru `api.{company-domain}.com`
  - [ ] n8n container: Labels pentru `n8n.{company-domain}.com`
  - [ ] Frontend (dacă e container): Labels pentru `app.{company-domain}.com`

### Testare

- [ ] **Smoke Tests:**
  - [ ] Accesează frontend: `https://app.{company-domain}.com`
  - [ ] Login funcționează
  - [ ] API responses corecte
  - [ ] WebSocket connections funcționează
  - [ ] n8n workflows răspund

- [ ] **Functional Tests:**
  - [ ] Creare angajat
  - [ ] Pontaj (fichaje)
  - [ ] Notificări
  - [ ] Chat
  - [ ] Export Excel/PDF

- [ ] **Izolare Tests:**
  - [ ] Verifică că DB-ul companiei 1 nu e accesibil din compania 2
  - [ ] Verifică că file storage e separat
  - [ ] Verifică că n8n workflows sunt separate

### Documentație Companie

- [ ] **Creează Documentație:**
  - [ ] `docs/COMPANY_{company-slug}.md` cu:
    - [ ] Credentials (DB, SMTP, Telegram)
    - [ ] Domains configurate
    - [ ] Backup schedule
    - [ ] Contact info pentru support

---

## 7) RISCURI ȘI SIGURANȚĂ

### Riscuri Identificate

#### 1. **Risc: Contaminare Date între Companii**
**Severitate:** CRITICAL  
**Probabilitate:** Medium (dacă config greșit)

**Cauze:**
- Database connection string greșit (conectează la DB-ul altei companii)
- File storage path greșit (accesează directoare altei companii)
- n8n workflows shared (accesează date altei companii)

**Mitigare:**
- ✅ Database: User MySQL separat per companie cu grants restrictive
- ✅ File Storage: Permisiuni restrictive (chmod 700), user separat
- ✅ n8n: Container/instance separat, credentials separate
- ✅ Validare config: Script `validate-config.sh` verifică izolarea
- ✅ Monitoring: Alerts dacă se detectează acces cross-company

#### 2. **Risc: Secret Leakage**
**Severitate:** CRITICAL  
**Probabilitate:** Low (dacă se urmează best practices)

**Cauze:**
- Secrets hardcodate în cod (JWT_SECRET, DB_PASSWORD)
- Secrets în Git history
- Secrets în logs

**Mitigare:**
- ✅ Secrets doar în `.env` (nu în Git)
- ✅ `.env` în `.gitignore`
- ✅ Secrets management: HashiCorp Vault sau AWS Secrets Manager (opțional)
- ✅ Logging: Nu loga secrets (sanitize logs)

#### 3. **Risc: Configurație Greșită la Clone**
**Severitate:** HIGH  
**Probabilitate:** Medium (uman error)

**Cauze:**
- Variabile env incomplete sau greșite
- Domain-uri neconfigurate corect
- Database migrations neaplicate

**Mitigare:**
- ✅ Script de validare: `validate-config.sh` verifică toate variabilele
- ✅ Documentație clară: Checklist pas-cu-pas
- ✅ Defaults safe: Dacă variabilă lipsește, aplicația nu pornește (nu folosește default periculos)

#### 4. **Risc: n8n Workflows Shared**
**Severitate:** HIGH  
**Probabilitate:** Low (dacă se urmează procesul)

**Cauze:**
- Workflows importate greșit (din alta companie)
- Credentials shared între n8n instances

**Mitigare:**
- ✅ n8n instance separat per companie
- ✅ Workflows template cu substituție automată
- ✅ Validare: Script verifică că workflows nu conțin domenii altei companii

#### 5. **Risc: Breaking Changes în Template**
**Severitate:** MEDIUM  
**Probabilitate:** Medium (la update-uri template)

**Cauze:**
- Update template care schimbă structura config
- Update dependencies care breaking changes

**Mitigare:**
- ✅ Versioning: Template version în `package.json`
- ✅ Changelog: Documentează toate breaking changes
- ✅ Migration scripts: Scripts pentru migrare config vechi → nou
- ✅ Testing: Testează update-uri pe environment de test înainte

### Checklist Validare Izolare

**Database Isolation:**
- [ ] User MySQL separat per companie
- [ ] Grants restrictive (doar acces la DB-ul propriu)
- [ ] Test: Încearcă să accesezi DB altei companii → ar trebui să eșueze

**File Storage Isolation:**
- [ ] Directoare separate per companie
- [ ] Permisiuni restrictive (chmod 700)
- [ ] User sistem separat (opțional)
- [ ] Test: Încearcă să accesezi fișiere altei companii → ar trebui să eșueze

**n8n Isolation:**
- [ ] Container/instance separat
- [ ] Volume-uri separate
- [ ] Credentials separate
- [ ] Test: Verifică că workflows nu conțin domenii altei companii

**Network Isolation:**
- [ ] Docker networks separate (dacă folosește Docker)
- [ ] Firewall rules (opțional)
- [ ] Test: Verifică că serviciile unei companii nu sunt accesibile din alta

**Config Validation:**
- [ ] Rulează `validate-config.sh` → toate check-urile trec
- [ ] Verifică că nu există hardcodate rămase
- [ ] Verifică că toate env vars sunt setate

### Monitoring și Alerts

**Recomandări:**
- ✅ Logging centralizat (opțional): ELK Stack sau similar
- ✅ Monitoring: Uptime monitoring (UptimeRobot, Pingdom)
- ✅ Alerts: Email/Telegram pentru:
  - Backend down
  - Database connection errors
  - n8n workflows failed
  - Disk space low
  - Unusual access patterns (posibil contaminare date)

---

## Concluzie

Acest plan oferă o abordare incrementală și sigură pentru transformarea aplicației DeCamino Servicios într-un template reutilizabil. Prioritizăm:

1. **Backward Compatibility:** Nu stricăm producția existentă
2. **Izolare Completă:** Fiecare companie = deployment complet separat
3. **Configurație Externalizată:** Toate datele specifice companiei prin env vars și config files
4. **Siguranță:** Validări și checks pentru a preveni contaminarea datelor

**Următorii Pași:**
1. Implementează Faza 1 (Preparare Template) - 2-3 zile
2. Testează template-ul într-un environment de test
3. Documentează procesul complet
4. Clonează prima companie de test
5. Iterează și îmbunătățește procesul

**Estimare Totală:** 1-2 săptămâni pentru implementare completă (Fazele 1-3), plus timp pentru testare și documentație.
