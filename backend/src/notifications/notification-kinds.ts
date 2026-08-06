/**
 * Inventar central al tipurilor de notificări in-app / push.
 *
 * Convenție: pune `data.kind` = NotificationKind.* la fiecare notifyUser / push.
 * `Notification.type` rămâne severity UI: success | error | warning | info.
 *
 * Canal:
 * - in_app_push = NotificationsService.notifyUser (DB + WS + Web Push)
 * - push_broadcast = PushService.sendPushToAllUsers (ex. comunicados)
 * - email = SMTP (nu trece prin inventarul push; listat pentru vizibilitate)
 */

export const NotificationKind = {
  FICHAJE_REMINDER: 'FICHAJE_REMINDER',
  FICHAJE_REGULARIZACION: 'FICHAJE_REGULARIZACION',
  FICHAJE_APPROVED: 'FICHAJE_APPROVED', // helper legacy, nefolosit în producție
  NOMINA_NUEVA: 'NOMINA_NUEVA',
  PRL_DOCS_NUEVOS: 'PRL_DOCS_NUEVOS',
  PRL_DOC_PENDIENTE_FIRMA: 'PRL_DOC_PENDIENTE_FIRMA',
  CORREO_NUEVO: 'CORREO_NUEVO',
  SOLICITUD_CREADA: 'SOLICITUD_CREADA',
  SOLICITUD_ESTADO: 'SOLICITUD_ESTADO',
  AUSENCIA_CONVERTIDA: 'AUSENCIA_CONVERTIDA',
  DOCUMENTO_SOLICITADO: 'DOCUMENTO_SOLICITADO',
  TAREA_ASIGNADA: 'TAREA_ASIGNADA',
  TAREA_REASIGNADA: 'TAREA_REASIGNADA',
  COMUNICADO: 'COMUNICADO',
  PEDIDO_ACTUALIZADO: 'PEDIDO_ACTUALIZADO', // helper legacy
  MANUAL_ADMIN: 'MANUAL_ADMIN',
  TEST: 'TEST',
} as const;

export type NotificationKindId =
  (typeof NotificationKind)[keyof typeof NotificationKind];

export type NotificationChannel =
  | 'in_app_push'
  | 'push_broadcast'
  | 'email'
  | 'telegram';

export type NotificationKindMeta = {
  kind: NotificationKindId;
  label: string;
  description: string;
  defaultSeverity: 'success' | 'error' | 'warning' | 'info';
  channel: NotificationChannel;
  /** Deep-link tipic în frontend */
  defaultUrl?: string;
  /** Unde se trimite în cod (orientativ) */
  sources: string[];
};

