import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  Req,
  ForbiddenException,
  NotFoundException,
  UseGuards,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { PresenceManager } from './presence-manager.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../services/notifications.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly presenceManager: PresenceManager,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Calculate a deterministic numeric ID from centro name
   * This ensures the same centro name always gets the same ID
   */
  private calculateCentroId(centroName: string | null): number | null {
    if (!centroName) return null;
    let hash = 0;
    const name = centroName.trim().toUpperCase();
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Make it positive and ensure it fits in BigInt range
    return Math.abs(hash % 2147483647);
  }

  // GET /chat/colleagues - Get list of colleagues from the same centro + supervisors/developers
  // IMPORTANT: This route must be BEFORE /chat/rooms/:roomId to avoid route conflicts
  @Get('colleagues')
  async getColleagues(@Req() req: any) {
    try {
      const jwtUser = req.user;
      const userId = Number(jwtUser.userId); // Ensure userId is a number

      // Map role from JWT to chat service format
      const mapRole = (
        role: string | undefined,
        grupo: string | undefined,
      ): 'empleado' | 'supervisor' | 'admin' | 'superadmin' => {
        const grupoStr = grupo || '';
        if (grupoStr === 'Developer') return 'superadmin';
        if (grupoStr === 'Admin') return 'admin';
        if (grupoStr === 'Supervisor' || grupoStr === 'Manager')
          return 'supervisor';
        return 'empleado';
      };
      const userRole = mapRole(jwtUser.role, jwtUser.grupo);

      console.log(`[ChatController] getColleagues called for user:`, {
        userId,
        role: userRole,
      });

      // Get user's centro
      let centroTrabajo = null;
      try {
        const centroRaw = await this.prisma.$queryRaw<any[]>`
          SELECT \`CENTRO TRABAJO\` as centro_trabajo 
          FROM DatosEmpleados 
          WHERE CODIGO = ${userId}
        `;
        centroTrabajo = centroRaw?.[0]?.centro_trabajo || null;
        console.log(
          `[ChatController] User ${userId} centro_trabajo:`,
          centroTrabajo,
        );
      } catch (error) {
        console.error(
          `[ChatController] Error fetching centro_trabajo for colleagues:`,
          error,
        );
        centroTrabajo = null;
      }

      let allColleagues: any[] = [];

      // 1. For superadmin (Developer): get ALL active users (skip centro check)
      if (userRole === 'superadmin') {
        try {
          const allUsers = await this.prisma.$queryRaw<any[]>`
            SELECT 
              CODIGO as codigo,
              \`NOMBRE / APELLIDOS\` as nombre_apellidos,
              \`CORREO ELECTRONICO\` as correo_electronico,
              ESTADO as estado,
              GRUPO as grupo
            FROM DatosEmpleados
            WHERE CODIGO != ${userId}
              AND (ESTADO = 'ACTIVO' OR ESTADO IS NULL OR ESTADO = '')
            ORDER BY GRUPO DESC, \`NOMBRE / APELLIDOS\` ASC
          `;
          allColleagues.push(...allUsers);
          console.log(
            `[ChatController] Found ${allUsers.length} total active users for Developer`,
          );
        } catch (error) {
          console.error(
            `[ChatController] Error fetching all users for Developer:`,
            error,
          );
        }
      } else {
        // 2. Get colleagues from the same centro (if user has a centro) - only for non-superadmin
        if (centroTrabajo) {
          try {
            const colleaguesFromCentro = await this.prisma.$queryRaw<any[]>`
              SELECT 
                CODIGO as codigo,
                \`NOMBRE / APELLIDOS\` as nombre_apellidos,
                \`CORREO ELECTRONICO\` as correo_electronico,
                ESTADO as estado,
                GRUPO as grupo
              FROM DatosEmpleados
              WHERE \`CENTRO TRABAJO\` = ${centroTrabajo}
                AND CODIGO != ${userId}
                AND (ESTADO = 'ACTIVO' OR ESTADO IS NULL OR ESTADO = '')
              ORDER BY \`NOMBRE / APELLIDOS\` ASC
            `;
            allColleagues.push(...colleaguesFromCentro);
            console.log(
              `[ChatController] Found ${colleaguesFromCentro.length} colleagues from centro "${centroTrabajo}"`,
            );
          } catch (error) {
            console.error(
              `[ChatController] Error fetching colleagues from centro:`,
              error,
            );
          }
        }

        // 3. For empleado role: EXCLUDE supervisors and developers from colleagues list
        // (They will be available via /chat/supervisors endpoint instead)
        // Filter out any supervisors/developers that might be in the same centro
        if (userRole === 'empleado') {
          allColleagues = allColleagues.filter((col: any) => {
            const grupo = col.grupo || '';
            return (
              grupo !== 'Supervisor' &&
              grupo !== 'Manager' &&
              grupo !== 'Developer'
            );
          });
          console.log(
            `[ChatController] Filtered out supervisors/developers for empleado`,
          );
        }
      }

      // Get presence for all colleagues
      const colleagueUserIds = allColleagues.map((col: any) =>
        String(col.codigo),
      );
      console.log(
        `[ChatController] Fetching presence for ${colleagueUserIds.length} colleagues:`,
        colleagueUserIds,
      );
      const presences = this.presenceManager.getUsersPresence(colleagueUserIds);
      console.log(
        `[ChatController] Presence data:`,
        Array.from(presences.entries()).map(([userId, presence]) => ({
          userId,
          online: presence.online,
        })),
      );

      const serializedColleagues = allColleagues.map((col: any) => {
        const userId = String(col.codigo);
        const presence = presences.get(userId) || {
          online: false,
          lastSeen: null,
        };

        return {
          codigo: Number(col.codigo),
          nombre:
            col.nombre_apellidos ||
            col.correo_electronico ||
            `Usuario ${col.codigo}`,
          correo: col.correo_electronico || null,
          estado: col.estado || 'ACTIVO',
          grupo: col.grupo || null,
          presence: {
            online: presence.online,
            lastSeen: presence.lastSeen?.toISOString() || null,
          },
        };
      });

      console.log(
        `[ChatController] Returning ${serializedColleagues.length} total colleagues with presence`,
      );
      return { success: true, colleagues: serializedColleagues };
    } catch (error) {
      console.error(`[ChatController] Error in getColleagues:`, error);
      console.error(`[ChatController] Error stack:`, error.stack);
      return { success: true, colleagues: [] };
    }
  }

  // GET /chat/supervisors - Get list of supervisors and developers (for empleado role)
  @Get('supervisors')
  async getSupervisors(@Req() req: any) {
    try {
      const jwtUser = req.user;
      const userId = Number(jwtUser.userId);

      // Map role from JWT to chat service format
      const mapRole = (
        role: string | undefined,
        grupo: string | undefined,
      ): 'empleado' | 'supervisor' | 'admin' | 'superadmin' => {
        const grupoStr = grupo || '';
        if (grupoStr === 'Developer') return 'superadmin';
        if (grupoStr === 'Admin') return 'admin';
        if (grupoStr === 'Supervisor' || grupoStr === 'Manager')
          return 'supervisor';
        return 'empleado';
      };
      const userRole = mapRole(jwtUser.role, jwtUser.grupo);

      console.log(`[ChatController] getSupervisors called for user:`, {
        userId,
        role: userRole,
      });

      const supervisors: any[] = [];

      // Get all supervisors and developers (regardless of centro)
      try {
        const supervisorsAndDevelopers = await this.prisma.$queryRaw<any[]>` 
          SELECT 
            CODIGO as codigo,
            \`NOMBRE / APELLIDOS\` as nombre_apellidos,
            \`CORREO ELECTRONICO\` as correo_electronico,
            ESTADO as estado,
            GRUPO as grupo
          FROM DatosEmpleados
          WHERE CODIGO != ${userId}
            AND (ESTADO = 'ACTIVO' OR ESTADO IS NULL OR ESTADO = '')
            AND (GRUPO = 'Supervisor' OR GRUPO = 'Manager' OR GRUPO = 'Developer')
          ORDER BY GRUPO DESC, \`NOMBRE / APELLIDOS\` ASC
        `;
        supervisors.push(...supervisorsAndDevelopers);
        console.log(
          `[ChatController] Found ${supervisorsAndDevelopers.length} supervisors/developers`,
        );
      } catch (error) {
        console.error(
          `[ChatController] Error fetching supervisors/developers:`,
          error,
        );
      }

      // Get presence for all supervisors
      const supervisorUserIds = supervisors.map((s: any) => String(s.codigo));
      console.log(
        `[ChatController] Fetching presence for ${supervisorUserIds.length} supervisors:`,
        supervisorUserIds,
      );
      const presences =
        this.presenceManager.getUsersPresence(supervisorUserIds);
      console.log(
        `[ChatController] Presence data:`,
        Array.from(presences.entries()).map(([userId, presence]) => ({
          userId,
          online: presence.online,
        })),
      );

      const serializedSupervisors = supervisors.map((s: any) => {
        const userId = String(s.codigo);
        const presence = presences.get(userId) || {
          online: false,
          lastSeen: null,
        };

        return {
          codigo: Number(s.codigo),
          nombre:
            s.nombre_apellidos || s.correo_electronico || `Usuario ${s.codigo}`,
          correo: s.correo_electronico || null,
          estado: s.estado || 'ACTIVO',
          grupo: s.grupo || null,
          presence: {
            online: presence.online,
            lastSeen: presence.lastSeen?.toISOString() || null,
          },
        };
      });

      console.log(
        `[ChatController] Returning ${serializedSupervisors.length} supervisors with presence`,
      );
      return { success: true, supervisors: serializedSupervisors };
    } catch (error) {
      console.error(`[ChatController] Error in getSupervisors:`, error);
      console.error(`[ChatController] Error stack:`, error.stack);
      return { success: true, supervisors: [] };
    }
  }

  // GET /chat/rooms
  @Get('rooms')
  async getRooms(@Req() req: any) {
    try {
      // Map req.user (from JWT) to format expected by chat service
      const jwtUser = req.user; // { email, userId, role, grupo }

      console.log(`[ChatController] getRooms called for user:`, {
        userId: jwtUser.userId,
        grupo: jwtUser.grupo,
      });

      // Get centro_id from DB raw query (CENTRO TRABAJO field)
      let centroTrabajo = null;
      try {
        const centroRaw = await this.prisma.$queryRaw<any[]>`
          SELECT \`CENTRO TRABAJO\` as centro_trabajo 
          FROM DatosEmpleados 
          WHERE CODIGO = ${jwtUser.userId}
        `;
        centroTrabajo = centroRaw?.[0]?.centro_trabajo || null;
      } catch (error) {
        console.error(`[ChatController] Error fetching centro_trabajo:`, error);
        // Continue with null centro_id
      }

      // Use a deterministic hash of centro name to create a consistent ID
      const centroId = this.calculateCentroId(centroTrabajo);

      console.log(
        `[ChatController] User ${jwtUser.userId} - centroTrabajo: ${centroTrabajo}, centroId: ${centroId}`,
      );

      // Map role from JWT to chat service format
      const mapRole = (
        role: string | undefined,
        grupo: string | undefined,
      ): 'empleado' | 'supervisor' | 'admin' | 'superadmin' => {
        const grupoStr = grupo || '';
        if (grupoStr === 'Developer') return 'superadmin';
        if (grupoStr === 'Admin') return 'admin';
        if (grupoStr === 'Supervisor' || grupoStr === 'Manager')
          return 'supervisor';
        return 'empleado';
      };

      const chatUser = {
        id: Number(jwtUser.userId),
        role: mapRole(jwtUser.role, jwtUser.grupo),
        firma_id: 1, // Default to 1 for now - can be extracted from EMPRESA field later
        centro_id: centroId,
      };

      console.log(`[ChatController] chatUser:`, {
        id: chatUser.id,
        role: chatUser.role,
        centro_id: chatUser.centro_id,
      });

      const rooms = await this.chatService.listRoomsForUser(chatUser);
      console.log(`[ChatController] Rooms found: ${rooms.length}`);

      // Get centro names for all centro rooms
      const centroIds = rooms
        .filter((r) => r.tipo === 'centro' && r.centro_id !== null)
        .map((r) => Number(r.centro_id));

      const centroNamesMap = new Map<number, string>();
      if (centroIds.length > 0) {
        try {
          // Fetch all distinct centro names and map them by calculated ID
          // This matches the way we calculate centro_id from centro_trabajo
          const allCentros = await this.prisma.$queryRaw<any[]>`
            SELECT DISTINCT \`CENTRO TRABAJO\` as centro_trabajo
            FROM DatosEmpleados
            WHERE \`CENTRO TRABAJO\` IS NOT NULL AND \`CENTRO TRABAJO\` != ''
          `;

          // Map centro names by calculating their ID using the same hash function
          allCentros.forEach((centro: any) => {
            if (centro.centro_trabajo) {
              const id = this.calculateCentroId(centro.centro_trabajo);
              if (
                id !== null &&
                centroIds.includes(id) &&
                !centroNamesMap.has(id)
              ) {
                centroNamesMap.set(id, centro.centro_trabajo);
              }
            }
          });
        } catch (error) {
          console.error(`[ChatController] Error fetching centro names:`, error);
        }
      }

      // Convert BigInt fields to numbers for JSON serialization and add centro_nombre
      // Also include members for DM rooms
      const serializedRooms = await Promise.all(
        rooms.map(async (room) => {
          const baseRoom = {
            id: Number(room.id),
            firma_id: Number(room.firma_id),
            tipo: room.tipo,
            centro_id: room.centro_id ? Number(room.centro_id) : null,
            created_by: Number(room.created_by),
            created_at: room.created_at,
          };

          // Add centro name for centro type rooms
          if (room.tipo === 'centro' && room.centro_id !== null) {
            const centroId = Number(room.centro_id);
            const centroNombre =
              centroNamesMap.get(centroId) || `Centro #${centroId}`;
            return { ...baseRoom, centro_nombre: centroNombre };
          }

          // Add members for DM rooms
          if (room.tipo === 'dm') {
            const roomWithMembers = await this.chatService.getRoomWithMembers(
              room.id,
            );
            return {
              ...baseRoom,
              members: roomWithMembers.members.map((m) => ({
                id: Number(m.id),
                room_id: Number(m.room_id),
                user_id: Number(m.user_id),
                rol_in_room: m.rol_in_room,
                created_at: m.created_at,
              })),
            };
          }

          return baseRoom;
        }),
      );

      return {
        success: true,
        rooms: serializedRooms,
        user_centro: centroTrabajo || null, // Include user's centro for frontend
      };
    } catch (error) {
      console.error(`[ChatController] Error in getRooms:`, error);
      throw error;
    }
  }

  // GET /chat/rooms/:roomId/messages?after&limit
  @Get('rooms/:roomId/messages')
  async getMessages(
    @Req() req: any,
    @Param('roomId') roomIdParam: string,
    @Query('after') after?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const jwtUser = req.user; // { email, userId, role, grupo }
      const roomId = BigInt(roomIdParam);
      const limitNum = limit ? Number(limit) : 50;
      const room = await this.chatService.getRoomWithMembers(roomId);
      if (!room) throw new NotFoundException('Room not found');

      // Get centro_id for permission check
      let centroTrabajo = null;
      try {
        const centroRaw = await this.prisma.$queryRaw<any[]>`
          SELECT \`CENTRO TRABAJO\` as centro_trabajo 
          FROM DatosEmpleados 
          WHERE CODIGO = ${Number(jwtUser.userId)}
        `;
        centroTrabajo = centroRaw?.[0]?.centro_trabajo || null;
      } catch (error) {
        console.error(
          `[ChatController] Error fetching centro_trabajo for getMessages:`,
          error,
        );
      }
      const centroId = this.calculateCentroId(centroTrabajo);

      // Map role from JWT to chat service format
      const mapRole = (
        role: string | undefined,
        grupo: string | undefined,
      ): 'empleado' | 'supervisor' | 'admin' | 'superadmin' => {
        const grupoStr = grupo || '';
        if (grupoStr === 'Developer') return 'superadmin';
        if (grupoStr === 'Admin') return 'admin';
        if (grupoStr === 'Supervisor' || grupoStr === 'Manager')
          return 'supervisor';
        return 'empleado';
      };
      const userRole = mapRole(jwtUser.role, jwtUser.grupo);

      const chatUser = {
        id: Number(jwtUser.userId),
        role: userRole,
        firma_id: 1, // Default to 1 for now
        centro_id: centroId,
      };

      // permission: user must be member or allowed by role
      const isMember = room.members.some(
        (m) => m.user_id === BigInt(chatUser.id),
      );
      const isAdmin =
        chatUser.role === 'superadmin' ||
        (chatUser.role === 'admin' &&
          room.firma_id === BigInt(chatUser.firma_id));

      // For centro rooms: all users from the same centro have access automatically
      const isCentroRoomAccess =
        room.tipo === 'centro' &&
        room.centro_id !== null &&
        chatUser.centro_id !== null &&
        room.centro_id === BigInt(chatUser.centro_id);

      if (!(isMember || isAdmin || isCentroRoomAccess)) {
        throw new ForbiddenException();
      }

      const messages = await this.chatService.getMessages(
        roomId,
        after,
        limitNum,
      );

      // Convert BigInt fields to numbers for JSON serialization and include read_by info
      const serializedMessages = messages.map((msg) => ({
        id: Number(msg.id),
        room_id: Number(msg.room_id),
        user_id: Number(msg.user_id),
        message: msg.message,
        created_at: msg.created_at,
        read_by:
          msg.reads?.map((read) => ({
            user_id: Number(read.user_id),
            read_at: read.read_at,
          })) || [],
      }));

      return { success: true, messages: serializedMessages };
    } catch (error) {
      console.error(`[ChatController] Error in getMessages:`, error);
      throw error;
    }
  }

  // POST /chat/rooms/supervisor-group - Create or get supervisor group chat (MUST be before /rooms/:roomId)
  @Post('rooms/supervisor-group')
  async createSupervisorGroupRoom(@Req() req: any) {
    try {
      const jwtUser = req.user;
      const userId = Number(jwtUser.userId);

      // All users can create supervisor group chat (DM with themselves + all supervisors/developers)
      const room = await this.chatService.ensureSupervisorGroupRoom(1, userId);

      console.log(
        `[ChatController] createSupervisorGroupRoom - Room created/retrieved with ${room.members.length} members`,
      );
      console.log(
        `[ChatController] Member user IDs:`,
        room.members.map((m) => Number(m.user_id)),
      );

      // Convert BigInt fields to numbers for JSON serialization
      const serializedRoom = {
        id: Number(room.id),
        firma_id: Number(room.firma_id),
        tipo: room.tipo,
        centro_id: room.centro_id ? Number(room.centro_id) : null,
        created_by: Number(room.created_by),
        created_at: room.created_at,
        members: room.members.map((m) => ({
          id: Number(m.id),
          room_id: Number(m.room_id),
          user_id: Number(m.user_id),
          rol_in_room: m.rol_in_room,
          created_at: m.created_at,
        })),
      };

      return { success: true, room: serializedRoom };
    } catch (error) {
      console.error(
        `[ChatController] Error in createSupervisorGroupRoom:`,
        error,
      );
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw error;
    }
  }

  // POST /chat/rooms/:roomId/messages
  @Post('rooms/:roomId/messages')
  async postMessage(
    @Req() req: any,
    @Param('roomId') roomIdParam: string,
    @Body() body: { message: string },
  ) {
    try {
      const jwtUser = req.user; // { email, userId, role, grupo }
      const roomId = BigInt(roomIdParam);
      if (!body?.message || typeof body.message !== 'string') {
        throw new ForbiddenException('Message required');
      }
      const room = await this.chatService.getRoomWithMembers(roomId);
      if (!room) throw new NotFoundException('Room not found');

      const userId = Number(jwtUser.userId);
      const isMember = room.members.some((m) => m.user_id === BigInt(userId));

      // Get centro_id for permission check
      let centroTrabajo = null;
      try {
        const centroRaw = await this.prisma.$queryRaw<any[]>`
          SELECT \`CENTRO TRABAJO\` as centro_trabajo 
          FROM DatosEmpleados 
          WHERE CODIGO = ${userId}
        `;
        centroTrabajo = centroRaw?.[0]?.centro_trabajo || null;
      } catch (error) {
        console.error(
          `[ChatController] Error fetching centro_trabajo for postMessage:`,
          error,
        );
      }
      const centroId = this.calculateCentroId(centroTrabajo);

      // Map role from JWT to chat service format
      const mapRole = (
        role: string | undefined,
        grupo: string | undefined,
      ): 'empleado' | 'supervisor' | 'admin' | 'superadmin' => {
        const grupoStr = grupo || '';
        if (grupoStr === 'Developer') return 'superadmin';
        if (grupoStr === 'Admin') return 'admin';
        if (grupoStr === 'Supervisor' || grupoStr === 'Manager')
          return 'supervisor';
        return 'empleado';
      };
      const userRole = mapRole(jwtUser.role, jwtUser.grupo);

      const chatUser = {
        id: userId,
        role: userRole,
        firma_id: 1, // Default to 1 for now
        centro_id: centroId,
      };

      const isAdmin =
        chatUser.role === 'superadmin' ||
        (chatUser.role === 'admin' &&
          room.firma_id === BigInt(chatUser.firma_id));

      // For centro rooms: all users from the same centro have access automatically
      const isCentroRoomAccess =
        room.tipo === 'centro' &&
        room.centro_id !== null &&
        chatUser.centro_id !== null &&
        room.centro_id === BigInt(chatUser.centro_id);

      if (!(isMember || isAdmin || isCentroRoomAccess)) {
        throw new ForbiddenException();
      }

      await this.chatService.postMessage(roomId, userId, body.message);

      // Notificare pentru ceilalți membri ai camerei
      const senderName =
        jwtUser?.nombre ||
        jwtUser?.name ||
        jwtUser?.email ||
        `Usuario ${userId}`;
      const recipients = room.members
        .map((m) => Number(m.user_id))
        .filter((uid) => uid !== userId);
      if (recipients.length > 0) {
        const preview =
          body.message.length > 80
            ? `${body.message.slice(0, 80)}...`
            : body.message;
        await Promise.all(
          recipients.map((uid) =>
            this.notificationsService.notifyUser(String(userId), String(uid), {
              type: 'info',
              title: `Nuevo mensaje de ${senderName}`,
              message: preview || 'Mensaje nuevo',
              data: { roomId: Number(roomId), from: userId },
            }),
          ),
        );
      }

      return { success: true };
    } catch (error) {
      console.error(`[ChatController] Error in postMessage:`, error);
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw error;
    }
  }

  // POST /chat/rooms/:roomId/messages/read - Mark messages as read (must be after /messages)
  @Post('rooms/:roomId/messages/read')
  async markMessagesAsRead(
    @Req() req: any,
    @Param('roomId') roomIdParam: string,
    @Body() body: { messageIds: number[] },
  ) {
    try {
      const jwtUser = req.user;
      const roomId = BigInt(roomIdParam);
      const userId = Number(jwtUser.userId);

      if (
        !body?.messageIds ||
        !Array.isArray(body.messageIds) ||
        body.messageIds.length === 0
      ) {
        throw new ForbiddenException('messageIds array required');
      }

      // Verify user has access to the room
      const room = await this.chatService.getRoomWithMembers(roomId);
      if (!room) throw new NotFoundException('Room not found');

      // Get centro_id for permission check
      let centroTrabajo = null;
      try {
        const centroRaw = await this.prisma.$queryRaw<any[]>`
          SELECT \`CENTRO TRABAJO\` as centro_trabajo 
          FROM DatosEmpleados 
          WHERE CODIGO = ${userId}
        `;
        centroTrabajo = centroRaw?.[0]?.centro_trabajo || null;
      } catch (error) {
        console.error(
          `[ChatController] Error fetching centro_trabajo for markAsRead:`,
          error,
        );
      }
      const centroId = this.calculateCentroId(centroTrabajo);

      // Map role from JWT to chat service format
      const mapRole = (
        role: string | undefined,
        grupo: string | undefined,
      ): 'empleado' | 'supervisor' | 'admin' | 'superadmin' => {
        const grupoStr = grupo || '';
        if (grupoStr === 'Developer') return 'superadmin';
        if (grupoStr === 'Admin') return 'admin';
        if (grupoStr === 'Supervisor' || grupoStr === 'Manager')
          return 'supervisor';
        return 'empleado';
      };
      const userRole = mapRole(jwtUser.role, jwtUser.grupo);

      const chatUser = {
        id: userId,
        role: userRole,
        firma_id: 1,
        centro_id: centroId,
      };

      // Permission check
      const isMember = room.members.some(
        (m) => m.user_id === BigInt(chatUser.id),
      );
      const isAdmin =
        chatUser.role === 'superadmin' ||
        (chatUser.role === 'admin' &&
          room.firma_id === BigInt(chatUser.firma_id));

      // For centro rooms: all users from the same centro have access automatically
      const isCentroRoomAccess =
        room.tipo === 'centro' &&
        room.centro_id !== null &&
        chatUser.centro_id !== null &&
        room.centro_id === BigInt(chatUser.centro_id);

      if (!(isMember || isAdmin || isCentroRoomAccess)) {
        throw new ForbiddenException(
          'Not authorized to mark messages as read in this room',
        );
      }

      // Verify all message IDs belong to this room
      const messageIds = body.messageIds.map((id) => BigInt(id));
      const messages = await this.prisma.chatMessage.findMany({
        where: {
          id: { in: messageIds },
          room_id: roomId,
        },
        select: { id: true },
      });

      if (messages.length !== messageIds.length) {
        throw new ForbiddenException(
          'Some messages do not belong to this room',
        );
      }

      // Mark messages as read
      console.log(
        `[ChatController] Marking messages as read. Room: ${roomId}, User: ${userId}, Message IDs:`,
        messageIds,
      );
      await this.chatService.markMessagesAsRead(messageIds, userId);
      console.log(`[ChatController] Successfully marked messages as read`);

      return { success: true, message: 'Messages marked as read' };
    } catch (error) {
      console.error(`[ChatController] Error in markMessagesAsRead:`, error);
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw error;
    }
  }

  // POST /chat/rooms/centro - Create a centro room manually
  @Post('rooms/centro')
  async createCentroRoom(
    @Req() req: any,
    @Body() body: { centro_id?: number; centro_nombre?: string },
  ) {
    try {
      const jwtUser = req.user;
      const userId = Number(jwtUser.userId);

      // Get centro_id from body or calculate from centro_nombre, or use user's centro
      let centroId: number | null = null;
      let centroNombre: string | null = null;

      if (body.centro_id) {
        centroId = body.centro_id;
      } else if (body.centro_nombre) {
        centroNombre = body.centro_nombre;
        centroId = this.calculateCentroId(centroNombre);
      } else {
        // Use user's centro
        let centroTrabajo = null;
        try {
          const centroRaw = await this.prisma.$queryRaw<any[]>`
            SELECT \`CENTRO TRABAJO\` as centro_trabajo 
            FROM DatosEmpleados 
            WHERE CODIGO = ${userId}
          `;
          centroTrabajo = centroRaw?.[0]?.centro_trabajo || null;
        } catch (error) {
          console.error(
            `[ChatController] Error fetching centro_trabajo:`,
            error,
          );
        }
        if (centroTrabajo) {
          centroNombre = centroTrabajo;
          centroId = this.calculateCentroId(centroTrabajo);
        }
      }

      if (!centroId) {
        throw new ForbiddenException('centro_id or centro_nombre required');
      }

      // Check if room already exists
      const existing = await this.prisma.chatRoom.findFirst({
        where: { tipo: 'centro', centro_id: BigInt(centroId) },
      });

      if (existing) {
        // Return existing room
        // const roomWithMembers = await this.chatService.getRoomWithMembers(
        //   existing.id,
        // ); // Not used currently
        const centroName = centroNombre || `Centro #${centroId}`;
        return {
          success: true,
          room: {
            id: Number(existing.id),
            firma_id: Number(existing.firma_id),
            tipo: existing.tipo,
            centro_id: Number(existing.centro_id),
            centro_nombre: centroName,
            created_by: Number(existing.created_by),
            created_at: existing.created_at,
          },
          message: 'Room already exists',
        };
      }

      // Create new centro room
      const centroRoom = await this.chatService.ensureCentroRoom(
        1,
        centroId,
        userId,
      );
      const centroName = centroNombre || `Centro #${centroId}`;

      return {
        success: true,
        room: {
          id: Number(centroRoom.id),
          firma_id: Number(centroRoom.firma_id),
          tipo: centroRoom.tipo,
          centro_id: Number(centroRoom.centro_id),
          centro_nombre: centroName,
          created_by: Number(centroRoom.created_by),
          created_at: centroRoom.created_at,
        },
        message: 'Centro room created',
      };
    } catch (error) {
      console.error(`[ChatController] Error in createCentroRoom:`, error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw error;
    }
  }

  // POST /chat/rooms/dm
  @Post('rooms/dm')
  async ensureDm(
    @Req() req: any,
    @Body() body: { user_id?: number; colleague_id?: number }, // Updated: support peer-to-peer DM
  ) {
    const current = req.user;
    const currentUserId = Number(current.userId);

    // Support both old format (supervisor_id/empleado_id) and new format (user_id/colleague_id)
    const otherUserId = body.colleague_id || body.user_id || null;
    if (!otherUserId) {
      throw new ForbiddenException('colleague_id or user_id required');
    }

    // Cannot create DM with yourself
    if (otherUserId === currentUserId) {
      throw new ForbiddenException('Cannot create DM with yourself');
    }

    // Get centro_id for current user
    const centroRaw = await this.prisma.$queryRaw<any[]>`
      SELECT \`CENTRO TRABAJO\` as centro_trabajo 
      FROM DatosEmpleados 
      WHERE CODIGO = ${currentUserId}
    `;
    const centroTrabajo = centroRaw?.[0]?.centro_trabajo || null;
    const centroId = this.calculateCentroId(centroTrabajo);

    // Verify permissions for creating DM
    try {
      const otherUserRaw = await this.prisma.$queryRaw<any[]>`
          SELECT 
            \`CENTRO TRABAJO\` as centro_trabajo,
            GRUPO as grupo
          FROM DatosEmpleados 
          WHERE CODIGO = ${otherUserId}
        `;
      const otherUser = otherUserRaw?.[0] || null;
      if (!otherUser) {
        throw new NotFoundException('Other user not found');
      }

      const otherUserCentro = otherUser.centro_trabajo || null;
      const otherCentroId = this.calculateCentroId(otherUserCentro);
      const otherUserGrupo = otherUser.grupo || '';

      // Map roles
      const mapRole = (role: string, grupo: string) => {
        if (grupo === 'Developer') return 'superadmin';
        if (grupo === 'Admin') return 'admin';
        if (grupo === 'Supervisor' || grupo === 'Manager') return 'supervisor';
        return 'empleado';
      };
      const userRole = mapRole(current.role, current.grupo);
      const otherUserRole = mapRole('', otherUserGrupo);

      // Allow DM if:
      // 1. Both users are from the same centro, OR
      // 2. Current user is admin/superadmin, OR
      // 3. Other user is supervisor/developer (empleados can chat with supervisors/developers)
      const sameCentro = centroId !== null && centroId === otherCentroId;
      const isAdminOrSuperadmin =
        userRole === 'superadmin' || userRole === 'admin';
      const otherIsSupervisorOrDeveloper =
        otherUserRole === 'supervisor' || otherUserRole === 'superadmin';

      if (
        !sameCentro &&
        !isAdminOrSuperadmin &&
        userRole === 'empleado' &&
        !otherIsSupervisorOrDeveloper
      ) {
        throw new ForbiddenException(
          'Users must be from the same centro, or empleados can only chat with supervisors/developers',
        );
      }
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      )
        throw error;
      console.error(`[ChatController] Error verifying centro for DM:`, error);
    }

    // Create DM room between the two users
    const dm = await this.chatService.ensureDmRoom(
      1, // firma_id default
      centroId,
      currentUserId,
      Math.min(currentUserId, otherUserId), // Use smaller ID as first user
      Math.max(currentUserId, otherUserId), // Use larger ID as second user
    );

    // Convert BigInt fields to numbers for JSON serialization
    const serializedRoom = {
      id: Number(dm.id),
      firma_id: Number(dm.firma_id),
      tipo: dm.tipo,
      centro_id: dm.centro_id ? Number(dm.centro_id) : null,
      created_by: Number(dm.created_by),
      created_at: dm.created_at,
      members: dm.members.map((m) => ({
        id: Number(m.id),
        room_id: Number(m.room_id),
        user_id: Number(m.user_id),
        rol_in_room: m.rol_in_room,
        created_at: m.created_at,
      })),
    };

    return { success: true, room: serializedRoom };
  }

  // GET /chat/rooms/:roomId/presence
  @Get('rooms/:roomId/presence')
  async getRoomPresence(@Req() req: any, @Param('roomId') roomIdParam: string) {
    try {
      const roomId = BigInt(roomIdParam);
      const room = await this.chatService.getRoomWithMembers(roomId);
      if (!room) throw new NotFoundException('Room not found');

      // Map role from JWT to chat service format
      const mapRole = (
        role: string | undefined,
        grupo: string | undefined,
      ): 'empleado' | 'supervisor' | 'admin' | 'superadmin' => {
        const grupoStr = grupo || '';
        if (grupoStr === 'Developer') return 'superadmin';
        if (grupoStr === 'Admin') return 'admin';
        if (grupoStr === 'Supervisor' || grupoStr === 'Manager')
          return 'supervisor';
        return 'empleado';
      };

      const jwtUser = req.user;
      const chatUser = {
        id: Number(jwtUser.userId),
        role: mapRole(jwtUser.role, jwtUser.grupo),
        firma_id: 1, // Default to 1 for now
        centro_id: this.calculateCentroId(null), // Will be calculated below if needed
      };

      // Get centro_id for permission check
      let centroTrabajo = null;
      try {
        const centroRaw = await this.prisma.$queryRaw<any[]>`
          SELECT \`CENTRO TRABAJO\` as centro_trabajo 
          FROM DatosEmpleados 
          WHERE CODIGO = ${Number(jwtUser.userId)}
        `;
        centroTrabajo = centroRaw?.[0]?.centro_trabajo || null;
      } catch (error) {
        console.error(
          `[ChatController] Error fetching centro_trabajo for presence:`,
          error,
        );
      }
      chatUser.centro_id = this.calculateCentroId(centroTrabajo);

      // Permission: user must be member or allowed by role
      const isMember = room.members.some(
        (m) => m.user_id === BigInt(chatUser.id),
      );
      const isAdmin =
        chatUser.role === 'superadmin' ||
        (chatUser.role === 'admin' &&
          room.firma_id === BigInt(chatUser.firma_id));

      // For centro rooms: all users from the same centro have access automatically
      const isCentroRoomAccess =
        room.tipo === 'centro' &&
        room.centro_id !== null &&
        chatUser.centro_id !== null &&
        room.centro_id === BigInt(chatUser.centro_id);

      if (!(isMember || isAdmin || isCentroRoomAccess)) {
        throw new ForbiddenException('Access denied to this room');
      }

      // Get all member user IDs
      const memberUserIds = room.members.map((m) => String(m.user_id));

      // Get presence for all members
      const presences = this.presenceManager.getUsersPresence(memberUserIds);

      // Format response
      const presenceArray = Array.from(presences.entries()).map(
        ([userId, presence]) => ({
          userId,
          online: presence.online,
          lastSeen: presence.lastSeen?.toISOString() || null,
        }),
      );

      return {
        success: true,
        roomId: Number(roomId),
        presences: presenceArray,
      };
    } catch (error) {
      console.error(`[ChatController] Error in getRoomPresence:`, error);
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw error;
    }
  }

  @Delete('rooms/:roomId')
  async deleteRoom(@Req() req: any, @Param('roomId') roomIdParam: string) {
    try {
      const jwtUser = req.user;
      const roomId = BigInt(roomIdParam);

      // Map role from JWT to chat service format
      const mapRole = (
        role: string | undefined,
        grupo: string | undefined,
      ): 'empleado' | 'supervisor' | 'admin' | 'superadmin' => {
        const grupoStr = grupo || '';
        if (grupoStr === 'Developer') return 'superadmin';
        if (grupoStr === 'Admin') return 'admin';
        if (grupoStr === 'Supervisor' || grupoStr === 'Manager')
          return 'supervisor';
        return 'empleado';
      };

      const userRole = mapRole(jwtUser.role, jwtUser.grupo);

      // Only superadmin (Developer) can delete rooms
      if (userRole !== 'superadmin') {
        throw new ForbiddenException('Only developers can delete chat rooms');
      }

      // Check if room exists
      const room = await this.chatService.getRoomWithMembers(roomId);
      if (!room) {
        throw new NotFoundException('Room not found');
      }

      // Get message count before deletion (for logging)
      const messageCount = await this.chatService.getRoomMessageCount(roomId);
      console.log(
        `[ChatController] Developer ${jwtUser.userId} deleting room ${roomId} with ${messageCount} messages`,
      );

      // Delete room (messages and members will be deleted via CASCADE)
      await this.chatService.deleteRoom(roomId);

      return { success: true, message: 'Room deleted successfully' };
    } catch (error) {
      console.error(`[ChatController] Error in deleteRoom:`, error);
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw error;
    }
  }
}
