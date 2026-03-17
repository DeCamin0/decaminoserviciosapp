# Checklist: Pregătire Template pentru Clonare
## Pași Concreți de Implementat

---

## 🎯 OBJECTIV

Transformă proiectul actual într-un template reutilizabil, fără hardcodate, gata pentru clonare.

---

## ✅ Faza 1: Structură Config (1-2 zile)

### 1.1. Creează Directoare Config

```bash
mkdir -p config/branding
mkdir -p scripts
```

**Actualizează `.gitignore`:**
```bash
# .gitignore
# Date reale companii (nu se comit)
# Ignore doar fișierele reale, NU example files
backend/.env
backend/.env.*
!backend/.env.example

frontend/.env.production
frontend/.env.production.*
!frontend/.env.production.example

# Fișiere locale specifice companii
backend/.env.decaminoservicios
frontend/.env.production.decaminoservicios
```

**Status:** [ ] Actualizat .gitignore

**Fișiere de creat:**
- [ ] `config/company.env.example` - Template env vars (doar placeholders!)
- [ ] `config/company.config.json.example` - Template config JSON (opțional, doar branding + features)
- [ ] `config/branding/logo.svg.example` - Logo template (opțional)
- [ ] `config/branding/colors.json.example` - Culori template (opțional)
- [ ] `backend/.env.decaminoservicios` - Date reale DeCamino (local, NU în Git!)
- [ ] `frontend/.env.production.decaminoservicios` - Date reale DeCamino (local, NU în Git!)

### 1.2. Creează `config/company.env.example`

**⚠️ IMPORTANT: Doar placeholders, NU date reale!**

**Conținut:**
```env
# ============================================
# COMPANY IDENTITY
# ============================================
COMPANY_NAME=Your Company Name SL
COMPANY_CIF=Your-CIF-Here
COMPANY_ADDRESS=Your Company Address
COMPANY_PHONE=Your Phone Number
COMPANY_EMAIL=info@yourcompany.com

# ============================================
# COMPANY SLUG (pentru naming: DB, containers, paths)
# ============================================
# Folosit pentru: ${COMPANY_SLUG}_db, n8n-${COMPANY_SLUG}, /opt/${COMPANY_SLUG}
COMPANY_SLUG=your-company-slug

# ============================================
# DOMAINS
# ============================================
API_DOMAIN=api.yourcompany.com
N8N_DOMAIN=n8n.yourcompany.com
FRONTEND_DOMAIN=app.yourcompany.com
CORS_ORIGINS=https://app.yourcompany.com,https://yourcompany.com

# ============================================
# DATABASE
# ============================================
# Database name va fi: ${COMPANY_SLUG}_db (ex: your-company-slug_db)
# Database user va fi: ${COMPANY_SLUG}_user (ex: your-company-slug_user)
DB_TYPE=mysql
DB_HOST=your-db-host-ip
DB_PORT=3306
DB_USERNAME=${COMPANY_SLUG}_user
DB_PASSWORD=your-strong-password-here
DB_NAME=${COMPANY_SLUG}_db
DB_SYNC=false
DB_LOGGING=true

# ============================================
# JWT
# ============================================
JWT_SECRET=your-jwt-secret-here-generate-with-openssl-rand-base64-32
JWT_EXPIRES_IN=7d

# ============================================
# n8n PROXY
# ============================================
N8N_BASE_URL=https://n8n.yourcompany.com
N8N_TIMEOUT=30000

# ============================================
# EMAIL (SMTP)
# ============================================
SMTP_HOST=smtp.your-email-provider.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@yourcompany.com
SMTP_PASSWORD=your-smtp-password-here
SMTP_FROM=Your Company Name SL <info@yourcompany.com>
EMAIL_BCC=your-bcc-email@yourcompany.com

# ============================================
# IMAP (Email Ingestion)
# ============================================
IMAP_HOST=imap.your-email-provider.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_MAILBOX=INBOX
IMAP_PROCESSED_MAILBOX=Extrase

# ============================================
# TELEGRAM
# ============================================
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here
TELEGRAM_CHAT_ID=your-telegram-chat-id-here
TELEGRAM_BOT_TOKEN_GENERAL=your-general-telegram-bot-token-here
TELEGRAM_CHAT_ID_GENERAL=your-general-chat-id-here

# ============================================
# PUSH NOTIFICATIONS (VAPID)
# ============================================
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

**Status:** [ ] Creat

### 1.2.1. Creează `backend/.env.decaminoservicios` (Local, NU în Git!)

**⚠️ IMPORTANT: Acest fișier NU se comite în Git! Adaugă în `.gitignore`:**

```bash
# .gitignore
backend/.env.decaminoservicios
```

**Conținut (cu datele reale DeCamino):**
```env
# Date reale pentru DeCamino (doar local, nu în Git!)
COMPANY_NAME=De Camino Servicios Auxiliares SL
COMPANY_CIF=B85524536
COMPANY_ADDRESS=Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España
COMPANY_PHONE=910 440 275
COMPANY_EMAIL=info@decaminoservicios.com
COMPANY_SLUG=decamino

API_DOMAIN=api.decaminoservicios.com
N8N_DOMAIN=n8n.decaminoservicios.com
FRONTEND_DOMAIN=app.decaminoservicios.com
CORS_ORIGINS=https://app.decaminoservicios.com,https://decaminoservicios.com

DB_HOST=217.154.102.115
DB_USERNAME=facturacion_user
DB_PASSWORD=ParolaTare123!
DB_NAME=decamino_db

