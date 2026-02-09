# Explicație Template - Cum Funcționează Practic

## Conceptul de Bază

**Template = Proiectul tău actual devine "master template"**

Când vrei o companie nouă, **clonezi proiectul** și configurezi cu datele companiei noi.

---

## Structură Practică

### Situația ACUM (Înainte de Template)

```
decaminoserviciosapp/          ← Proiectul actual (DeCamino)
├── frontend/
├── backend/
└── ...
```

**Problema:** Totul e hardcodat pentru "DeCamino":
- Nume companie: `DE CAMINO SERVICIOS AUXILIARES SL`
- Domain: `api.decaminoservicios.com`
- Database: `decamino_db`
- Email: `info@decaminoservicios.com`
- etc.

---

### Situația DUPĂ Template

#### 1. Proiectul Actual Devine "Template Master"

```
template-master/               ← Proiectul tău actual (refactorizat)
├── frontend/                 ← Cod generic (fără hardcodate)
├── backend/                  ← Cod generic
├── config/                   ← NOU: Config files template
│   ├── company.env.example
│   └── company.config.json.example
└── scripts/                  ← NOU: Scripturi de clonare
    ├── clone-company.sh
    └── setup-company.sh
```

**Ce se schimbă:**
- ❌ **NU mai ai hardcodate** în cod (nume companie, domain, etc.)
- ✅ **Totul vine din config** (env vars, config files)
- ✅ **Codul e generic** - funcționează pentru orice companie

#### 2. Când Vrei Companie Nouă → Clonezi Template-ul

**Exemplu: Vrei să adaugi "Compania XYZ"**

```bash
# Clonezi template-ul
git clone template-master compania-xyz
cd compania-xyz

# Rulezi scriptul de setup
./scripts/setup-company.sh compania-xyz
```

**Ce face scriptul:**
1. Creează `.env` cu datele companiei XYZ
2. Creează `config/company.config.json` cu branding XYZ
3. Configurează database connection pentru XYZ
4. Setup n8n workflows pentru XYZ

#### 3. Rezultat: Fiecare Companie = Proiect Separat

```
/opt/
├── decamino/                 ← Compania 1 (DeCamino - original)
│   ├── frontend/
│   ├── backend/
│   └── .env                  ← Config DeCamino
│
├── compania-xyz/             ← Compania 2 (XYZ - clonat)
│   ├── frontend/
│   ├── backend/
│   └── .env                  ← Config XYZ
│
└── compania-abc/              ← Compania 3 (ABC - clonat)
    ├── frontend/
    ├── backend/
    └── .env                  ← Config ABC
```

**Fiecare companie:**
- ✅ **Proiect separat** (nu multi-tenant)
- ✅ **Database separat** (`decamino_db`, `compania_xyz_db`, `compania_abc_db`)
- ✅ **n8n separat** (container/instance separat)
- ✅ **Domain separat** (`api.decaminoservicios.com`, `api.xyz.com`, `api.abc.com`)

---

## Exemplu Concret: Cum Funcționează

### Înainte (Hardcodat)

**`frontend/src/utils/exportExcel.ts`:**
```typescript
// HARDCODAT - doar pentru DeCamino
const COMPANY_INFO = {
  name: 'DE CAMINO SERVICIOS AUXILIARES SL',  // ← Hardcodat!
  cif: 'B85524536',                            // ← Hardcodat!
  email: 'info@decaminoservicios.com'          // ← Hardcodat!
};
```

**Problema:** Dacă clonezi proiectul pentru compania XYZ, tot va apărea "DeCamino" în Excel-uri!

---

### După (Template - Config Externalizat)

**`frontend/src/utils/exportExcel.ts`:**
```typescript
// GENERIC - funcționează pentru orice companie
const COMPANY_INFO = {
  name: import.meta.env.VITE_COMPANY_NAME || 'Company Name',  // ← Din env!
  cif: import.meta.env.VITE_COMPANY_CIF || '',                // ← Din env!
  email: import.meta.env.VITE_COMPANY_EMAIL || ''             // ← Din env!
};
```

**`compania-xyz/frontend/.env.production`:**
```env
VITE_COMPANY_NAME=Compania XYZ SL
VITE_COMPANY_CIF=X12345678
VITE_COMPANY_EMAIL=info@xyz.com
```

**Rezultat:** Când compania XYZ folosește aplicația, Excel-urile vor avea "Compania XYZ SL", nu "DeCamino"!

---

## Procesul Complet: De la Template la Companie Nouă

### Pasul 1: Pregătești Template-ul (Odată)

**1.1. Externalizezi Hardcodate-urile**

**Înainte:**
```typescript
// backend/src/main.ts
const corsOrigins = [
  'https://app.decaminoservicios.com',  // ← Hardcodat!
  'https://decaminoservicios.com'       // ← Hardcodat!
];
```

**După:**
```typescript
// backend/src/main.ts
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [
  'http://localhost:5173'  // ← Default doar pentru dev
];
```

**1.2. Creezi Config Files Template**

**`config/company.env.example`:**
```env
# Company Identity
COMPANY_NAME=De Camino Servicios Auxiliares SL
COMPANY_CIF=B85524536
COMPANY_EMAIL=info@decaminoservicios.com

# Domains
API_DOMAIN=api.decaminoservicios.com
FRONTEND_DOMAIN=app.decaminoservicios.com
CORS_ORIGINS=https://app.decaminoservicios.com,https://decaminoservicios.com

# Database
DB_HOST=217.154.102.115
DB_NAME=decamino_db
DB_USERNAME=facturacion_user
DB_PASSWORD=...

# Email
SMTP_USER=info@decaminoservicios.com
SMTP_FROM=De Camino Servicios Auxiliares SL <info@decaminoservicios.com>
```