export const NOTIFICATION_INVENTORY: NotificationKindMeta[] = [
  {
    kind: NotificationKind.FICHAJE_REMINDER,
    label: 'Recordatorio de fichaje',
    description:
      'Reminder Entrada/Salida când angajatul e în fereastra orarului și nu a fichat corect. Cron */5 Madrid.',
    defaultSeverity: 'warning',
    channel: 'in_app_push',
    defaultUrl: '/fichaje',
    sources: ['fichaje-reminder.service.ts'],
  },
  {
    kind: NotificationKind.FICHAJE_REGULARIZACION,
    label: 'Regularización de jornada',
    description:
      'Supervisor cere confirmarea regularizării de ore pentru o zi.',
    defaultSeverity: 'warning',
    channel: 'in_app_push',
    defaultUrl: '/fichaje',
    sources: ['fichaje-regularizacion.service.ts'],
  },
  {
    kind: NotificationKind.FICHAJE_APPROVED,
    label: 'Fichaje aprobat',
    description: 'Helper exemplu în NotificationsService (nefolosit).',
    defaultSeverity: 'success',
    channel: 'in_app_push',
    sources: ['notifications.service.ts'],
  },
  {
    kind: NotificationKind.NOMINA_NUEVA,
    label: 'Nueva nómina disponible',
    description: 'Angajatul are o nómină nouă încărcată.',
    defaultSeverity: 'info',
    channel: 'in_app_push',
    sources: ['gestoria.service.ts'],
  },
  {
    kind: NotificationKind.PRL_DOCS_NUEVOS,
    label: 'Nuevos documentos PRL',
    description: 'Documente PRL noi disponibile pentru angajat.',
    defaultSeverity: 'info',
    channel: 'in_app_push',
    sources: ['prl-documents.service.ts'],
  },
  {
    kind: NotificationKind.PRL_DOC_PENDIENTE_FIRMA,
    label: 'Documento PRL pendiente de firma',
    description: 'Un document PRL așteaptă semnătura angajatului.',
    defaultSeverity: 'warning',
    channel: 'in_app_push',
    sources: ['prl-documents.service.ts'],
  },
  {
    kind: NotificationKind.CORREO_NUEVO,
    label: 'Nuevo correo recibido',
    description:
      'Notificare in-app când se trimite un email către angajat (manual / mesaje automate).',
    defaultSeverity: 'info',
    channel: 'in_app_push',
    sources: [
      'empleados.controller.ts',
      'sent-emails.controller.ts',
      'scheduled-messages-cron.service.ts',
    ],
  },
  {
    kind: NotificationKind.SOLICITUD_CREADA,
    label: 'Solicitud creada',
    description: 'Confirmare că o solicitud a fost creată.',
    defaultSeverity: 'success',
    channel: 'in_app_push',
    defaultUrl: '/solicitudes',
    sources: ['solicitudes.service.ts'],
  },
  {
    kind: NotificationKind.SOLICITUD_ESTADO,
    label: 'Cambio de estado de solicitud',
    description: 'Actualizare stare solicitud (aprobada, rechazada, etc.).',
    defaultSeverity: 'info',
    channel: 'in_app_push',
    defaultUrl: '/solicitudes',
    sources: ['solicitudes.service.ts'],
  },
  {
    kind: NotificationKind.AUSENCIA_CONVERTIDA,
    label: 'Ausencia convertida',
    description: 'Tipul de absență a fost convertit (ex. la injustificada).',
    defaultSeverity: 'info',
    channel: 'in_app_push',
    defaultUrl: '/solicitudes',
    sources: ['solicitudes.service.ts'],
  },
  {
    kind: NotificationKind.DOCUMENTO_SOLICITADO,
    label: 'Nueva solicitud de documento',
    description: 'HR cere un document de la angajat.',
    defaultSeverity: 'info',
    channel: 'in_app_push',
    sources: ['documentos-solicitados.service.ts'],
  },
  {
    kind: NotificationKind.TAREA_ASIGNADA,
    label: 'Nueva tarea asignada',
    description: 'O sarcină nouă a fost asignată angajatului.',
    defaultSeverity: 'info',
    channel: 'in_app_push',
    defaultUrl: '/mis-tareas',
    sources: ['tareas.service.ts'],
  },
  {
    kind: NotificationKind.TAREA_REASIGNADA,
    label: 'Tarea reasignada',
    description: 'O sarcină existentă a fost reasignată.',
    defaultSeverity: 'info',
    channel: 'in_app_push',
    defaultUrl: '/mis-tareas',
    sources: ['tareas.service.ts'],
  },
  {
    kind: NotificationKind.COMUNICADO,
    label: 'Comunicado',
    description: 'Broadcast push către toți abonații (comunicados).',
    defaultSeverity: 'info',
    channel: 'push_broadcast',
    defaultUrl: '/comunicados',
    sources: ['comunicados.service.ts'],
  },
  {
    kind: NotificationKind.PEDIDO_ACTUALIZADO,
    label: 'Pedido actualizat',
    description: 'Helper exemplu în NotificationsService (nefolosit).',
    defaultSeverity: 'info',
    channel: 'in_app_push',
    sources: ['notifications.service.ts'],
  },
  {
    kind: NotificationKind.MANUAL_ADMIN,
    label: 'Notificación manual (admin)',
    description: 'Trimisă din UI admin / SendNotificationModal.',
    defaultSeverity: 'info',
    channel: 'in_app_push',
    sources: ['notifications.controller.ts'],
  },
  {
    kind: NotificationKind.TEST,
    label: 'Notificación de prueba',
    description: 'Endpoint-uri de test push / in-app.',
    defaultSeverity: 'info',
    channel: 'in_app_push',
    sources: ['notifications.controller.ts'],
  },
];

export function getNotificationInventory(): NotificationKindMeta[] {
  return NOTIFICATION_INVENTORY;
}

export function getNotificationKindMeta(
  kind: string,
): NotificationKindMeta | undefined {
  return NOTIFICATION_INVENTORY.find((k) => k.kind === kind);
}
