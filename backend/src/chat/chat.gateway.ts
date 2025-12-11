import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PresenceManager } from './presence-manager.service';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * WebSocket Gateway pentru chat în timp real
 * Suportă:
 * - Autentificare cu JWT
 * - Rooms pentru chat rooms
 * - Mesaje în timp real
 * - Prezență (online/offline)
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private socketToUser = new Map<
    string,
    { userId: string; roomIds: Set<string> }
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly presenceManager: PresenceManager,
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Called when gateway is initialized
   */
  afterInit(server: Server) {
    this.logger.log(
      'ChatGateway initialized, registering server with PresenceManager',
    );
    this.presenceManager.registerServer('/chat', server);
  }

  /**
   * Gestionează conexiunea unui client
   * Verifică token-ul JWT și extrage informațiile utilizatorului
   */
  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      // Verifică și decodează token-ul
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      if (!payload || !payload.userId) {
        this.logger.warn(`Connection rejected: Invalid token`);
        client.disconnect();
        return;
      }

      const userId = String(payload.userId);

      // Salvează informațiile socket-ului
      this.socketToUser.set(client.id, {
        userId,
        roomIds: new Set<string>(),
      });

      // Gestionează prezența
      this.presenceManager.userConnected(client.id, userId, this.server);

      this.logger.log(
        `User ${userId} connected to chat (socket: ${client.id})`,
      );

      // Trimite confirmare conexiune
      client.emit('connected', {
        userId,
        message: 'Connected to chat',
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * Gestionează deconexiunea unui client
   */
  handleDisconnect(client: Socket) {
    const socketData = this.socketToUser.get(client.id);
    if (socketData) {
      const { userId, roomIds } = socketData;

      // Leave toate room-urile
      for (const roomId of roomIds) {
        client.leave(`room:${roomId}`);
      }

      // Gestionează prezența
      this.presenceManager.userDisconnected(client.id, this.server);

      this.logger.log(
        `User ${userId} disconnected from chat (socket: ${client.id})`,
      );
      this.socketToUser.delete(client.id);
    }
  }

  /**
   * Join la un chat room
   */
  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    try {
      const socketData = this.socketToUser.get(client.id);
      if (!socketData) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { userId } = socketData;
      const roomId = data?.roomId;

      if (!roomId) {
        client.emit('error', { message: 'roomId is required' });
        return;
      }

      // Verifică permisiunile userului pentru room
      const room = await this.chatService.getRoomWithMembers(BigInt(roomId));
      if (!room) {
        client.emit('error', { message: 'Room not found' });
        return;
      }

      const userNumId = Number(userId);
      const isMember = room.members.some(
        (m) => m.user_id === BigInt(userNumId),
      );

      // Get centro_id for permission check
      let centroTrabajo = null;
      try {
        const centroRaw = await this.prisma.$queryRaw<any[]>`
          SELECT \`CENTRO TRABAJO\` as centro_trabajo 
          FROM DatosEmpleados 
          WHERE CODIGO = ${userNumId}
        `;
        centroTrabajo = centroRaw?.[0]?.centro_trabajo || null;
      } catch (error) {
        this.logger.warn(
          `Error fetching centro_trabajo for permission check: ${error}`,
        );
      }

      // Calculate centro_id
      const centroId = this.calculateCentroId(centroTrabajo);

      // Map role from JWT payload (need to get it from client data or re-fetch)
      // For now, we'll use a simple check - members can always join
      // Admin/supervisor permissions will be checked at message send time
      if (!isMember && room.tipo === 'centro') {
        // For centro rooms, check if user is from the same centro
        if (
          centroId === null ||
          room.centro_id === null ||
          room.centro_id !== BigInt(centroId)
        ) {
          client.emit('error', { message: 'Access denied to this room' });
          return;
        }
      } else if (!isMember && room.tipo === 'dm') {
        // For DM rooms, user must be a member
        client.emit('error', { message: 'Access denied to this room' });
        return;
      }

      // Join room
      await client.join(`room:${roomId}`);
      socketData.roomIds.add(roomId);

      this.logger.log(
        `User ${userId} joined room ${roomId} (socket: ${client.id})`,
      );

      client.emit('room-joined', {
        roomId,
        message: `Joined room ${roomId}`,
      });

      // Emite evenimente de prezență pentru membrii room-ului
      // Obține toți membrii room-ului
      const memberIds = room.members.map((m) => String(m.user_id));
      const presences = this.presenceManager.getUsersPresence(memberIds);

      // Trimite starea de prezență actuală către client
      const presenceData = Array.from(presences.entries()).map(
        ([memberUserId, presence]) => ({
          userId: memberUserId,
          online: presence.online,
          lastSeen: presence.lastSeen?.toISOString() || null,
        }),
      );

      client.emit('presence:update', {
        roomId,
        presences: presenceData,
      });
    } catch (error) {
      this.logger.error(`Error joining room: ${error.message}`);
      client.emit('error', { message: 'Failed to join room' });
    }
  }

  /**
   * Leave dintr-un chat room
   */
  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const socketData = this.socketToUser.get(client.id);
    if (!socketData) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const roomId = data?.roomId;
    if (!roomId) {
      client.emit('error', { message: 'roomId is required' });
      return;
    }

    client.leave(`room:${roomId}`);
    socketData.roomIds.delete(roomId);

    this.logger.log(
      `User ${socketData.userId} left room ${roomId} (socket: ${client.id})`,
    );

    client.emit('room-left', {
      roomId,
      message: `Left room ${roomId}`,
    });
  }

  /**
   * Trimite mesaj către un room
   */
  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; message: string },
  ) {
    try {
      const socketData = this.socketToUser.get(client.id);
      if (!socketData) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { userId } = socketData;
      const { roomId, message } = data || {};

      if (!roomId || !message) {
        client.emit('error', { message: 'roomId and message are required' });
        return;
      }

      const userNumId = Number(userId);

      // Salvează mesajul în DB
      await this.chatService.postMessage(BigInt(roomId), userNumId, message);

      // Broadcast mesajul către toți membrii room-ului
      this.server.to(`room:${roomId}`).emit('message', {
        roomId,
        userId,
        message,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`User ${userId} sent message to room ${roomId}`);
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  /**
   * Trimite mesaj către un room (called from service/controller)
   */
  sendMessageToRoom(roomId: string, userId: string, message: string) {
    this.server.to(`room:${roomId}`).emit('message', {
      roomId,
      userId,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Extrage token-ul JWT din handshake sau query
   */
  private extractToken(client: Socket): string | null {
    // Încearcă din query string (pentru conexiuni WebSocket)
    const token = client.handshake.query?.token as string;
    if (token) return token;

    // Încearcă din handshake auth
    const authToken = client.handshake.auth?.token as string;
    if (authToken) return authToken;

    return null;
  }

  /**
   * Calculate a deterministic numeric ID from centro name
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
    return Math.abs(hash % 2147483647);
  }
}
