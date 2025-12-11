import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatRoomType, ChatRoomMemberRole } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoomsForUser(user: {
    id: number;
    role: 'empleado' | 'supervisor' | 'admin' | 'superadmin';
    firma_id: number;
    centro_id: number | null;
  }) {
    const { role, firma_id, centro_id, id } = user;
    // const includeArchived = options?.includeArchived ?? false; // Not used currently

    // superadmin (Developer) vede toate chaturile
    if (role === 'superadmin') {
      return this.prisma.chatRoom.findMany({
        orderBy: { created_at: 'desc' }, // Cele mai recente primele
      });
    }

    if (role === 'admin') {
      return this.prisma.chatRoom.findMany({
        where: { firma_id: BigInt(firma_id) },
        orderBy: { created_at: 'desc' },
      });
    }

    // empleado: rooms where they are member OR community of their centro
    const memberRooms = await this.prisma.chatRoomMember.findMany({
      where: { user_id: BigInt(id) },
      select: { room_id: true },
    });
    const roomIds = memberRooms.map((m) => m.room_id);

    const extraWhere =
      centro_id != null
        ? {
            OR: [
              { id: { in: roomIds } },
              { tipo: ChatRoomType.centro, centro_id: BigInt(centro_id) },
            ],
          }
        : { id: { in: roomIds } };

    return this.prisma.chatRoom.findMany({
      where: extraWhere,
      orderBy: { created_at: 'desc' },
    });
  }

  async getRoomWithMembers(roomId: bigint) {
    return this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: { members: true },
    });
  }

  async getMessages(roomId: bigint, after?: string, limit: number = 50) {
    return this.prisma.chatMessage.findMany({
      where: after
        ? { room_id: roomId, created_at: { gt: new Date(after) } }
        : { room_id: roomId },
      orderBy: { created_at: 'asc' },
      take: limit,
      include: {
        reads: true, // Include read receipts
      },
    });
  }

  async markMessageAsRead(messageId: bigint, userId: number) {
    // Use upsert to avoid duplicates
    return this.prisma.chatMessageRead.upsert({
      where: {
        message_id_user_id: {
          message_id: messageId,
          user_id: BigInt(userId),
        },
      },
      update: {
        read_at: new Date(), // Update read_at if already exists
      },
      create: {
        message_id: messageId,
        user_id: BigInt(userId),
        read_at: new Date(),
      },
    });
  }

  async markMessagesAsRead(messageIds: bigint[], userId: number) {
    console.log(
      `[ChatService] markMessagesAsRead called. User: ${userId}, Message IDs:`,
      messageIds.map((id) => id.toString()),
    );

    // Mark multiple messages as read in one operation
    const data = messageIds.map((messageId) => ({
      message_id: messageId,
      user_id: BigInt(userId),
      read_at: new Date(),
    }));

    console.log(`[ChatService] Creating ${data.length} read receipts...`);
    // Use createMany with skipDuplicates for better performance
    const createResult = await this.prisma.chatMessageRead.createMany({
      data,
      skipDuplicates: true,
    });
    console.log(`[ChatService] Created ${createResult.count} read receipts`);

    // Update existing reads to refresh read_at timestamp
    const updateResult = await this.prisma.chatMessageRead.updateMany({
      where: {
        message_id: { in: messageIds },
        user_id: BigInt(userId),
      },
      data: {
        read_at: new Date(),
      },
    });
    console.log(
      `[ChatService] Updated ${updateResult.count} existing read receipts`,
    );
  }

  async postMessage(roomId: bigint, userId: number, message: string) {
    await this.prisma.chatMessage.create({
      data: {
        room_id: roomId,
        user_id: BigInt(userId),
        message,
      },
    });
  }

  async ensureCentroRoom(
    firma_id: number,
    centro_id: number,
    createdBy: number,
  ) {
    const existing = await this.prisma.chatRoom.findFirst({
      where: { tipo: ChatRoomType.centro, centro_id: BigInt(centro_id) },
    });
    if (existing) return existing;
    return this.prisma.chatRoom.create({
      data: {
        firma_id: BigInt(firma_id),
        tipo: ChatRoomType.centro,
        centro_id: BigInt(centro_id),
        created_by: BigInt(createdBy),
      },
    });
  }

  async ensureDmRoom(
    firma_id: number,
    centro_id: number | null,
    createdBy: number,
    userId1: number,
    userId2: number,
  ) {
    // Check if a DM room already exists between these two users
    const existing = await this.prisma.chatRoom.findFirst({
      where: {
        tipo: ChatRoomType.dm,
        members: {
          some: {
            user_id: BigInt(userId1),
          },
        },
      },
      include: { members: true },
    });

    // If room exists and has both users as members, return it
    if (
      existing &&
      existing.members.some((m) => m.user_id === BigInt(userId2))
    ) {
      return existing;
    }

    // Create new DM room with both users as members
    return this.prisma.chatRoom.create({
      data: {
        firma_id: BigInt(firma_id),
        tipo: ChatRoomType.dm,
        centro_id: centro_id != null ? BigInt(centro_id) : null,
        created_by: BigInt(createdBy),
        members: {
          create: [
            {
              user_id: BigInt(userId1),
              rol_in_room: ChatRoomMemberRole.member,
            },
            {
              user_id: BigInt(userId2),
              rol_in_room: ChatRoomMemberRole.member,
            },
          ],
        },
      },
      include: { members: true },
    });
  }

  async deleteRoom(roomId: bigint) {
    // Prisma will automatically delete related messages and members via CASCADE
    return this.prisma.chatRoom.delete({
      where: { id: roomId },
    });
  }

  async getRoomMessageCount(roomId: bigint): Promise<number> {
    return this.prisma.chatMessage.count({
      where: { room_id: roomId },
    });
  }

  async ensureSupervisorGroupRoom(firma_id: number, createdBy: number) {
    // Check if a supervisor group room already exists for this user
    // We identify it by: tipo = dm, centro_id = -userId (negative userId as special identifier)
    // This creates a unique chat per user with supervisors/developers
    const SPECIAL_SUPERVISOR_GROUP_ID = -createdBy; // Use negative userId as identifier

    // Check if room already exists for this user
    let existing = await this.prisma.chatRoom.findFirst({
      where: {
        tipo: ChatRoomType.dm,
        centro_id: BigInt(SPECIAL_SUPERVISOR_GROUP_ID),
      },
      include: { members: true },
    });

    // Get all supervisors and developers
    const allSupervisorsRaw = await this.prisma.$queryRaw<any[]>` 
      SELECT CODIGO as codigo, GRUPO as grupo
      FROM DatosEmpleados
      WHERE (ESTADO = 'ACTIVO' OR ESTADO IS NULL OR ESTADO = '')
        AND (GRUPO = 'Supervisor' OR GRUPO = 'Manager' OR GRUPO = 'Developer')
    `;
    const allSupervisorIds = allSupervisorsRaw.map((s: any) =>
      BigInt(s.codigo),
    );
    const createdById = BigInt(createdBy);

    // Combine user + all supervisors/developers
    const allMemberIds = [
      createdById,
      ...allSupervisorIds.filter((id) => id !== createdById),
    ];

    console.log(
      `[ChatService] ensureSupervisorGroupRoom - User: ${createdBy}, Found ${allSupervisorIds.length} supervisors/developers`,
    );
    console.log(
      `[ChatService] Found users:`,
      allSupervisorsRaw.map((s: any) => ({
        codigo: Number(s.codigo),
        grupo: s.grupo,
      })),
    );
    console.log(
      `[ChatService] Total members (including user ${createdBy}): ${allMemberIds.length}`,
    );
    console.log(
      `[ChatService] Member IDs:`,
      allMemberIds.map((id) => Number(id)),
    );

    if (existing) {
      // Verify all members (user + supervisors/developers) are in the room
      const existingMemberIds = new Set(existing.members.map((m) => m.user_id));
      // const expectedMemberIds = new Set(allMemberIds); // Not used currently

      // Check if we need to add any missing members
      const missingIds = allMemberIds.filter(
        (id) => !existingMemberIds.has(id),
      );
      if (missingIds.length > 0) {
        // Add missing members
        await this.prisma.chatRoomMember.createMany({
          data: missingIds.map((userId) => ({
            room_id: existing.id,
            user_id: userId,
            rol_in_room: ChatRoomMemberRole.member,
          })),
          skipDuplicates: true,
        });
        // Refetch with updated members
        existing = await this.prisma.chatRoom.findUnique({
          where: { id: existing.id },
          include: { members: true },
        });
      }
      return existing;
    }

    // Create new supervisor group room with user + all supervisors/developers as members
    return this.prisma.chatRoom.create({
      data: {
        firma_id: BigInt(firma_id),
        tipo: ChatRoomType.dm,
        centro_id: BigInt(SPECIAL_SUPERVISOR_GROUP_ID), // Special identifier: negative userId
        created_by: createdById,
        members: {
          create: allMemberIds.map((userId) => ({
            user_id: userId,
            rol_in_room: ChatRoomMemberRole.member,
          })),
        },
      },
      include: { members: true },
    });
  }
}
