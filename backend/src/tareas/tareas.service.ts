import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EmpleadoGrupoScopeService } from '../services/empleado-grupo-scope.service';
import { NotificationsService } from '../services/notifications.service';
import { EmailService } from '../services/email.service';
import { SentEmailsService } from '../services/sent-emails.service';

const MODULE_MANAGE = 'tareas';
const MODULE_MINE = 'mis-tareas';
const PRIORIDADES = new Set(['normal', 'alta', 'urgente']);
const ESTADOS = new Set(['pendiente', 'en_curso', 'hecha', 'cancelada']);

@Injectable()
export class TareasService {
  private readonly logger = new Logger(TareasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly empleadoGrupoScopeService: EmpleadoGrupoScopeService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly sentEmailsService: SentEmailsService,
    private readonly configService: ConfigService,
  ) {}

  private grupoOf(user: any): string {
    return String(user?.grupo || user?.GRUPO || '').trim();
  }

  private codigoOf(user: any): string {
    return String(user?.userId || user?.codigo || user?.CODIGO || '').trim();
  }

  private nombreOf(user: any): string {
    return String(
      user?.name ||
        user?.nombre ||
        user?.['NOMBRE / APELLIDOS'] ||
        user?.email ||
        '',
    ).trim();
  }

  private async hasModule(grupo: string, module: string): Promise<boolean> {
    if (!grupo) return false;
    if (
      (grupo === 'Developer' ||
        grupo === 'Admin' ||
        grupo === 'Manager' ||
        grupo === 'Supervisor') &&
      (module === MODULE_MANAGE || module === MODULE_MINE)
    ) {
      const explicit = await this.prisma.permissions.findFirst({
        where: { grupo_module: `${grupo}_${module}` },
      });
      if (explicit && String(explicit.permitted).toLowerCase() === 'false') {
        return false;
      }
      if (explicit && String(explicit.permitted).toLowerCase() === 'true') {
        return true;
      }
      return true;
    }
    const row = await this.prisma.permissions.findFirst({
      where: { grupo_module: `${grupo}_${module}` },
    });
    return Boolean(row && String(row.permitted).toLowerCase() === 'true');
  }

  async assertCanManage(user: any): Promise<void> {
    const ok = await this.hasModule(this.grupoOf(user), MODULE_MANAGE);
    if (!ok) throw new ForbiddenException('Sin permiso para gestionar Tareas');
  }

  async assertCanViewMine(user: any): Promise<void> {
    const grupo = this.grupoOf(user);
    const mine = await this.hasModule(grupo, MODULE_MINE);
    const manage = await this.hasModule(grupo, MODULE_MANAGE);
    if (!mine && !manage) {
      throw new ForbiddenException('Sin permiso para Mis Tareas');
    }
  }

  private serialize(row: any) {
    return {
      ...row,
      fotos: (row.fotos || []).map((f: any) => ({
        id: f.id,
        mime_type: f.mime_type,
        tamano_bytes: f.tamano_bytes,
        nombre_original: f.nombre_original,
        uploaded_by: f.uploaded_by,
        created_at: f.created_at,
      })),
    };
  }

  async listAll(
    user: any,
    filters: { estado?: string; codigo_asignado?: string; q?: string } = {},
  ) {
    await this.assertCanManage(user);
    const allowed =
      await this.empleadoGrupoScopeService.listAllowedCodigosForPayload({
        userId: this.codigoOf(user),
        role: user?.role,
        grupo: this.grupoOf(user),
      });

    const where: any = {};
    if (filters.estado && ESTADOS.has(filters.estado)) {
      where.estado = filters.estado;
    }
    if (filters.codigo_asignado) {
      where.codigo_asignado = String(filters.codigo_asignado).trim();
    }
    if (allowed && Array.isArray(allowed)) {
      where.codigo_asignado = filters.codigo_asignado
        ? filters.codigo_asignado
        : { in: allowed };
      if (
        filters.codigo_asignado &&
        !allowed.includes(String(filters.codigo_asignado).trim())
      ) {
        return [];
      }
    }
    if (filters.q?.trim()) {
      const q = filters.q.trim();
      where.OR = [
        { titulo: { contains: q } },
        { descripcion: { contains: q } },
        { centro: { contains: q } },
        { zona: { contains: q } },
        { nombre_asignado: { contains: q } },
      ];
    }

    const rows = await this.prisma.tareaServicio.findMany({
      where,
      include: { fotos: { orderBy: { created_at: 'asc' } } },
      orderBy: [
        { estado: 'asc' },
        { prioridad: 'desc' },
        { created_at: 'desc' },
      ],
      take: 500,
    });
    return rows.map((r) => this.serialize(r));
  }