SMTP_USER=info@decaminoservicios.com
SMTP_FROM=De Camino Servicios Auxiliares SL <info@decaminoservicios.com>
EMAIL_BCC=decamino.rrhh@gmail.com,app@decaminoservicios.com

TELEGRAM_CHAT_ID=-4990173907
# ... etc (toate datele reale)
```

**Status:** [ ] Creat (local, nu în Git)

### 1.3. Creează `config/company.config.json.example` (Opțional)

**⚠️ IMPORTANT: Doar branding + features, NU date companie (sunt în .env)!**

**Conținut:**
```json
{
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

**Notă:** Date companie (nume, CIF, email, etc.) sunt în `.env`, NU aici!  
**Config JSON = doar branding + features (fără secrete, fără date companie)**

**Status:** [ ] Creat (opțional)

---

## ✅ Faza 2: Externalizare Hardcodate Frontend (2-3 zile)

### 2.1. `frontend/src/utils/exportExcel.ts`

**Înainte:**
```typescript
const COMPANY_INFO = {
  name: 'DE CAMINO SERVICIOS AUXILIARES SL',  // ← Hardcodat!
  cif: 'B85524536',
  address: 'Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España',
  phone: '910 440 275',
  email: 'info@decaminoservicios.com'
};

const STYLES = {
  companyName: {
    fill: { fgColor: { argb: "CC0000" } }  // ← Hardcodat roșu!
  },
  reportTitle: {
    fill: { fgColor: { argb: "0066CC" } }  // ← Hardcodat albastru!
  }
};
```

**După:**
```typescript
// Backward compatible: dacă env vars lipsesc, folosește valorile vechi
const COMPANY_INFO = {
  name: import.meta.env.VITE_COMPANY_NAME || 'DE CAMINO SERVICIOS AUXILIARES SL',
  cif: import.meta.env.VITE_COMPANY_CIF || 'B85524536',
  address: import.meta.env.VITE_COMPANY_ADDRESS || 'Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España',
  phone: import.meta.env.VITE_COMPANY_PHONE || '910 440 275',
  email: import.meta.env.VITE_COMPANY_EMAIL || 'info@decaminoservicios.com'
};

// Culori din env vars (fără # pentru Excel ARGB)
const PRIMARY_COLOR = (import.meta.env.VITE_PRIMARY_COLOR || '#CC0000').replace('#', '');
const SECONDARY_COLOR = (import.meta.env.VITE_SECONDARY_COLOR || '#0066CC').replace('#', '');

const STYLES = {
  companyName: {
    fill: { fgColor: { argb: PRIMARY_COLOR } }  // ← Din env!
  },
  reportTitle: {
    fill: { fgColor: { argb: SECONDARY_COLOR } }  // ← Din env!
  },
  totalsRow: {
    fill: { fgColor: { argb: PRIMARY_COLOR } }   // ← Din env!
  }
};
```

**Status:** [ ] Modificat

### 2.2. `frontend/src/utils/routes.js`

**Înainte:**
```javascript
const BACKEND_PROD_URL = 'https://api.decaminoservicios.com';  // ← Hardcodat!
```

**După:**
```javascript
// Backward compatible
const BACKEND_PROD_URL = import.meta.env.VITE_API_URL || 'https://api.decaminoservicios.com';
```

**Toate endpoint-urile:** Înlocuiește hardcodate cu `import.meta.env.VITE_API_URL`  
**Notă:** Păstrează default-ul vechi pentru backward compatibility

**Status:** [ ] Modificat

### 2.3. `frontend/src/components/MainLayout.jsx` și `DesktopLayout.jsx`

**Înainte:**
```javascript
const getLogoUrl = () => {
  const basePath = import.meta.env.VITE_BASE_PATH || '/';
  return `${basePath}logo.svg`;  // ← Hardcodat logo.svg
};
```

**După:**
```javascript
const getLogoUrl = () => {
  const logoPath = import.meta.env.VITE_LOGO_PATH || '/logo.svg';
  const basePath = import.meta.env.VITE_BASE_PATH || '/';
  return `${basePath}${logoPath}`;
};
```

**Status:** [ ] Modificat

### 2.4. Creează `frontend/env.production.example`

**⚠️ IMPORTANT: Doar placeholders, NU date reale!**

**Conținut:**
```env
# API URL
VITE_API_URL=https://api.yourcompany.com

# Company Info (VITE_* pentru frontend)
VITE_COMPANY_NAME=Your Company Name SL
VITE_COMPANY_CIF=Your-CIF-Here
VITE_COMPANY_ADDRESS=Your Company Address
VITE_COMPANY_PHONE=Your Phone Number
VITE_COMPANY_EMAIL=info@yourcompany.com

# Branding - Logo
VITE_LOGO_PATH=logo.svg

# Branding - Culori
VITE_PRIMARY_COLOR=#CC0000        # Roșu (exemplu)
VITE_SECONDARY_COLOR=#0066CC      # Albastru (exemplu)
VITE_ACCENT_COLOR=#E53935         # Roșu accent (exemplu)
```

**Status:** [ ] Creat

### 2.4.1. Creează `frontend/.env.production.decaminoservicios` (Local, NU în Git!)

**⚠️ IMPORTANT: Acest fișier NU se comite în Git!**

**Conținut (cu datele reale DeCamino):**
```env
VITE_API_URL=https://api.decaminoservicios.com
VITE_COMPANY_NAME=De Camino Servicios Auxiliares SL
VITE_COMPANY_CIF=B85524536
VITE_COMPANY_ADDRESS=Avda. Euzkadi 14, Local 5, 28702 San Sebastian de los Reyes, Madrid, España
VITE_COMPANY_PHONE=910 440 275
VITE_COMPANY_EMAIL=info@decaminoservicios.com
VITE_LOGO_PATH=logo.svg
VITE_PRIMARY_COLOR=#CC0000
VITE_SECONDARY_COLOR=#0066CC
VITE_ACCENT_COLOR=#E53935
```

**Status:** [ ] Creat (local, nu în Git)

---

## ✅ Faza 3: Externalizare Hardcodate Backend (2-3 zile)

### 3.1. `backend/src/main.ts` - CORS Origins

**Înainte:**
```typescript
const defaultOrigins = [
  'http://localhost:5173',
  'https://app.decaminoservicios.com',  // ← Hardcodat!
  'https://decaminoservicios.com'       // ← Hardcodat!
];
```

**După:**
```typescript
// Backward compatible: dacă CORS_ORIGINS lipsește, folosește valorile vechi
const defaultOrigins = ['http://localhost:5173'];

const corsOrigins = process.env.CORS_ORIGINS
  ? [
      ...process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
      ...defaultOrigins,
    ]
  : [
      'http://localhost:5173',
      'https://app.decaminoservicios.com',  // ← Default pentru backward compatibility
      'https://decaminoservicios.com'
    ];
```

**Status:** [ ] Modificat

### 3.2. `backend/src/main.ts` - API URL Public

**Înainte:**
```typescript
const publicUrl =
  process.env.API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://api.decaminoservicios.com'  // ← Hardcodat!
    : `http://${host}:${port}`);
```

**După:**
```typescript
// Backward compatible
const publicUrl =
  process.env.API_URL ||
  (process.env.NODE_ENV === 'production'
    ? process.env.API_DOMAIN 
      ? `https://${process.env.API_DOMAIN}` 
      : 'https://api.decaminoservicios.com'  // ← Default pentru backward compatibility
    : `http://${host}:${port}`);
```

**Status:** [ ] Modificat

### 3.3. `backend/src/services/hall-of-fame.service.ts` - BCC Emails

**Înainte:**
```typescript
bcc: ['decamino.rrhh@gmail.com'],  // ← Hardcodat!
```

**După:**
```typescript
// Backward compatible: dacă EMAIL_BCC lipsește, folosește valoarea veche
bcc: process.env.EMAIL_BCC?.split(',').map(e => e.trim()) || ['decamino.rrhh@gmail.com'],
```

**Status:** [ ] Modificat

### 3.4. `backend/src/config/n8n.config.ts` - n8n URL

**Verifică:** Deja folosește `process.env.N8N_BASE_URL` - OK!

**Status:** [ ] Verificat (deja OK)

### 3.5. `backend/deploy-backend.sh` - Hardcodate

**Găsește toate hardcodate-urile:**
- [ ] `SMTP_USER=info@decaminoservicios.com` → Din env
- [ ] `SMTP_FROM=De Camino Servicios Auxiliares SL <info@decaminoservicios.com>` → Din env
- [ ] `DB_NAME=${DB_NAME:-decaminoservicios}` → OK (deja din env)

**Status:** [ ] Modificat

### 3.6. Extinde `backend/src/config/config.module.ts`

**Adaugă CompanyConfig:**
```typescript
// config/company.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('company', () => ({
  name: process.env.COMPANY_NAME || 'Company Name',
  cif: process.env.COMPANY_CIF || '',
  address: process.env.COMPANY_ADDRESS || '',
  phone: process.env.COMPANY_PHONE || '',
  email: process.env.COMPANY_EMAIL || '',
}));
```

**În `config.module.ts`:**
```typescript
import companyConfig from './config/company.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [databaseConfig, jwtConfig, n8nConfig, companyConfig], // ← Adaugă companyConfig
      // ...
    }),
  ],
})
```

**Status:** [ ] Creat și integrat

---

## ✅ Faza 4: Scripturi Clonare (1-2 zile)

### 4.1. Creează `scripts/clone-company.sh`

**⚠️ IMPORTANT: Folosește COMPANY_SLUG pentru toate naming-urile!**

**Conținut:**
```bash
#!/bin/bash
set -e

