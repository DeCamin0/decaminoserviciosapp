# Email Ingestion Module

Modul pentru extragerea automată a documentelor din email-uri și procesarea lor prin workflow de review.

## Funcționalități

- **Extragere email-uri**: Conectare la IMAP și extragere mesaje (citite/necitite/toate)
- **Extragere attachments**: Descărcare PDF, imagini, fișiere Office
- **Clasificare automată**: Detectare tip document și angajat din subject/filename/PDF content
- **Idempotency**: Prevenire duplicate prin hash unic (message_id + attachment_id)
- **Workflow review**: PENDING_REVIEW → APPROVED → SENT/ARCHIVED/REJECTED
- **Distribuție automată**: La aprobare, documentul devine disponibil pentru angajat

## Configurare

### Variabile de mediu

```env
# IMAP Configuration (folosește aceleași credențiale ca SMTP)
IMAP_HOST=imap.serviciodecorreo.es  # Default: imap.serviciodecorreo.es
IMAP_PORT=993                        # Default: 993
IMAP_SECURE=true                      # Default: true
IMAP_MAILBOX=INBOX                  # Default: INBOX
IMAP_PROCESSED_MAILBOX=Extrase      # Folder unde se mută mesajele procesate (opțional)

# IMAP_USER și IMAP_PASSWORD sunt opționale
# Dacă nu sunt setate, se folosesc SMTP_USER și SMTP_PASSWORD
```

### Instalare dependențe

```bash
npm install imapflow @types/imapflow
```

## API Endpoints

### POST /admin/documents/ingest-emails

Trigger manual pentru extragere email-uri.

**Body:**
```json
{
  "readStatus": "all" | "read" | "unread",
  "limit": 50
}
```

**Response:**
```json
{
  "success": true,
  "processed": 10,
  "inserted": 8,
  "skipped": 2,
  "details": {
    "messagesFetched": 10,
    "attachmentsExtracted": 12,
    "documentsCreated": 8
  }
}
```

### GET /admin/documents/pending

Obține documente în așteptare de review.

**Response:**
```json
{
  "success": true,
  "count": 5,
  "documents": [...]
}
```

### POST /admin/documents/:id/approve

Aprobă document și atribuie angajat.

**Body:**
```json
{
  "employeeId": "12345",
  "documentType": "nomina",
  "action": "send" | "archive"
}
```

### POST /admin/documents/:id/reject

Respinge document.

**Body:**
```json
{
  "reason": "Document incorect"
}
```

### POST /admin/documents/:id/reassign

Reatribuie document altui angajat.

**Body:**
```json
{
  "employeeId": "67890"
}
```

## Workflow

1. **Ingestion**: Admin trigger manual → fetch email-uri → extract attachments → clasificare → salvare ca PENDING_REVIEW
2. **Review**: Admin vede documente PENDING_REVIEW → aprobă/respinge/reatribuie
3. **Distribution**: La aprobare cu action="send" → document devine SENT → disponibil pentru angajat → notificare email (opțional)

## Tipuri documente suportate

- PDF (`application/pdf`)
- Imagini (`image/png`, `image/jpeg`)
- Office (`application/msword`, `.docx`, `.xls`, `.xlsx`)

## Clasificare automată

Sistemul detectează automat:
- **Tip document**: nomina, contrato, anexo, sancion, certificado, baja
- **Angajat**: CODIGO din subject/filename/PDF content

Patterns detectate:
- Tip: regex pe subject/filename/PDF text
- Angajat: "CODIGO: 12345", "ID: 12345", sau din filename "nomina_12345.pdf"

## Securitate

- **Auth**: Doar admin (Admin, Developer, Manager, Supervisor) poate accesa endpoint-urile
- **Idempotency**: Prevenire duplicate prin `idempotency_key` UNIQUE
- **Logging**: Nu se loghează conținut documente, doar metadata

## Structură DB

Câmpuri noi în `DocumentosOficiales`:
- `status`: PENDING_REVIEW, APPROVED, SENT, ARCHIVED, REJECTED
- `source_message_id`: ID mesaj email
- `source_attachment_id`: ID attachment
- `idempotency_key`: Hash pentru prevenire duplicate
- `detected_empleado_id`: Detectat automat
- `detected_tipo_documento`: Detectat automat
- `confirmed_empleado_id`: Confirmat de admin
- `confirmed_tipo_documento`: Confirmat de admin
- `action`: send, archive, reject
- `rejection_reason`: Motiv respingere
- `approved_by`: CODIGO admin
- `approved_at`: Data aprobare
- `distributed_at`: Data distribuție
- `ingestion_metadata`: JSON cu metadata email (subject, from, date, etc.)

## Note

- Documentele existente rămân funcționale (status default: SENT)
- Backward compatible: nu modifică coloane existente, doar adaugă noi
- Email notifications sunt opționale (dacă SMTP nu e configurat, se skip-uie)
