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
import { PresenceManager } from '../chat/presence-manager.service';

/**
 * WebSocket Gateway pentru notificări în timp real
 * Suportă:
 * - Autentificare cu JWT
 * - Rooms per utilizator, grup, centru
 * - Notificări broadcast și targeted
 * - Prezență (online/offline) - sincronizată cu chat
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

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly presenceManager: PresenceManager,
  ) {}

  /**
   * Called when gateway is initialized
   */
  afterInit(server: Server) {
    this.logger.log(
      'NotificationsGateway initialized, registering server with PresenceManager',
    );
    this.presenceManager.registerServer('/notifications', server);
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

      // Join la room-urile utilizatorului
      await client.join(`user:${userId}`);

      if (payload.grupo) {
        await client.join(`grupo:${payload.grupo}`);
      }

      this.logger.log(`User ${userId} connected (socket: ${client.id})`);

      // Gestionează prezența - emite pe namespace-ul /notifications (care e activ când userul e logat)
      // Folosim this.server (notifications namespace) pentru a emite evenimentele
      // PresenceManager va emite pe server-ul dat, astfel încât toți cei conectați la /notifications vor primi evenimentele
      this.presenceManager.userConnected(client.id, userId, this.server);

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

      // Gestionează prezența - emite pe namespace-ul /notifications
      this.presenceManager.userDisconnected(client.id, this.server);

      this.connectedUsers.delete(client.id);
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
    return this.connectedUsers.size;
  }

  /**
   * Verifică dacă un utilizator este conectat
   */
  isUserConnected(userId: string): boolean {
    return Array.from(this.connectedUsers.values()).includes(userId);
  }
}
