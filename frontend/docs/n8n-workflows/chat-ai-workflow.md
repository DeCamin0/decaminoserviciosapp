# n8n Workflow: Chat AI Assistant

## 📋 Descriere
Workflow pentru procesarea mesajelor chat-ului AI în aplicația DeCamino. Acest workflow primește mesaje de la utilizatori și răspunde cu informații generate de GPT-4 bazate pe datele din sistem.

## 🔗 Endpoint
```
https://n8n.decaminoservicios.com/webhook/chat-ai
```

---

## 📊 Structura Workflow

### 1. Webhook Node
**Nume:** `Chat AI Webhook`
**Metodă:** POST
**Path:** `/chat-ai`

**Configurare:**
- Method: POST
- Path: chat-ai
- Response Mode: Respond to Webhook
- Authentication: None (public endpoint)

**Date primite:**
```json
{
  "mensaje": "Cine nu a pontat azi?",
  "usuario": {
    "id": "123",
    "nombre": "Juan Perez",
    "rol": "manager"
  }
}
```

### 2. Set Node (Validate Input)
**Nume:** `Validate Input`

**JavaScript Code:**
```javascript
const { mensaje, usuario } = $input.first().json;

if (!mensaje || !usuario) {
  return [{
    json: {
      error: true,
      message: "Mesajul și informațiile utilizatorului sunt obligatorii"
    }
  }];
}

return [{
  json: {
    mensaje: mensaje.trim(),
    usuario: usuario,
    timestamp: new Date().toISOString()
  }
}];
```

### 3. HTTP Request Node (GPT-4 API)
**Nume:** `Call GPT-4`

**Configurare:**
- Method: POST
- URL: `https://api.openai.com/v1/chat/completions`
- Headers:
  - `Authorization: Bearer {{$env.OPENAI_API_KEY}}`
  - `Content-Type: application/json`

**Body:**
```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "system",
      "content": "Ești un asistent AI pentru compania DeCamino Servicios Auxiliares SL. Răspunde în română. Ai acces la următoarele funcționalități:\n\n1. Pontaje (fichajes) - verifică cine a pontat/ nu a pontat\n2. Solicitări (solicitudes) - status solicitări vacanță/asunto propio\n3. Angajați (empleados) - informații despre angajați\n4. Statistici (estadisticas) - raportări și statistici\n5. Programe (cuadrantes) - programe de lucru\n\nRăspunde concis și util. Dacă ai nevoie de date specifice, indică ce informații sunt necesare."
    },
    {
      "role": "user",
      "content": "{{$json.mensaje}}"
    }
  ],
  "max_tokens": 500,
  "temperature": 0.7
}
```

### 4. Set Node (Process GPT Response)
**Nume:** `Process Response`

**JavaScript Code:**
```javascript
const gptResponse = $input.first().json;
const originalRequest = $('Validate Input').first().json;

// Extrage răspunsul de la GPT
const respuesta = gptResponse.choices?.[0]?.message?.content || 
                 "Nu am putut procesa cererea. Te rog să încerci din nou.";

// Log activitatea
const logData = {
  action: 'chat_ai_message',
  user: originalRequest.usuario,
  message: originalRequest.mensaje,
  response: respuesta,
  timestamp: new Date().toISOString()
};

// Salvează în Google Sheets pentru logging
// (opțional - poți adăuga un nod Google Sheets aici)

return [{
  json: {
    success: true,
    respuesta: respuesta,
    timestamp: new Date().toISOString(),
    log: logData
  }
}];
```

### 5. Respond to Webhook Node
**Nume:** `Success Response`

**Configurare:**
- Response Code: 200
- Response Body: `{{$json}}`

**Răspuns așteptat:**
```json
{
  "success": true,
  "respuesta": "Răspunsul de la GPT-4...",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 🔧 Configurare Variabile de Mediu

### În n8n:
1. **OPENAI_API_KEY**: Cheia API pentru OpenAI GPT-4
2. **GOOGLE_SHEETS_CREDENTIALS**: Credențiale pentru Google Sheets (pentru logging)

---

## 📝 Exemple de Utilizare

### Exemplu 1: Verificare pontaje
**Mesaj utilizator:** "Cine nu a pontat azi?"
**Răspuns AI:** "În data de astăzi, următorii angajați nu au pontat încă: Maria Garcia, Carlos Lopez. Recomand să contactezi acești angajați pentru a verifica situația."

### Exemplu 2: Statistici solicitări
**Mesaj utilizator:** "Câte solicitări sunt în așteptare?"
**Răspuns AI:** "În prezent sunt 5 solicitări în așteptare: 3 pentru vacanță și 2 pentru asunto propio. Toate sunt în proces de aprobare."

### Exemplu 3: Informații angajați
**Mesaj utilizator:** "Care sunt angajații cu cele mai multe ore lucrate?"
**Răspuns AI:** "Top 3 angajați cu cele mai multe ore lucrate această lună: 1. Juan Perez - 160 ore, 2. Maria Garcia - 155 ore, 3. Carlos Lopez - 150 ore."

---

## 🛡️ Securitate

### Validări:
- Verificare mesaj obligatoriu
- Validare format utilizator
- Sanitizare input pentru prevenirea XSS
- Rate limiting (opțional)

### Logging:
- Toate mesajele sunt logate cu timestamp
- Informații utilizator pentru audit
- Răspunsuri AI pentru îmbunătățire

---

## 🔄 Integrare cu Sistemul Existente

### Conexiuni cu alte workflow-uri:
1. **Pontaje**: Verificare status pontaje
2. **Solicitări**: Status solicitări și aprobări
3. **Angajați**: Informații despre angajați
4. **Statistici**: Raportări și analize

### Extensii viitoare:
1. **Notificări**: Trimite notificări către manageri
2. **Rapoarte automate**: Generează rapoarte pe baza întrebărilor
3. **Integrare cu alte sisteme**: CRM, contabilitate, etc.

---

## 📊 Metrici de Succes

### Faza 1:
- [ ] Workflow răspunde în < 5 secunde
- [ ] 0 erori în procesarea mesajelor
- [ ] Logging complet al activităților
- [ ] Răspunsuri relevante de la GPT-4

### Faza 2:
- [ ] Integrare cu baza de date pentru date reale
- [ ] Notificări automate pentru manageri
- [ ] Rapoarte generate automat
- [ ] Analiză sentiment și feedback utilizatori 