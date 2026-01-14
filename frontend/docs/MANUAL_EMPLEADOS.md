# Manual de Usuario - De Camino Servicios Auxiliares

## Guía para Empleados

Este manual está diseñado específicamente para los empleados de **De Camino Servicios Auxiliares**. Te ayudará a utilizar todas las funcionalidades disponibles en la aplicación web.

---

## 📋 Contenido

1. [Inicio de Sesión](#inicio-de-sesión)
2. [Página Principal (Dashboard)](#página-principal-dashboard)
3. [Datos Personales](#datos-personales)
4. [Registro de Jornada (Fichaje)](#registro-de-jornada-fichaje)
5. [Solicitudes](#solicitudes)
6. [Documentos](#documentos)
7. [Mi Horario](#mi-horario)
8. [Mis Inspecciones](#mis-inspecciones)
9. [Comunicados](#comunicados)
10. [Pedidos](#pedidos)
11. [Salón de la Fama](#salón-de-la-fama)
12. [Funciones Generales](#funciones-generales)

---

## Inicio de Sesión

### Acceder a la aplicación

1. Abre la aplicación en tu navegador o en la app móvil
2. Verás la página de inicio de sesión con el logo de la empresa

### Campos de autenticación

#### Correo Electrónico
- **Qué es**: Tu dirección de email utilizada para iniciar sesión
- **Formato**: `tu@email.com`
- **Validación**: Debe ser un email válido
- **Icono**: 📧 (aparece en el campo)

#### Contraseña
- **Qué es**: Tu contraseña de acceso
- **Formato**: Texto oculto (••••••••)
- **Botón visibilidad**: Click en el icono del ojo para ver/ocultar la contraseña
- **Validación**: Campo obligatorio

### Botones

#### "Iniciar Sesión"
- **Función**: Envía tus datos de autenticación
- **Estado de carga**: Muestra "Iniciando sesión..." mientras se procesa
- **Después del éxito**: Te redirige automáticamente a la página principal

#### "Conéctate como DEMO"
- **Función**: Acceso en modo demo con datos simulados
- **Disponibilidad**: Solo aparece si no estás ya en modo demo
- **Uso**: Para explorar la aplicación sin datos reales

### Mensajes de error y advertencias

#### Errores de autenticación

**1. "Email o contraseña incorrecta"**
- **Qué significa**: El email o la contraseña que ingresaste no son correctos
- **Causas posibles**:
  - Has escrito mal el email (verifica mayúsculas/minúsculas)
  - Has escrito mal la contraseña (verifica mayúsculas/minúsculas y caracteres especiales)
  - La contraseña ha sido cambiada y no la recuerdas
  - El email no está registrado en el sistema
- **Qué hacer**:
  1. Verifica que el email esté escrito correctamente (sin espacios antes/después)
  2. Verifica que la contraseña esté escrita correctamente
  3. Usa el botón del ojo para ver la contraseña mientras la escribes
  4. Si olvidaste la contraseña, contacta al administrador
  5. Si el problema persiste, contacta al soporte técnico

**2. "Error de conexión" o "No se pudo conectar al servidor"**
- **Qué significa**: No hay conexión a internet o el servidor no está disponible
- **Causas posibles**:
  - No tienes conexión a internet
  - El servidor está en mantenimiento
  - Problemas de red temporal
- **Qué hacer**:
  1. Verifica tu conexión a internet (abre otra página web)
  2. Espera unos minutos e intenta de nuevo
  3. Si el problema persiste, contacta al soporte técnico
  4. Verifica si hay un mensaje de mantenimiento en la página

**3. "Sesión expirada"**
- **Qué significa**: Tu sesión ha expirado por inactividad
- **Qué hacer**: Simplemente inicia sesión de nuevo

**4. "Usuario no autorizado"**
- **Qué significa**: Tu cuenta no tiene permisos para acceder
- **Qué hacer**: Contacta al administrador para verificar tus permisos

#### Estados de carga

**"Iniciando sesión..."**
- **Qué significa**: El sistema está procesando tu solicitud de inicio de sesión
- **Qué hacer**: Espera a que termine (no cierres la página ni hagas click varias veces)
- **Tiempo normal**: 2-5 segundos
- **Si tarda mucho**: Puede haber un problema de conexión, espera hasta 30 segundos antes de intentar de nuevo

#### Validaciones del formulario

**Campo de email vacío o inválido**
- **Qué significa**: El campo de email está vacío o no tiene formato válido
- **Formato válido**: `nombre@dominio.com` (debe tener @ y un dominio)
- **Qué hacer**: Escribe un email válido

**Campo de contraseña vacío**
- **Qué significa**: El campo de contraseña está vacío
- **Qué hacer**: Escribe tu contraseña

#### Consejos de seguridad

1. **No compartas tu contraseña**: Nunca compartas tu contraseña con nadie
2. **Cierra sesión**: Siempre cierra sesión cuando termines, especialmente en dispositivos compartidos
3. **Contraseña segura**: Si puedes cambiar tu contraseña, usa una contraseña segura (mínimo 8 caracteres, con mayúsculas, minúsculas, números y símbolos)
4. **No uses modo demo en producción**: El modo demo es solo para pruebas, no uses datos reales

---

## Página Principal (Dashboard)

### Acceso

Después de iniciar sesión, serás redirigido automáticamente a `/inicio` (Dashboard).

### Elementos principales

#### 1. Banner de Bienvenida

**Contenido:**
- **Avatar de usuario**: Tu foto de perfil (o iniciales si no tienes foto)
- **Nombre**: "¡Bienvenido, [Tu Nombre]!"
- **Descripción**: Información sobre la empresa y funcionalidades
- **Botón "Ver perfil"**: Enlace a tu página de datos personales

**Banner Recordatorio - Baja Médica** (si está activo):
- **Cuándo aparece**: Hasta el 15 de febrero de 2026
- **Contenido**: Recordatorio sobre comunicar bajas médicas
- **Botón cerrar**: X en la esquina superior derecha
- **Acción**: Click en X para cerrar el banner

#### 2. Alertas Mensuales

**Cuándo aparece**: Si tienes días con alertas de horas en el mes actual

**Contenido:**
- **⚠️ Icono**: Indicador visual amarillo
- **Título**: "Alertas mensuales detectadas" o "Alertas de horas mensuales"
- **Detalles**: 
  - Días con exceso (has trabajado más horas de las previstas)
  - Días con déficit (no has fichado o has trabajado menos)
- **Enlace**: "Revisa el tab Horas Trabajadas → Alertas"

##### Explicación detallada de las alertas

**¿Qué son las alertas mensuales?**
- Son notificaciones que aparecen cuando hay diferencias entre las horas que fichaste y las horas que tenías programadas en tu horario
- Se calculan automáticamente cada mes
- Aparecen en el Dashboard y en la página de Fichaje

**Tipos de alertas:**

**1. Alertas de EXCESO (positivas)**
- **Qué significa**: Has fichado MÁS horas de las que tenías programadas
- **Ejemplo**: Tenías programado 8h pero fichaste 8h 30m
- **Causas posibles**:
  - Trabajaste horas extra
  - Olvidaste fichar la salida a tiempo
  - Error al fichar
- **Qué hacer**:
  1. Ve al tab "Horas Trabajadas → Alertas" en Fichaje
  2. Revisa el día específico
  3. Si trabajaste horas extra, solicita regularización
  4. Si fue un error, declara el motivo

**2. Alertas de DÉFICIT (negativas)**
- **Qué significa**: Has fichado MENOS horas de las que tenías programadas
- **Ejemplo**: Tenías programado 8h pero fichaste 7h 30m
- **Causas posibles**:
  - No fichaste entrada o salida
  - Saliste antes de lo programado
  - Olvidaste fichar
- **Qué hacer**:
  1. Ve al tab "Horas Trabajadas → Alertas" en Fichaje
  2. Revisa el día específico
  3. Si olvidaste fichar, declara "No Punch" con el motivo
  4. Si saliste antes, solicita regularización explicando el motivo

**3. Días sin fichajes**
- **Qué significa**: No fichaste entrada ni salida en un día laborable
- **Qué hacer**: Declara "No Punch" con el motivo correspondiente

##### Mensajes de notificación

**Notificación: "Tienes X días con alerta este mes"**
- **Qué significa**: Tienes X días con diferencias entre horas fichadas y programadas
- **Detalles**: Te muestra cuántos días tienen exceso y cuántos tienen déficit
- **Acción recomendada**: Click en "Revisa el apartado Horas Trabajadas → Alertas" para ver los detalles

**Notificación no aparece**
- **Causas posibles**:
  - No tienes alertas este mes
  - Ya revisaste las alertas anteriormente
  - El mes aún no tiene datos suficientes
- **Qué hacer**: Si crees que deberías tener alertas, ve manualmente al tab "Alertas" en Fichaje

##### Banner de Baja Médica

**Cuándo aparece**: Hasta el 15 de febrero de 2026 (o según configuración)

**Contenido**: Recordatorio sobre comunicar bajas médicas

**Botón cerrar (X)**:
- **Función**: Cierra el banner
- **Qué pasa**: El banner desaparece pero puede volver a aparecer en la próxima sesión
- **Recomendación**: Lee el mensaje antes de cerrarlo

**Si no aparece el banner**:
- **Causas posibles**:
  - Ya pasó la fecha límite
  - Ya lo cerraste y no se ha reiniciado la sesión
  - No aplica a tu situación
- **Qué hacer**: Si necesitas comunicar una baja médica, ve a la sección "Solicitudes → Baja"

#### 3. Acceso Rápido (Quick Access Orb)

**Qué es**: Un círculo interactivo con todas las funcionalidades principales

**Elementos disponibles para empleados:**

- **📋 Datos personales**: Tu información personal
- **⏰ Registro de Jornada**: Fichar entrada/salida
- **📝 Solicitudes**: Solicitar vacaciones, permisos, etc.
- **📄 Documentos**: Ver nóminas y documentos
- **📅 Mi horario**: Consultar tu cuadrante personal
- **✅ Mis inspecciones**: Ver inspecciones asignadas
- **📢 Comunicados**: Anuncios oficiales
- **🛒 Pedidos**: Crear pedidos (si tienes permiso)
- **🏆 Salón de la Fama**: Clasificación mensual

**Cómo funciona**:
1. Click en cualquier elemento del círculo
2. Te redirige automáticamente a la página correspondiente
3. Los elementos están organizados en círculo para acceso rápido

### Navegación

**Navegación inferior móvil** (en móvil):
- **Inicio**: Página principal
- **Registro de Jornada**: Fichaje
- **Solicitudes**: Solicitudes
- **Comunicados**: Comunicados oficiales
- **Más**: Abre el menú con todas las opciones

**Barra lateral desktop** (en escritorio):
- Menú lateral con todas las secciones
- Agrupadas lógicamente para acceso rápido

---

## Datos Personales

### Acceso

- **Ruta**: `/datos`
- **Desde Dashboard**: Click en "Datos personales" del Quick Access Orb
- **Desde navegación**: Click en tu avatar o nombre

### Funcionalidades

#### 1. Ver información personal

**Información mostrada**:
- Nombre completo
- DNI/NIE
- Correo electrónico
- Teléfono
- Dirección
- Fecha de nacimiento
- Nacionalidad
- Número de cuenta (IBAN)
- Centro de trabajo
- Grupo
- Fecha de alta
- Avatar (foto de perfil)

#### 2. Editar información

**Botón "✏️ Editar"**:
- **Función**: Activa el modo de edición
- **Campos editables**:
  - Teléfono
  - Dirección
  - Correo electrónico (con confirmación)
  - Avatar (subir nueva foto)
- **Botones**:
  - **💾 Guardar**: Guarda los cambios
  - **❌ Cancelar**: Cancela los cambios

#### 3. Cambiar contraseña

**Botón "🔒 Cambiar Contraseña"**:
- **Función**: Abre formulario para cambiar contraseña
- **Campos**:
  - Contraseña actual (obligatorio)
  - Nueva contraseña (obligatorio)
  - Confirmar nueva contraseña (obligatorio)
- **Validación**: 
  - Nueva contraseña debe tener al menos 8 caracteres
  - Debe coincidir con la confirmación
- **Botones**:
  - **💾 Guardar**: Cambia la contraseña
  - **❌ Cancelar**: Cancela

#### 4. Subir Avatar

**Cómo funciona**:
1. Click en tu avatar o en "Cambiar foto"
2. Selecciona una imagen de tu dispositivo
3. Recorta la imagen si es necesario
4. Click en "Guardar"
5. La foto se actualiza automáticamente

**Formatos aceptados**: JPG, PNG, GIF
**Tamaño máximo**: 5 MB

##### Errores y advertencias en Datos Personales

**1. "Error al guardar los cambios"**
- **Qué significa**: Hubo un error al guardar tus datos personales
- **Causas posibles**:
  - Problema de conexión
  - Error del servidor
  - Datos inválidos
- **Qué hacer**:
  1. Verifica tu conexión a internet
  2. Verifica que todos los campos estén en formato correcto
  3. Espera unos segundos e intenta de nuevo
  4. Si el problema persiste, contacta al soporte técnico

**2. "Datos actualizados correctamente" (éxito)**
- **Qué significa**: Tus datos personales se guardaron exitosamente
- **Qué hacer**: No necesitas hacer nada más

**3. "Error al cambiar la contraseña"**
- **Qué significa**: Hubo un error al intentar cambiar tu contraseña
- **Causas posibles**:
  - La contraseña actual es incorrecta
  - La nueva contraseña no cumple los requisitos (mínimo 8 caracteres)
  - Las contraseñas no coinciden
  - Problema de conexión
- **Qué hacer**:
  1. Verifica que la contraseña actual sea correcta
  2. Verifica que la nueva contraseña tenga al menos 8 caracteres
  3. Verifica que "Nueva contraseña" y "Confirmar nueva contraseña" coincidan exactamente
  4. Intenta de nuevo

**4. "Contraseña actual incorrecta"**
- **Qué significa**: La contraseña actual que ingresaste no es correcta
- **Qué hacer**: 
  1. Verifica que estés escribiendo la contraseña correcta
  2. Usa el botón del ojo para ver la contraseña mientras la escribes
  3. Verifica que no tengas el bloqueo de mayúsculas activado
  4. Si olvidaste la contraseña, contacta al administrador

**5. "Las contraseñas no coinciden"**
- **Qué significa**: "Nueva contraseña" y "Confirmar nueva contraseña" no son iguales
- **Qué hacer**: Asegúrate de escribir exactamente la misma contraseña en ambos campos

**6. "La contraseña debe tener al menos 8 caracteres"**
- **Qué significa**: La nueva contraseña es demasiado corta
- **Qué hacer**: Usa una contraseña de al menos 8 caracteres (recomendado: mayúsculas, minúsculas, números y símbolos)

**7. "Error al subir el avatar"**
- **Qué significa**: Hubo un error al subir tu foto de perfil
- **Causas posibles**:
  - El archivo es muy grande (máximo 5 MB)
  - El formato no es válido (debe ser JPG, PNG o GIF)
  - Problema de conexión
- **Qué hacer**:
  1. Verifica que el archivo sea JPG, PNG o GIF
  2. Verifica que el tamaño no exceda 5 MB
  3. Intenta comprimir la imagen si es muy grande
  4. Verifica tu conexión a internet
  5. Intenta de nuevo

**8. "Avatar actualizado correctamente" (éxito)**
- **Qué significa**: Tu foto de perfil se actualizó exitosamente
- **Qué hacer**: La foto debería aparecer actualizada en unos segundos

---

## Registro de Jornada (Fichaje)

### Acceso

- **Ruta**: `/fichaje`
- **Desde Dashboard**: Click en "Registro de Jornada" del Quick Access Orb
- **Desde navegación**: Click en el icono de reloj del menú

### Funcionalidades principales

#### 1. Fichar (Registrar horas)

**Botón "Fichar"**:
- **Función**: Registra tu entrada o salida
- **Cómo funciona**:
  1. Click en el botón
  2. El sistema detecta automáticamente si es entrada o salida
  3. Se guarda la hora y la ubicación (GPS)
  4. Aparece confirmación visual

**Indicadores**:
- **🟢 Verde**: Has fichado la entrada
- **🔴 Rojo**: Has fichado la salida
- **⏰ Hora**: Se muestra la hora exacta del fichaje

**Importante**: 
- La ubicación se solicita automáticamente al fichar
- Solo se utiliza para el registro de jornada
- Debes permitir el acceso a la ubicación en tu navegador

##### Errores y advertencias al fichar

**1. "Error al obtener ubicación" o "No se pudo obtener la ubicación"**
- **Qué significa**: El navegador no pudo obtener tu ubicación GPS
- **Causas posibles**:
  - No has dado permiso para acceder a la ubicación
  - El GPS está desactivado en tu dispositivo
  - Estás en un lugar sin señal GPS (interior, sótano)
  - Problemas de conexión
- **Qué hacer**:
  1. Acepta el permiso de ubicación cuando el navegador lo solicite
  2. Activa el GPS en tu dispositivo
  3. Ve a un lugar con mejor señal (cerca de una ventana o al aire libre)
  4. Si el problema persiste, el fichaje se guardará sin ubicación (pero puede requerir justificación)

**2. "No se pudo guardar el registro"**
- **Qué significa**: Hubo un error al guardar tu fichaje
- **Causas posibles**:
  - Problema de conexión a internet
  - El servidor está temporalmente no disponible
  - Error en el sistema
- **Qué hacer**:
  1. Verifica tu conexión a internet
  2. Espera unos segundos e intenta de nuevo
  3. Si el problema persiste, contacta al soporte técnico
  4. Toma nota de la hora exacta en que intentaste fichar

**3. "No se pueden registrar 2 Entradas consecutivas"**
- **Qué significa**: Intentaste fichar entrada dos veces seguidas sin fichar salida
- **Causas posibles**:
  - Olvidaste fichar la salida del fichaje anterior
  - Error al fichar (hiciste click dos veces)
  - El sistema detecta que ya tienes una entrada abierta
- **Qué hacer**:
  1. Ve al tab "Registros" y verifica tus fichajes
  2. Si tienes una entrada sin salida, edita o elimina el fichaje anterior
  3. Si realmente no fichaste salida, declara "No Punch" para el día anterior
  4. Contacta a tu supervisor si necesitas ayuda

**4. "No se pueden registrar 2 Salidas consecutivas"**
- **Qué significa**: Intentaste fichar salida dos veces seguidas sin fichar entrada
- **Causas posibles**:
  - Olvidaste fichar la entrada
  - Error al fichar (hiciste click dos veces)
  - El sistema detecta que no tienes una entrada abierta
- **Qué hacer**:
  1. Ve al tab "Registros" y verifica tus fichajes
  2. Si falta la entrada, edita el fichaje o declara "No Punch"
  3. Si fue un error, elimina el fichaje duplicado
  4. Contacta a tu supervisor si necesitas ayuda

**5. "No se pueden registrar 2 fichajes del mismo tipo consecutivos"**
- **Qué significa**: Intentaste fichar el mismo tipo (entrada o salida) dos veces seguidas
- **Qué hacer**: Similar a los errores anteriores, verifica tus registros y corrige el error

**6. "Registro creado correctamente" / "Registro actualizado correctamente"**
- **Qué significa**: Tu fichaje se guardó exitosamente
- **Qué hacer**: No necesitas hacer nada, el fichaje está registrado

**7. Advertencia de horario restringido**
- **Qué significa**: Intentas fichar fuera del horario permitido según tu horario asignado
- **Mensaje típico**: "No puedes fichar fuera de tu horario asignado"
- **Qué hacer**:
  1. Verifica tu horario en "Mi Horario"
  2. Si necesitas fichar fuera del horario, contacta a tu supervisor
  3. Puede que necesites solicitar una regularización después

**8. "Error de conexión al servidor"**
- **Qué significa**: No hay conexión con el servidor
- **Qué hacer**:
  1. Verifica tu conexión a internet
  2. Espera unos minutos e intenta de nuevo
  3. Si el problema persiste, contacta al soporte técnico

#### 2. Anunciar Baja Médica

**Botón "Anunciar Baja Médica"**:
- **Función**: Anuncia una baja médica
- **Cuándo usarlo**: Cuando tengas una baja médica y necesites comunicarla
- **Acción**: 
  1. Click en el botón
  2. Completa el formulario con los datos de la baja médica
  3. Sube el PDF del certificado médico (opcional)
  4. Envía la solicitud

**Formulario**:
- **Fecha baja** (obligatorio): Fecha de inicio de la baja
- **Fecha alta** (opcional): Fecha de fin de la baja
- **Días de baja** (opcional): Número de días
- **Upload PDF** (opcional): Sube el certificado médico
- **Botones**:
  - **💾 Guardar**: Guarda la solicitud
  - **❌ Cancelar**: Cancela

#### 3. Confirmar Jornada

**Botón "Confirmar Jornada"**:
- **Función**: Confirma una jornada completa de trabajo
- **Cuándo usarlo**: Al final del día para confirmar que has trabajado según el horario
- **Acción**: 
  1. Click en el botón
  2. Selecciona la fecha
  3. Confirma

#### 4. Tabs principales

##### Tab "Registros" (Por defecto)

**Contenido**: Lista de todos tus fichajes

**Columnas**:
- Fecha
- Hora entrada
- Hora salida
- Duración
- Estado (Confirmado/Pendiente)

**Acciones**:
- **✏️ Edit**: Edita un fichaje (solo si está pendiente)
- **🗑️ Delete**: Elimina un fichaje (solo si está pendiente)
- **🔄 Refresh**: Recarga la lista

**Filtros**:
- **Mes**: Selecciona el mes
- **Año**: Selecciona el año
- **Búsqueda**: Busca por fecha u hora

##### Tab "Horas Trabajadas"

**Contenido**: Estadísticas sobre horas trabajadas

**Información**:
- Horas trabajadas en el mes
- Comparación con horas programadas
- Alertas (exceso/déficit)

**Botones**:
- **Filtro período**: Selecciona mes/año
- **Export**: Descarga el informe

##### Tab "Horas Permitidas"

**Contenido**: Horas permitidas según tu horario

**Información**: 
- Horas programadas en el mes
- Días laborables
- Días festivos

##### Tab "Alertas"

**Contenido**: Días con problemas (exceso/déficit de horas)

**Colores**:
- **🟢 Verde**: Todo OK
- **🟡 Amarillo**: Atención (déficit pequeño)
- **🔴 Rojo**: Problema (exceso o déficit grande)

**Información mostrada**:
- Fecha
- Horas programadas
- Horas trabajadas
- Diferencia
- Tipo de alerta (exceso/déficit)

#### 5. Solicitar Regularización de Fichaje

**Nota importante**: Si olvidaste fichar, fichaste incorrectamente o hay una diferencia entre las horas que fichaste y las horas programadas, puedes solicitar una regularización. Esta funcionalidad está disponible en el tab "Registros".

##### Cuándo aparece el botón "🔄 Regularizar"

El botón "🔄 Regularizar" aparece automáticamente en el tab "Registros" cuando:
- Has fichado entrada y salida para un día
- Existe una diferencia entre las horas que fichaste y las horas programadas en tu horario
- Aún no has confirmado o regularizado ese día

**Ubicación del botón**:
- En la lista de registros, en cada día que necesita regularización
- Aparece como un botón azul pequeño con el texto "🔄 Regularizar"
- Solo aparece si hay una diferencia entre horas fichadas y horas programadas

##### Cómo solicitar una regularización

**Paso 1: Encuentra el día que necesitas regularizar**
1. Ve al tab "Registros"
2. Busca en la lista el día que tiene una diferencia de horas
3. El botón "🔄 Regularizar" aparecerá en ese día

**Paso 2: Click en el botón "🔄 Regularizar"**
- Haz click en el botón "🔄 Regularizar"
- Se abrirá automáticamente un modal de confirmación

##### Modal de Confirmación de Jornada

Cuando haces click en "🔄 Regularizar", se abre un modal llamado **"⚠️ Confirmar Jornada"**.

**Información mostrada en el modal**:

1. **Has fichado**: Muestra las horas totales que fichaste ese día (ejemplo: "8h 29m")
   - Aparece en color azul
   - Es la suma de todas las horas entre entrada y salida

2. **Horario previsto**: Muestra las horas que tenías programadas según tu horario (ejemplo: "8h")
   - Aparece en color verde
   - Es el horario asignado para ese día

3. **Diferencia**: Muestra la diferencia entre horas fichadas y horas programadas
   - Si fichaste MÁS horas: aparece con signo "+" y color naranja (ejemplo: "+29m")
   - Si fichaste MENOS horas: aparece con signo "-" y color rojo (ejemplo: "-22m")

##### Escenario 1: Has trabajado MÁS horas de las previstas (Diferencia positiva)

**Cuándo ocurre**: Has fichado más horas de las que tenías programadas (ejemplo: fichaste 8h 29m pero tenías programado 8h).

**Pregunta en el modal**: "¿Has trabajado más horas de las previstas?"

**Opciones disponibles**:

**Botón "No he trabajado más"** (Verde):
- **Qué significa**: Confirmas que NO trabajaste más horas de las programadas
- **Qué pasa**: El sistema registrará solo las horas programadas (ejemplo: 8h en lugar de 8h 29m)
- **Cuándo usarlo**: 
  - Si olvidaste fichar la salida a tiempo
  - Si hubo un error al fichar
  - Si realmente no trabajaste más horas
- **Resultado**: La jornada se confirma con las horas programadas, no con las horas fichadas

**Botón "He trabajado más"** (Naranja):
- **Qué significa**: Confirmas que SÍ trabajaste más horas de las programadas
- **Qué pasa**: El sistema enviará tu solicitud para revisión del supervisor
- **Cuándo usarlo**: 
  - Si realmente trabajaste horas extra
  - Si necesitas que se te paguen las horas adicionales
- **Resultado**: La solicitud se envía para aprobación. El supervisor revisará y decidirá si se aprueban las horas extra

##### Escenario 2: Has trabajado MENOS horas de las previstas (Diferencia negativa)

**Cuándo ocurre**: Has fichado menos horas de las que tenías programadas (ejemplo: fichaste 7h 38m pero tenías programado 8h).

**Pregunta en el modal**: "¿Has trabajado menos horas de las previstas?"

**Opciones disponibles**:

**Botón "Sí, he trabajado menos"** (Verde):
- **Qué significa**: Confirmas que SÍ trabajaste menos horas de las programadas
- **Qué pasa**: El sistema registrará las horas que realmente fichaste (ejemplo: 7h 38m)
- **Cuándo usarlo**: 
  - Si saliste antes de lo programado
  - Si realmente trabajaste menos horas ese día
  - Si tienes un permiso o salida autorizada
- **Resultado**: Se registran las horas reales fichadas. Puede afectar tu salario si no está justificado

**Botón "No, fue error de fichaje"** (Rojo):
- **Qué significa**: Confirmas que NO trabajaste menos horas, fue un error al fichar
- **Qué pasa**: El sistema registrará las horas programadas (ejemplo: 8h) en lugar de las horas fichadas
- **Cuándo usarlo**: 
  - Si olvidaste fichar la entrada o salida
  - Si fichaste incorrectamente
  - Si realmente trabajaste las horas programadas pero hubo un error al fichar
- **Resultado**: Se registran las horas programadas. El sistema asume que trabajaste el horario completo

##### Botones del modal

**Botones de acción** (dependiendo del escenario):
- **Botones de confirmación**: "No he trabajado más", "He trabajado más", "Sí, he trabajado menos", "No, fue error de fichaje"
  - Estos botones confirman tu elección
  - Una vez click, se procesa la solicitud
  - No se puede deshacer fácilmente

**Estado de carga**:
- Mientras se procesa, aparece el texto "Procesando..."
- Los botones se deshabilitan durante el procesamiento
- No cierres el modal hasta que termine

**Cerrar el modal**:
- Puedes cerrar el modal haciendo click fuera de él o en la X
- Si cierras sin confirmar, la regularización no se procesa
- Puedes volver a intentar más tarde

##### Qué pasa después de confirmar

**Si elegiste "No he trabajado más" o "No, fue error de fichaje"**:
- ✅ La jornada se confirma inmediatamente
- ✅ Se registran las horas programadas
- ✅ Aparece un mensaje: "Jornada confirmada correctamente"
- ✅ No necesita aprobación del supervisor

**Si elegiste "He trabajado más" o "Sí, he trabajado menos"**:
- ⏳ La solicitud se envía para revisión
- ⏳ Aparece un mensaje: "Jornada enviada para revisión"
- ⏳ Tu supervisor o manager revisará la solicitud
- ⏳ Recibirás una notificación cuando se apruebe o rechace
- ⏳ Puedes ver el estado en la página de "Solicitudes"

##### Casos especiales

**Si no hay horario previsto para ese día**:
- El botón "🔄 Regularizar" NO aparecerá
- Aparecerá un mensaje: "No se puede regularizar - No hay horario previsto para este día"
- Esto significa que ese día no tenías horario asignado
- **Qué hacer**: Si crees que deberías tener horario, contacta a tu supervisor

**Si ya existe una regularización para ese día**:
- El botón "🔄 Regularizar" NO aparecerá
- Ya existe una solicitud de regularización pendiente o aprobada
- **Qué hacer**: Ve a "Solicitudes" para ver el estado de la regularización

**Si el fichaje está completo y correcto**:
- El botón "🔄 Regularizar" NO aparecerá
- No hay necesidad de regularización

##### Errores y advertencias en regularización

**1. "No se puede regularizar - No hay horario previsto para este día"**
- **Qué significa**: Ese día no tenías horario asignado en el sistema
- **Causas posibles**:
  - Ese día era festivo o no laborable
  - No tenías horario asignado para ese día específico
  - El horario aún no se ha generado para ese mes
- **Qué hacer**:
  1. Verifica en "Mi Horario" si ese día tiene horario asignado
  2. Si deberías tener horario, contacta a tu supervisor
  3. Si era un día no laborable, no necesitas regularizar

**2. "No se pudo verificar la diferencia. Intenta de nuevo."**
- **Qué significa**: Hubo un error al verificar las horas fichadas vs programadas
- **Causas posibles**:
  - Problema de conexión
  - Error temporal del servidor
  - Datos inconsistentes
- **Qué hacer**:
  1. Espera unos segundos e intenta de nuevo
  2. Recarga la página (F5)
  3. Si el problema persiste, contacta al soporte técnico

**3. "Error al solicitar regularización. Intenta de nuevo."**
- **Qué significa**: Hubo un error al enviar tu solicitud de regularización
- **Causas posibles**:
  - Problema de conexión
  - Error del servidor
  - La solicitud ya existe
- **Qué hacer**:
  1. Verifica tu conexión a internet
  2. Espera unos segundos e intenta de nuevo
  3. Verifica en "Solicitudes" si la solicitud ya se creó
  4. Si el problema persiste, contacta al soporte técnico

**4. "Regularización solicitada" (éxito)**
- **Qué significa**: Tu solicitud de regularización se envió correctamente
- **Qué pasa después**: 
  - Si elegiste "No he trabajado más" o "No, fue error de fichaje": Se confirma inmediatamente
  - Si elegiste "He trabajado más" o "Sí, he trabajado menos": Se envía para revisión del supervisor
- **Qué hacer**: Espera la notificación de aprobación o revisa en "Solicitudes"

**5. "Jornada confirmada correctamente"**
- **Qué significa**: La jornada se confirmó y regularizó exitosamente
- **Qué hacer**: No necesitas hacer nada más, la jornada está registrada correctamente

**6. "Jornada enviada para revisión"**
- **Qué significa**: Tu solicitud de regularización se envió y está pendiente de aprobación
- **Qué hacer**: 
  1. Espera la notificación cuando se apruebe o rechace
  2. Puedes ver el estado en "Solicitudes"
  3. El supervisor revisará tu caso

#### 6. Declarar "No Punch" (No fichado)

**Qué es**: Si no fichaste en un día específico (ni entrada ni salida), puedes declarar el motivo.

##### Cuándo usar esta funcionalidad

**Situaciones comunes**:
- Olvidaste fichar entrada y salida en un día
- No fuiste a trabajar (ausencia injustificada)
- Hubo un problema técnico y no pudiste fichar
- Cualquier otra situación donde no hay fichajes registrados

##### Cómo declarar "No Punch"

**Paso 1: Acceder a la funcionalidad**
- Esta opción está disponible en diferentes lugares según el contexto:
  - En el tab "Registros" si hay días sin fichajes
  - En el calendario de "Mi Horario" si hay días marcados como sin fichajes
  - En otras secciones donde se detecten días sin fichajes

**Paso 2: Click en "Declarar No Punch" o similar**
- Busca el día que no tiene fichajes
- Haz click en el botón o enlace para declarar el motivo

##### Modal "📝 Indicar motivo (Sin fichajes)"

Cuando haces click, se abre un modal llamado **"📝 Indicar motivo (Sin fichajes)"**.

**Información mostrada en el modal**:

1. **Fecha**: Muestra la fecha del día sin fichajes
   - Aparece en un recuadro amarillo
   - Formato: DD/MM/YYYY (ejemplo: "15/01/2026")

2. **Horario previsto** (si aplica): Muestra las horas que tenías programadas
   - Aparece si hay un horario asignado para ese día
   - Ejemplo: "8h"

3. **Mensaje informativo**: 
   - "No se encontraron fichajes para esta fecha. Por favor, indica el motivo."
   - Aparece en color amarillo para indicar que requiere atención

##### Motivos disponibles (obligatorio elegir uno)

Debes seleccionar UN motivo de los siguientes:

**1. "Olvidé fichar"** (OLVIDO_FICHAR):
- **Qué significa**: Olvidaste fichar entrada y/o salida
- **Cuándo usarlo**: 
  - Si realmente trabajaste pero olvidaste fichar
  - Si hubo un descuido
- **Qué pasa**: Se requiere revisión del supervisor
- **Resultado**: El supervisor revisará y decidirá si se te pagan las horas o no

**2. "Ausencia injustificada"** (AUSENCIA_INJUSTIFICADA):
- **Qué significa**: No fuiste a trabajar y no está justificado
- **Cuándo usarlo**: 
  - Si no fuiste a trabajar sin permiso
  - Si no tienes una baja médica o permiso
- **Qué pasa**: Se requiere revisión del supervisor
- **Resultado**: Puede afectar tu salario y puede haber consecuencias según la política de la empresa

**3. "Otro"** (OTRO):
- **Qué significa**: Tienes otro motivo que no está en la lista
- **Cuándo usarlo**: 
  - Si el motivo no es "olvidé fichar" ni "ausencia injustificada"
  - Si tienes una situación especial
- **Qué pasa**: Se requiere revisión del supervisor
- **Resultado**: El supervisor revisará tu caso específico

**Cómo seleccionar un motivo**:
- Haz click en el círculo (radio button) al lado del motivo que corresponde
- El motivo seleccionado se marca con un borde azul y fondo azul claro
- Solo puedes seleccionar UN motivo a la vez

##### Campo "Notas" (opcional)

**Qué es**: Un campo de texto donde puedes añadir información adicional.

**Cuándo usarlo**:
- Si necesitas explicar más detalles sobre el motivo
- Si quieres añadir información que ayude al supervisor a entender la situación
- Si el motivo "Otro" necesita más explicación

**Ejemplos de notas útiles**:
- "Olvidé fichar porque estaba en una reunión urgente"
- "Problema técnico con la aplicación móvil"
- "Tuve que salir por emergencia familiar"
- "El supervisor me autorizó verbalmente"

**Límites**:
- Puedes escribir tanto texto como necesites
- El campo es opcional, pero se recomienda usarlo para dar más contexto

##### Botones del modal

**Botón "Cancelar"** (Gris):
- **Función**: Cierra el modal sin guardar
- **Cuándo usarlo**: Si cambiaste de opinión o quieres hacerlo más tarde
- **Qué pasa**: No se guarda nada, puedes volver a intentar más tarde

**Botón "Guardar"** (Azul/Primario):
- **Función**: Guarda el motivo declarado
- **Cuándo usarlo**: Cuando hayas seleccionado un motivo y estés listo para enviar
- **Estado**: 
  - Está deshabilitado (gris) si no has seleccionado un motivo
  - Se habilita (azul) cuando seleccionas un motivo
  - Muestra "Guardando..." mientras se procesa
- **Qué pasa al hacer click**:
  1. Se envía la información al sistema
  2. Aparece un mensaje de confirmación: "Motivo registrado correctamente. La regularización será revisada por el supervisor."
  3. El modal se cierra automáticamente
  4. El supervisor recibirá una notificación para revisar tu caso

##### Advertencia importante

**Mensaje de advertencia**:
- Cuando seleccionas cualquier motivo, aparece un recuadro amarillo con el texto:
  - "⚠️ Este motivo requiere revisión del supervisor."
- Esto significa que TODOS los motivos requieren aprobación
- No se procesa automáticamente, siempre necesita revisión

##### Qué pasa después de guardar

**Inmediatamente**:
- ✅ Recibes un mensaje de confirmación
- ✅ El motivo queda registrado en el sistema
- ✅ El modal se cierra

**Proceso de revisión**:
- ⏳ Tu supervisor o manager recibe una notificación
- ⏳ Revisará tu caso y el motivo declarado
- ⏳ Decidirá si se aprueba o rechaza
- ⏳ Puede contactarte si necesita más información

**Resultado final**:
- Si se aprueba: Las horas se registrarán según la decisión del supervisor
- Si se rechaza: Puede haber consecuencias según el motivo y la política de la empresa
- Recibirás una notificación cuando se tome una decisión

##### Errores y advertencias en "No Punch"

**1. "No se encontraron fichajes para esta fecha"**
- **Qué significa**: El sistema confirma que no hay fichajes registrados para ese día
- **Qué hacer**: Procede a declarar el motivo usando el modal

**2. "Motivo registrado correctamente. La regularización será revisada por el supervisor."**
- **Qué significa**: Tu declaración de "No Punch" se guardó exitosamente
- **Qué pasa después**: El supervisor recibirá una notificación y revisará tu caso
- **Qué hacer**: Espera la notificación de revisión

**3. "Error al guardar el motivo"**
- **Qué significa**: Hubo un error al guardar tu declaración
- **Causas posibles**:
  - Problema de conexión
  - Error del servidor
  - El motivo ya fue declarado anteriormente
- **Qué hacer**:
  1. Verifica tu conexión a internet
  2. Espera unos segundos e intenta de nuevo
  3. Verifica si ya declaraste el motivo anteriormente
  4. Si el problema persiste, contacta al soporte técnico

**4. "Debes seleccionar un motivo"**
- **Qué significa**: No has seleccionado ningún motivo antes de intentar guardar
- **Qué hacer**: Selecciona uno de los motivos disponibles (Olvidé fichar, Ausencia injustificada, u Otro)

**5. Advertencia: "Este motivo requiere revisión del supervisor"**
- **Qué significa**: Todos los motivos de "No Punch" requieren aprobación del supervisor
- **Qué hacer**: Asegúrate de ser honesto y añadir notas explicativas para ayudar al supervisor a entender la situación

##### Consejos importantes

1. **Sé honesto**: Declara el motivo real, no inventes excusas
2. **Añade notas**: Usa el campo de notas para dar más contexto
3. **Declara rápido**: No esperes mucho tiempo, declara el motivo lo antes posible
4. **Revisa antes de enviar**: Asegúrate de haber seleccionado el motivo correcto
5. **Contacta al supervisor**: Si es urgente, contacta directamente a tu supervisor además de declarar el motivo

---

## Solicitudes

### Acceso

- **Ruta**: `/solicitudes`
- **Desde Dashboard**: Click en "Solicitudes" del Quick Access Orb
- **Desde navegación**: Click en el icono de clipboard del menú

### Tabs principales

#### Tab "Vacaciones"

**Contenido**: Solicitudes de vacaciones

**Botones**:
- **➕ Nueva Solicitud**: Crea una nueva solicitud de vacaciones
- **📋 Lista**: Ve todas tus solicitudes

**Información mostrada**:
- Fecha inicio
- Fecha fin
- Días solicitados
- Estado (Pendiente/Aprobada/Rechazada)
- Saldo disponible

**Formulario "Nueva Solicitud de Vacaciones"**:
- **Campos**:
  - Fecha inicio (obligatorio): Fecha de inicio de vacaciones
  - Fecha fin (obligatorio): Fecha de fin de vacaciones
  - Motivo (opcional): Razón de la solicitud
- **Botones**:
  - **💾 Guardar**: Guarda la solicitud
  - **❌ Cancelar**: Cancela

**Validación**:
- Las fechas deben ser válidas
- La fecha fin debe ser posterior a la fecha inicio
- No puedes solicitar más días de los disponibles

##### Errores y advertencias en Solicitudes

**1. "Las fechas deben ser válidas"**
- **Qué significa**: Las fechas que ingresaste no son válidas o están en formato incorrecto
- **Qué hacer**: 
  1. Verifica que las fechas estén en formato correcto (DD/MM/YYYY)
  2. Asegúrate de seleccionar fechas futuras (no puedes solicitar vacaciones en el pasado)
  3. Verifica que no haya errores de escritura

**2. "La fecha fin debe ser posterior a la fecha inicio"**
- **Qué significa**: La fecha de fin es anterior o igual a la fecha de inicio
- **Qué hacer**: Selecciona una fecha de fin que sea posterior a la fecha de inicio

**3. "No puedes solicitar más días de los disponibles"**
- **Qué significa**: Estás intentando solicitar más días de vacaciones de los que tienes disponibles
- **Qué hacer**: 
  1. Verifica tu saldo de vacaciones disponible
  2. Reduce el número de días solicitados
  3. Si necesitas más días, contacta a tu supervisor

**4. "Error al crear la solicitud"**
- **Qué significa**: Hubo un error al guardar tu solicitud
- **Causas posibles**:
  - Problema de conexión
  - Error del servidor
  - Datos inválidos
- **Qué hacer**:
  1. Verifica tu conexión a internet
  2. Verifica que todos los campos estén completos y correctos
  3. Espera unos segundos e intenta de nuevo
  4. Si el problema persiste, contacta al soporte técnico

**5. "Solicitud creada correctamente" (éxito)**
- **Qué significa**: Tu solicitud se guardó exitosamente
- **Qué pasa después**: La solicitud se envía para aprobación del supervisor
- **Qué hacer**: Puedes ver el estado de tu solicitud en la lista de solicitudes

**6. "Solicitud actualizada correctamente" (éxito)**
- **Qué significa**: Los cambios en tu solicitud se guardaron exitosamente
- **Qué hacer**: La solicitud se actualiza y se reenvía para aprobación si es necesario

**7. "No se pudo eliminar la solicitud"**
- **Qué significa**: Hubo un error al intentar eliminar la solicitud
- **Causas posibles**:
  - La solicitud ya fue aprobada o rechazada (no se puede eliminar)
  - Problema de conexión
  - Error del servidor
- **Qué hacer**:
  1. Verifica el estado de la solicitud (si está aprobada/rechazada, no se puede eliminar)
  2. Si está pendiente, intenta de nuevo
  3. Si el problema persiste, contacta al soporte técnico

**8. "Error al subir el archivo" (para bajas médicas)**
- **Qué significa**: Hubo un error al subir el PDF del certificado médico
- **Causas posibles**:
  - El archivo es muy grande (máximo 5-10 MB)
  - El formato no es válido (debe ser PDF)
  - Problema de conexión
- **Qué hacer**:
  1. Verifica que el archivo sea PDF y no exceda el tamaño máximo
  2. Intenta comprimir el PDF si es muy grande
  3. Verifica tu conexión a internet
  4. Intenta de nuevo

**9. "Endpoint para subir bajas médicas no está configurado"**
- **Qué significa**: La funcionalidad de subir PDFs no está disponible temporalmente
- **Qué hacer**: 
  1. Guarda la solicitud sin el PDF
  2. Contacta a tu supervisor para enviarle el PDF por otro medio
  3. Contacta al soporte técnico si el problema persiste

**10. Mensajes de éxito en Solicitudes**
- **"Justificante cargado correctamente"**: El archivo se subió exitosamente
- **"Baja médica creada correctamente"**: La baja médica se registró exitosamente
- **"Situación actualizada correctamente"**: Los cambios se guardaron exitosamente

#### Tab "Asuntos Propios"

**Contenido**: Solicitudes de "asuntos propios" (asuntos personales)

**Funcionalidad**: Similar a Vacaciones

**Formulario**:
- Fecha inicio (obligatorio)
- Fecha fin (obligatorio)
- Motivo (opcional)

#### Tab "Permisos"

**Contenido**: Solicitudes de permisos

**Tipos de permisos**:
- Permiso Retribuido
- Permiso Recuperable
- Permiso No Retribuido
- Permiso médico
- Permiso sin sueldo

**Formulario**:
- Tipo (obligatorio): Selecciona el tipo de permiso
- Fecha inicio (obligatorio)
- Fecha fin (obligatorio)
- Motivo (opcional)
- Horas (si aplica): Para permisos por horas

#### Tab "Ausencias"

**Contenido**: Ausencias registradas

**Acciones**:
- **➕ Nueva Ausencia**: Añade una ausencia
- **✏️ Edit**: Edita una ausencia
- **🗑️ Delete**: Elimina una ausencia

**Formulario**:
- Tipo (obligatorio): Tipo de ausencia
- Fecha inicio (obligatorio)
- Fecha fin (obligatorio)
- Motivo (opcional)

#### Tab "Baja"

**Contenido**: Bajas médicas

**Acciones**:
- **➕ Anunciar Baja Médica**: Anuncia una baja médica
- **📤 Upload PDF**: Sube el documento de baja médica
- **📋 Lista**: Ve todas tus bajas médicas

**Formulario "Anunciar Baja Médica"**:
- **Campos**:
  - Fecha baja (obligatorio): Fecha de inicio
  - Fecha alta (opcional): Fecha de fin
  - Días de baja (opcional): Número de días
  - Upload PDF (opcional): Sube el certificado médico
- **Botones**:
  - **💾 Guardar**: Guarda
  - **❌ Cancelar**: Cancela

### Filtros

**Filtro mes**:
- **Dropdown**: Selecciona el mes
- **Opción "Todas las meses"**: Ve todos los meses

**Búsqueda**:
- **Campo texto**: Busca por tipo, fecha o estado

### Indicadores visuales

**Badges de estado**:
- **🟡 Pendiente**: Solicitud en espera
- **🟢 Aprobada**: Solicitud aprobada
- **🔴 Rechazada**: Solicitud rechazada

---

## Documentos

### Acceso

- **Ruta**: `/documentos`
- **Desde Dashboard**: Click en "Documentos" del Quick Access Orb
- **Desde navegación**: Click en el icono de documento del menú

### Tabs principales

#### Tab "Nóminas"

**Contenido**: Todas tus nóminas

**Lista de nóminas**:
- **Columnas**:
  - Mes (Mes)
  - Año (Año)
  - Archivo (Nombre del archivo)
  - Fecha subida (Fecha de carga)
  - Estado (Disponible/Pendiente)
- **Acciones**:
  - **👁️ Preview**: Ve la nómina en el navegador
  - **⬇️ Descargar**: Descarga el PDF
  - **📧 Enviar por Email**: Envía la nómina por email

**Filtros**:
- **Mes**: Selecciona el mes
- **Año**: Selecciona el año
- **Búsqueda**: Busca por nombre de archivo

#### Tab "Mis Documentos"

**Contenido**: Tus documentos personales

**Lista de documentos**:
- **Columnas**:
  - Tipo (Tipo de documento)
  - Archivo (Nombre del archivo)
  - Fecha subida (Fecha de carga)
  - Estado (Firmado/Pendiente)
- **Acciones**:
  - **👁️ Ver**: Ve el documento
  - **⬇️ Descargar**: Descarga el documento
  - **✏️ Editar**: Edita el documento
  - **🗑️ Eliminar**: Elimina el documento

**Botón "➕ Subir Documento"**:
- **Función**: Sube un documento nuevo
- **Acción**:
  1. Click en el botón
  2. Selecciona el tipo de documento:
     - Contrato
     - Certificado Médico
     - DNI/NIE
     - Certificado Handicap
     - Otro (personalizado)
  3. Selecciona el archivo (PDF, JPG, PNG)
  4. Click en "Subir"

**Tipos de documentos disponibles**:
- Contrato
- Certificado Médico
- DNI/NIE
- Certificado Handicap
- Certificado de Antigüedad
- Certificado de Salario
- Certificado de Trabajo
- Otro (puedes introducir un tipo personalizado)

#### Tab "Documentos Oficiales"

**Contenido**: Documentos oficiales (Alta SS, etc.)

**Lista de documentos**:
- Similar a "Mis Documentos"
- Documentos oficiales cargados por administración

**Acciones**:
- **👁️ Ver**: Ve el documento
- **⬇️ Descargar**: Descarga el documento
- **✍️ Firmar**: Firma el documento (si es necesario)

#### Tab "Documentos Solicitados"

**Contenido**: Documentos solicitados por ti o por administración

**Lista de solicitudes**:
- **Columnas**:
  - Tipo (Tipo de documento)
  - Solicitado por (Quién lo solicitó)
  - Fecha solicitud (Fecha de solicitud)
  - Estado (Pendiente/Completado)
- **Acciones**:
  - **✅ Marcar como Completado**: Marca como completado
  - **👁️ Ver detalles**: Ve detalles

**Botón "➕ Nueva Solicitud"**:
- **Función**: Solicita un documento nuevo
- **Acción**:
  1. Click en el botón
  2. Selecciona el tipo de documento
  3. Añade observaciones (opcional)
  4. Envía la solicitud

### Funciones especiales

#### Firma digital (AutoFirma)

**Cuándo aparece**: Cuando un documento necesita firma

**Cómo funciona**:
1. Click en "✍️ Firmar"
2. Se abre el modal de firma
3. Opciones:
   - **AutoFirma**: Firma con AutoFirma (si está instalado)
   - **Firma manual**: Dibuja tu firma en la pantalla
4. Confirma la firma
5. El documento se guarda con la firma

#### Preview de documentos

**Cómo funciona**:
1. Click en "👁️ Preview" o "👁️ Ver"
2. Se abre un modal con el documento
3. Opciones:
   - Zoom in/out
   - Navegación de páginas (para PDF)
   - Descarga directa

##### Errores y advertencias en Documentos

**1. "Error al subir el documento"**
- **Qué significa**: Hubo un error al subir tu documento
- **Causas posibles**:
  - El archivo es muy grande (máximo 5-10 MB según el tipo)
  - El formato no es válido (debe ser PDF, JPG o PNG)
  - Problema de conexión
  - El archivo está corrupto
- **Qué hacer**:
  1. Verifica que el archivo sea PDF, JPG o PNG
  2. Verifica que el tamaño no exceda el límite
  3. Intenta comprimir el archivo si es muy grande
  4. Verifica que el archivo no esté corrupto (ábrelo en otro programa)
  5. Verifica tu conexión a internet
  6. Intenta de nuevo

**2. "Documento subido correctamente" (éxito)**
- **Qué significa**: Tu documento se subió exitosamente
- **Qué hacer**: El documento debería aparecer en la lista en unos segundos

**3. "Error al descargar el documento"**
- **Qué significa**: Hubo un error al intentar descargar el documento
- **Causas posibles**:
  - Problema de conexión
  - El archivo no existe o fue eliminado
  - Problema del navegador
- **Qué hacer**:
  1. Verifica tu conexión a internet
  2. Intenta desde otro navegador
  3. Verifica que no tengas bloqueadores de descarga activos
  4. Intenta de nuevo después de unos segundos

**4. "Error al ver el documento"**
- **Qué significa**: No se puede abrir el preview del documento
- **Causas posibles**:
  - El archivo está corrupto
  - El formato no es compatible con el visor
  - Problema de conexión
- **Qué hacer**:
  1. Intenta descargar el documento en lugar de verlo
  2. Verifica tu conexión a internet
  3. Intenta desde otro navegador
  4. Si el problema persiste, contacta al soporte técnico

**5. "Error al enviar por email"**
- **Qué significa**: Hubo un error al enviar el documento por email
- **Causas posibles**:
  - El email no está configurado correctamente
  - Problema del servidor de email
  - Problema de conexión
- **Qué hacer**:
  1. Verifica tu conexión a internet
  2. Intenta descargar el documento manualmente y enviarlo por email
  3. Intenta de nuevo después de unos segundos
  4. Si el problema persiste, contacta al soporte técnico

**6. "Correo enviado con éxito" (éxito)**
- **Qué significa**: El documento se envió exitosamente a tu email
- **Qué hacer**: Revisa tu bandeja de entrada (y spam si no lo encuentras)

**7. "Error al firmar el documento"**
- **Qué significa**: Hubo un error al intentar firmar el documento
- **Causas posibles**:
  - AutoFirma no está instalado o configurado correctamente
  - Problema con la firma manual
  - Problema de conexión
- **Qué hacer**:
  1. Si usas AutoFirma, verifica que esté instalado y actualizado
  2. Si usas firma manual, intenta dibujar la firma de nuevo
  3. Verifica tu conexión a internet
  4. Intenta de nuevo

**8. "Documento firmado correctamente" (éxito)**
- **Qué significa**: El documento se firmó exitosamente
- **Qué hacer**: El documento debería aparecer como "Firmado" en la lista

**9. "No se puede eliminar el documento"**
- **Qué significa**: Hubo un error al intentar eliminar el documento
- **Causas posibles**:
  - El documento está firmado o bloqueado (no se puede eliminar)
  - Problema de conexión
  - Error del servidor
- **Qué hacer**:
  1. Verifica si el documento está firmado o bloqueado
  2. Verifica tu conexión a internet
  3. Intenta de nuevo
  4. Si el problema persiste, contacta al soporte técnico

**10. "Nómina no disponible"**
- **Qué significa**: La nómina que intentas ver aún no está disponible
- **Qué hacer**: 
  1. Espera unos días, las nóminas se suben después de procesarse
  2. Contacta a tu supervisor si crees que debería estar disponible
  3. Verifica que estés buscando en el mes y año correctos

---

## Mi Horario

### Acceso

- **Ruta**: `/cuadrantes-empleado`
- **Desde Dashboard**: Click en "Mi horario" del Quick Access Orb
- **Desde navegación**: Click en el icono de calendario del menú

### Funcionalidades

#### 1. Vista de calendario

**Vista mensual**:
- **Calendario**: Ve tu horario del mes actual
- **Navegación**: 
  - **← Mes anterior**: Ve el mes anterior
  - **→ Mes siguiente**: Ve el mes siguiente
  - **Hoy**: Vuelve al mes actual

**Información mostrada**:
- Días laborables
- Días festivos
- Horas de entrada
- Horas de salida
- Duración de la jornada

#### 2. Detalles del día

**Click en un día**:
- **Modal con detalles**:
  - Fecha
  - Hora entrada
  - Hora salida
  - Duración
  - Tipo de día (Laborable/Festivo)
  - Observaciones (si las hay)

#### 3. Filtros

**Filtro mes**:
- **Dropdown**: Selecciona el mes
- **Opción "Mes actual"**: Ve el mes actual

**Filtro año**:
- **Dropdown**: Selecciona el año
- **Opción "Año actual"**: Ve el año actual

#### 4. Exportar horario

**Botón "📄 Exportar PDF"**:
- **Función**: Descarga tu horario en PDF
- **Acción**: Click → Se descarga el PDF

**Botón "📊 Exportar Excel"**:
- **Función**: Descarga tu horario en Excel
- **Acción**: Click → Se descarga el Excel

---

## Mis Inspecciones

### Acceso

- **Ruta**: `/mis-inspecciones`
- **Desde Dashboard**: Click en "Mis inspecciones" del Quick Access Orb
- **Desde navegación**: Click en el icono de clipboard-check del menú

### Funcionalidades

#### 1. Lista de inspecciones

**Card-uras de inspecciones**:
- **Título**: Título de la inspección
- **Fecha**: Fecha de la inspección
- **Estado**: Pendiente/Completada
- **Centro**: Centro de trabajo
- **Acciones**:
  - **👁️ Ver detalles**: Ve detalles
  - **✏️ Completar**: Completa la inspección

#### 2. Completar inspección

**Formulario**:
- **Campos** (según el tipo de inspección):
  - Observaciones
  - Fotos (subir)
  - Checklist items
  - Firma (opcional)
- **Botones**:
  - **💾 Guardar**: Guarda el progreso
  - **✅ Completar**: Finaliza la inspección
  - **❌ Cancelar**: Cancela

#### 3. Filtros

**Filtro estado**:
- **Dropdown**: Pendiente/Completada/Todas

**Filtro fecha**:
- **Desde**: Fecha de inicio
- **Hasta**: Fecha de fin

**Búsqueda**:
- **Campo texto**: Busca por título o centro

---

## Comunicados

### Acceso

- **Ruta**: `/comunicados`
- **Disponibilidad**: Para todos los usuarios
- **Desde Dashboard**: Click en "Comunicados" del Quick Access Orb
- **Badge**: Número de comunicados no leídos (si existe)

### Funcionalidades principales

#### 1. Lista de comunicados

**Card-uras de comunicados**:
- **Título**: Título del comunicado
- **Preview**: Primeras líneas del contenido
- **Fecha**: Fecha de publicación
- **Autor**: Quién creó el comunicado
- **Badge "Nuevo"**: Si no está leído
- **Acciones**:
  - **👁️ Leer más**: Ve el comunicado completo
  - **✅ Marcar como leído**: Marca como leído

**Filtros**:
- **Todos**: Todos los comunicados
- **No leídos**: Solo no leídos
- **Leídos**: Solo leídos

**Búsqueda**:
- **Campo texto**: Busca por título o contenido

#### 2. Ver comunicado

**Cuándo aparece**: Click en "👁️ Leer más"

**Contenido**:
- **Título**: Título completo
- **Contenido**: Contenido completo (formateado)
- **Fecha publicación**: Fecha de publicación
- **Autor**: Quién lo creó
- **Adjuntos**: Archivos adjuntos (si existen)
- **Acciones**:
  - **⬇️ Descargar adjuntos**: Descarga los archivos
  - **✅ Marcar como leído**: Marca como leído
  - **← Volver**: Vuelve a la lista

#### 3. Marcar como leído

**Cómo funciona**:
- Click en "✅ Marcar como leído"
- El comunicado se marca como leído
- El badge "Nuevo" desaparece
- El contador de comunicados no leídos se actualiza

#### 4. Descargar adjuntos

**Cómo funciona**:
- Click en "⬇️ Descargar adjuntos"
- Se descargan todos los archivos adjuntos
- Si hay múltiples archivos, se descargan como archivo ZIP

---

## Pedidos

### Acceso

- **Ruta**: `/empleado-pedidos`
- **Disponibilidad**: Solo si tienes permiso para crear pedidos
- **Desde Dashboard**: Click en "Pedidos" del Quick Access Orb

### Funcionalidades

#### 1. Crear pedido nuevo

**Botón "➕ Nuevo Pedido"**:
- **Función**: Abre el formulario de creación

**Formulario**:
- **Campos**:
  - **Producto** (obligatorio): Selecciona del catálogo
  - **Cantidad** (obligatorio): Cantidad
  - **Observaciones** (opcional)
- **Botones**:
  - **💾 Guardar**: Guarda el pedido
  - **❌ Cancelar**: Cancela

#### 2. Lista de pedidos

**Card-uras de pedidos**:
- **Producto**: Nombre del producto
- **Cantidad**: Cantidad
- **Fecha**: Fecha de solicitud
- **Estado**: Pendiente/Aprobado/Rechazado
- **Acciones**:
  - **👁️ Ver detalles**: Ve detalles
  - **✏️ Editar**: Edita (si está pendiente)
  - **🗑️ Eliminar**: Elimina (si está pendiente)

#### 3. Filtros

**Filtro estado**:
- **Dropdown**: Pendiente/Aprobado/Rechazado/Todos

**Filtro fecha**:
- **Desde**: Fecha de inicio
- **Hasta**: Fecha de fin

**Búsqueda**:
- **Campo texto**: Busca por producto o número de pedido

---

## Salón de la Fama

### Acceso

- **Ruta**: `/hall-of-fame`
- **Disponibilidad**: Para todos los usuarios
- **Desde Dashboard**: Click en "Salón de la Fama" del Quick Access Orb

### Funcionalidades

#### 1. Clasificación mensual

**Lista de empleados**:
- **Columnas**:
  - Posición (Posición)
  - Nombre
  - Puntos (Puntos)
  - Badges (Insignias)
- **Ordenación**: Por puntos (descendente)

#### 2. Detalles de empleado

**Click en un empleado**:
- **Contenido**:
  - Puntos totales
  - Badges ganados
  - Historial de rendimiento
  - Gráfico de evolución

#### 3. Badges disponibles

**Lista de badges**:
- **Tipos**:
  - ⭐ Puntualidad (Puntualidad)
  - 💪 Esfuerzo (Esfuerzo)
  - 🎯 Objetivos (Objetivos)
  - 🤝 Colaboración (Colaboración)
- **Cómo se ganan**: Automáticamente según rendimiento

---

## Funciones Generales

### Notificaciones

**Cómo funciona**:
- **Icono 🔔**: En el header (escritorio) o menú (móvil)
- **Badge**: Número de notificaciones no leídas
- **Click**: Abre la lista de notificaciones
- **Acciones**:
  - **👁️ Marcar como leída**: Marca como leída
  - **🗑️ Eliminar**: Elimina la notificación
  - **🔗 Ir a**: Ve a la página asociada

### Tema (Modo Oscuro/Claro)

**Botón toggle**:
- **Ubicación**: En el header (junto a notificaciones)
- **Función**: Cambia entre modo oscuro y claro
- **Preferencia**: Se guarda automáticamente

### Cerrar Sesión

**Botón "Salir"**:
- **Ubicación**: En el header (escritorio) o menú (móvil)
- **Función**: Cierra la sesión del usuario
- **Confirmación**: No (se cierra inmediatamente)

### Búsqueda global

**Campo búsqueda** (si está disponible):
- **Función**: Busca en toda la aplicación
- **Resultados**: Páginas, empleados, documentos, etc.

---

## Consejos y Trucos

### Navegación rápida

1. **Quick Access Orb**: Usa el círculo del Dashboard para acceso rápido
2. **Atajos de teclado**: 
   - `Ctrl/Cmd + K`: Búsqueda global (si está disponible)
   - `Esc`: Cierra modales

### Gestión eficiente

1. **Filtros**: Usa los filtros para encontrar información rápidamente
2. **Export**: Exporta datos cuando necesites backup
3. **Notificaciones**: Activa las notificaciones push para estar al día

### Seguridad

1. **Contraseña**: Usa una contraseña fuerte
2. **Cerrar sesión**: Cierra sesión cuando termines
3. **Dispositivo**: No compartas tu dispositivo con otros

---

## Resolución de Problemas Comunes

### Problemas de conexión

**Síntoma**: No puedes cargar páginas, los botones no responden, aparecen errores de conexión

**Soluciones**:
1. Verifica tu conexión a internet (abre otra página web)
2. Recarga la página (F5 o botón de recargar)
3. Cierra y vuelve a abrir el navegador
4. Limpia la caché del navegador (Ctrl+Shift+Delete)
5. Si usas WiFi, intenta conectarte a otra red
6. Si el problema persiste, contacta al soporte técnico

### Problemas al fichar

**Síntoma**: No puedes fichar, aparece error de ubicación, el botón no funciona

**Soluciones**:
1. **Error de ubicación**:
   - Acepta el permiso de ubicación cuando el navegador lo solicite
   - Activa el GPS en tu dispositivo
   - Ve a un lugar con mejor señal GPS
   - Si el problema persiste, el fichaje se guardará sin ubicación

2. **Botón no responde**:
   - Espera unos segundos (puede estar procesando)
   - Recarga la página
   - Verifica tu conexión a internet
   - Intenta desde otro dispositivo si es posible

3. **Error "2 fichajes consecutivos"**:
   - Ve al tab "Registros" y verifica tus fichajes anteriores
   - Si tienes una entrada sin salida, edita o elimina el fichaje anterior
   - Si olvidaste fichar, declara "No Punch"

### Problemas con solicitudes

**Síntoma**: No puedes crear solicitudes, aparecen errores de validación

**Soluciones**:
1. **Fechas inválidas**:
   - Verifica que las fechas estén en formato correcto
   - Asegúrate de que la fecha fin sea posterior a la fecha inicio
   - No uses fechas pasadas

2. **Más días de los disponibles**:
   - Verifica tu saldo de vacaciones disponible
   - Reduce el número de días solicitados
   - Contacta a tu supervisor si necesitas más días

3. **Error al guardar**:
   - Verifica que todos los campos obligatorios estén completos
   - Verifica tu conexión a internet
   - Intenta de nuevo después de unos segundos

### Problemas con documentos

**Síntoma**: No puedes subir documentos, no se cargan los PDFs

**Soluciones**:
1. **Error al subir archivo**:
   - Verifica que el archivo sea PDF, JPG o PNG
   - Verifica que el tamaño no exceda 5-10 MB
   - Intenta comprimir el archivo si es muy grande
   - Intenta desde otro navegador

2. **PDF no se muestra**:
   - Verifica que el archivo no esté corrupto
   - Intenta abrirlo en otro programa primero
   - Intenta subirlo de nuevo

3. **Error al descargar**:
   - Verifica tu conexión a internet
   - Intenta desde otro navegador
   - Verifica que no tengas bloqueadores de descarga activos

### Problemas con notificaciones

**Síntoma**: No recibes notificaciones, el badge no se actualiza

**Soluciones**:
1. Verifica que las notificaciones estén activadas en tu navegador
2. Recarga la página
3. Cierra y vuelve a abrir el navegador
4. Verifica que no tengas bloqueadores de notificaciones activos

### Problemas de visualización

**Síntoma**: La página no se ve bien, elementos faltantes, colores raros

**Soluciones**:
1. Recarga la página (F5)
2. Limpia la caché del navegador
3. Actualiza tu navegador a la última versión
4. Intenta desde otro navegador
5. Verifica que JavaScript esté activado

### Problemas de sesión

**Síntoma**: Te desloguea automáticamente, no puedes iniciar sesión

**Soluciones**:
1. **Sesión expirada**:
   - Simplemente inicia sesión de nuevo
   - La sesión expira por seguridad después de un tiempo de inactividad

2. **No puedes iniciar sesión**:
   - Verifica que el email y contraseña sean correctos
   - Usa el botón del ojo para ver la contraseña mientras la escribes
   - Verifica que no tengas el bloqueo de mayúsculas activado
   - Si olvidaste la contraseña, contacta al administrador

3. **Te desloguea frecuentemente**:
   - Verifica tu conexión a internet
   - No cierres la pestaña del navegador
   - Evita usar múltiples pestañas de la aplicación al mismo tiempo

### Cuándo contactar al soporte

**Contacta al soporte técnico si**:
- Los problemas persisten después de intentar las soluciones básicas
- Aparecen errores que no están documentados en este manual
- No puedes acceder a funcionalidades críticas (fichar, ver documentos)
- Hay problemas de seguridad o privacidad
- Necesitas ayuda con permisos o configuración de cuenta

**Información a proporcionar al soporte**:
- Descripción detallada del problema
- Pasos para reproducir el problema
- Mensajes de error exactos (copia y pega)
- Navegador y versión que usas
- Dispositivo (móvil/escritorio)
- Capturas de pantalla si es posible

## Soporte y Ayuda

### Reportar problemas

**Botón "Reportar error"** (si está disponible):
- **Función**: Abre WhatsApp para reportar problemas
- **Número**: +34 635 289 087

### Contacto

- **Email**: info@decaminoservicios.com
- **Website**: https://decaminoservicios.com

### Horario de soporte

- **Lunes a Viernes**: 9:00 - 18:00
- **Emergencias**: Contacta a tu supervisor directo

---

## Conclusión

Este manual cubre todas las funcionalidades principales disponibles para empleados en la aplicación. Para preguntas adicionales o problemas, contacta al equipo de soporte.

**Versión manual**: 1.0  
**Fecha actualización**: 2026-01-XX  
**Aplicación**: De Camino Servicios Auxiliares Web App