COMPANY_SLUG=$1
if [ -z "$COMPANY_SLUG" ]; then
  echo "Usage: $0 <company-slug>"
  echo "Example: $0 compania-xyz"
  echo ""
  echo "Company slug will be used for:"
  echo "  - Database: ${COMPANY_SLUG}_db"
  echo "  - DB User: ${COMPANY_SLUG}_user"
  echo "  - n8n Container: n8n-${COMPANY_SLUG}"
  echo "  - Path: /opt/${COMPANY_SLUG}"
  exit 1
fi

TARGET_DIR="/opt/$COMPANY_SLUG"
TEMPLATE_REPO="<your-template-repo-url>"

echo "📦 Cloning template to $TARGET_DIR..."

# Clone template
git clone "$TEMPLATE_REPO" "$TARGET_DIR"
cd "$TARGET_DIR"

# Run setup
./scripts/setup-company.sh "$COMPANY_SLUG"

echo ""
echo "✅ Company cloned successfully!"
echo ""
echo "📋 Standard naming (using COMPANY_SLUG=$COMPANY_SLUG):"
echo "   - Database: ${COMPANY_SLUG}_db"
echo "   - DB User: ${COMPANY_SLUG}_user"
echo "   - n8n Container: n8n-${COMPANY_SLUG}"
echo "   - Path: /opt/${COMPANY_SLUG}"
echo ""
echo "Next steps:"
echo "1. Edit $TARGET_DIR/backend/.env with company-specific values"
echo "2. Edit $TARGET_DIR/frontend/.env.production with company-specific values"
echo "3. Setup database: CREATE DATABASE ${COMPANY_SLUG}_db;"
echo "4. Run: ./scripts/validate-config.sh"
echo "5. Deploy (see docs/CLONING_GUIDE.md)"
```

**Status:** [ ] Creat

### 4.2. Creează `scripts/setup-company.sh`

**⚠️ IMPORTANT: Folosește COMPANY_SLUG peste tot + sincronizează backend → frontend!**

**Conținut:**
```bash
#!/bin/bash
set -e