  async listMine(user: any) {
    await this.assertCanViewMine(user);
    const codigo = this.codigoOf(user);
    if (!codigo) throw new BadRequestException('Usuario sin código');
    const rows = await this.prisma.tareaServicio.findMany({
      where: { codigo_asignado: codigo },
      include: { fotos: { orderBy: { created_at: 'asc' } } },
      orderBy: [{ estado: 'asc' }, { created_at: 'desc' }],
      take: 300,
    });
    return rows.map((r) => this.serialize(r));
  }

  async create(
    user: any,
    body: {
      codigo_asignado: string;
      nombre_asignado?: string;
      titulo: string;
      descripcion?: string;
      prioridad?: string;
      centro?: string;
      zona?: string;
      cliente_id?: number | null;
      fecha_limite?: string | null;
    },
  ) {
    await this.assertCanManage(user);
    const codigoAsignado = String(body.codigo_asignado || '').trim();
    const titulo = String(body.titulo || '').trim();
    if (!codigoAsignado || !titulo) {
      throw new BadRequestException('Se requieren codigo_asignado y titulo');
    }

    const allowed =
      await this.empleadoGrupoScopeService.listAllowedCodigosForPayload({
        userId: this.codigoOf(user),
        role: user?.role,
        grupo: this.grupoOf(user),
      });
    this.empleadoGrupoScopeService.assertCodigoEnAmbito(
      allowed ?? null,
      codigoAsignado,
    );

    const prioridad = String(body.prioridad || 'normal').toLowerCase();
    if (!PRIORIDADES.has(prioridad)) {
      throw new BadRequestException('Prioridad inválida');
    }

    let fechaLimite: Date | null = null;
    if (body.fecha_limite) {
      const d = new Date(body.fecha_limite);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('fecha_limite inválida');
      }
      fechaLimite = d;
    }

    const row = await this.prisma.tareaServicio.create({
      data: {
        titulo,
        descripcion: body.descripcion?.trim() || null,
        prioridad,
        estado: 'pendiente',
        codigo_asignado: codigoAsignado,
        nombre_asignado: body.nombre_asignado?.trim() || null,
        codigo_creador: this.codigoOf(user),
        nombre_creador: this.nombreOf(user) || null,
        centro: body.centro?.trim() || null,
        zona: body.zona?.trim() || null,
        cliente_id:
          body.cliente_id != null && Number.isFinite(Number(body.cliente_id))
            ? Number(body.cliente_id)
            : null,
        fecha_limite: fechaLimite,
      },
      include: { fotos: true },
    });

    setImmediate(() => {
      this.notifyAsignadoTarea({
        tareaId: row.id,
        codigoAsignado,
        nombreAsignadoHint: body.nombre_asignado?.trim() || null,
        titulo: row.titulo,
        descripcion: row.descripcion,
        prioridad: row.prioridad,
        centro: row.centro,
        fechaLimite: row.fecha_limite,
        codigoCreador: this.codigoOf(user),
        nombreCreador: this.nombreOf(user) || null,
        esReasignacion: false,
      }).catch((err: any) => {
        this.logger.warn(
          `⚠️ Error notifying tarea ${row.id} (non-blocking): ${err?.message || err}`,
        );
      });
    });

