# 📋 Plan Integrare Contasimple API v2 - DeCamino

**Status:** Planificare (nu implementat încă)  
**Data:** 2025-01-XX  
**Prioritate:** Medie (va fi implementat când e nevoie)

---

## 🎯 Obiective

1. **Sincronizare bidirecțională:**
   - Customers (Entities - Customers)
   - Providers (Entities - Providers)

2. **Facturare din DeCamino în Contasimple:**
   - Creare factură emisă (Accounting - Invoices - Issued)
   - Citire status + PDF

3. **Reconciliere (audit):**
   - Verificare periodică că DeCamino și Contasimple au aceiași clienți/furnizori
   - Creare/actualizare automată ce lipsește, fără dubluri

---

## 📐 Arhitectură Propusă

### 1. Tabele MariaDB (Prisma Schema)

```prisma
// Mapare pentru sincronizare bidirecțională
model ContasimpleMapping {
  id                    Int      @id @default(autoincrement())
  decamino_type         String   @db.VarChar(50) // 'customer' | 'provider' | 'invoice'
  decamino_id           Int      // ID din Clientes/Proveedores/Facturas
  contasimple_id        String   @db.VarChar(100) // ID din Contasimple
  contasimple_type      String?  @db.VarChar(50)
  sync_direction        String   @default("bidirectional") @db.VarChar(20)
  last_synced_at        DateTime @default(now())
  last_sync_status      String?  @db.VarChar(20) // 'success' | 'error' | 'pending'
  last_sync_error       String?  @db.Text
  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt

  @@unique([decamino_type, decamino_id], map: "uq_decamino_mapping")
  @@unique([contasimple_id], map: "uq_contasimple_id")
  @@index([decamino_type, decamino_id])
  @@index([contasimple_id])
}

// Cache token Contasimple
model ContasimpleTokenCache {
  id            Int      @id @default(autoincrement())
  token         String   @db.Text
  expires_at    DateTime
  created_at    DateTime @default(now())
}

// Audit/Log sincronizări
model ContasimpleSyncLog {
  id                Int      @id @default(autoincrement())
  sync_type         String   @db.VarChar(50) // 'customer' | 'provider' | 'invoice' | 'reconciliation'
  operation         String   @db.VarChar(50) // 'create' | 'update' | 'delete' | 'reconcile'
  decamino_id       Int?
  contasimple_id    String?  @db.VarChar(100)
  status            String   @db.VarChar(20) // 'success' | 'error' | 'skipped'
  error_message     String?  @db.Text
  request_payload   String?  @db.Text
  response_payload   String?  @db.Text
  created_at        DateTime @default(now())

  @@index([sync_type, created_at])
  @@index([status, created_at])
}
```

### 2. Structură Backend (NestJS)

```
backend/src/contasimple/
├── contasimple.module.ts
├── contasimple.controller.ts
├── services/
│   ├── contasimple-api.service.ts           # Token management + request wrapper
│   ├── contasimple-customer.service.ts     # Logică customers sync
│   ├── contasimple-provider.service.ts      # Logică providers sync
│   ├── contasimple-invoice.service.ts       # Logică facturi
│   ├── contasimple-sync.service.ts          # Sincronizare bidirecțională
│   └── contasimple-reconciliation.service.ts # Audit/reconciliere
├── dto/
│   ├── customer-sync.dto.ts
│   ├── provider-sync.dto.ts
│   └── invoice-create.dto.ts
└── utils/
    ├── field-mapper.ts                      # Mapare câmpuri DeCamino <-> Contasimple
    └── deduplication.ts                     # Logică deduplicare
```

### 3. Endpoint-uri Gateway

#### Customers:
```
POST   /api/contasimple/customers/sync              # Sync un customer specific
POST   /api/contasimple/customers/sync-all          # Sync toți customers
POST   /api/contasimple/customers/reconcile         # Reconciliere (audit)
GET    /api/contasimple/customers/{cliente_id}/status
GET    /api/contasimple/customers/mappings          # Listă mapări (debugging)
```

#### Providers:
```
POST   /api/contasimple/providers/sync
POST   /api/contasimple/providers/sync-all
POST   /api/contasimple/providers/reconcile
GET    /api/contasimple/providers/{proveedor_id}/status
```

