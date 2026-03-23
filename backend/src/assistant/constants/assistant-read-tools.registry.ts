/**
 * Registro de herramientas read-only del asistente: whitelists y límites.
 * Cualquier campo no listado aquí no debe exponerse al LLM ni al cliente vía asistente.
 */

/** Claves que nunca deben aparecer en salidas del asistente (defensa en profundidad). */
export const ASSISTANT_SENSITIVE_KEY_BLACKLIST = new Set<string>([
  'CONTRASENA',
  'contraseña',
  'password',
  'SEG__SOCIAL',
  'SEG. SOCIAL',
  'DNI_NIE',
  'N__Cuenta',
  'Nº Cuenta',
  'SUELDO_BRUTO_MENSUAL',
  'SUELDO BRUTO MENSUAL',
  'archivo',
  'AVATAR',
  'CORREO ELECTRONICO',
  'CORREO_ELECTRONICO',
  'email',
  'DIRECCION',
  'DIRECCIÓN',
  'motivo',
  'iban',
  'IBAN',
]);

/** Máx. caracteres de contenido KB por artículo (evita prompts enormes). */
export const ASSISTANT_KB_CONTENIDO_MAX_CHARS = 6000;

/**
 * Tool: fichajes_registro
 * Entrada: userId, rol (JWT), entidades fecha/mes.
 * Roles: todos autenticados; datos filtrados por RBAC en SQL (empleado = propios).
 */
export const WHITELIST_FICHAJES_REGISTRO = [
  'fichaje_pk',
  'CODIGO',
  'nombre_apellidos',
  'TIPO',
  'HORA',
  'FECHA',
  'DURACION',
  'Estado',
] as const;

/**
 * Tool: fichajes_ausencias_plan
 * (fichajes faltantes / plan del día)
 */
export const WHITELIST_FICHAJES_FALTANTES = [
  'CODIGO',
  'nombre',
  'centro',
  'fecha_esperada',
  'horas_plan',
  'fuente',
  'horas_fichadas',
  'fichaje_incompleto',
  'detalles_faltantes',
] as const;

/**
 * Tool: empleados_resumen_operativo
 */
export const WHITELIST_EMPLEADOS_LISTADO = [
  'CODIGO',
  'nombre',
  'estado',
  'centro',
  'grupo',
  'tiene_cuadrante',
  'tiene_horario',
  'tiene_centro',
  'detalles_faltantes',
] as const;

/** Tool: empleado_mis_datos_contrato — resumen propio (sin sueldo/DNI). */
export const WHITELIST_EMPLEADO_CONTRATO = [
  'row_kind',
  'codigo',
  'nombre',
  'tipo_contrato',
  'horas_contrato',
  'fecha_alta',
  'fecha_antiguedad',
  'antiguedad',
  'empresa',
  'centro',
  'estado',
  /** true = existe PDF/archivo en CarpetasDocumentos (tipo o nombre con „contrato”) */
  'documento_contrato_subido',
] as const;

/** Coloane zi din `cuadrante` (export + LLM pot rezuma pe zile). */
const CUADRANTE_ZI_KEYS = Array.from(
  { length: 31 },
  (_, i) => `ZI_${i + 1}` as const,
);

/**
 * Tool: cuadrante_mes
 */
export const WHITELIST_CUADRANTE = [
  'id',
  'CODIGO',
  'NOMBRE',
  'LUNA',
  'CENTRO',
  'TotalHoras',
  ...CUADRANTE_ZI_KEYS,
] as const;

/** Tool: pedidos_resumen — comandas material (PedidosTodos), sin líneas detalladas. */
export const WHITELIST_PEDIDOS = [
  'pedido_uid',
  'empleado_id',
  'comunidad_nombre',
  'fecha',
  'creado_en',
  'estado',
  'moneda',
  'total',
  'num_items',
] as const;

/** Tool: plan_trabajo_dia — daily_plan (cuadrante vs horario, 3 segmente). */
export const WHITELIST_PLAN_TRABAJO_DIA = [
  'CODIGO',
  'nombre',
  'centro',
  'fecha',
  'horas_plan',
  'fuente',
  'valor_celula_cuadrante',
  'horas_cuadrante_dia',
  'horas_horario_dia',
  'horario_segmento_1_horas',
  'horario_segmento_2_horas',
  'horario_segmento_3_horas',
  /** Ore din `horario_multicentro` (dacă `fuente` = horario_multicentro). */
  'horas_horario_multicentro_dia',
  /** Client din `horario_multicentro` (repartizare pe centru/comunitate). */
  'cliente_horario_multicentro',
  'trabaja_este_dia',
] as const;

