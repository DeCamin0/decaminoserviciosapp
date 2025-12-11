import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

interface UserPresence {
  connectionCount: number;
  lastSeen: Date | null;
  isOnline: boolean;
}

/**
 * PresenceManager - Gestionează starea de prezență a utilizatorilor
 *
 * Menține în memorie:
 * - Numărul de conexiuni active pentru fiecare user
 * - Last seen timestamp
 * - Starea online/offline
 */
@Injectable()
export class PresenceManager {
  private readonly logger = new Logger(PresenceManager.name);

  // Map<userId, UserPresence>
  private userPresences = new Map<string, UserPresence>();

  // Map<socketId, userId> - pentru a știi care socket aparține cărui user
  private socketToUser = new Map<string, string>();

  // Store servers for different namespaces so we can emit to all
  private notificationServer: Server | null = null;
  private chatServer: Server | null = null;

  /**
   * Register a server for a namespace
   */
  registerServer(namespace: string, server: Server) {
    if (namespace === '/notifications') {
      this.notificationServer = server;
      this.logger.log('Registered notifications server for presence events');
    } else if (namespace === '/chat') {
      this.chatServer = server;
      this.logger.log('Registered chat server for presence events');
    }
  }

  /**
   * Emit presence event to all registered servers
   */
  private emitToAllServers(event: string, data: any) {
    const servers = [this.notificationServer, this.chatServer].filter(
      (s) => s !== null,
    ) as Server[];
    this.logger.log(`Emitting ${event} to ${servers.length} namespace(s)`);
    for (const server of servers) {
      try {
        server.emit(event, data);
      } catch (error) {
        this.logger.error(`Error emitting ${event} to server: ${error}`);
      }
    }
  }

  /**
   * Incrementează numărul de conexiuni pentru un user
   * Returnează true dacă userul a trecut de la offline la online
   */
  userConnected(socketId: string, userId: string, server: Server): boolean {
    const userPresence = this.userPresences.get(userId) || {
      connectionCount: 0,
      lastSeen: null,
      isOnline: false,
    };

    const wasOnline = userPresence.isOnline;
    userPresence.connectionCount++;
    userPresence.isOnline = true;

    this.userPresences.set(userId, userPresence);
    this.socketToUser.set(socketId, userId);

    this.logger.log(
      `User ${userId} connected (socket: ${socketId}, connections: ${userPresence.connectionCount})`,
    );

    // Dacă userul trece de la offline la online, emite eveniment
    if (!wasOnline) {
      this.logger.log(
        `User ${userId} is now ONLINE - emitting presence:online event`,
      );

      // Emite eveniment pe toate namespace-urile (notifications și chat)
      this.emitToAllServers('presence:online', {
        userId,
        timestamp: new Date().toISOString(),
      });

      // De asemenea, emite pe server-ul curent (pentru backwards compatibility)
      try {
        server.emit('presence:online', {
          userId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.logger.warn(`Error emitting to current server: ${error}`);
      }

      return true;
    }

    return false;
  }

  /**
   * Decrementează numărul de conexiuni pentru un user
   * Returnează true dacă userul a trecut de la online la offline
   */
  userDisconnected(
    socketId: string,
    server: Server,
  ): { userId: string; wentOffline: boolean } | null {
    const userId = this.socketToUser.get(socketId);
    if (!userId) {
      return null;
    }

    const userPresence = this.userPresences.get(userId);
    if (!userPresence) {
      this.socketToUser.delete(socketId);
      return null;
    }

    const wasOnline = userPresence.isOnline;
    userPresence.connectionCount--;

    if (userPresence.connectionCount <= 0) {
      userPresence.connectionCount = 0;
      userPresence.isOnline = false;
      userPresence.lastSeen = new Date();

      this.logger.log(
        `User ${userId} is now OFFLINE (last seen: ${userPresence.lastSeen.toISOString()}) - emitting presence:offline event`,
      );

      // Emite eveniment pe toate namespace-urile (notifications și chat)
      this.emitToAllServers('presence:offline', {
        userId,
        lastSeen: userPresence.lastSeen.toISOString(),
        timestamp: new Date().toISOString(),
      });

      // De asemenea, emite pe server-ul curent (pentru backwards compatibility)
      try {
        server.emit('presence:offline', {
          userId,
          lastSeen: userPresence.lastSeen.toISOString(),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.logger.warn(`Error emitting to current server: ${error}`);
      }
    } else {
      this.logger.log(
        `User ${userId} disconnected (socket: ${socketId}, remaining connections: ${userPresence.connectionCount})`,
      );
    }

    this.userPresences.set(userId, userPresence);
    this.socketToUser.delete(socketId);

    return {
      userId,
      wentOffline: wasOnline && !userPresence.isOnline,
    };
  }

  /**
   * Verifică dacă un user este online
   */
  isUserOnline(userId: string): boolean {
    const presence = this.userPresences.get(userId);
    return presence?.isOnline || false;
  }

  /**
   * Obține last seen pentru un user
   */
  getUserLastSeen(userId: string): Date | null {
    const presence = this.userPresences.get(userId);
    return presence?.lastSeen || null;
  }

  /**
   * Obține starea de prezență pentru un user
   */
  getUserPresence(userId: string): { online: boolean; lastSeen: Date | null } {
    const presence = this.userPresences.get(userId);
    if (!presence) {
      return { online: false, lastSeen: null };
    }
    return {
      online: presence.isOnline,
      lastSeen: presence.lastSeen,
    };
  }

  /**
   * Obține starea de prezență pentru mai mulți useri
   */
  getUsersPresence(
    userIds: string[],
  ): Map<string, { online: boolean; lastSeen: Date | null }> {
    const result = new Map<
      string,
      { online: boolean; lastSeen: Date | null }
    >();

    for (const userId of userIds) {
      result.set(userId, this.getUserPresence(userId));
    }

    return result;
  }

  /**
   * Obține numărul total de utilizatori online
   */
  getOnlineUsersCount(): number {
    let count = 0;
    for (const presence of this.userPresences.values()) {
      if (presence.isOnline) {
        count++;
      }
    }
    return count;
  }
}
