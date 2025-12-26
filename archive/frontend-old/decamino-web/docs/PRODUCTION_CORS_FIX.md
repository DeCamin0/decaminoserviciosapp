# Fix pentru erorile CORS în producție

## Problema identificată

În producție, aplicația primește erori de tipul:
```
SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON
```

Aceasta se întâmplă pentru că:

1. **În development**: Vite proxy redirecționează request-urile `/webhook/...` către n8n
2. **În producție**: Aplicația este servită ca fișiere statice, deci request-urile `/webhook/...` nu sunt redirecționate și returnează HTML (pagina 404 a serverului web)

## Soluții

### Soluția 1: Folosește serverul proxy în producție (RECOMANDAT)

1. **Rulează serverul proxy**:
```bash
# În directorul proiectului
node proxy-server.js
```

2. **Servește aplicația prin proxy**:
```bash
# În alt terminal
npx serve -s dist -l 3000
```

3. **Configurează nginx/apache** să redirecționeze `/webhook/...` către proxy-ul local.

### Soluția 2: Configurează serverul web să redirecționeze

Pentru **nginx**, adaugă în configurația site-ului:

```nginx
location /webhook/ {
    proxy_pass https://n8n.decaminoservicios.com;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # CORS headers
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With";
}
```

Pentru **Apache**, adaugă în `.htaccess`:

```apache
RewriteEngine On
RewriteRule ^webhook/(.*)$ https://n8n.decaminoservicios.com/webhook/$1 [P,L]

# CORS headers
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header always set Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With"
```

### Soluția 3: Folosește URL-uri absolute în producție

Modifică `src/utils/routes.js` să folosească URL-uri absolute în producție:

```javascript
export const routes = {
  getEmpleados: import.meta.env.PROD 
    ? 'https://n8n.decaminoservicios.com/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142'
    : '/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142',
  // ... alte rute
};
```

## Verificare

După implementarea soluției, testează cu:

```bash
node test-production-endpoints.js
```

## Status

- ✅ Endpoint-urile n8n funcționează corect
- ✅ Aplicația folosește configurația corectă de rute
- ✅ Gestionarea erorilor este îmbunătățită
- ⚠️ Trebuie configurat proxy-ul în producție