COMPANY_SLUG=$1
if [ -z "$COMPANY_SLUG" ]; then
  echo "Usage: $0 <company-slug>"
  echo "Example: $0 compania-xyz"
  exit 1
fi

echo "🔧 Setting up company: $COMPANY_SLUG"

# Convert COMPANY_SLUG pentru MySQL (liniuțe → underscore)
# MySQL username nu acceptă bine liniuțe, folosim underscore
DB_SLUG=$(echo "$COMPANY_SLUG" | tr '-' '_')
echo "📋 DB Slug (for MySQL): $DB_SLUG"

# Export COMPANY_SLUG pentru a fi folosit în scripturi
export COMPANY_SLUG
export DB_SLUG

# Copy env templates
if [ ! -f backend/.env ]; then
  cp config/company.env.example backend/.env
  
  # Inlocuieste placeholder-ul COMPANY_SLUG cu valoarea reala
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/COMPANY_SLUG=your-company-slug/COMPANY_SLUG=$COMPANY_SLUG/g" backend/.env
    sed -i '' "s/\${COMPANY_SLUG}_db/${DB_SLUG}_db/g" backend/.env
    sed -i '' "s/\${COMPANY_SLUG}_user/${DB_SLUG}_user/g" backend/.env
  else
    # Linux
    sed -i "s/COMPANY_SLUG=your-company-slug/COMPANY_SLUG=$COMPANY_SLUG/g" backend/.env
    sed -i "s/\${COMPANY_SLUG}_db/${DB_SLUG}_db/g" backend/.env
    sed -i "s/\${COMPANY_SLUG}_user/${DB_SLUG}_user/g" backend/.env
  fi
  
  echo "✅ Created backend/.env from template (COMPANY_SLUG=$COMPANY_SLUG, DB_SLUG=$DB_SLUG)"
else
  echo "⚠️  backend/.env already exists, skipping..."
fi

if [ ! -f frontend/.env.production ]; then
  cp frontend/env.production.example frontend/.env.production
  
  # Sincronizează automat din backend/.env în frontend/.env.production
  # (dacă backend/.env există deja și are valori)
  # ⚠️ NU folosim "source" - e fragil cu spații/caractere speciale
  # Folosim grep + cut pentru parsing safe
  if [ -f backend/.env ]; then
    # Funcție helper pentru a extrage valoarea dintr-un .env file (safe pentru spații/caractere speciale)
    get_env_value() {
      local key="$1"
      local file="$2"
      # Extrage valoarea după primul =, păstrând tot restul (inclusiv spații, <, >, etc.)
      grep "^${key}=" "$file" 2>/dev/null | cut -d '=' -f2- | sed 's/^"\(.*\)"$/\1/' || echo ""
    }
    
    # Actualizează frontend/.env.production cu valorile din backend/.env (safe parsing)
    COMPANY_NAME_VAL=$(get_env_value "COMPANY_NAME" "backend/.env")
    if [ -n "$COMPANY_NAME_VAL" ]; then
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^VITE_COMPANY_NAME=.*|VITE_COMPANY_NAME=$COMPANY_NAME_VAL|g" frontend/.env.production
      else
        sed -i "s|^VITE_COMPANY_NAME=.*|VITE_COMPANY_NAME=$COMPANY_NAME_VAL|g" frontend/.env.production
      fi
    fi
    
    COMPANY_EMAIL_VAL=$(get_env_value "COMPANY_EMAIL" "backend/.env")
    if [ -n "$COMPANY_EMAIL_VAL" ]; then
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^VITE_COMPANY_EMAIL=.*|VITE_COMPANY_EMAIL=$COMPANY_EMAIL_VAL|g" frontend/.env.production
      else
        sed -i "s|^VITE_COMPANY_EMAIL=.*|VITE_COMPANY_EMAIL=$COMPANY_EMAIL_VAL|g" frontend/.env.production
      fi
    fi
    
    COMPANY_CIF_VAL=$(get_env_value "COMPANY_CIF" "backend/.env")
    if [ -n "$COMPANY_CIF_VAL" ]; then
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^VITE_COMPANY_CIF=.*|VITE_COMPANY_CIF=$COMPANY_CIF_VAL|g" frontend/.env.production
      else
        sed -i "s|^VITE_COMPANY_CIF=.*|VITE_COMPANY_CIF=$COMPANY_CIF_VAL|g" frontend/.env.production
      fi
    fi
    
    COMPANY_ADDRESS_VAL=$(get_env_value "COMPANY_ADDRESS" "backend/.env")
    if [ -n "$COMPANY_ADDRESS_VAL" ]; then
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^VITE_COMPANY_ADDRESS=.*|VITE_COMPANY_ADDRESS=$COMPANY_ADDRESS_VAL|g" frontend/.env.production
      else
        sed -i "s|^VITE_COMPANY_ADDRESS=.*|VITE_COMPANY_ADDRESS=$COMPANY_ADDRESS_VAL|g" frontend/.env.production
      fi
    fi
    
    COMPANY_PHONE_VAL=$(get_env_value "COMPANY_PHONE" "backend/.env")
    if [ -n "$COMPANY_PHONE_VAL" ]; then
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^VITE_COMPANY_PHONE=.*|VITE_COMPANY_PHONE=$COMPANY_PHONE_VAL|g" frontend/.env.production
      else
        sed -i "s|^VITE_COMPANY_PHONE=.*|VITE_COMPANY_PHONE=$COMPANY_PHONE_VAL|g" frontend/.env.production
      fi
    fi
    
    API_DOMAIN_VAL=$(get_env_value "API_DOMAIN" "backend/.env")
    if [ -n "$API_DOMAIN_VAL" ]; then
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^VITE_API_URL=.*|VITE_API_URL=https://$API_DOMAIN_VAL|g" frontend/.env.production
      else
        sed -i "s|^VITE_API_URL=.*|VITE_API_URL=https://$API_DOMAIN_VAL|g" frontend/.env.production
      fi
    fi
    
    echo "✅ Synced values from backend/.env to frontend/.env.production (safe parsing)"
  fi
  
  echo "✅ Created frontend/.env.production from template"