#### Invoices:
```
POST   /api/contasimple/invoices/create              # Creare factură din DeCamino
GET    /api/contasimple/invoices/{id}                # Detalii factură
GET    /api/contasimple/invoices/{id}/pdf           # PDF factură
GET    /api/contasimple/invoices/{id}/status        # Status factură
```

### 4. Job-uri n8n/Cron

- **Job 1:** Sincronizare automată customers (oră în oră)
  - `POST /api/contasimple/customers/sync-all` (bidirectional)

- **Job 2:** Sincronizare automată providers (oră în oră)
  - `POST /api/contasimple/providers/sync-all` (bidirectional)

- **Job 3:** Reconciliere completă (zilnic, noaptea)
  - `POST /api/contasimple/customers/reconcile`
  - `POST /api/contasimple/providers/reconcile`

- **Job 4:** Refresh token (la 50 min)
  - Intern în `ContasimpleApiService` (automat)

---

## 🔄 Strategie Sincronizare

### Deduplicare (identificare customer/provider):

**Priorități:**
1. **NIF/CIF** (dacă există în ambele sisteme) - cel mai sigur
2. **Email + Nume** (dacă NIF lipsește)
3. **Nume exact + Adresă** (ultima opțiune)

### Mapare Câmpuri:

**DeCamino → Contasimple (Customer):**
```typescript
{
  tax_id: cliente.NIF,
  name: cliente.NOMBRE_O_RAZON_SOCIAL,
  email: cliente.EMAIL,
  phone: cliente.TELEFONO || cliente.MOVIL,
  address: cliente.DIRECCION,
  city: cliente.POBLACION,
  postal_code: cliente.CODIGO_POSTAL,
  province: cliente.PROVINCIA,
  country: cliente.PAIS || 'España'
}
```

**Contasimple → DeCamino (Customer):**
```typescript
{
  NIF: customer.tax_id,
  'NOMBRE O RAZON SOCIAL': customer.name,
  EMAIL: customer.email,
  TELEFONO: customer.phone,
  DIRECCION: customer.address,
  POBLACION: customer.city,
  'CODIGO POSTAL': customer.postal_code,
  PROVINCIA: customer.province,
  PAIS: customer.country || 'España'
}
```

---

## 📝 Plan Implementare (Pas cu Pas)

### **FAZA 1: Customers Sync** (prioritate 1)

#### Pas 1.1: Setup inițial
- [ ] Verificare Swagger Contasimple - endpoint-uri customers reale
- [ ] Creare tabelă `ContasimpleMapping` (doar pentru customers deocamdată)
- [ ] Creare tabelă `ContasimpleTokenCache`
- [ ] Creare tabelă `ContasimpleSyncLog`
- [ ] Setup `ContasimpleApiService` (token management cu cache 55 min)
- [ ] Configurare env: `CONTASIMPLE_AUTH_KEY`, `CONTASIMPLE_BASE_URL`

#### Pas 1.2: Sync DeCamino → Contasimple
- [ ] Implementare `ContasimpleCustomerService.upsertCustomer()`
- [ ] Implementare deduplicare (caută după NIF/email+nume în Contasimple)
- [ ] Endpoint `POST /api/contasimple/customers/sync` (pentru un customer)
- [ ] Testare manuală cu 5-10 customers

#### Pas 1.3: Sync Contasimple → DeCamino
- [ ] Implementare `syncFromContasimple()` (listă + sync cu paginare)
- [ ] Endpoint `POST /api/contasimple/customers/sync-all`
- [ ] Testare manuală

#### Pas 1.4: Reconciliere Customers
- [ ] Implementare `reconcileCustomers()`
- [ ] Endpoint `POST /api/contasimple/customers/reconcile`
- [ ] Testare cu date reale

#### Pas 1.5: Production Ready (Customers)
- [ ] Error handling robust
- [ ] Rate limiting (similar cu `N8nProxyService`)
- [ ] Logging complet în `ContasimpleSyncLog`
- [ ] Job n8n pentru sync automat (opțional)

---

### **FAZA 2: Providers Sync** (după Faza 1)

#### Pas 2.1: Sync DeCamino → Contasimple
- [ ] Implementare `ContasimpleProviderService` (similar cu customers)
- [ ] Endpoint `POST /api/contasimple/providers/sync`
- [ ] Testare manuală

