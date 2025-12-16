# Soluție pentru Lista de Angajați în Producție

## Problema
În modul de dezvoltare (development), lista de angajați apare corect, dar în producție nu se încarcă din cauza restricțiilor CORS.

## Cauza
- **Development**: Folosește proxy-ul Vite care rezolvă automat problemele CORS
- **Production**: Face apeluri directe către n8n, care nu are configurate header-ele CORS pentru domeniul de producție

## Soluții

### 1. Configurare CORS în n8n (Recomandat)

În fiecare workflow n8n care returnează date pentru aplicație, adaugă aceste header-e la răspuns:

```javascript
// În fiecare workflow n8n, la sfârșitul workflow-ului, adaugă un nod "Set" pentru header-e:
Access-Control-Allow-Origin: https://decaminoservicios.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Allow-Credentials: true
```

**Workflow-uri care necesită configurare CORS:**
- `/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142` (lista angajați)
- `/webhook/95551bd2-fba3-401f-a14e-08e3ca037ce7` (fichajes)
- `/webhook/get-registros-EgZjaHJv` (registros)
- Toate celelalte endpoint-uri folosite de aplicație

### 2. Folosirea Proxy Server în Producție

Alternativ, poți folosi `proxy-server.js` existent și în producție:

```bash
# Instalează dependențele
npm install express cors

# Rulează proxy server-ul
node proxy-server.js

# Apoi accesează aplicația prin proxy
http://localhost:3001
```

### 3. Configurare nginx (Dacă folosești nginx)

Adaugă în configurația nginx:

```nginx
location /webhook/ {
    proxy_pass https://n8n.decaminoservicios.com;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Adaugă header-ele CORS
    add_header Access-Control-Allow-Origin https://decaminoservicios.com;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With";
    add_header Access-Control-Allow-Credentials true;
}
```

## Verificare

După implementarea soluției, verifică în browser console că:
1. Nu mai apar erori CORS
2. Lista de angajați se încarcă corect
3. Modal-ul "Añadir Registro" afișează angajații în dropdown

## Debugging

Pentru a verifica dacă problema este CORS, deschide Developer Tools și verifică:
1. **Network tab**: Caută apelurile către `/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142`
2. **Console tab**: Caută erori cu "CORS" sau "blocked"
3. **Response headers**: Verifică dacă conțin header-ele CORS necesare

## Note

- Aplicația afișează acum mesaje explicative când lista de angajați nu se poate încărca în producție
- Aceste mesaje apar doar în modul de producție (`import.meta.env.PROD`)
- În development, aplicația continuă să funcționeze normal prin proxy-ul Vite
