# 📄 Módulo de Facturación - DeCamino

## 🎯 Descripción

El módulo de facturación es un sistema completo para la gestión de facturas en DeCamino Servicios Auxiliares SL. Permite crear, editar, visualizar y gestionar facturas con funcionalidades avanzadas como generación de PDF y estadísticas en tiempo real.

## 🏗️ Arquitectura

```
src/modules/facturas/
├── components/           # Componentes reutilizables
│   ├── FacturaForm.jsx  # Formulario de creación/edición
│   ├── FacturaPreview.jsx # Vista previa de factura
│   └── FacturaLista.jsx # Lista con filtros y acciones
├── contexts/
│   └── FacturasContext.jsx # Estado global y lógica de negocio
├── pages/
│   └── FacturasPage.jsx # Página principal del módulo
├── utils/
│   └── pdfGenerator.jsx  # Generación de PDFs
└── index.js             # Exportaciones del módulo
```

## 🚀 Funcionalidades

### ✅ Implementadas
- **Creación y edición de facturas** con formulario dinámico
- **Gestión de items** con cantidades, precios y TVA
- **Cálculo automático** de subtotales, TVA y totales
- **Generación de PDF** profesional con logo y branding
- **Estados de factura**: Borrador, Enviado, eFactura Pendiente, Pagado
- **Filtrado y búsqueda** avanzada por múltiples criterios
- **Estadísticas en tiempo real** con métricas clave
- **Persistencia local** con localStorage
- **Logging de actividades** integrado con el sistema existente

### 🔄 Próximas Integraciones
- **Conexión con módulo Clientes** para selección automática
- **Integración eFactura** para envío de XML firmado
- **Envío automático por email** con PDF adjunto
- **Recordatorios de vencimiento** automáticos
- **Reportes avanzados** y exportación de datos
- **API backend** para persistencia en servidor

## 🎨 Diseño y UX

### Colores y Branding
- **Primario**: Rojo (#E53935) - DeCamino branding
- **Secundario**: Blanco y grises para contraste
- **Estados**: Códigos de color intuitivos
  - Borrador: Gris
  - Enviado: Azul
  - eFactura Pendiente: Ámbar
  - Pagado: Verde

### Componentes
- **Formulario dinámico** con validación en tiempo real
- **Preview profesional** con diseño de factura real
- **Lista interactiva** con acciones rápidas
- **Estadísticas visuales** con iconos y métricas

## 📊 Estados de Factura

| Estado | Descripción | Color |
|--------|-------------|-------|
| `borrador` | Factura en creación/edición | Gris |
| `enviado` | Factura enviada al cliente | Azul |
| `efactura-pendiente` | Pendiente de procesamiento eFactura | Ámbar |
| `pagado` | Factura pagada | Verde |

## 🔧 Uso del Módulo

### Importación
```javascript
import { FacturasPage } from './modules/facturas';
```

### Context Provider
```javascript
import { FacturasProvider, useFacturas } from './modules/facturas';

// Envolver la aplicación
<FacturasProvider>
  <App />
</FacturasProvider>

// Usar en componentes
const { facturas, createFactura, getFacturasStats } = useFacturas();
```

### Generación de PDF
```javascript
import { downloadFacturaPDF, openFacturaPDF } from './modules/facturas';

// Descargar PDF
await downloadFacturaPDF(factura);

// Abrir en browser
await openFacturaPDF(factura);
```

## 📈 Estadísticas Disponibles

El módulo proporciona estadísticas en tiempo real:

- **Total facturas**: Número total de facturas
- **Total facturado**: Suma de todas las facturas
- **Pagado**: Suma de facturas pagadas
- **Pendiente**: Suma de facturas pendientes
- **Por estado**: Desglose por cada estado

## 🔗 Integración con Sistema Existente

### Logging de Actividades
- Integrado con `activityLogger` existente
- Logs automáticos para todas las acciones
- Tracking de usuario y sesión

### Autenticación
- Usa `AuthContext` existente
- Permisos basados en roles
- Persistencia de sesión

### Diseño
- Consistente con tema rojo/blanco
- Usa componentes UI existentes
- Responsive design con TailwindCSS

## 🚀 Extensibilidad

### Preparado para eFactura
- Estructura de datos compatible con XML
- Estados preparados para workflow eFactura
- Campos para información fiscal

### Preparado para API
- Context separado de lógica de negocio
- Funciones async preparadas para backend
- Estructura de datos estandarizada

### Preparado para Clientes
- Campo cliente preparado para integración
- Estructura extensible para datos de cliente
- Validación preparada para datos reales

## 📝 Notas de Desarrollo

### Dependencias
- `pdfmake`: Generación de PDFs
- `react-router-dom`: Navegación
- `localStorage`: Persistencia temporal

### Performance
- Cálculos optimizados con useMemo
- Lazy loading de PDF generation
- Debouncing en filtros de búsqueda

### Seguridad
- Validación de entrada en formularios
- Sanitización de datos
- Logging de actividades para auditoría

## 🎯 Roadmap

### Fase 1 (Actual) ✅
- [x] Módulo básico funcional
- [x] Generación de PDF
- [x] Gestión de estados
- [x] Estadísticas básicas

### Fase 2 (Próxima)
- [ ] Integración con módulo Clientes
- [ ] API backend para persistencia
- [ ] Envío automático por email
- [ ] Recordatorios de vencimiento

### Fase 3 (Futura)
- [ ] Integración eFactura completa
- [ ] Reportes avanzados
- [ ] Dashboard de facturación
- [ ] Integración con contabilidad 