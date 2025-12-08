# 🧠 Endpoint OCR pentru Facturi Primite - DeCamino

## 📋 Prezentare Generală

Acest endpoint permite analiza automată a facturilor primite folosind tehnologia OCR (Optical Character Recognition) pentru a extrage informații structurate din imagini și documente PDF.

## 🔗 Endpoint

```
POST https://n8n.decaminoservicios.com/webhook/analiza-document-3T2c84S
```

## 📤 Parametri

### Câmpuri obligatorii (multipart/form-data)

| Câmp | Tip | Descriere | Exemplu |
|------|-----|-----------|---------|
| `file` | File | Fișierul facturii (imagine sau PDF) | `factura.pdf` |
| `fileName` | String | Numele fișierului | `factura-energia-2025.pdf` |
| `clientFileId` | String | ID unic pentru identificarea clientului | `FACTURA-1703123456789` |

### Tipuri de fișiere acceptate

- **Imagini**: JPG, PNG, BMP, TIFF
- **Documente**: PDF
- **Dimensiune maximă**: 10MB (configurabil)

## 📥 Răspuns

### Format JSON

```json
{
  "success": true,
  "fileName": "factura-energia-2025.pdf",
  "total": 150.50,
  "nif": "B12345678",
  "cif": "B12345678",
  "fecha": "2025-01-15",
  "proveedor": "Endesa Energía S.A.",
  "magazin": "Endesa Energía S.A.",
  "tienda": "Endesa Energía S.A.",
  "conceptos": [
    {
      "descripcion": "Suministro de energía eléctrica",
      "cantidad": 1,
      "precio": 150.50,
      "total": 150.50
    }
  ],
  "productos": [
    {
      "descripcion": "Suministro de energía eléctrica",
      "cantidad": 1,
      "precio": 150.50,
      "total": 150.50
    }
  ],
  "timestamp": "2025-01-15T10:30:00.000Z",
  "confidence": 0.95
}
```

### Câmpuri răspuns

| Câmp | Tip | Descriere |
|------|-----|-----------|
| `success` | Boolean | Status-ul operațiunii |
| `fileName` | String | Numele fișierului procesat |
| `total` | Number | Suma totală a facturii |
| `nif` | String | NIF/CIF al furnizorului |
| `cif` | String | CIF alternativ al furnizorului |
| `fecha` | String | Data facturii (YYYY-MM-DD) |
| `proveedor` | String | Numele furnizorului |
| `magazin` | String | Nume alternativ furnizor |
| `tienda` | String | Nume alternativ furnizor |
| `conceptos` | Array | Lista conceptelor/serviciilor |
| `productos` | Array | Lista produselor (alternativ) |
| `timestamp` | String | Timestamp-ul procesării |
| `confidence` | Number | Scorul de încredere OCR (0-1) |

## 🧪 Testare

### 1. Fișier JavaScript de test

```bash
node test-ocr-factura-recibida.js
```

### 2. Fișier HTML de test

Deschide `test-ocr-factura-recibida.html` în browser pentru testare interactivă.

### 3. Testare cu cURL

```bash
curl -X POST \
  -F "file=@factura-test.pdf" \
  -F "fileName=factura-test.pdf" \
  -F "clientFileId=FACTURA-$(date +%s)" \
  https://n8n.decaminoservicios.com/webhook/analiza-document-3T2c84S
```

### 4. Testare cu Postman

1. **Metodă**: POST
2. **URL**: `https://n8n.decaminoservicios.com/webhook/analiza-document-3T2c84S`
3. **Body**: form-data
4. **Câmpuri**:
   - `file`: [selectează fișierul]
   - `fileName`: [numele fișierului]
   - `clientFileId`: [ID unic]

## 🔍 Integrare în Frontend

### Folosire în React

```jsx
import { routes } from '../utils/routes';

const handleProcessOcr = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('fileName', file.name);
    formData.append('clientFileId', `FACTURA-${Date.now()}`);

    const response = await fetch(routes.ocrImagen, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const ocrResult = await response.json();
    
    // Procesează rezultatul
    const processedData = {
      total: ocrResult.total || 0,
      nif: ocrResult.nif || ocrResult.cif || '',
      fecha: ocrResult.fecha || new Date().toISOString().split('T')[0],
      proveedor: ocrResult.proveedor || ocrResult.magazin || ocrResult.tienda || 'Proveedor desconocido',
      conceptos: ocrResult.conceptos || ocrResult.productos || []
    };

    return processedData;
  } catch (error) {
    console.error('Error procesare OCR:', error);
    throw error;
  }
};
```

### Folosire în JavaScript vanilla

```javascript
async function processFacturaOcr(file) {
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('fileName', file.name);
  formData.append('clientFileId', `FACTURA-${Date.now()}`);

  const response = await fetch('https://n8n.decaminoservicios.com/webhook/analiza-document-3T2c84S', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}
```

## ⚠️ Gestionarea Erorilor

### Erori comune

