# Validación de Trimestre - Funcionalidad Implementada

## Descripción

Se ha implementado una funcionalidad de validación de trimestre que permite a los usuarios crear facturas, facturas recibidas y gastos con fechas fuera del trimestre actual, pero requiere confirmación explícita del usuario.

## Características

### ✅ **Permite Operaciones Fuera del Trimestre**
- Los usuarios pueden crear facturas, facturas recibidas y gastos con fechas de trimestres anteriores o siguientes
- No se bloquea la operación, solo se solicita confirmación

### ⚠️ **Confirmación Obligatoria**
- Cuando se detecta una fecha fuera del trimestre actual, se muestra un diálogo de confirmación
- El usuario debe confirmar explícitamente que desea continuar
- Si el usuario cancela, la operación se detiene

### 📊 **Indicadores Visuales**
- Se muestran mensajes de advertencia en color naranja cuando la fecha está fuera del trimestre
- Los mensajes indican a qué trimestre pertenece la fecha seleccionada
- Ejemplo: "⚠️ La fecha 15/01/2024 pertenece al trimestre anterior (T1 2024). ¿Desea continuar con esta operación fuera del trimestre actual (T4 2024)?"

## Módulos Afectados

### 1. **Facturas (FacturaForm)**
- **Archivo**: `src/modules/facturas/components/FacturaForm.jsx`
- **Validación**: Al crear/editar facturas
- **Confirmación**: Antes de guardar la factura

### 2. **Facturas Recibidas (FacturaRecibidaForm)**
- **Archivo**: `src/modules/facturas/components/FacturaRecibidaForm.jsx`
- **Validación**: Al crear/editar facturas recibidas
- **Confirmación**: Antes de guardar la factura recibida

### 3. **Gastos (GastoManualModal)**
- **Archivo**: `src/modules/gastos/components/GastoManualModal.jsx`
- **Validación**: Al crear gastos manuales
- **Confirmación**: Antes de guardar el gasto

## Implementación Técnica

### Archivo de Utilidades
- **Archivo**: `src/utils/quarterValidation.js`
- **Funciones principales**:
  - `checkQuarterValidation(date)`: Verifica si una fecha está fuera del trimestre actual
  - `confirmOutsideQuarterOperation(message)`: Muestra el diálogo de confirmación
  - `getCurrentQuarter()`: Obtiene el trimestre actual
  - `getQuarterRange(year, quarter)`: Calcula el rango de fechas de un trimestre

### Lógica de Validación
1. **Detección**: Se verifica si la fecha seleccionada está dentro del trimestre actual
2. **Advertencia**: Se muestra un mensaje visual en color naranja
3. **Confirmación**: Al intentar guardar, se solicita confirmación explícita
4. **Procesamiento**: Solo si se confirma, se procede con la operación

### Cálculo de Trimestres
- **T1**: Enero, Febrero, Marzo
- **T2**: Abril, Mayo, Junio
- **T3**: Julio, Agosto, Septiembre
- **T4**: Octubre, Noviembre, Diciembre

## Flujo de Usuario

### Escenario Normal (Dentro del Trimestre)
1. Usuario selecciona una fecha del trimestre actual
2. No se muestran advertencias
3. La operación se procesa normalmente

### Escenario con Fecha Fuera del Trimestre
1. Usuario selecciona una fecha de otro trimestre
2. Se muestra mensaje de advertencia en naranja
3. Al intentar guardar, aparece diálogo de confirmación
4. Usuario confirma o cancela
5. Si confirma: se procesa la operación
6. Si cancela: se detiene la operación

## Mensajes de Usuario

### Advertencias Visuales
- **Color**: Naranja (`text-orange-600`)
- **Icono**: ⚠️
- **Formato**: "La fecha [FECHA] pertenece al trimestre [T#] [AÑO]. ¿Desea continuar con esta operación fuera del trimestre actual (T# [AÑO])?"

### Diálogo de Confirmación
- **Tipo**: `window.confirm()` nativo del navegador
- **Opciones**: "OK" (confirmar) / "Cancel" (cancelar)
- **Comportamiento**: 
  - OK: Continúa con la operación
  - Cancel: Detiene la operación

## Beneficios

### Para el Usuario
- **Flexibilidad**: Puede trabajar con fechas de otros trimestres cuando sea necesario
- **Control**: Tiene control total sobre cuándo permitir operaciones fuera del trimestre
- **Transparencia**: Sabe exactamente a qué trimestre pertenece cada fecha

### Para el Sistema
- **Integridad**: Mantiene la integridad de los datos sin bloquear operaciones legítimas
- **Auditoría**: Registra cuando se realizan operaciones fuera del trimestre
- **Consistencia**: Aplica la misma lógica en todos los módulos

## Consideraciones Técnicas

### Performance
- Las validaciones se ejecutan solo cuando es necesario
- No hay impacto en el rendimiento para fechas dentro del trimestre actual

### Compatibilidad
- Funciona en todos los navegadores modernos
- Utiliza APIs nativas del navegador (`window.confirm`)

### Mantenibilidad
- Código centralizado en un archivo de utilidades
- Fácil de modificar o extender
- Reutilizable en otros módulos

## Posibles Mejoras Futuras

### 1. **Configuración por Usuario**
- Permitir que cada usuario configure sus preferencias de validación
- Opción para desactivar completamente la validación

### 2. **Historial de Operaciones Fuera del Trimestre**
- Registrar todas las operaciones confirmadas fuera del trimestre
- Reportes de auditoría

### 3. **Validaciones Adicionales**
- Verificar si la fecha está dentro del año fiscal
- Validaciones específicas por tipo de documento

### 4. **Interfaz Mejorada**
- Reemplazar `window.confirm` con un modal personalizado
- Mejor integración visual con el diseño de la aplicación

## Conclusión

Esta funcionalidad proporciona un equilibrio perfecto entre flexibilidad y control, permitiendo a los usuarios trabajar con fechas de otros trimestres cuando sea necesario, mientras mantiene la transparencia y el control sobre las operaciones realizadas.
