# 📤 Exportación de Fichas de Inspección - DeCamino

## 🎯 Descripción

Sistema completo de exportación para las fichas de inspección de DeCamino Servicios Auxiliares SL. Permite exportar inspecciones en múltiples formatos con diseño profesional y branding de la empresa.

## 🚀 Funcionalidades de Exportación

### ✅ Implementadas

#### 1. **Exportación PDF Individual**
- **Descripción**: Genera PDF profesional de la inspección actual
- **Características**:
  - Logo DeCamino en header
  - Diseño profesional con colores corporativos (rojo #E53935)
  - Toda la información de la inspección
  - Firmas digitales incluidas
  - Paginación automática
  - Footer con información de generación

#### 2. **Vista Previa PDF**
- **Descripción**: Abre el PDF en el navegador para imprimir
- **Características**:
  - Misma calidad que el PDF descargado
  - Optimizado para impresión
  - Acceso directo desde el formulario

#### 3. **Exportación Excel/CSV**
- **Descripción**: Exporta todas las inspecciones a formato CSV
- **Características**:
  - Datos estructurados para análisis
  - Compatible con Excel, Google Sheets, etc.
  - Incluye todas las columnas relevantes
  - Filtrado automático de datos

#### 4. **Exportación ZIP con PDFs**
- **Descripción**: Descarga todas las inspecciones como PDFs en un archivo ZIP
- **Características**:
  - Un PDF por inspección
  - Nombres de archivo descriptivos
  - Compresión automática
  - Ideal para archivo y distribución

## 📋 Formatos de Exportación

### PDF Individual
```
Nombre: inspeccion_{tipo}_{centro}_{fecha}.pdf
Ejemplo: inspeccion_limpieza_Centro_Comercial_2024-01-15.pdf
```

### Excel/CSV
```
Nombre: inspecciones_{fecha}.csv
Ejemplo: inspecciones_2024-01-15.csv
```

### ZIP con PDFs
```
Nombre: inspecciones_{fecha}.zip
Ejemplo: inspecciones_2024-01-15.zip
```

## 🎨 Diseño PDF

### Header
- Logo DeCamino (izquierda)
- "DE CAMINO SERVICIOS AUXILIARES SL" (derecha)
- Colores corporativos

### Contenido
1. **Título Principal**: Tipo de inspección
2. **Datos Generales**: Fecha, hora, supervisor, centro, trabajador
3. **Verificaciones**: Checkboxes para uniforme, horario, cliente
4. **Registro de Supervisión**: Tabla con zonas, rangos, observaciones
5. **Encuesta de Calidad**: Valoraciones y comentarios
6. **Firmas**: Firma trabajador y cliente
7. **Footer**: Información de generación

### Estilos
- **Primario**: Rojo #E53935 (DeCamino)
- **Secundario**: Grises para texto
- **Tablas**: Headers rojos, contenido gris
- **Checkboxes**: Verde para marcados, gris para no marcados

## 🔧 Uso del Sistema

### Desde el Formulario de Inspección

#### Botones Disponibles:
1. **📄 Descargar PDF**: Descarga la inspección actual
2. **🖨️ Imprimir PDF**: Abre en navegador para imprimir
3. **📊 Exportar Excel**: Exporta todas las inspecciones
4. **📦 Exportar ZIP**: Descarga todas como PDFs

#### Condiciones:
- **PDF Individual**: Requiere centro y trabajador seleccionados
- **Excel/ZIP**: Funciona con inspecciones existentes

### Desde la Página Principal

#### Botones en "Inspecciones Recientes":
- **📊 Exportar Excel**: Exporta todas las inspecciones a CSV
- **📦 Exportar ZIP**: Descarga todas como PDFs

## 📊 Estructura de Datos Exportados

### Excel/CSV Columns:
```csv
Fecha,Hora,Supervisor,Centro,Trabajador,Servicio,Tipo,Uniforme,En Horario,Confirmando Cliente,Calidad DeCamino,Calidad Empleada,Mejoras,Seguiría DeCamino,Recomendaría DeCamino,Contacto,Firma Trabajador,Firma Cliente
```

### Rangos de Calidad:
- 1 - Muy malo
- 2 - Malo
- 3 - Regular
- 4 - Bueno
- 5 - Excelente

## 🛠️ Implementación Técnica

### Dependencias:
```json
{
  "pdfmake": "^0.2.20",
  "jszip": "^3.10.1"
}
```

### Archivos Principales:
- `src/utils/inspectionExporter.js`: Lógica de exportación
- `src/components/inspections/InspectionForm.jsx`: Integración UI
- `src/pages/InspeccionesPage.jsx`: Botones de exportación

### Funciones Principales:
```javascript
// PDF Individual
downloadInspectionPDF(inspectionData, filename)
openInspectionPDF(inspectionData)

// Exportación Masiva
exportAllInspections(inspections)
exportInspectionsToExcel(inspections)
```

## 🔄 Flujo de Datos

### 1. Obtención de Datos
```javascript
// Desde API
const response = await fetch(routes.getInspecciones, {
  method: 'POST',
  body: JSON.stringify({ limit: 100 })
});

// Fallback a localStorage
const localInspections = JSON.parse(localStorage.getItem('inspections') || '[]');
```

### 2. Procesamiento
```javascript
// Generación PDF
const pdfDoc = await generateInspectionPDF(inspectionData);

// Generación ZIP
const zip = new JSZip();
zip.file(filename, pdfBlob);
```

### 3. Descarga
```javascript
// PDF Individual
pdfDoc.download(filename);

// ZIP
const zipBlob = await zip.generateAsync({ type: 'blob' });
```

## 🎯 Casos de Uso

### 1. **Supervisor en Campo**
- Completa inspección
- Descarga PDF inmediatamente
- Imprime para entrega al cliente

### 2. **Gerente de Calidad**
- Exporta Excel para análisis
- Revisa tendencias y estadísticas
- Genera reportes mensuales

### 3. **Administración**
- Exporta ZIP con todas las inspecciones
- Archiva documentos para auditoría
- Comparte con clientes

### 4. **Auditoría Externa**
- Acceso a PDFs profesionales
- Documentación completa
- Trazabilidad de firmas

## 🔒 Seguridad y Privacidad

### Datos Incluidos:
- ✅ Información de inspección
- ✅ Firmas digitales
- ✅ Datos de contacto (opcional)
- ✅ Timestamps de generación

### Datos Excluidos:
- ❌ Contraseñas de usuarios
- ❌ Datos sensibles de empleados
- ❌ Información de sistema

## 🚀 Próximas Mejoras

### Planificadas:
- [ ] **Email Automático**: Envío automático de PDFs por email
- [ ] **Firma Digital**: Certificación digital de documentos
- [ ] **Plantillas Personalizadas**: Diferentes diseños por cliente
- [ ] **Reportes Avanzados**: Gráficos y estadísticas en PDF
- [ ] **Integración Cloud**: Almacenamiento en la nube
- [ ] **API de Exportación**: Endpoint para exportación programática

### Optimizaciones:
- [ ] **Compresión Avanzada**: Reducir tamaño de archivos
- [ ] **Caché de PDFs**: Generación más rápida
- [ ] **Progreso de Exportación**: Barra de progreso para ZIPs grandes
- [ ] **Filtros Avanzados**: Exportación selectiva por fechas/tipos

## 📞 Soporte

### Problemas Comunes:
1. **PDF no se genera**: Verificar que centro y trabajador estén seleccionados
2. **ZIP vacío**: Verificar que existan inspecciones en el sistema
3. **Excel sin datos**: Verificar conexión con API

### Contacto:
- **Desarrollador**: Sistema de exportación
- **Soporte Técnico**: Problemas de generación
- **Administración**: Acceso y permisos

---

**DeCamino Servicios Auxiliares SL** - Sistema de Exportación de Inspecciones v1.0 