#### Pas 2.2: Sync Contasimple → DeCamino
- [ ] Implementare sync bidirecțional providers
- [ ] Endpoint `POST /api/contasimple/providers/sync-all`
- [ ] Testare manuală

#### Pas 2.3: Reconciliere Providers
- [ ] Implementare `reconcileProviders()`
- [ ] Endpoint `POST /api/contasimple/providers/reconcile`
- [ ] Testare

---

### **FAZA 3: Invoices** (după Faza 2)

#### Pas 3.1: Creare Factură
- [ ] Verificare Swagger - endpoint-uri invoices reale
- [ ] Implementare `ContasimpleInvoiceService.createIssuedInvoice()`
- [ ] Mapare items factură (din `Facturas` DeCamino)
- [ ] Endpoint `POST /api/contasimple/invoices/create`
- [ ] Testare creare factură

#### Pas 3.2: Citire Status + PDF
- [ ] Implementare `getInvoiceStatus()`
- [ ] Implementare `getInvoicePDF()`
- [ ] Endpoint-uri `GET /api/contasimple/invoices/{id}/status` și `/pdf`
- [ ] Testare

---

### **FAZA 4: Production Ready (Complet)**

- [ ] Rate limiting pentru toate endpoint-urile
- [ ] Retry logic cu exponential backoff
- [ ] Paginare corectă pentru listă customers/providers
- [ ] Documentație API
- [ ] Job-uri n8n pentru sync automat
- [ ] Monitoring + alerting pentru erori

---

## 🔍 Checklist Testare

### Sandbox:
- [ ] Token refresh funcționează (cache 55 min)
- [ ] Creare customer în Contasimple (din DeCamino)
- [ ] Actualizare customer (modificare în DeCamino → sync în Contasimple)
- [ ] Creare customer în Contasimple → sync în DeCamino (bidirecțional)
- [ ] Deduplicare: customer cu același NIF nu se dublează
- [ ] Creare provider (similar cu customer)
- [ ] Creare factură emisă în Contasimple
- [ ] Descărcare PDF factură
- [ ] Reconciliere: identifică diferențe și le rezolvă
- [ ] Rate limiting: nu depășește limitele API

### Production:
- [ ] Job n8n sincronizare (oră în oră) rulează corect
- [ ] Job n8n reconciliere (zilnic) rulează corect
- [ ] Logging: toate operațiunile sunt loggate în `ContasimpleSyncLog`
- [ ] Error handling: erori API nu blochează aplicația
- [ ] Performance: sincronizare 100+ customers < 5 min
- [ ] Security: `CONTASIMPLE_AUTH_KEY` nu e expus în frontend

---

## ⚠️ Constrainte/Notițe

1. **Token Management:**
   - Token valabil ~1h
   - Cache în memorie (55 min) + DB
   - Refresh automat înainte de expirare

2. **Security:**
   - `CONTASIMPLE_AUTH_KEY` doar în backend (.env)
   - Nu expune cheia în frontend
   - Toate request-urile prin gateway

3. **Deduplicare:**
   - Prioritate: NIF → Email+Nume → Nume+Adresă
   - Evită dubluri în ambele sisteme

4. **Rate Limiting:**
   - Verifică limitele Contasimple API
   - Implementează token-bucket (similar cu `N8nProxyService`)

5. **Error Handling:**
   - Retry cu exponential backoff
   - Logging complet pentru debugging
   - Nu blochează aplicația la erori API

---

## 📚 Referințe

- Contasimple API v2 Swagger: [URL-ul tău aici]
- Endpoint-uri verificate:
  - Customers: [lista endpoint-urilor reale]
  - Providers: [lista endpoint-urilor reale]
  - Invoices: [lista endpoint-urilor reale]

---

## 💬 Notițe Implementare

**Când vei începe implementarea:**
1. Începe cu **FAZA 1** (Customers) - pas cu pas
2. Testează fiecare pas înainte de a trece la următorul
3. Verifică Swagger-ul Contasimple pentru endpoint-uri exacte
4. Adaptează maparea câmpurilor în funcție de structura reală API-ului

**Priorități:**
- Mai întâi customers (Faza 1)
- Apoi providers (Faza 2)
- La final invoices (Faza 3)

---

**Status:** Plan salvat, așteptăm aprobare pentru implementare când ești gata.