**1.3. Creezi Script de Clonare**

**`scripts/clone-company.sh`:**
```bash
#!/bin/bash
COMPANY_SLUG=$1  # ex: "compania-xyz"

# Clonează template-ul
git clone <template-repo> /opt/$COMPANY_SLUG
cd /opt/$COMPANY_SLUG

# Copiază config template
cp config/company.env.example backend/.env
cp config/company.config.json.example config/company.config.json

# Rulează setup interactiv (sau din parametri)
./scripts/setup-company.sh $COMPANY_SLUG
```

---

### Pasul 2: Când Vrei Companie Nouă (De Fiecare Dată)

**Exemplu: Vrei să adaugi "Servicios ABC"**

**2.1. Clonezi Template-ul**
```bash
cd /opt
./scripts/clone-company.sh servicios-abc
```

**2.2. Configurezi Datele Companiei**

**`servicios-abc/backend/.env`:**
```env
# Company Identity
COMPANY_NAME=Servicios ABC SL
COMPANY_CIF=A98765432
COMPANY_EMAIL=info@abc.com

# Domains
API_DOMAIN=api.abc.com
FRONTEND_DOMAIN=app.abc.com
CORS_ORIGINS=https://app.abc.com,https://abc.com

# Database
DB_HOST=217.154.102.115
DB_NAME=servicios_abc_db          # ← Database nou!
DB_USERNAME=servicios_abc_user    # ← User nou!
DB_PASSWORD=strong-password-abc

# Email
SMTP_USER=info@abc.com
SMTP_FROM=Servicios ABC SL <info@abc.com>
```

**2.3. Setup Database**
```bash
cd servicios-abc/backend

# Creează database nou
mysql -u root -p
CREATE DATABASE servicios_abc_db;
CREATE USER 'servicios_abc_user'@'%' IDENTIFIED BY 'strong-password-abc';
GRANT ALL ON servicios_abc_db.* TO 'servicios_abc_user'@'%';

# Rulează migrations
npx prisma migrate deploy
```

**2.4. Deploy**
```bash
# Build și deploy backend
cd backend
npm install
npm run build
nohup node dist/src/main.js > ../backend.log 2>&1 &

# Build și deploy frontend
cd ../frontend
npm install
npm run build
# Upload dist/ la CDN sau server static
```

**2.5. Setup n8n (Container Nou)**
```bash
docker run -d \
  --name n8n-servicios-abc \
  -v /opt/servicios-abc/n8n-data:/home/node/.n8n \
  -e N8N_HOST=n8n.abc.com \
  n8nio/n8n
```

**Rezultat:** Ai o aplicație completă pentru "Servicios ABC", complet separată de DeCamino!

---

## Diferența: Template vs Multi-Tenant

### ❌ Multi-Tenant (NU vrei asta)
```
Un singur proiect, un singur database:
├── compania_1_data (în același DB)
├── compania_2_data (în același DB)
└── compania_3_data (în același DB)
```
**Probleme:** Riscuri de contaminare date, complexitate mare, un bug afectează toate companiile

### ✅ Template (Ce vrei tu)
```
Proiecte separate, database-uri separate:
├── decamino/          → decamino_db
├── servicios-abc/     → servicios_abc_db
└── compania-xyz/     → compania_xyz_db
```
**Avantaje:** Izolare completă, siguranță, un bug afectează doar o companie

---

## Ce Se Clonază vs Ce Se Configurează

### Se Clonază (Cod Generic)
- ✅ **Toate fișierele** din `frontend/` și `backend/`
- ✅ **Schema Prisma** (aceeași pentru toate companiile)
- ✅ **n8n workflows** (template-uri, apoi configurezi credentials)
- ✅ **Structura proiectului**

### Se Configurează (Date Specifice Companiei)
- 🔧 **Environment variables** (`.env` files)
- 🔧 **Database connection** (DB nou, user nou)
- 🔧 **Domains** (DNS, SSL certificates)
- 🔧 **n8n credentials** (SMTP, Telegram, Google Sheets, etc.)
- 🔧 **Branding** (logo, culori - opțional)

---

## Exemplu Vizual: Flow Complet

```
┌─────────────────────────────────────┐
│   TEMPLATE MASTER (decaminoserviciosapp) │
│   - Cod generic                      │
│   - Fără hardcodate                  │
│   - Config din env vars              │
└─────────────────────────────────────┘
              │
              │ Clone + Config
              │
    ┌─────────┴─────────┬──────────────┐
    │                   │              │
    ▼                   ▼              ▼
┌─────────┐      ┌──────────┐    ┌──────────┐
│ DeCamino│      │ Servicios│    │ Compania │
│         │      │   ABC    │    │   XYZ    │
├─────────┤      ├──────────┤    ├──────────┤
│ DB:     │      │ DB:      │    │ DB:      │
│ decamino│      │ servicios│    │ compania │
│ _db     │      │ _abc_db  │    │ _xyz_db  │
│         │      │          │    │          │
│ Domain: │      │ Domain:  │    │ Domain:  │
│ api.    │      │ api.     │    │ api.     │
│ decamino│      │ abc.com  │    │ xyz.com  │
│ .com    │      │          │    │          │
└─────────┘      └──────────┘    └──────────┘
```

**Fiecare companie = deployment complet separat, izolat!**

---

## Concluzie

**Template = Proiectul tău actual devine "master"**

**Când vrei companie nouă:**
1. Clonezi proiectul
2. Configurezi cu datele companiei noi (env vars)
3. Setup database nou
4. Deploy separat

**Rezultat:** Fiecare companie = aplicație completă, separată, izolată!

**Nu creezi "alt proiect"** - clonezi proiectul actual și îl configurezi diferit pentru fiecare companie.
