/**
 * Proceduri văzute în aplicație. Modelul le reformulează.
 * Nu adăuga aici un buton care nu există în ecran.
 */

export const PROCEDURE_IDS = [
  'registrar_jornada',
  'salida_incidencia',
  'olvido_fichaje',
  'vacaciones_solicitud',
  'permiso_retribuido',
  'asuntos_propios',
  'ausencia_justificada',
  'justificante_no_borrar',
  'datos_personales',
  'pedidos_material',
  'albaran_pedido',
  'baja_voluntaria',
  'no_documentada',
] as const;

export type ProcedureId = (typeof PROCEDURE_IDS)[number];

const PROCEDURES: Record<ProcedureId, string> = {
  registrar_jornada:
    'En Registro de Jornada (Fichaje) hay dos botones: «Entrada» (Iniciar jornada) y «Salida» (Finalizar jornada). ' +
    'Pueden estar desactivados fuera del horario asignado, durante vacaciones o ausencia, o en un festivo completo si el empleado no trabaja festivos. ' +
    'El asistente no pulsa estos botones ni cambia un fichaje.',
  salida_incidencia:
    'En Registro de Jornada existe el botón «Salida incidencia». ' +
    'Cierra un turno que sigue abierto (el último marcaje es Entrada) cuando la Salida normal está bloqueada. ' +
    'No sirve para un día ya pasado sin fichajes ni para corregir una hora.',
  olvido_fichaje:
    'Si se te olvidó fichar hoy, entra en Fichaje y registra la entrada o la salida que falta.\n' +
    'Si el día ya pasó y no hay fichajes: abre Mi Horario, en ese día pulsa «Indicar motivo», elige «Olvidé fichar» y el supervisor lo revisa. ' +
    'Ese botón solo aparece en un día pasado con alerta de fichaje.\n' +
    'Si el fichaje ya existe pero falta la salida o la hora está mal, abre Registros y pulsa «Regularizar» en ese registro.\n' +
    'El asistente no modifica el fichaje.',
  vacaciones_solicitud:
    'Para solicitar vacaciones: abre Solicitudes, crea una solicitud nueva, elige el tipo Vacaciones, marca el primer día y el último día, y envía. ' +
    'Queda pendiente hasta que la aprueben. El saldo de días es otra pregunta y se consulta, no se inventa. ' +
    'La opción puede salir desactivada si no hay derecho o si se alcanzó el límite.',
  permiso_retribuido:
    'En Solicitudes crea una solicitud de tipo Permiso Retribuido e indica el período de inicio y fin que pide el formulario. ' +
    'Al enviarla queda Pendiente. No añadas otros botones.',
  asuntos_propios:
    'En Solicitudes elige Asuntos Propios y marca los días en el calendario de esa solicitud. ' +
    'La opción puede mostrar «Sin derechos» o «Límite alcanzado». No inventes cuántos días corresponden.',
  ausencia_justificada:
    'En Solicitudes crea una solicitud de tipo Ausencias justificada. ' +
    'El tipo de justificante es obligatorio. Los tipos del formulario son: Cita médica (médico de cabecera), Cita con especialista, Justificante médico (sin baja), Deber inexcusable (cita oficial), Incidencia puntual / urgencia, y Otro. ' +
    'La fecha es obligatoria. Adjuntar justificante es obligatorio (pdf, jpg o png). ' +
    'En cita médica o cita con especialista, la hora y el centro médico son opcionales. Si el tipo es Otro, la descripción es obligatoria. ' +
    'La solicitud queda Pendiente.',
  justificante_no_borrar:
    'No está garantizado que el empleado pueda borrar un justificante ya enviado. ' +
    'Si no aparece una acción de eliminar, no inventes el menú. Para anular, corregir o sustituir, tiene que hablar con supervisión o con recursos humanos.',
  datos_personales:
    'Los datos personales se editan en Datos personales (ruta /datos). ' +
    'Al editar, el motivo de la modificación es obligatorio. El cambio suele ir a aprobación y no siempre se guarda al instante. ' +
    'No indiques Documentos si la pregunta es la dirección u otro dato personal.',
  pedidos_material:
    'Los pedidos de material se gestionan en Pedidos (/pedidos o /empleado-pedidos): catálogo, crear pedidos, subir albarán y ver estado. ' +
    'Un listado concreto se consulta con la herramienta de pedidos, no se inventa.',
  albaran_pedido:
    'El albarán se sube en Pedidos de material. Abre Pedidos (/pedidos o /empleado-pedidos), selecciona el pedido y usa la opción de subir albarán en ese pedido. No se sube desde Documentos generales.',
  baja_voluntaria:
    'En Solicitudes el tipo Baja Voluntaria exige el último día de trabajo. Al enviarla queda Pendiente. No inventes más campos.',
  no_documentada:
    'No hay un procedimiento verificado para esta pregunta. Dilo así. No inventes botones, pantallas ni reglas de la empresa.',
};

/** Temas sin procedură verificată. Modelul trebuie să aleagă no_documentada. */
export const UNDOCUMENTED_ASSISTANT_TOPICS = [
  'tareas',
  'presupuestos',
  'clientes',
  'horas permitidas',
  'bajas médicas o mutua',
  'inspecciones completas (solo existen metadatos de documentos)',
  'hall of fame',
  'un ticket general de incidencia a administración',
  'pago de nocturnidad',
  'subir un justificante fuera del formulario Ausencias justificada',
];

export function isProcedureId(value: string): value is ProcedureId {
  return (PROCEDURE_IDS as readonly string[]).includes(value);
}

export function procedureText(id: ProcedureId): string {
  return PROCEDURES[id];
}

export function procedureCatalogForPrompt(): string {
  const lines = PROCEDURE_IDS.map((id) => `## ${id}\n${PROCEDURES[id]}`);
  return (
    lines.join('\n\n') +
    '\n\nSin procedimiento verificado: ' +
    UNDOCUMENTED_ASSISTANT_TOPICS.join('; ') +
    '.'
  );
}