    return this.serialize(row);
  }

  /**
   * In-app + Web Push + email to assignee when a tarea is created or reassigned.
   */
  private async notifyAsignadoTarea(params: {
    tareaId: number;
    codigoAsignado: string;
    nombreAsignadoHint?: string | null;
    titulo: string;
    descripcion?: string | null;
    prioridad?: string | null;
    centro?: string | null;
    fechaLimite?: Date | null;
    codigoCreador: string;
    nombreCreador?: string | null;
    esReasignacion: boolean;
  }): Promise<void> {
    const {
      tareaId,
      codigoAsignado,
      titulo,
      descripcion,
      prioridad,
      centro,
      fechaLimite,
      codigoCreador,
      nombreCreador,
      esReasignacion,
    } = params;

    let empleadoEmail: string | null = null;
    let empleadoNombre = params.nombreAsignadoHint?.trim() || codigoAsignado;

    try {
      const emp = await this.prisma.user.findUnique({
        where: { CODIGO: codigoAsignado },
        select: {
          CORREO_ELECTRONICO: true,
          NOMBRE_APELLIDOS: true,
          NOMBRE: true,
          APELLIDO1: true,
        },
      });
      if (emp) {
        empleadoEmail = emp.CORREO_ELECTRONICO?.trim() || null;
        empleadoNombre =
          emp.NOMBRE_APELLIDOS?.trim() ||
          [emp.NOMBRE, emp.APELLIDO1].filter(Boolean).join(' ').trim() ||
          empleadoNombre;
      }
    } catch (err: any) {
      this.logger.warn(
        `⚠️ Could not fetch empleado ${codigoAsignado}: ${err?.message}`,
      );
    }

    const title = esReasignacion ? 'Tarea reasignada' : 'Nueva tarea asignada';
    const messageParts = [
      titulo,
      prioridad && prioridad !== 'normal' ? `(${prioridad})` : null,
      centro ? `· ${centro}` : null,
    ].filter(Boolean);
    const message = messageParts.join(' ');

    try {
      await this.notificationsService.notifyUser(
        codigoCreador || 'system',
        codigoAsignado,
        {
          type: 'info',
          title,
          message,
          data: {
            tareaId,
            url: '/mis-tareas',
            prioridad: prioridad || 'normal',
          },
        },
      );
      this.logger.log(
        `✅ Notification (+push) sent to ${codigoAsignado} for tarea ${tareaId}`,
      );
    } catch (notifErr: any) {
      this.logger.warn(
        `⚠️ In-app/push notification failed for ${codigoAsignado}: ${notifErr?.message}`,
      );
    }

    if (!empleadoEmail) {
      this.logger.warn(
        `⚠️ No email for empleado ${codigoAsignado}, skipping email for tarea ${tareaId}`,
      );
      return;
    }
    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        `⚠️ Email service not configured; skip email to ${empleadoEmail}`,
      );
      return;
    }

    try {
      const { subject, html } = this.formatTareaEmailHtml({
        empleadoNombre,
        titulo,
        descripcion,
        prioridad: prioridad || 'normal',
        centro,
        fechaLimite,
        nombreCreador,
        esReasignacion,
      });
      await this.emailService.sendEmail(empleadoEmail, subject, html);
      this.logger.log(`✅ Email sent to ${empleadoEmail} for tarea ${tareaId}`);
      try {
        await this.sentEmailsService.saveSentEmail({
          senderId: codigoCreador || 'system',
          recipientType: 'empleado',
          recipientId: codigoAsignado,
          recipientEmail: empleadoEmail,
          recipientName: empleadoNombre,
          subject,
          message: html,
          status: 'sent',
        });
      } catch (saveErr: any) {
        this.logger.warn(`⚠️ Error saving sent email: ${saveErr?.message}`);
      }
    } catch (emailErr: any) {
      this.logger.warn(
        `⚠️ Error sending email to ${empleadoEmail}: ${emailErr?.message}`,
      );
    }
  }

  private formatTareaEmailHtml(data: {
    empleadoNombre: string;
    titulo: string;
    descripcion?: string | null;
    prioridad: string;
    centro?: string | null;
    fechaLimite?: Date | null;
    nombreCreador?: string | null;
    esReasignacion: boolean;
  }): { subject: string; html: string } {
    const company = this.configService.get<{
      legalNameShort?: string;
      legalName?: string;
    }>('company');
    const brand =
      company?.legalNameShort ||
      company?.legalName ||
      'DE CAMINO SERVICIOS AUXILIARES';
    const subject = data.esReasignacion
      ? `Tarea reasignada: ${data.titulo}`
      : `Nueva tarea: ${data.titulo}`;
    const fechaLimiteStr = data.fechaLimite
      ? new Date(data.fechaLimite).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : null;
    const esc = (s: string) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0f766e; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .footer { background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 5px 5px; }
    .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #0f766e; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${esc(brand)}</h1>
      <h2>${data.esReasignacion ? 'Tarea reasignada' : 'Nueva tarea asignada'}</h2>
    </div>
    <div class="content">
      <p>Estimado/a <strong>${esc(data.empleadoNombre)}</strong>,</p>
      <p>${
        data.esReasignacion
          ? 'Se le ha reasignado una tarea:'
          : 'Se le ha asignado una nueva tarea:'
      }</p>
      <div class="info-box">
        <p><strong>Título:</strong> ${esc(data.titulo)}</p>
        <p><strong>Prioridad:</strong> ${esc(data.prioridad)}</p>
        ${data.centro ? `<p><strong>Centro:</strong> ${esc(data.centro)}</p>` : ''}
        ${fechaLimiteStr ? `<p><strong>Fecha límite:</strong> ${esc(fechaLimiteStr)}</p>` : ''}
        ${data.nombreCreador ? `<p><strong>Asignada por:</strong> ${esc(data.nombreCreador)}</p>` : ''}
        ${
          data.descripcion
            ? `<p><strong>Descripción:</strong><br/>${esc(data.descripcion).replace(/\n/g, '<br/>')}</p>`
            : ''
        }
      </div>
      <p>Acceda a la aplicación → <strong>Mis Tareas</strong> para ver los detalles y completarla.</p>
    </div>
    <div class="footer">
      <p>Este es un mensaje automático. Por favor, no responda a este correo.</p>
      <p>${esc(company?.legalName || brand)}</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return { subject, html };
  }

  async update(
    user: any,
    id: number,
    body: {
      estado?: string;
      prioridad?: string;
      codigo_asignado?: string;
      nombre_asignado?: string;
      titulo?: string;
      descripcion?: string;
      centro?: string;
      zona?: string;
      nota_completado?: string;
    },
  ) {
    const tarea = await this.prisma.tareaServicio.findUnique({ where: { id } });
    if (!tarea) throw new NotFoundException('Tarea no encontrada');

    const codigo = this.codigoOf(user);
    const canManage = await this.hasModule(this.grupoOf(user), MODULE_MANAGE);
    const isAssignee = tarea.codigo_asignado === codigo;

    if (!canManage && !isAssignee) {
      throw new ForbiddenException('Sin permiso para modificar esta tarea');
    }

    const data: any = {};
    if (canManage) {
      if (body.titulo != null) data.titulo = String(body.titulo).trim();
      if (body.descripcion !== undefined) {
        data.descripcion = body.descripcion?.trim() || null;
      }
      if (body.centro !== undefined) data.centro = body.centro?.trim() || null;
      if (body.zona !== undefined) data.zona = body.zona?.trim() || null;
      if (body.prioridad != null) {
        const p = String(body.prioridad).toLowerCase();
        if (!PRIORIDADES.has(p))
          throw new BadRequestException('Prioridad inválida');
        data.prioridad = p;
      }
      if (body.codigo_asignado) {
        const allowed =
          await this.empleadoGrupoScopeService.listAllowedCodigosForPayload({
            userId: codigo,
            role: user?.role,
            grupo: this.grupoOf(user),
          });
        this.empleadoGrupoScopeService.assertCodigoEnAmbito(
          allowed ?? null,
          body.codigo_asignado,
        );
        data.codigo_asignado = String(body.codigo_asignado).trim();
        if (body.nombre_asignado != null) {
          data.nombre_asignado = body.nombre_asignado.trim() || null;
        }
      }
    }

    if (body.estado != null) {
      const e = String(body.estado).toLowerCase();
      if (!ESTADOS.has(e)) throw new BadRequestException('Estado inválido');
      if (!canManage) {
        // Asignado: solo pendiente → en_curso (o cancel no)
        if (!(tarea.estado === 'pendiente' && e === 'en_curso')) {
          throw new ForbiddenException(
            'Solo puedes marcar la tarea como en curso; usa completar para finalizar',
          );
        }
      }
      data.estado = e;
      if (e === 'hecha' && !tarea.completado_at) {
        data.completado_at = new Date();
      }
      if (e === 'cancelada' || e === 'pendiente' || e === 'en_curso') {
        data.completado_at = null;
      }
    }

    if (body.nota_completado !== undefined && canManage) {
      data.nota_completado = body.nota_completado?.trim() || null;
    }

    const prevAsignado = String(tarea.codigo_asignado || '').trim();
    const updated = await this.prisma.tareaServicio.update({
      where: { id },
      data,
      include: { fotos: { orderBy: { created_at: 'asc' } } },
    });

    const nuevoAsignado = String(updated.codigo_asignado || '').trim();
    if (canManage && nuevoAsignado && nuevoAsignado !== prevAsignado) {
      setImmediate(() => {
        this.notifyAsignadoTarea({
          tareaId: updated.id,
          codigoAsignado: nuevoAsignado,
          nombreAsignadoHint: updated.nombre_asignado,
          titulo: updated.titulo,
          descripcion: updated.descripcion,
          prioridad: updated.prioridad,
          centro: updated.centro,
          fechaLimite: updated.fecha_limite,
          codigoCreador: codigo,
          nombreCreador: this.nombreOf(user) || null,
          esReasignacion: true,
        }).catch((err: any) => {
          this.logger.warn(
            `⚠️ Error notifying reassignment tarea ${updated.id}: ${err?.message || err}`,
          );
        });
      });
    }

    return this.serialize(updated);
  }

  async completar(
    user: any,
    id: number,
    nota: string | undefined,
    files: Express.Multer.File[],
  ) {
    const tarea = await this.prisma.tareaServicio.findUnique({ where: { id } });
    if (!tarea) throw new NotFoundException('Tarea no encontrada');

    const codigo = this.codigoOf(user);
    const canManage = await this.hasModule(this.grupoOf(user), MODULE_MANAGE);
    const isAssignee = tarea.codigo_asignado === codigo;
    if (!canManage && !isAssignee) {
      throw new ForbiddenException('Sin permiso para completar esta tarea');
    }
    if (tarea.estado === 'cancelada') {
      throw new BadRequestException('La tarea está cancelada');
    }
    if (tarea.estado === 'hecha') {
      throw new BadRequestException('La tarea ya está completada');
    }

    if (files?.length && !this.storage.isEnabled()) {
      throw new BadRequestException(
        'Almacenamiento de fotos no disponible (R2). Completa sin fotos o contacta a administración.',
      );
    }

    const uploaded: Array<{
      storage_key: string;
      storage_bucket: string | null;
      mime_type: string | null;
      tamano_bytes: number | null;
      nombre_original: string | null;
      uploaded_by: string;
    }> = [];

    for (const file of files || []) {
      const key = this.storage.buildObjectKey({
        app: 'decamino',
        tenant: this.tenantSlug(),
        domain: 'tareas-servicio',
        scopeId: String(id),
        originalName: file.originalname,
      });
      const put = await this.storage.put({
        key,
        body: file.buffer,
        contentType: file.mimetype || 'application/octet-stream',
      });
      uploaded.push({
        storage_key: put.key,
        storage_bucket: put.bucket || null,
        mime_type: file.mimetype || null,
        tamano_bytes: file.size ?? null,
        nombre_original: file.originalname || null,
        uploaded_by: codigo,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (uploaded.length) {
        await tx.tareaServicioFoto.createMany({
          data: uploaded.map((u) => ({ ...u, tarea_id: id })),
        });
      }
      return tx.tareaServicio.update({
        where: { id },
        data: {
          estado: 'hecha',
          completado_at: new Date(),
          nota_completado: nota?.trim() || tarea.nota_completado,
        },
        include: { fotos: { orderBy: { created_at: 'asc' } } },
      });
    });

    return this.serialize(updated);
  }

  private tenantSlug(): string {
    const db = (process.env.DB_NAME || '').trim().toLowerCase();
    if (db === 'hera_facility_db' || db.includes('hera')) return 'hera';
    if (db === 'decamino_db' || db.includes('decamino')) return 'decamino';
    if (db.startsWith('tenant_')) return db.replace(/^tenant_/, '') || 'tenant';
    return 'decamino';
  }

  async getFotoUrl(user: any, tareaId: number, fotoId: number) {
    await this.assertCanViewMine(user);
    const foto = await this.prisma.tareaServicioFoto.findFirst({
      where: { id: fotoId, tarea_id: tareaId },
      include: { tarea: true },
    });
    if (!foto) throw new NotFoundException('Foto no encontrada');

    const codigo = this.codigoOf(user);
    const canManage = await this.hasModule(this.grupoOf(user), MODULE_MANAGE);
    if (!canManage && foto.tarea.codigo_asignado !== codigo) {
      throw new ForbiddenException('Sin permiso');
    }
    if (!this.storage.isEnabled()) {
      throw new BadRequestException('Almacenamiento no disponible');
    }
    const url = await this.storage.getPresignedGetUrl({
      key: foto.storage_key,
      expiresInSeconds: 600,
    });
    return { url: url.url, expiresIn: 600 };
  }
}
