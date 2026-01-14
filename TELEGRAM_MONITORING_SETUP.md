# 📱 Configurare Sistem de Alerting Telegram

## 🎯 Obiectiv

Să primești notificări pe Telegram când:
- ❌ Apare o eroare critică în backend (erori 500+)
- 🔴 Baza de date cade sau nu răspunde
- ⚠️ Performanță scăzută (latență mare)
- 🚨 Erori critice din frontend

## ✅ Ce Este Implementat

### 1. **Global Exception Filter**
- Prinde toate erorile neprinse din backend
- Trimite alertă pe Telegram pentru erori 500+
- Include detalii: mesaj, stack trace, path, metodă

### 2. **Monitoring Service**
- **DB Health Check**: La fiecare 5 minute
- **Performance Monitoring**: Detectează latență mare (>1s)
- **Auto-recovery**: Notifică când serviciile revin online

### 3. **Frontend Error Reporting**
- Endpoint: `POST /api/monitoring/frontend-error`
- Trimite erori critice din frontend pe Telegram

## 🔧 Configurare

### Pasul 1: Obține Token Telegram Bot

1. Caută **@BotFather** pe Telegram
2. Trimite `/newbot` și urmează instrucțiunile
3. Copiază token-ul (ex: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Pasul 2: Obține Chat ID

**Opțiunea 1 - Chat personal:**
1. Trimite mesaj bot-ului tău
2. Accesează: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Găsește `chat.id` din răspuns

**Opțiunea 2 - Grup:**
1. Adaugă bot-ul într-un grup
2. Folosește `@getidsbot` pentru a obține chat ID-ul grupului
3. Sau verifică în `getUpdates` cu numele grupului

### Pasul 3: Configurează Variabile de Mediu

Adaugă în `.env` sau `.env.production`:

```bash
# Telegram Bot Configuration

# Bot pentru gestoria (notificări despre ausencias, solicitudes, etc.)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=-1001234567890  # Chat ID sau grup ID

# Bot general (pentru erori, notificări generale, monitoring, etc.)
# Opțional: dacă nu e configurat, se folosește bot-ul de gestoria ca fallback
TELEGRAM_BOT_TOKEN_GENERAL=987654321:XYZabcDEFghiJKLmnoPQRstuVWX
TELEGRAM_CHAT_ID_GENERAL=-1009876543210  # Chat ID sau grup ID pentru bot-ul general

# Enable Monitoring (opțional, default: false)
MONITORING_ENABLED=true
```

**Notă**: 
- Chat ID-ul poate fi negativ pentru grupuri (ex: `-1001234567890`)
- Bot-ul general este opțional. Dacă nu e configurat, erorile și notificările generale vor fi trimise la bot-ul de gestoria
- Recomandat: folosește bot-ul general pentru erori/monitoring și bot-ul de gestoria pentru notificări despre angajați

## 📋 Variabile de Mediu

| Variabilă | Descriere | Exemplu | Obligatoriu |
|-----------|-----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Token-ul bot-ului Telegram (gestoria) | `123456789:ABC...` | ✅ Da |
| `TELEGRAM_CHAT_ID` | ID-ul chat-ului pentru notificări (gestoria) | `-1001234567890` | ✅ Da |
| `TELEGRAM_BOT_TOKEN_GENERAL` | Token-ul bot-ului Telegram general (erori, monitoring) | `987654321:XYZ...` | ❌ Nu (opțional) |
| `TELEGRAM_CHAT_ID_GENERAL` | ID-ul chat-ului pentru bot-ul general | `-1009876543210` | ❌ Nu (opțional) |
| `MONITORING_ENABLED` | Activează monitoring-ul automat | `true` / `false` | ❌ Nu (default: false) |

**Notă**: Dacă `TELEGRAM_BOT_TOKEN_GENERAL` și `TELEGRAM_CHAT_ID_GENERAL` nu sunt configurate, erorile și notificările generale vor fi trimise la bot-ul de gestoria.

## 🚀 Funcționalități

### Erori Backend (Automat)

**Când**: Orice eroare 500+ în backend  
**Ce primești**:
```
🚨 Error crítico en backend

❌ Status: 500
📋 Método: POST
🔗 Path: /api/empleados
💬 Mensaje: Database connection failed

```
[Stack trace]
```

⏰ Timestamp: 2026-01-15T10:30:00.000Z
```

### Database Down (Automat - La 5 min)

**Când**: DB nu răspunde (2 eșecuri consecutive)  
**Ce primești**:
```
🔴 Base de datos inaccesible

❌ Error: Connection timeout
🔄 Fallos consecutivos: 2
⏰ Último check: 2026-01-15T10:25:00.000Z

⚠️ Acción requerida: Verificar conexión a base de datos
```

### Performanță (Automat - La 5 min)

**Când**: Latența DB > 1 secundă  
**Ce primești**:
```
⚠️ Alerta de rendimiento

🐌 Latencia DB: 1500ms (umbral: 1000ms)
⏰ Timestamp: 2026-01-15T10:30:00.000Z

⚠️ La base de datos está respondiendo lentamente.
```

### Frontend Errors (Manual - din Frontend)

**Cum**: Frontend-ul poate raporta erori critice  
**Endpoint**: `POST /api/monitoring/frontend-error`

```javascript
// În frontend (ErrorBoundary sau error handler):
await fetch('/api/monitoring/frontend-error', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: error.message,
    stack: error.stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    userId: user?.CODIGO,
    timestamp: new Date().toISOString(),
  }),
});
```

## 🧪 Testare

### Test 1: Verifică Configurarea

```bash
# Verifică log-urile la start
# Ar trebui să vezi:
# ✅ Telegram service configured (chatId: -1001234567890)
```

### Test 2: Testează Manual

```bash
# Test health check manual
curl -X POST http://localhost:3000/api/monitoring/health-check \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test 3: Testează Alertă

```bash
# Simulează o eroare (va trimite alertă pe Telegram)
curl -X GET http://localhost:3000/api/test-error-500
```

## 📊 Monitoring Endpoints

| Endpoint | Method | Descriere | Auth |
|----------|--------|-----------|------|
| `/api/monitoring/frontend-error` | POST | Raportează erori din frontend | ❌ Nu |
| `/api/monitoring/health-check` | POST | Health check manual | ✅ Da (JWT) |

## 🔍 Cron Jobs

| Job | Frecvență | Descriere |
|-----|-----------|-----------|
| Database Health Check | La 5 minute | Verifică conectivitatea DB |
| Backend Health Check | La 10 minute | Verifică servicii externe (viitor) |

## ⚙️ Dezactivare

Pentru a dezactiva monitoring-ul:

```bash
MONITORING_ENABLED=false
```

Sau comentează cron jobs în `monitoring.service.ts`.

## 🔐 Securitate

- ✅ Frontend error endpoint este public (poate fi rate-limited în viitor)
- ✅ Health check manual necesită autentificare JWT
- ✅ Telegram token nu este logat în consolă
- ✅ Erorile sunt trimise doar pentru erori critice (500+)

## 📝 Note

- **Latență minimă**: Alertă trimisă doar după 2 eșecuri consecutive DB (pentru a evita false positives)
- **Rate limiting**: Poți adăuga rate limiting pentru frontend errors în viitor
- **Format mesaje**: Toate mesajele sunt în spaniolă (pentru consistență cu restul aplicației)

## 🐛 Troubleshooting

**Problema**: Nu primesc notificări  
**Soluție**:
1. Verifică că `TELEGRAM_BOT_TOKEN` și `TELEGRAM_CHAT_ID` sunt setate corect
2. Verifică log-urile: `✅ Telegram service configured`
3. Testează manual: trimite un mesaj bot-ului și verifică că primești

**Problema**: Prea multe notificări  
**Soluție**:
- Ajustează threshold-urile în `monitoring.service.ts`
- Sau dezactivează `MONITORING_ENABLED=false`

**Problema**: Frontend errors nu sunt trimise  
**Soluție**:
- Verifică că frontend-ul face POST la `/api/monitoring/frontend-error`
- Verifică CORS dacă e nevoie

## 📚 Referințe

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
- [NestJS Schedule](https://docs.nestjs.com/techniques/task-scheduling)

