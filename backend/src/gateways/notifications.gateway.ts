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

/**
 * WebSocket Gateway pentru notificări în timp real
 * Suportă:
 * - Autentificare cu JWT
 * - Rooms per utilizator, grup, centru
 * - Notificări broadcast și targeted
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedUsers = new Map<string, string>(); // socketId -> userId
  private userConnectionCount = new Map<string, number>(); // userId -> active sockets count

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Called when gateway is initialized
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  afterInit(_server: Server) {
    this.logger.log('NotificationsGateway initialized');
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

      // Salvează conexiunea
      const userId = String(payload.userId);
      this.connectedUsers.set(client.id, userId);

      // Actualizează numărul de conexiuni active per user
      const currentCount = this.userConnectionCount.get(userId) || 0;
      this.userConnectionCount.set(userId, currentCount + 1);

      // Join la room-urile utilizatorului
      await client.join(`user:${userId}`);

      if (payload.grupo) {
        await client.join(`grupo:${payload.grupo}`);
      }

      this.logger.log(`User ${userId} connected (socket: ${client.id})`);

      // Trimite confirmare conexiune
      client.emit('connected', {
        userId,
        message: 'Connected to notifications',
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
    const userId = this.connectedUsers.get(client.id);
    if (userId) {
      this.logger.log(`User ${userId} disconnected (socket: ${client.id})`);
      this.connectedUsers.delete(client.id);

      const currentCount = this.userConnectionCount.get(userId) || 0;
      if (currentCount <= 1) {
        this.userConnectionCount.delete(userId);
      } else {
        this.userConnectionCount.set(userId, currentCount - 1);
      }
    }
  }

  /**
   * Mesaj pentru join la un room suplimentar (ex: centru de lucru)
   */
  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    if (data?.room) {
      client.join(data.room);
      this.logger.log(`Socket ${client.id} joined room: ${data.room}`);
      client.emit('room-joined', { room: data.room });
    }
  }

  /**
   * Mesaj pentru leave dintr-un room
   */
  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    if (data?.room) {
      client.leave(data.room);
      this.logger.log(`Socket ${client.id} left room: ${data.room}`);
      client.emit('room-left', { room: data.room });
    }
  }

  /**
   * Trimite notificare către un utilizator specific
   */
  sendToUser(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', notification);
    this.logger.log(`Notification sent to user: ${userId}`);
  }

  /**
   * Trimite notificare către un grup
   */
  sendToGroup(grupo: string, notification: any) {
    this.server.to(`grupo:${grupo}`).emit('notification', notification);
    this.logger.log(`Notification sent to group: ${grupo}`);
  }

  /**
   * Trimite notificare către un centru de lucru
   */
  sendToCentro(centro: string, notification: any) {
    this.server.to(`centro:${centro}`).emit('notification', notification);
    this.logger.log(`Notification sent to centro: ${centro}`);
  }

  /**
   * Broadcast notificare către toți utilizatorii conectați
   */
  broadcast(notification: any) {
    this.server.emit('notification', notification);
    this.logger.log('Notification broadcasted to all users');
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
   * Obține numărul de utilizatori conectați
   */
  getConnectedUsersCount(): number {
    return this.userConnectionCount.size;
  }

  /**
   * Verifică dacă un utilizator este conectat
   */
  isUserConnected(userId: string): boolean {
    return this.userConnectionCount.has(userId);
  }

  /**
   * Obține lista de userId-uri care au cel puțin o conexiune WebSocket activă
   * Folosită pentru a afișa statusul online/offline în Admin/Empleados
   */
  getOnlineUserIds(): string[] {
    return Array.from(this.userConnectionCount.keys());
  }
}
