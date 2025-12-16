# Modo DEMO - DeCamino Servicios Auxiliares

## Descripción

El modo DEMO permite explorar la aplicación completa con datos simulados, sin necesidad de conectarse al backend real. Utiliza Mock Service Worker (MSW) para interceptar las llamadas API y devolver datos ficticios persistentes.

## Características

### ✅ Funcionalidades Implementadas

- **Activación segura**: El modo DEMO se activa solo cuando es solicitado explícitamente
- **Datos persistentes**: Los cambios se guardan en localStorage durante la sesión
- **CRUD completo**: Todas las operaciones de creación, lectura, actualización y eliminación funcionan
- **Paginación**: Soporte completo para listas paginadas
- **Búsqueda y filtrado**: Funcionalidades de búsqueda en todos los módulos
- **Archivos simulados**: PDFs base64 para nóminas, documentos e inspecciones
- **Estadísticas**: Datos simulados para todos los dashboards
- **Logs de actividad**: Sistema de logging simulado

### 🎯 Módulos Cubiertos

1. **Autenticación**
   - Login simulado con usuarios demo
   - Roles: Admin, Manager, Supervisor, Empleado
   - Sesiones persistentes

2. **Empleados**
   - Lista completa de empleados demo
   - CRUD completo
   - Filtros por centro y búsqueda

3. **Fichajes**
   - Registro de entrada/salida
   - Estados: aprobado, pendiente, rechazado
   - Geolocalización simulada

4. **Cuadrantes**
   - Programas semanales
   - Gestión de horarios
   - Aprobaciones

5. **Documentos**
   - Nóminas con PDF base64
   - Documentos oficiales
   - Upload/download simulado

6. **Solicitudes**
   - Vacaciones, asuntos propios, permisos médicos
   - Workflow de aprobación
   - Estados: pendiente, aprobado, rechazado

7. **Inspecciones**
   - Inspecciones de seguridad, higiene, calidad
   - PDFs de informes
   - Estados: programada, completada

8. **Clientes**
   - Gestión completa de clientes
   - Contratos y facturación
   - Búsqueda por NIF, nombre, email

9. **Proveedores**
   - Catálogo de proveedores
   - Categorías y servicios
   - Gestión de contratos

10. **Facturas**
    - Creación y edición
    - Estados: borrador, enviado, pagado
    - PDFs simulados

11. **Gastos**
    - Procesamiento OCR simulado
    - Estados: cargado, pendiente, procesado
    - Categorización automática

12. **Estadísticas**
    - Dashboards completos
    - Métricas por módulo
    - Gráficos y reportes

## Cómo Usar

### 1. Activación del Modo DEMO

**Opción A: Botón en Login**
1. Ve a la página de login
2. Haz clic en "Conectează-te ca DEMO"
3. Confirma la activación

**Opción B: URL Parameter**
```
http://localhost:5173/?demo=true
```

**Opción C: LocalStorage**
```javascript
localStorage.setItem('app_demo', '1');
location.reload();
```

### 2. Credenciales Demo

```
Admin:     admin@demo.com / 123456
Manager:   manager@demo.com / 123456
Supervisor: supervisor@demo.com / 123456
Empleado:  empleado@demo.com / 123456
```

### 3. Controles DEMO

- **Badge DEMO**: Aparece en la esquina superior derecha
- **Reset**: Limpia todos los datos demo
- **Salir**: Desactiva el modo DEMO

## Estructura Técnica

### Archivos Principales

```
src/
├── utils/demo.ts                 # Utilidades DEMO
├── mocks/
│   ├── browser.ts               # Configuración MSW
│   ├── handlers.ts              # Handlers API
│   ├── demoStore.ts             # Almacén persistente
│   ├── serverUtils.ts           # Utilidades servidor
│   └── fixtures/                # Datos demo
│       ├── auth.json
│       ├── empleados.json
│       ├── clientes.json
│       ├── proveedores.json
│       ├── fichajes.json
│       ├── cuadrantes.json
│       ├── nominas.json
│       ├── documentos.json
│       ├── solicitudes.json
│       ├── inspecciones.json
│       ├── facturas.json
│       ├── gastos.json
│       ├── estadisticas.json
│       └── logs.json
├── components/
│   └── DemoBadge.jsx            # Componente badge
└── pages/
    └── LoginPage.jsx            # Botón DEMO en login
```

### Flujo de Activación

1. **Detección**: `isDemoMode()` verifica múltiples fuentes
2. **Inicialización**: MSW se activa solo en modo DEMO
3. **Datos**: DemoStore se inicializa con fixtures
4. **Interceptación**: Handlers MSW interceptan llamadas API
5. **Persistencia**: Cambios se guardan en localStorage

