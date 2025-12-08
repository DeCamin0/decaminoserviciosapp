# 🔐 Integrare AutoFirma - DeCamino

## 📋 **Endpoint-uri Backend Necesare**

### **1. POST /sign/autofirma/prepare**
**Scop:** Pregătește documentul pentru semnare
```json
POST /sign/autofirma/prepare
{
  "documentId": "string",
  "reason": "string (opțional)"
}

Response:
{
  "sessionId": "string",
  "launchUrl": "autofirma://sign?sid=<sessionId>",
  "statusUrl": "/sign/autofirma/status?sid=<sessionId>",
  "downloadUrl": "/sign/autofirma/download?sid=<sessionId>"
}
```

### **2. GET /sign/autofirma/status?sid=<sessionId>**
**Scop:** Verifică statusul semnării
```json
GET /sign/autofirma/status?sid=<sessionId>

Response:
{
  "status": "pending" | "waiting_signer" | "done" | "error",
  "message": "string (opțional)"
}
```

### **3. GET /sign/autofirma/download?sid=<sessionId>**
**Scop:** Descarcă documentul semnat
```json
GET /sign/autofirma/download?sid=<sessionId>

Response: PDF-ul semnat (binary)
```

## ⚙️ **Configurare Frontend**

### **Variabile de Mediu (.env):**
```env
# API Base URL
VITE_API_BASE=https://api.decaminoservicios.com

# AutoFirma Configuration
VITE_SIGNING_MOCK=0                    # 0 = AutoFirma real, 1 = Mock mode
VITE_AUTOFIRMA_INSTALL_URL=https://firmaelectronica.gob.es/Home/Descargas.html

# Timeout Configuration
VITE_SIGNING_POLL_MS=2000              # 2 secunde între verificări
VITE_SIGNING_POLL_MAX_MS=180000        # 3 minute maxim
```

### **Mock Mode vs Production:**
- **Development:** `VITE_SIGNING_MOCK=1` - Simulează semnarea
- **Production:** `VITE_SIGNING_MOCK=0` - Folosește AutoFirma reală

## 🚀 **Fluxul de Semnare**

### **1. Pregătire Document**
```typescript
const prep = await prepare(documentId, reason);
// Returnează: { sessionId, launchUrl, statusUrl, downloadUrl }
```

### **2. Lansare AutoFirma**
```typescript
window.location.href = prep.launchUrl;
// Protocol: autofirma://sign?sid=<sessionId>
```

### **3. Polling Status**
```typescript
while (status.status !== 'done') {
  const status = await getStatus(prep.statusUrl);
  await new Promise(resolve => setTimeout(resolve, 2000));
}
```

### **4. Download Document**
```typescript
window.location.href = prep.downloadUrl;
// Descarcă PDF-ul semnat
```

## 🔧 **Implementare Backend**

### **Exemplu Node.js/Express:**
```javascript
app.post('/sign/autofirma/prepare', async (req, res) => {
  const { documentId, reason } = req.body;
  
  // 1. Generează session ID unic
  const sessionId = generateSessionId();
  
  // 2. Pregătește documentul pentru semnare
  const document = await prepareDocumentForSigning(documentId);
  
  // 3. Salvează în cache/database
  await saveSigningSession(sessionId, documentId, reason);
  
  res.json({
    sessionId,
    launchUrl: `autofirma://sign?sid=${sessionId}`,
    statusUrl: `/sign/autofirma/status?sid=${sessionId}`,
    downloadUrl: `/sign/autofirma/download?sid=${sessionId}`
  });
});
```

## 📱 **Componenta Frontend**

### **Utilizare:**
```tsx
<SignWithAutoFirmaButton
  documentId="DOC_123"
  reason="Semnare contract angajare"
  lang="es"
  onSuccess={({ sessionId }) => console.log('Signed:', sessionId)}
  onError={(error) => console.error('Error:', error)}
/>
```

### **Stări de Loading:**
- `Pregătesc…` - Se pregătește documentul
- `Deschid AutoFirma…` - Se lansează aplicația
- `Aștept semnarea…` - Se așteaptă semnarea
- `Se descarcă PDF-ul semnat…` - Se descarcă documentul

## 🚨 **Gestionarea Erorilor**

### **Tipuri de Erori:**
- `NETWORK_ERROR` - Probleme de rețea
- `TIMEOUT` - Procesul a durat prea mult
- `SIGNING_ERROR` - Eroare la semnare
- `UNKNOWN_ERROR` - Eroare neașteptată

### **Fallback-uri:**
- **AutoFirma nu se deschide** → Modal de instalare
- **Eroare de rețea** → Reîncearcă automat
- **Timeout** → Mesaj de eroare cu reîncercare

## 🔒 **Securitate**

### **Măsuri Implementate:**
- **Session ID unic** pentru fiecare semnare
- **Timeout** pentru a preveni blocarea
- **Validare** document ID și reason
- **HTTPS** pentru toate comunicările

### **Recomandări:**
- **Rate limiting** pe endpoint-uri
- **Validare** documente înainte de semnare
- **Logging** pentru audit trail
- **Autentificare** pentru endpoint-uri

## 📚 **Resurse Utile**

- **AutoFirma Oficial:** https://firmaelectronica.gob.es/
- **Documentație PDF.js:** https://mozilla.github.io/pdf.js/
- **Protocol Handlers:** https://developer.mozilla.org/en-US/docs/Web/API/Navigator/registerProtocolHandler