else
  echo "⚠️  frontend/.env.production already exists, skipping..."
fi

# Copy config JSON (opțional - doar branding + features)
if [ ! -f config/company.config.json ]; then
  if [ -f config/company.config.json.example ]; then
    cp config/company.config.json.example config/company.config.json
    echo "✅ Created config/company.config.json from template"
  fi
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "⚠️  IMPORTANT: Edit the following files with company-specific values:"
echo "   - backend/.env (COMPANY_NAME, COMPANY_EMAIL, domains, DB credentials, etc.)"
echo "   - frontend/.env.production (va fi sincronizat automat din backend/.env)"
echo ""
echo "📋 Standard naming (using COMPANY_SLUG=$COMPANY_SLUG, DB_SLUG=$DB_SLUG):"
echo "   - Database: ${DB_SLUG}_db (MySQL-safe, underscore)"
echo "   - DB User: ${DB_SLUG}_user (MySQL-safe, underscore)"
echo "   - n8n Container: n8n-${COMPANY_SLUG}"
echo "   - Path: /opt/${COMPANY_SLUG}"
echo "   - Domains: app.\${domain}, api.\${domain}, n8n.\${domain}"
```

**Status:** [ ] Creat

### 4.3. Creează `scripts/validate-config.sh`

**Conținut:**
```bash
#!/bin/bash
set -e

echo "🔍 Validating company configuration..."

# Check backend .env
if [ ! -f backend/.env ]; then
  echo "❌ backend/.env not found!"
  exit 1
fi

# Check COMPANY_SLUG
if ! grep -q "^COMPANY_SLUG=" backend/.env || grep -q "^COMPANY_SLUG=your-company-slug" backend/.env; then
  echo "❌ COMPANY_SLUG not set or still placeholder in backend/.env"
  exit 1
fi

COMPANY_SLUG=$(grep "^COMPANY_SLUG=" backend/.env | cut -d '=' -f2)
echo "📋 Using COMPANY_SLUG: $COMPANY_SLUG"

