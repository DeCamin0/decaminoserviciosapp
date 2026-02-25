# TODO: Conversie DOCX → HTML pe Backend

## Problema Actuală
- **Development**: Funcționează perfect - conversia DOCX → HTML cu `mammoth` merge
- **Production**: Eroare `this._isBound is not a function` din cauza minificării cu `esbuild`
- **Cauză**: Bluebird (folosit de `mammoth`) depinde de numele exacte ale funcțiilor (`_isBound`, `_receiverAt`), care sunt schimbate la minificare

## Soluție: Mutare Conversie pe Backend

### Backend (NestJS)
1. ✅ Adăugat import `mammoth` în `backend/src/services/prl-documents.service.ts`
2. ✅ Adăugat metodă `convertirDocxAHtml(docxBuffer: Buffer)` în `PrlDocumentsService`
3. ⏳ Adăugat endpoint `POST /api/prl/mis-documentos/:documentoId/convertir-docx-html` în `PrlDocumentsController`
   - Primește `documentoId`
   - Descarcă DOCX-ul din DB
   - Convertește la HTML cu `mammoth`
   - Returnează `{ html: string }`

### Frontend
1. ⏳ Modificat `PRLDocumentSigner.jsx`:
   - Eliminat conversia locală cu `mammoth`
   - Adăugat call la endpoint-ul backend pentru conversie
   - Folosește HTML-ul primit de la backend

### Beneficii
- ✅ Fără probleme de minificare (backend nu minifică)
- ✅ Fără dependențe Bluebird în frontend
- ✅ Bundle mai mic în frontend
- ✅ Conversia se face pe server (mai sigur)

### Fișiere de Modificat
- `backend/src/services/prl-documents.service.ts` - ✅ Metodă adăugată
- `backend/src/controllers/prl-documents.controller.ts` - ⏳ Endpoint de adăugat
- `frontend/src/components/PRLDocumentSigner.jsx` - ⏳ De modificat să folosească backend
- `frontend/src/utils/routes.js` - ⏳ De adăugat ruta nouă

### Notă
- Backend-ul are deja `mammoth` instalat în `package.json`
- Metoda `convertirDocxAHtml` este deja implementată în service
- Trebuie doar endpoint-ul în controller și modificarea frontend-ului
