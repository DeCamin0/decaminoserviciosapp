# Ghid pentru generarea API Key Netdata Cloud

## Problema identificată
API key-ul actual returnează erori 401 (Unauthorized) și 404 (Not Found), ceea ce înseamnă că:
- API key-ul a expirat sau nu este valid
- Endpoint-urile nu sunt corecte pentru versiunea actuală de Netdata Cloud
- Serverele nu mai există sau au fost mutate

## Soluții

### 1. Verifică API Key-ul actual
1. Mergi la [Netdata Cloud](https://app.netdata.cloud)
2. Autentifică-te în contul tău
3. Mergi la Settings > API Keys
4. Verifică dacă API key-ul `ndc.uR6vYiCbx3iMYnU2etIeASgejbfpnuXLBeXRAhGPUy1WHZPqWP3dr1nmWXzvcRHJcdbHq6ifXSksWcJ7TxQiT55PMQp4m22SZEw0aYcyrJCUQwX0iemDQU064qGQjNp6` este activ

### 2. Generează un API Key nou
1. În Netdata Cloud, mergi la Settings > API Keys
2. Click pe "Generate New API Key"
3. Denumește-l "DeCamino Server Monitor"
4. Copiază noul API key

### 3. Verifică serverele
1. Mergi la Spaces în Netdata Cloud
2. Verifică dacă space-ul "Decamino rrhh space" există
3. Verifică dacă serverele sunt active:
   - VPS 1 - DeCamino (ID: 7764789d-63d5-49fb-a0e4-dfeae97b5f74)
   - VPS 2 - Backup (ID: cdc0c2d9-7d9b-4b72-aa47-4b201446d045)

### 4. Actualizează configurația
După ce ai noul API key, actualizează în `src/components/ServerMonitor.jsx`:

```javascript
const defaultCloudConfig = {
  cloudUrl: 'https://app.netdata.cloud',
  apiKey: 'NOUL_TĂU_API_KEY_AICI',
  spaces: [
    {
      id: 'SPACE_ID_ACTUALIZAT',
      name: 'Decamino rrhh space',
      servers: [
        { id: 'SERVER_ID_1_ACTUALIZAT', name: 'VPS 1 - DeCamino' },
        { id: 'SERVER_ID_2_ACTUALIZAT', name: 'VPS 2 - Backup' }
      ]
    }
  ]
};
```

### 5. Testează API-ul
Rulează scriptul de test pentru a verifica dacă noul API key funcționează:

```bash
node test-netdata-api.js
```

## Endpoint-uri Netdata Cloud v2
Endpoint-urile actualizate pentru versiunea nouă:
- `/api/v2/nodes/{node_id}/info`
- `/api/v2/spaces/{space_id}/nodes/{node_id}/info`
- `/api/v2/nodes/{node_id}/charts`
- `/api/v2/spaces/{space_id}/nodes/{node_id}/charts`

## Debugging
Pentru debugging, verifică:
1. Console-ul browser-ului pentru erori
2. Network tab pentru request-urile API
3. Status code-urile returnate de API

## Alternativă: Mock Data
Dacă API-ul nu funcționează, poți activa date mock pentru testare:

```javascript
// În ServerMonitor.jsx, adaugă această funcție
const getMockData = () => ({
  cpu: 4,
  memory: 8,
  disk: 100,
  network: '1 Gbps',
  uptime: 15,
  alerts: 0,
  metrics: 1250
});
``` 