# DeCamino Servicios - Monorepo

Monorepo pentru aplicația DeCamino Servicios, cu migrare incrementală de la n8n la backend NestJS.

## 📁 Structură

```
decaminoserviciosapp/
├── frontend/          # React app (production - conectat la n8n)
├── backend/           # NestJS API (nou - în dezvoltare)
├── .gitignore         # Git ignore pentru monorepo
└── MIGRATION_PLAN.md  # Plan detaliat de migrare
```

## 🚀 Quick Start

### Frontend (Production)
```bash
cd frontend
npm install
npm run dev
```
Frontend-ul rulează pe `http://localhost:5173` și este conectat la n8n.

### Backend (Development)
```bash
cd backend
npm install
npm run start:dev
```
Backend-ul rulează pe `http://localhost:3000`.

## 📋 Status

- ✅ Frontend: Funcțional, conectat la n8n
- ✅ Backend: NestJS inițializat, gata pentru dezvoltare
- ⏳ Migrare: Planificată, încă nu începută

## 🔄 Strategie de Migrare

Vezi [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) pentru planul detaliat.

Migrarea este **incrementală și non-breaking**:
1. Backend ca proxy către n8n
2. Migrare endpoint cu endpoint
3. Completare migrare

## ⚠️ Reguli Importante

- **NU** modifica frontend-ul automat
- **NU** înlocui comportamentul n8n fără aprobare explicită
- Migrarea este **endpoint cu endpoint** cu aprobare explicită
- Toate modificările trebuie să mențină compatibilitatea înapoi

## 🌍 Idioma de Comunicación

**IMPORTANTE: Desde ahora, todas las comunicaciones deben estar en español:**
- ✅ Todos los emails enviados desde el sistema
- ✅ Todas las notificaciones (push, websocket, etc.)
- ✅ Todos los avisos y alertas
- ✅ Todos los mensajes de Telegram
- ✅ Todos los textos de interfaz visibles al usuario

**Cualquier mensaje, notificación o comunicación con el usuario final debe estar exclusivamente en español.**

## 📚 Documentație

- [Plan de Migrare](./MIGRATION_PLAN.md)
- [Backend README](./backend/README.md)