# Check required vars
REQUIRED_VARS=(
  "COMPANY_NAME"
  "COMPANY_EMAIL"
  "COMPANY_SLUG"
  "API_DOMAIN"
  "DB_NAME"
  "DB_USERNAME"
  "DB_PASSWORD"
  "JWT_SECRET"
  "SMTP_USER"
  "SMTP_PASSWORD"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "^${var}=" backend/.env || grep -q "^${var}=$" backend/.env || grep -q "^${var}=your-" backend/.env; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo "❌ Missing or incomplete variables in backend/.env:"
  printf '  - %s\n' "${MISSING_VARS[@]}"
  exit 1
fi

# Validate naming conventions (folosind COMPANY_SLUG)
# MySQL username folosește underscore, nu liniuțe
DB_SLUG=$(echo "$COMPANY_SLUG" | tr '-' '_')
EXPECTED_DB_NAME="${DB_SLUG}_db"
EXPECTED_DB_USER="${DB_SLUG}_user"

if ! grep -q "^DB_NAME=${EXPECTED_DB_NAME}" backend/.env; then
  echo "⚠️  Warning: DB_NAME should be '${EXPECTED_DB_NAME}' (following COMPANY_SLUG naming, MySQL-safe)"
fi

if ! grep -q "^DB_USERNAME=${EXPECTED_DB_USER}" backend/.env; then
  echo "⚠️  Warning: DB_USERNAME should be '${EXPECTED_DB_USER}' (following COMPANY_SLUG naming, MySQL-safe)"
fi

# Check frontend .env.production
if [ ! -f frontend/.env.production ]; then
  echo "❌ frontend/.env.production not found!"
  exit 1
fi

# Check required frontend vars
FRONTEND_REQUIRED=(
  "VITE_API_URL"
  "VITE_COMPANY_NAME"
  "VITE_COMPANY_EMAIL"
)

FRONTEND_MISSING=()

for var in "${FRONTEND_REQUIRED[@]}"; do
  if ! grep -q "^${var}=" frontend/.env.production || grep -q "^${var}=$" frontend/.env.production || grep -q "^${var}=Your" frontend/.env.production; then
    FRONTEND_MISSING+=("$var")
  fi
done

if [ ${#FRONTEND_MISSING[@]} -gt 0 ]; then
  echo "❌ Missing or incomplete variables in frontend/.env.production:"
  printf '  - %s\n' "${FRONTEND_MISSING[@]}"
  exit 1
fi

echo "✅ Configuration validation passed!"
echo "📋 Company slug: $COMPANY_SLUG"
echo "📋 Database: ${EXPECTED_DB_NAME}"
echo "📋 DB User: ${EXPECTED_DB_USER}"
```

**Status:** [ ] Creat

### 4.4. Creează `scripts/check-hardcoded.sh` (CRITIC!)

**⚠️ IMPORTANT: Verifică automat că nu mai există hardcodate-uri!**

**Conținut:**
```bash
#!/bin/bash
set -e

echo "🔍 Checking for hardcoded company-specific values..."

# Verifică dacă ripgrep (rg) e instalat
if ! command -v rg &> /dev/null; then
  echo "❌ ripgrep (rg) not found. Install it first:"
  echo "   macOS: brew install ripgrep"
  echo "   Linux: apt-get install ripgrep"
  exit 1
fi

# Lista de termeni de căutat (hardcodate-uri specifice DeCamino)
SEARCH_TERMS=(
  "decamino"
  "decaminoservicios.com"
  "B85524536"  # CIF DeCamino
  "info@decaminoservicios.com"
  "decamino.rrhh@gmail.com"
  "app@decaminoservicios.com"
  "217.154.102.115"  # IP DB (dacă e hardcodat)
  "facturacion_user"  # DB user (dacă e hardcodat)
)

# Fișiere/foldere de ignorat (fișiere locale cu date reale)
IGNORE_PATTERNS=(
  "backend/.env.decaminoservicios"
  "frontend/.env.production.decaminoservicios"
  "*.md"  # Documentație poate conține exemple
  "node_modules"
  ".git"
  "dist"
  "build"
)

# Construiește argumentele pentru ripgrep
RG_IGNORE_ARGS=()
for pattern in "${IGNORE_PATTERNS[@]}"; do
  RG_IGNORE_ARGS+=("--glob" "!${pattern}")
done

FOUND_HARDCODED=false

# Caută fiecare termen
for term in "${SEARCH_TERMS[@]}"; do
  echo ""
  echo "🔎 Searching for: $term"
  
  # Caută case-insensitive, exclude fișierele ignorate
  RESULTS=$(rg -i "$term" "${RG_IGNORE_ARGS[@]}" . 2>/dev/null || true)
  
  if [ -n "$RESULTS" ]; then
    echo "❌ Found hardcoded value: $term"
    echo "$RESULTS" | head -20  # Arată primele 20 rezultate
    FOUND_HARDCODED=true
  else
    echo "✅ Not found (or only in ignored files)"
  fi
done

echo ""
if [ "$FOUND_HARDCODED" = true ]; then
  echo "❌ HARDCODED VALUES FOUND!"
  echo ""
  echo "⚠️  Action required:"
  echo "   1. Review the results above"
  echo "   2. Replace hardcoded values with environment variables"
  echo "   3. Update .env files with company-specific values"
  echo "   4. Run this script again until it passes"
  exit 1
else
  echo "✅ No hardcoded values found (except in ignored files)"
  echo "✅ Template is ready for cloning!"
fi
```

**Status:** [ ] Creat

### 4.5. Make Scripts Executable

```bash
chmod +x scripts/*.sh
```

**Status:** [ ] Executat

---

## ✅ Faza 5: Documentație (1 zi)

### 5.1. Creează `docs/TEMPLATE_SETUP.md`

**Conținut:** Ghid complet setup template (cum să pregătești template-ul)

**Status:** [ ] Creat

### 5.2. Creează `docs/CLONING_GUIDE.md`

**Conținut:** Pași detaliați pentru clonare companie nouă (din checklist-ul din PLAN_TEMPLATE_MIGRATION.md)

**Status:** [ ] Creat

### 5.3. Creează `docs/COMPANY_CONFIG_REFERENCE.md`

**Conținut:** Referință completă toate variabilele config (ce face fiecare, default-uri, etc.)

**Status:** [ ] Creat

---

## ✅ Faza 6: Verificare Hardcodate-uri (CRITIC!)

### 6.1. Rulează `scripts/check-hardcoded.sh`

**⚠️ IMPORTANT: Acest pas e CRITIC înainte de a considera template-ul gata!**

- [ ] Rulează `scripts/check-hardcoded.sh`
- [ ] Verifică că nu mai există hardcodate-uri (decât în fișierele ignorate)
- [ ] Dacă găsește hardcodate-uri:
  - [ ] Identifică fișierele afectate
  - [ ] Externalizează valorile în env vars
  - [ ] Rulează din nou până trece

**Status:** [ ] Verificat (fără hardcodate-uri)

---

## ✅ Faza 7: Testare (1-2 zile)

### 7.1. Test Template în Development (Rapid)

**Focus pe esențial:**
- [ ] Clonează template-ul într-un director de test (`test-company`)
- [ ] Rulează `scripts/setup-company.sh test-company`
- [ ] Configurează `backend/.env` cu date de test (COMPANY_NAME, etc.)
- [ ] Rulează `scripts/validate-config.sh` → trebuie să treacă
- [ ] **Rulează `scripts/check-hardcoded.sh` → trebuie să treacă**
- [ ] Testează backend (start, health check)
- [ ] Testează frontend (build, preview)
- [ ] **Test critic:** Export Excel → verifică că apare numele companiei de test, NU "DeCamino"
- [ ] **Test critic:** Login funcționează

**Status:** [ ] Testat

### 7.2. Test Clonare Companie Nouă (Environment de Test)

- [ ] Clonează template-ul pentru "test-company-2"
- [ ] Configurează cu date de test diferite
- [ ] Setup database nou (`test-company-2_db`)
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Testează funcționalități de bază:
  - [ ] Login
  - [ ] Creare angajat
  - [ ] Pontaj
  - [ ] **Export Excel (verifică că apare numele companiei de test, nu DeCamino)**
  - [ ] Notificări
  - [ ] Chat
- [ ] Verifică izolarea: datele din `test-company-2_db` nu sunt accesibile din `test-company_db`

**Status:** [ ] Testat

---

## 📋 SUMAR: Ce Trebuie Modificat

### Fișiere de Modificat (Backward Compatible)

**Frontend:**
1. ✅ `frontend/src/utils/exportExcel.ts` - COMPANY_INFO + culori din env
2. ✅ `frontend/src/utils/routes.js` - URL-uri din env
3. ✅ `frontend/src/pages/SolicitudesPage.jsx` - PDF date companie din env
4. ✅ `frontend/src/components/MainLayout.jsx` - Logo path din env
5. ✅ `frontend/src/layouts/DesktopLayout.jsx` - Logo path din env
6. ✅ `frontend/src/layouts/MobileLayout.jsx` - Logo path din env (dacă există)

**Backend:**
1. ✅ `backend/src/main.ts` - CORS origins din env
2. ✅ `backend/src/main.ts` - API URL din env
3. ✅ `backend/src/services/hall-of-fame.service.ts` - BCC emails din env
4. ✅ `backend/deploy-backend.sh` - SMTP_FROM din env
5. ✅ `backend/src/config/config.module.ts` - Adaugă CompanyConfig

### Fișiere de Creat (Noi)

**Config:**
1. ✅ `config/company.env.example`
2. ✅ `config/company.config.json.example`
3. ✅ `config/branding/logo.svg.example`
4. ✅ `config/branding/colors.json.example`
5. ✅ `frontend/env.production.example`

**Scripts:**
1. ✅ `scripts/clone-company.sh`
2. ✅ `scripts/setup-company.sh`
3. ✅ `scripts/validate-config.sh`
4. ✅ `scripts/check-hardcoded.sh` (CRITIC - verificare hardcodate-uri)

**Documentație:**
1. ✅ `docs/TEMPLATE_SETUP.md`
2. ✅ `docs/CLONING_GUIDE.md`
3. ✅ `docs/COMPANY_CONFIG_REFERENCE.md`

---

## ⚠️ IMPORTANT: Backward Compatibility

**Toate modificările trebuie să fie backward compatible!**

**Strategie:**
- Folosește `||` cu default-uri (valorile actuale hardcodate)
- Dacă env var lipsește, folosește valoarea veche
- Astfel, producția actuală continuă să funcționeze fără modificări

**Exemplu:**
```typescript
// ✅ BUN - backward compatible
const companyName = process.env.COMPANY_NAME || 'DE CAMINO SERVICIOS AUXILIARES SL';

// ❌ RĂU - breaking change
const companyName = process.env.COMPANY_NAME; // undefined dacă lipsește!
```

---

## 🎯 Ordine de Implementare Recomandată (Rapidă)

### Varianta Rapidă (Recomandată - Mai Rapid la Rezultat)

**Focus pe esențial mai întâi, apoi documentație:**

1. **Faza 1** - Config + Example + Validate (1 zi)
   - Creează `config/company.env.example` (doar placeholders!)
   - Creează `frontend/env.production.example` (doar placeholders!)
   - Creează `scripts/validate-config.sh`
   - Creează `backend/.env.decaminoservicios` (local, nu în Git)

2. **Faza 2** - Frontend Esențial (1 zi)
   - `exportExcel.ts` - COMPANY_INFO din env (VITE_COMPANY_*)
   - `routes.js` - API_URL din env (VITE_API_URL)
   - `MainLayout.jsx` / `DesktopLayout.jsx` - Logo din env (VITE_LOGO_PATH)
   - Creează `frontend/.env.production.decaminoservicios` (local)

3. **Faza 3** - Backend Esențial (1 zi)
   - `main.ts` - CORS origins din env (CORS_ORIGINS)
   - `main.ts` - API URL din env (API_DOMAIN)
   - `hall-of-fame.service.ts` - BCC emails din env (EMAIL_BCC)
   - `deploy-backend.sh` - SMTP_FROM din env

4. **Faza 4** - Scripturi (1 zi)
   - `scripts/setup-company.sh` (cu COMPANY_SLUG peste tot, sync safe)
   - `scripts/clone-company.sh`
   - `scripts/check-hardcoded.sh` (CRITIC!)

5. **Faza 5** - Verificare Hardcodate-uri (CRITIC!)
   - Rulează `scripts/check-hardcoded.sh`
   - Corectează orice hardcodate-uri găsite
   - Repetă până trece

6. **Faza 6** - Test Rapid (1 zi)
   - Clonează template-ul pentru "test-company"
   - Configurează cu date de test
   - Testează: export Excel (verifică nume companie), login, funcționalități de bază

7. **Faza 7** - Documentație (după test)
   - Documentație (după ce știi că funcționează)

**Timp estimat varianta rapidă:** 4-5 zile până la rezultat funcțional (include verificare hardcodate-uri)

### Varianta Completă (Dacă Vrei Totul de la Început)

1. **Faza 1** - Structură Config (creează fișierele template)
2. **Faza 2** - Frontend (externalizează hardcodate-urile)
3. **Faza 3** - Backend (externalizează hardcodate-urile)
4. **Faza 4** - Scripturi (creează scripturile de clonare)
5. **Faza 5** - Documentație (documentează totul)
6. **Faza 6** - Testare (testează template-ul)

**Timp estimat varianta completă:** 1-2 săptămâni

---

## ✅ Checklist Final

**După ce termini toate fazele:**

- [ ] Toate hardcodate-urile externalizate
- [ ] **`scripts/check-hardcoded.sh` trece (fără hardcodate-uri)**
- [ ] Config files template create
- [ ] Scripturi de clonare funcționale
- [ ] Documentație completă
- [ ] Template testat (clone + deploy companie de test)
- [ ] Producția actuală funcționează (backward compatible)
- [ ] Gata pentru prima clonare reală!

---

## 🚀 Următorul Pas

După ce template-ul e gata:
1. Clonează pentru prima companie reală
2. Configurează cu datele companiei
3. Deploy
4. Iterează și îmbunătățește procesul

---

## 📝 SUMAR AJUSTĂRI FAȚĂ DE PLANUL INIȚIAL

### 1. ✅ .example Files = Doar Placeholders

**Înainte:** `.example` files conțineau date reale DeCamino  
**Acum:** `.example` files conțin doar placeholders (`Your Company Name`, `your-company-slug`, etc.)

**Date reale:** Fișiere locale separate (nu în Git):
- `backend/.env.decaminoservicios` (local, în `.gitignore`)
- `frontend/.env.production.decaminoservicios` (local, în `.gitignore`)

### 2. ✅ Naming Unificat: COMPANY_* vs VITE_COMPANY_*

**Backend:** `COMPANY_*` (fără prefix)
- `COMPANY_NAME`, `COMPANY_EMAIL`, `COMPANY_CIF`, etc.

**Frontend:** `VITE_COMPANY_*` (cu prefix VITE_)
- `VITE_COMPANY_NAME`, `VITE_COMPANY_EMAIL`, `VITE_COMPANY_CIF`, etc.

**Sincronizare automată:** `setup-company.sh` copiază automat din `backend/.env` în `frontend/.env.production`

### 3. ✅ Config JSON = Opțional, Doar Branding + Features

**Înainte:** `company.config.json` conținea și date companie (redundant cu `.env`)  
**Acum:** `company.config.json` = doar branding + features (opțional)

**Regulă:** Nu dubla sursele de adevăr!
- `.env` = secrete + infrastructură + date companie
- `company.config.json` = branding + features (fără secrete, fără date companie)

### 4. ✅ COMPANY_SLUG peste Tot (MySQL-Safe)

**Standard naming (folosind COMPANY_SLUG):**
- **COMPANY_SLUG:** Poate folosi liniuțe (ex: `compania-xyz`)
- **DB_SLUG:** Convertit automat (liniuțe → underscore) pentru MySQL
- Database: `${DB_SLUG}_db` (ex: `compania_xyz_db` - MySQL-safe)
- DB User: `${DB_SLUG}_user` (ex: `compania_xyz_user` - MySQL-safe)
- n8n Container: `n8n-${COMPANY_SLUG}` (ex: `n8n-compania-xyz`)
- Path: `/opt/${COMPANY_SLUG}` (ex: `/opt/compania-xyz`)
- Domains: `app.${domain}`, `api.${domain}`, `n8n.${domain}`

**În scripturi:** `setup-company.sh` convertește automat COMPANY_SLUG → DB_SLUG (underscore) pentru MySQL

### 5. ✅ Sync Safe (Fără `source`)

**Înainte:** `source backend/.env` (fragil cu spații/caractere speciale)  
**Acum:** Parsing safe cu `grep + cut` în `setup-company.sh`

**Funcție helper:**
```bash
get_env_value() {
  local key="$1"
  local file="$2"
  grep "^${key}=" "$file" 2>/dev/null | cut -d '=' -f2- | sed 's/^"\(.*\)"$/\1/' || echo ""
}
```

**Rezultat:** Funcționează corect și cu `SMTP_FROM=Compania <mail@...>` (spații, <, >)

### 6. ✅ Verificare Hardcodate-uri (CRITIC!)

**Script `check-hardcoded.sh`:**
- Caută automat termeni hardcodate (decamino, decaminoservicios.com, CIF, emailuri, etc.)
- Folosește `ripgrep` (rg) pentru căutare rapidă
- Ignoră fișierele locale (`.env.decaminoservicios`, documentație, node_modules)
- **Trebuie să treacă înainte de a considera template-ul gata!**

**Caută:**
- `decamino`
- `decaminoservicios.com`
- `B85524536` (CIF)
- `info@decaminoservicios.com`
- `decamino.rrhh@gmail.com`
- IP-uri, DB users hardcodate, etc.

### 7. ✅ Ordine de Execuție Rapidă

**Varianta rapidă (recomandată):**
1. Config + Example + Validate (1 zi)
2. Frontend Esențial (1 zi)
3. Backend Esențial (1 zi)
4. Test Rapid (1 zi) - **focus pe export Excel + login**
5. Scripturi + Documentație (după test)

**Timp estimat:** 3-4 zile până la rezultat funcțional (vs. 1-2 săptămâni varianta completă)

### 8. ✅ Backward Compatibility păstrată

**Toate modificările folosesc default-uri:**
```typescript
// ✅ BUN - backward compatible
const companyName = process.env.COMPANY_NAME || 'DE CAMINO SERVICIOS AUXILIARES SL';
```

**Producția actuală continuă să funcționează fără modificări!**
