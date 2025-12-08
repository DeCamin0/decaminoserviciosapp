# Test Proxy n8n

## Testare Proxy Service

Backend-ul are un proxy service care routează request-uri către n8n.

### Structura URL-ului

**Direct la n8n:**
```
https://n8n.decaminoservicios.com/webhook/ENDPOINT_ID
```

**Prin backend proxy:**
```
http://localhost:3000/api/n8n/webhook/ENDPOINT_ID
```

### Comenzi de test

#### 1. Test endpoint principal (Hello World)
```powershell
curl http://localhost:3000
```

#### 2. Test proxy cu endpoint n8n (exemplu - GET usuarios)
```powershell
# Test GET request prin proxy
curl http://localhost:3000/api/n8n/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142
```

#### 3. Test proxy cu POST (exemplu - login - NU TESTA CU DATE REALE!)
```powershell
# ATENȚIE: Nu testa login cu date reale!
# Doar pentru testare structură
curl -X POST http://localhost:3000/api/n8n/webhook/login-yyBov0qVQZEhX2TL ^
  -H "Content-Type: application/json" ^
  -d "{\"test\":\"data\"}"
```

### Endpoint-uri disponibile pentru testare

Din `frontend/src/utils/routes.js`:

**GET endpoints (pot necesita autentificare):**
- `/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142` - Get empleados
- `/webhook/get-cuadrantes-yyBov0qVQZEhX2TL` - Get cuadrantes
- `/webhook/lista-solicitudes` - Get solicitudes
- `/webhook/get-nomina-ZeTqQIbs8kwia` - Get nominas

### Ce să verificăm

1. ✅ Proxy-ul rutează corect către n8n
2. ✅ Headers sunt forwardate corect
3. ✅ Response-ul de la n8n este returnat corect
4. ✅ Error handling funcționează (dacă n8n returnează eroare)

### Dacă apare eroare

- **404**: Endpoint-ul nu există în n8n sau URL-ul este greșit
- **401/403**: Endpoint-ul necesită autentificare
- **500**: Eroare în proxy service sau n8n
- **Timeout**: n8n nu răspunde (verifică conexiunea)