| Cod | Descriere | Soluție |
|-----|-----------|---------|
| 400 | Parametri lipsă | Verifică că toate câmpurile sunt prezente |
| 413 | Fișier prea mare | Reduce dimensiunea fișierului |
| 415 | Tip fișier neacceptat | Folosește doar imagini sau PDF |
| 500 | Eroare server | Încearcă din nou sau contactează suportul |

### Gestionare în cod

```javascript
try {
  const ocrResult = await processFacturaOcr(file);
  // Procesează rezultatul
} catch (error) {
  if (error.message.includes('400')) {
    console.error('Parametri lipsă');
  } else if (error.message.includes('413')) {
    console.error('Fișier prea mare');
  } else if (error.message.includes('415')) {
    console.error('Tip fișier neacceptat');
  } else {
    console.error('Eroare server:', error.message);
  }
}
```

## 📊 Logging și Monitorizare

### Logging automat

Endpoint-ul loghează automat:
- Timestamp-ul procesării
- Numele fișierului
- Scorul de încredere OCR
- Erorile întâlnite

### Monitorizare

- **Rata de succes**: % din facturi procesate cu succes
- **Timp de procesare**: Durata medie de analiză
- **Calitatea OCR**: Scorul mediu de încredere
- **Erori**: Tipurile și frecvența erorilor

## 🔧 Configurare

### Variabile de mediu

```bash
# Endpoint OCR
VITE_OCR_ENDPOINT=https://n8n.decaminoservicios.com/webhook/analiza-document-3T2c84S

# Dimensiune maximă fișier (bytes)
VITE_MAX_FILE_SIZE=10485760

# Tipuri fișiere acceptate
VITE_ACCEPTED_FILE_TYPES=image/*,application/pdf
```

### Configurare în routes.js

```javascript
export const routes = {
  // ... alte rute
  ocrImagen: `${BASE_URL}/webhook/analiza-document-3T2c84S`,
  analizaDocument: `${BASE_URL}/webhook/analiza-document-3T2c84S`,
};
```

## 🚀 Implementare Completă

### 1. Componenta de upload

```jsx
const FacturaOcrUpload = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setResult(null);
  };

  const handleProcessOcr = async () => {
    if (!selectedFile) return;
    
    setProcessing(true);
    try {
      const ocrResult = await handleProcessOcr(selectedFile);
      setResult(ocrResult);
    } catch (error) {
      console.error('Error OCR:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/*,application/pdf"
        onChange={(e) => handleFileSelect(e.target.files[0])}
      />
      <button 
        onClick={handleProcessOcr}
        disabled={!selectedFile || processing}
      >
        {processing ? 'Procesando...' : 'Procesar OCR'}
      </button>
      {result && (
        <div>
          <h3>Resultado OCR</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
```

### 2. Context pentru gestionarea OCR

```jsx
const FacturasOcrContext = createContext();

export const FacturasOcrProvider = ({ children }) => {
  const [ocrHistory, setOcrHistory] = useState([]);
  const [processing, setProcessing] = useState(false);

  const processFacturaOcr = async (file) => {
    setProcessing(true);
    try {
      const result = await handleProcessOcr(file);
      setOcrHistory(prev => [...prev, { ...result, timestamp: new Date() }]);
      return result;
    } finally {
      setProcessing(false);
    }
  };

  return (
    <FacturasOcrContext.Provider value={{
      ocrHistory,
      processing,
      processFacturaOcr
    }}>
      {children}
    </FacturasOcrContext.Provider>
  );
};
```

## 📈 Performanță și Optimizare

### Recomandări

1. **Compresie imagini**: Reduce dimensiunea înainte de trimitere
2. **Validare client**: Verifică tipul și dimensiunea fișierului
3. **Cache**: Salvează rezultatele OCR pentru fișiere identice
4. **Queue**: Implementează o coadă pentru fișiere mari

### Metrici de performanță

- **Timp de procesare**: < 30 secunde pentru fișiere < 5MB
- **Precizie OCR**: > 90% pentru facturi clare
- **Disponibilitate**: > 99.9%
- **Throughput**: 100+ facturi/oră

## 🔒 Securitate

### Măsuri implementate

- **Validare tip fișier**: Doar imagini și PDF-uri
- **Limitare dimensiune**: Previne atacuri DoS
- **Sanitizare nume**: Elimină caractere periculoase
- **Rate limiting**: Previne spam-ul
- **Logging audit**: Urmărește toate operațiunile

### Best practices

1. **Nu trimite** fișiere cu informații sensibile
2. **Validează** rezultatele OCR înainte de folosire
3. **Loghează** toate operațiunile pentru audit
4. **Monitorizează** performanța și erorile

## 📞 Suport și Contact

Pentru probleme tehnice sau întrebări:

- **Email**: suport@decaminoservicios.com
- **Documentație**: [link către documentația completă]
- **GitHub Issues**: [link către repository]

---

*Ultima actualizare: 15 Ianuarie 2025*
*Versiune: 1.0.0*