### Handlers MSW

Cubren todos los endpoints de la aplicación:

- **Autenticación**: `/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142`
- **Empleados**: `/api/empleados`
- **Clientes**: `/api/clientes`
- **Proveedores**: `/api/proveedores`
- **Fichajes**: `/api/fichajes`
- **Cuadrantes**: `/api/cuadrantes`
- **Nóminas**: `/api/nominas`
- **Documentos**: `/api/documentos`
- **Solicitudes**: `/api/solicitudes`
- **Inspecciones**: `/api/inspecciones`
- **Facturas**: `/api/facturas`
- **Gastos**: `/api/gastos`
- **Estadísticas**: `/api/estadisticas`
- **Logs**: `/api/logs`
- **Avatar**: `/webhook/getavatar/886f6dd7-8b4d-479b-85f4-fb888ba8f731`

## Seguridad

### Principios de Seguridad

1. **No Invasivo**: El modo DEMO no modifica el código de producción
2. **Activación Explícita**: Solo se activa cuando es solicitado
3. **Aislamiento**: Los datos demo están completamente separados
4. **Sin Backend**: No se realizan llamadas al backend real
5. **PWA Compatible**: No interfiere con el service worker

### Verificaciones

- MSW solo se activa si `isDemoMode() === true`
- Handlers solo interceptan en modo DEMO
- Datos demo almacenados en `localStorage.__demo_store__`
- Badge DEMO visible solo en modo DEMO

## Desarrollo

### Agregar Nuevos Datos Demo

1. **Crear fixture**: `src/mocks/fixtures/nuevo_modulo.json`
2. **Agregar al store**: Incluir en `fixtures` en `handlers.ts`
3. **Crear handlers**: Agregar endpoints en `handlers.ts`
4. **Actualizar DemoStore**: Incluir en inicialización

### Agregar Nuevos Endpoints

```javascript
// En handlers.ts
http.get('/api/nuevo-endpoint', async ({ request }) => {
  await randDelay();
  
  const { qp } = parseUrl(request.url);
  let datos = DemoStore.list('nuevo_modulo');
  
  // Filtros, búsqueda, paginación
  if (qp.search) {
    datos = searchItems(datos, qp.search, ['campo1', 'campo2']);
  }
  
  const page = parseInt(qp.page) || 1;
  const pageSize = parseInt(qp.pageSize) || 20;
  const result = paginate(datos, page, pageSize);
  
  return ok(result);
});
```

### Testing

```javascript
// Verificar modo DEMO
console.log('DEMO Mode:', isDemoMode());
console.log('DEMO Status:', getDemoStatus());

// Verificar datos
console.log('Demo Store:', DemoStore.snapshot());
console.log('Total Items:', DemoStore.totalItems());
```

## Troubleshooting

### Problemas Comunes

1. **MSW no se activa**
   - Verificar que `isDemoMode()` retorna `true`
   - Comprobar que `localStorage.app_demo === '1'`

2. **Datos no persisten**
   - Verificar que `DemoStore.persist()` se llama
   - Comprobar `localStorage.__demo_store__`

3. **Handlers no interceptan**
   - Verificar que MSW está activo
   - Comprobar que los endpoints coinciden

4. **Badge DEMO no aparece**
   - Verificar que `isDemoMode()` retorna `true`
   - Comprobar que el componente está importado

### Debug

```javascript
// En consola del navegador
window.__DEMO__ // true si MSW está activo
localStorage.getItem('app_demo') // '1' si DEMO está activo
localStorage.getItem('__demo_store__') // datos demo
```

## Limitaciones

### Conocidas

1. **Archivos reales**: No se pueden subir archivos reales
2. **Notificaciones**: No hay notificaciones push reales
3. **Email**: No se envían emails reales
4. **Geolocalización**: Usa ubicaciones simuladas
5. **Tiempo real**: No hay sincronización en tiempo real

### Futuras Mejoras

1. **Más datos demo**: Ampliar fixtures con más casos
2. **Simulación de errores**: Endpoint para simular errores
3. **Performance**: Optimizar handlers para grandes volúmenes
4. **Exportar datos**: Función para exportar datos demo
5. **Importar datos**: Función para importar datos personalizados

## Contribución

Para contribuir al modo DEMO:

1. **Fork** el repositorio
2. **Crear** una rama para la feature
3. **Implementar** los cambios
4. **Probar** en modo DEMO
5. **Crear** un pull request

### Estándares

- Seguir la estructura existente
- Documentar nuevos endpoints
- Incluir datos demo realistas
- Mantener compatibilidad con PWA
- No modificar código de producción

---

**Nota**: El modo DEMO está diseñado para demostración y testing. No debe usarse en producción.