/**
 * Tool: vacaciones_solicitudes
 * Sin email ni motivo (PII / médico u otro texto libre).
 */
export const WHITELIST_VACACIONES_SOLICITUDES = [
  'id',
  'codigo',
  'nombre',
  'tipo',
  'estado',
  'fecha_inicio',
  'fecha_fin',
  'fecha_solicitud',
] as const;

/**
 * Tool: nominas_metadatos
 * Solo metadatos; nunca archivo binario. RBAC por codigo_empleado en SQL.
 */
export const WHITELIST_NOMINAS_METADATOS = [
  'id',
  'nombre',
  'Mes',
  'Ano',
  'fecha_subida',
  'codigo_empleado',
  /** Rânduri din consulta „faltan nóminas” (empleados ACTIVO sin fila en Nominas). */
  'estado',
  'row_kind',
  'mes_referencia',
  'ano_referencia',
] as const;

/**
 * Tool: diplomas_metadatos — tabla `diplomas` (sin PDF binario).
 */
export const WHITELIST_DIPLOMAS_METADATOS = [
  'id',
  'empleado_id',
  'nombre_empleado',
  'nombre_archivo',
  'fecha_subida',
  'subido_por',
  'notas',
] as const;

/**
 * Tool: documentos_inspeccion_metadatos
 */
export const WHITELIST_DOCUMENTOS_INSPECCION = [
  'id',
  'codigo',
  'nombre',
  'tipo_documento',
  'fecha_subida',
  'estado',
] as const;

/**
 * Tool: knowledge_base_articulos
 */
export const WHITELIST_KB_ARTICULO = [
  'id',
  'titulo',
  'categoria',
  'tags',
  'contenido',
] as const;

/** Saldo vacaciones expuesto al asistente (mismo subconjunto que antes, explícito). */
export const WHITELIST_VACACIONES_SALDO_FLAT = [
  'dias_anuales',
  'dias_generados_hasta_hoy',
  'dias_consumidos_aprobados',
  'dias_restantes',
] as const;

/** Tool: comunicados_list — anunțuri interne publicate (fără fișier atașat). */
export const WHITELIST_COMUNICADOS = [
  'id',
  'titulo',
  'resumen_texto',
  'autor_id',
  'created_at',
  'leido_por_mi',
  'leido_en',
] as const;

/**
 * Tool: ausencias_calendario — aceeași sursă ca workflow-ul n8n „Cron absente”
 * (tabela `Ausencias`, parsare FECHA zi sau interval).
 */
export const WHITELIST_AUSENCIAS_CALENDARIO = [
  'id',
  'solicitud_id',
  'CODIGO',
  'NOMBRE',
  'TIPO',
  'FECHA_RAW',
  'HORA',
  'LOCACION',
  'MOTIVO',
  'DURACION',
  'UNIDAD_DURACION',
  'created_at',
  'fecha_inicio',
  'fecha_fin',
] as const;

/** Tool: solicitudes_tabla — rânduri din `solicitudes` (fără email/motivo). */
export const WHITELIST_SOLICITUDES_TABLA = [
  'id',
  'codigo',
  'nombre',
  'tipo',
  'estado',
  'fecha_inicio',
  'fecha_fin',
  'fecha_solicitud',
  /** Ausencias justificada / médico (cuando aplica). */
  'tipo_justificante',
] as const;

/** Tool: documentos_solicitados_metadatos */
export const WHITELIST_DOCUMENTOS_SOLICITADOS = [
  'id',
  'empleado_id',
  'tipo_documento',
  'estado',
  'fecha_solicitud',
  'fecha_completado',
] as const;

export type AssistantReadToolId =
  | 'fichajes_registro'
  | 'fichajes_ausencias_plan'
  | 'empleados_resumen_operativo'
  | 'cuadrante_mes'
  | 'plan_trabajo_dia'
  | 'pedidos_resumen'
  | 'vacaciones_solicitudes'
  | 'vacaciones_saldo'
  | 'solicitudes_tabla'
  | 'ausencias_calendario'
  | 'nominas_metadatos'
  | 'diplomas_metadatos'
  | 'documentos_inspeccion_metadatos'
  | 'documentos_solicitados_metadatos'
  | 'comunicados_list'
  | 'knowledge_base_articulos';
