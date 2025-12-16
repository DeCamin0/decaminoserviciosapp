# DeCamino Servicios - Backend API

## 🎯 Purpose

This is the new **Node.js backend** that will gradually replace the current **n8n workflows**. The migration is **incremental and non-breaking** - the frontend will continue working with n8n until each endpoint is fully migrated.

## 📋 Migration Strategy

### Phase 1: Backend as Proxy (Current)
- Backend acts as a proxy/router to n8n
- Frontend remains unchanged
- Zero breaking changes
- Testing infrastructure in place

### Phase 2: Incremental Migration
- Migrate endpoints one-by-one
- Backend implements real logic
- Frontend gradually switches from n8n → backend
- n8n remains as fallback

### Phase 3: Complete Migration
- All endpoints in backend
- n8n becomes optional/legacy
- Full control over API

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation

```bash
cd backend
npm install
```

### Development

```bash
# Start in development mode (with hot-reload)
npm run start:dev

# The server will start on http://localhost:3000
```

### Available Scripts

- `npm run start:dev` - Start development server with watch mode
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests

## 📁 Project Structure

```
backend/
├── src/
│   ├── main.ts              # Application entry point
│   ├── app.module.ts        # Root module
│   ├── app.controller.ts    # Root controller
│   └── app.service.ts       # Root service
├── test/                    # E2E tests
├── package.json
├── tsconfig.json
└── nest-cli.json
```

## 🔌 Current Status

- ✅ NestJS initialized
- ✅ Basic "Hello World" endpoint working
- ⏳ Frontend connection (pending)
- ⏳ n8n proxy setup (pending)
- ⏳ Endpoint migration (pending)

## ⚠️ Important Notes

- **DO NOT** modify frontend until explicitly approved
- **DO NOT** break existing n8n workflows
- Migration is **endpoint-by-endpoint** with explicit approval
- All changes must maintain backward compatibility

## 🌍 Idioma de Comunicación

**IMPORTANTE: Todas las comunicaciones deben estar en español:**
- ✅ Todos los emails enviados desde el sistema
- ✅ Todas las notificaciones (push, websocket, etc.)
- ✅ Todos los avisos y alertas
- ✅ Todos los mensajes de Telegram
- ✅ Todos los textos de interfaz visibles al usuario

**Cualquier mensaje, notificación o comunicación con el usuario final debe estar exclusivamente en español.**

## 🔗 Related

- Frontend: `/frontend` (React app)
- Current Backend: n8n workflows at `https://n8n.decaminoservicios.com`
