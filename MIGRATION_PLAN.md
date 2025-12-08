# Migration Plan: n8n → NestJS Backend

## 🎯 Objective

Gradually migrate functionality from n8n workflows to a real Node.js backend (NestJS) without breaking the production frontend.

## 📋 Current State

- ✅ **Frontend**: React app connected to n8n at `https://n8n.decaminoservicios.com`
- ✅ **Backend**: NestJS initialized in `/backend` (ready for development)
- ⏳ **Migration**: Not started (frontend still uses n8n)

## 🔄 Migration Strategy

### Phase 1: Backend as Proxy (Current)
**Status**: Ready to implement

- Backend acts as a proxy/router to n8n
- Frontend remains unchanged
- Zero breaking changes
- Testing infrastructure in place

**Implementation**:
- Create proxy service in backend
- Route `/api/*` requests to n8n
- Frontend gradually switches from direct n8n calls to backend API

### Phase 2: Incremental Migration
**Status**: Pending

- Migrate endpoints one-by-one
- Backend implements real logic
- Frontend gradually switches from n8n → backend
- n8n remains as fallback

**Process for each endpoint**:
1. Identify endpoint in frontend (`routes.js`, `n8n-endpoints.ts`)
2. Create equivalent route in backend
3. Implement logic (or proxy to n8n initially)
4. Update frontend to use backend endpoint
5. Test thoroughly
6. Remove n8n dependency for that endpoint

### Phase 3: Complete Migration
**Status**: Future

- All endpoints in backend
- n8n becomes optional/legacy
- Full control over API

## 📝 Endpoint Inventory

### Authentication & Users
- `POST /webhook/login-yyBov0qVQZEhX2TL` - Login
- `GET /webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142` - Get usuarios
- `GET /webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142` - Get empleados
- `PUT /webhook/853e19f8-877a-4c85-b63c-199f3ec84049` - Update user
- `POST /webhook/5c15e864-0bfc-43bb-b398-58bd8fabf3c2` - Add user

### Fichajes (Time Tracking)
- `GET /webhook/95551bd2-fba3-401f-a14e-08e3ca037ce7` - Get fichajes
- `GET /webhook/get-registros-EgZjaHJv` - Get registros
- `GET /webhook/47305af1-939e-4002-a140-7f581bdaf392` - Get registros empleados
- `GET /webhook/v1/e9424047-c9ae-4442-a9b6-2ac9e378eaa2` - Get registros periodo
- `POST /webhook/registrohorario-WUqDggA` - Add fichaje
- `PUT /webhook/f8378016-1d88-4c1e-af56-3175d41d1652` - Update fichaje
- `DELETE /webhook/be5911e1-28ad-4ab4-8ecd-a1fa65b6a0fb` - Delete fichaje

### Cuadrantes (Schedules)
- `GET /webhook/get-cuadrantes-yyBov0qVQZEhX2TL` - Get cuadrantes
- `POST /webhook/guardar-cuadrante-yyBov0qVQZEhX2TL` - Save cuadrante

### Solicitudes (Requests)
- `GET /webhook/lista-solicitudes` - Get solicitudes
- `GET /webhook/lista-solicitudes-email-yyBov0qVQZEhX2TL` - Get solicitudes by email
- `POST /webhook/solicitud-empleados` - Add solicitud
- `PUT /webhook/actualizar-estado-5Wogblin` - Update solicitud status
- `POST /webhook/56981e4c-316e-412d-8c49-99ecb13f2327` - Upload bajas medicas
- `GET /webhook/...` - Get bajas medicas

### AutoFirma
- `POST /webhook/918cd7f3-c0b6-49da-9218-46723702224d` - Prepare/Status/Download

### Documentos
- `GET /webhook/171d8236-6ef1-4b97-8605-096476bc1d8b` - Documentos oficiales

### Pedidos (Orders)
- `GET /webhook/catalogo/bae4f329-a1be-4e66-9792-6b35aa2f4a51` - Get catalogo
- `POST /webhook/96759745-6289-41d4-9e5e-f253fbfab08c` - Add product
- `PUT/DELETE /webhook/5c49e67b-b81c-4187-8d0f-37bb32e9f217` - Edit/Delete product
- `GET /webhook/2498ba38-1402-4b73-bb5b-c8b1097ecf4b` - Get permisos
- `GET /webhook/8c8aa198-5b57-4203-bdd7-7f8ff060bf68` - Load permisos

## 🚀 Next Steps

1. **Setup Git** (if not already done)
   ```bash
   git init
   git add .
   git commit -m "Initial commit: monorepo with frontend + backend"
   ```

2. **Create Backend Proxy Service**
   - Implement n8n proxy in NestJS
   - Route requests to n8n during migration

3. **Choose First Endpoint to Migrate**
   - Start with a simple, low-risk endpoint
   - Example: Health check or simple GET endpoint

4. **Update Frontend Gradually**
   - Create environment variable for backend URL
   - Switch one endpoint at a time
   - Test thoroughly before moving to next

## ⚠️ Important Rules

- **DO NOT** modify frontend logic automatically
- **DO NOT** replace n8n behavior until explicitly approved
- **DO NOT** break existing functionality
- Migration must be **endpoint-by-endpoint** with explicit approval
- All changes must maintain backward compatibility

## 📚 Documentation

- Backend README: `/backend/README.md`
- Frontend: Production React app (unchanged)
- n8n: `https://n8n.decaminoservicios.com`
