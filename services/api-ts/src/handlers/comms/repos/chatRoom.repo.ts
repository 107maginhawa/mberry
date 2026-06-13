/**
 * ChatRoomRepository - Data access layer for chat rooms
 * Handles participant-based filtering and room management
 */

import { eq, and, or, ne, desc, sql, isNull, isNotNull, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { NotFoundError, ConflictError } from '@/core/errors';
import { 
  chatRooms,
  chatMessages,
  type ChatRoom, 
  type NewChatRoom,
  type ChatRoomFilters,
  type ChatRoomWithLastMessage
} from './comms.schema';

export class ChatRoomRepository extends DatabaseRepository<ChatRoom, NewChatRoom, ChatRoomFilters> {
  constructor(
    db: DatabaseInstance,
    logger?: any
  ) {
    super(db, chatRooms, logger);
  }

  /**
   * Build where conditions for chat room filtering
   */
  protected buildWhereConditions(filters?: ChatRoomFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(chatRooms.organizationId, filters.organizationId));
    }

    // Array-based participant filtering using JSON operators
    if (filters.participants && filters.participants.length > 0) {
      const participantConditions = filters.participants.map(participantId =>
        sql`${chatRooms.participants} @> ${JSON.stringify([participantId])}`
      );
      conditions.push(or(...participantConditions));
    }

    if (filters.admins && filters.admins.length > 0) {
      const adminConditions = filters.admins.map(adminId =>
        sql`${chatRooms.admins} @> ${JSON.stringify([adminId])}`
      );
      conditions.push(or(...adminConditions));
    }

    if (filters.status) {
      conditions.push(eq(chatRooms.status, filters.status));
    }

    if (filters.context) {
      conditions.push(eq(chatRooms.context, filters.context));
    }

    // Special filter: find rooms where user is a participant
    if (filters.withParticipant) {
      conditions.push(
        sql`${chatRooms.participants} @> ${JSON.stringify([filters.withParticipant])}`
      );
    }

    // FIX-013: rooms that contain ALL of the given participants (AND semantics).
    // Each `@>` is ANDed so e.g. [currentUser, otherUser] only matches rooms
    // containing both — used by listChatRooms for the `withParticipant` query.
    if (filters.withParticipants && filters.withParticipants.length > 0) {
      for (const participantId of filters.withParticipants) {
        conditions.push(
          sql`${chatRooms.participants} @> ${JSON.stringify([participantId])}`
        );
      }
    }

    // FIX-008 (G4 read-path): tenant-scope the listing to the caller's org for
    // org-scoped rooms while preserving DMs (org-agnostic, PD-2 gated). Emits
    // `(organization_id = X OR room_type = 'dm')`.
    if (filters.organizationIdOrDm) {
      conditions.push(
        or(
          eq(chatRooms.organizationId, filters.organizationIdOrDm),
          eq(chatRooms.roomType, 'dm')
        )
      );
    }

    // Special filter: rooms with active video calls
    if (filters.hasActiveCall !== undefined) {
      if (filters.hasActiveCall) {
        conditions.push(isNotNull(chatRooms.activeVideoCallMessage));
      } else {
        conditions.push(isNull(chatRooms.activeVideoCallMessage));
      }
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Find chat rooms for a specific user (as either participant)
   */
  async findUserChatRooms(
    userId: string,
    options?: {
      status?: 'active' | 'archived';
      hasActiveCall?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<ChatRoom[]> {
    this.logger?.debug({ userId, options }, 'Finding chat rooms for user');

    const filters: ChatRoomFilters = {
      withParticipant: userId,
      status: options?.status,
      hasActiveCall: options?.hasActiveCall
    };

    const chatRoomList = await this.findMany(filters, {
      orderBy: desc(chatRooms.lastMessageAt),
      pagination: options?.limit || options?.offset ? {
        limit: options?.limit || 50,
        offset: options?.offset || 0
      } : undefined
    });

    this.logger?.debug({
      userId,
      roomCount: chatRoomList.length
    }, 'User chat rooms retrieved');

    return chatRoomList;
  }

  /**
   * FIX-013: list a user's chat rooms with context/participant filtering AND
   * pagination pushed into SQL, returning the true total. The previous handler
   * sliced an unbounded in-memory list and applied the `context`/`withParticipant`
   * filters AFTER the slice — so a matching room on a later page silently
   * vanished (broke booking-chat discoverability). Here every filter is part of
   * the WHERE clause and LIMIT/OFFSET run server-side.
   */
  async findUserRoomsPage(
    userId: string,
    opts: {
      status?: 'active' | 'archived';
      context?: string;
      withParticipant?: string;
      hasActiveCall?: boolean;
      organizationId?: string;
      limit: number;
      offset: number;
    }
  ): Promise<{ data: ChatRoom[]; totalCount: number }> {
    const withParticipants = [userId];
    if (opts.withParticipant) withParticipants.push(opts.withParticipant);

    const filters: ChatRoomFilters = {
      withParticipants,
      status: opts.status,
      context: opts.context,
      hasActiveCall: opts.hasActiveCall,
      // PD-2 (CONTINUE-48): rooms are org-scoped INCLUDING DMs — no cross-org
      // DMs. Previously DMs were exempted (`organizationIdOrDm`, org-agnostic);
      // the decision flips that to a strict org filter on every room type.
      organizationId: opts.organizationId,
    };

    const { data, totalCount } = await this.findManyWithPagination(filters, {
      orderBy: desc(chatRooms.lastMessageAt),
      pagination: { limit: opts.limit, offset: opts.offset },
    });

    this.logger?.debug({ userId, opts, totalCount, returned: data.length }, 'User chat rooms page retrieved');

    return { data, totalCount };
  }

  /**
   * Find chat room containing all specified participants
   */
  async findRoomWithParticipants(
    participantIds: string[]
  ): Promise<ChatRoom | null> {
    this.logger?.debug({ participantIds }, 'Finding room with participants');

    if (participantIds.length === 0) return null;

    // Use custom SQL to find rooms containing all participants
    const [room] = await this.db
      .select()
      .from(chatRooms)
      .where(
        // Room must contain all specified participants
        sql`${chatRooms.participants} @> ${JSON.stringify(participantIds)}`
      )
      .limit(1);

    this.logger?.debug({
      participantIds,
      found: !!room
    }, 'Room lookup with participants completed');

    return room || null;
  }

  /**
   * Find chat room between exactly two participants (for backward compatibility)
   */
  async findRoomBetweenParticipants(
    participant1Id: string,
    participant2Id: string
  ): Promise<ChatRoom | null> {
    return this.findRoomWithParticipants([participant1Id, participant2Id]);
  }

  /**
   * Find or create chat room for booking context
   * Updated to use flexible participant/admin arrays
   */
  async findOrCreateBookingChatRoom(
    bookingId: string,
    participantIds: string[],
    adminIds?: string[],
    organizationId?: string
  ): Promise<{ room: ChatRoom; created: boolean }> {
    this.logger?.debug({
      bookingId,
      participantIds,
      adminIds
    }, 'Finding or creating booking chat room');

    // First check if room already exists for this booking
    let room = await this.findOne({ context: bookingId });

    if (room) {
      this.logger?.debug({ bookingId, roomId: room.id }, 'Found existing booking room');
      return { room, created: false };
    }

    // Check if room exists between these participants (without context link)
    room = await this.findRoomWithParticipants(participantIds);

    if (room) {
      // Link existing room to booking
      const updatedRoom = await this.updateOneById(room.id, {
        context: bookingId
      });

      this.logger?.info({
        bookingId,
        roomId: room.id
      }, 'Linked existing room to booking');

      return { room: updatedRoom, created: false };
    }

    // Create new room for booking
    const newRoom = await this.createOne({
      organizationId: organizationId!,
      participants: participantIds,
      admins: adminIds || participantIds, // Default: all participants are admins
      context: bookingId,
      status: 'active',
      messageCount: 0
    });

    this.logger?.info({
      bookingId,
      roomId: newRoom.id,
      participantIds
    }, 'Created new booking chat room');

    return { room: newRoom, created: true };
  }

  /**
   * Update last message timestamp and increment message count
   * Called when new messages are added
   */
  async updateLastMessage(
    roomId: string,
    messageTimestamp: Date = new Date()
  ): Promise<ChatRoom> {
    this.logger?.debug({ roomId, messageTimestamp }, 'Updating room last message');

    // FIX-014: increment messageCount atomically in SQL (`message_count + 1`)
    // instead of read-then-write. The previous findOneById + `currentRoom.messageCount + 1`
    // dropped concurrent messages (two sends reading the same count both wrote N+1).
    const updatedRoom = await this.updateOneById(roomId, {
      lastMessageAt: messageTimestamp,
      messageCount: sql`${chatRooms.messageCount} + 1`
    } as unknown as Partial<ChatRoom>);

    this.logger?.debug({
      roomId, 
      messageCount: updatedRoom.messageCount 
    }, 'Room last message updated');
    
    return updatedRoom;
  }

  /**
   * Set or clear active video call message reference
   */
  async setActiveVideoCall(
    roomId: string,
    videoCallMessageId: string | null
  ): Promise<ChatRoom> {
    this.logger?.debug({ roomId, videoCallMessageId }, 'Setting active video call');

    // Clearing the pointer is unconditional (end/leave call).
    if (videoCallMessageId === null) {
      const cleared = await this.updateOneById(roomId, {
        activeVideoCallMessage: null
      });
      this.logger?.info({ roomId, action: 'cleared' }, 'Active video call updated');
      return cleared;
    }

    // FIX-014: claim the active-call slot atomically — only set it when no call
    // is currently active (`active_video_call_message IS NULL`). Two concurrent
    // starts can no longer both become the active call: the loser's conditional
    // UPDATE affects 0 rows and we surface a ConflictError so the caller can
    // retire its orphaned call message.
    const [claimed] = await this.db
      .update(chatRooms)
      .set({
        activeVideoCallMessage: videoCallMessageId,
        updatedAt: new Date(),
        version: sql`${chatRooms.version} + 1`
      } as Record<string, unknown>)
      .where(and(eq(chatRooms.id, roomId), isNull(chatRooms.activeVideoCallMessage)))
      .returning();

    if (!claimed) {
      this.logger?.warn({ roomId, videoCallMessageId, action: 'claim_conflict' }, 'Active video call already set; claim rejected');
      throw new ConflictError('An active video call already exists in this room');
    }

    this.logger?.info({ roomId, videoCallMessageId, action: 'set' }, 'Active video call updated');

    return claimed as ChatRoom;
  }

  /**
   * Check if user/profile is a participant in the room
   */
  async isUserParticipant(roomId: string, userOrProfileId: string): Promise<boolean> {
    this.logger?.debug({ roomId, userOrProfileId }, 'Checking if user is participant');

    const room = await this.findOneById(roomId);
    if (!room) {
      return false;
    }

    const isParticipant = room.participants.includes(userOrProfileId);

    this.logger?.debug({ roomId, userOrProfileId, isParticipant }, 'Participant check completed');

    return isParticipant;
  }

  /**
   * Check if user/profile is an admin of the room
   */
  async isUserAdmin(roomId: string, userOrProfileId: string): Promise<boolean> {
    this.logger?.debug({ roomId, userOrProfileId }, 'Checking if user is admin');

    const room = await this.findOneById(roomId);
    if (!room) {
      return false;
    }

    const isAdmin = room.admins.includes(userOrProfileId);

    this.logger?.debug({ roomId, userOrProfileId, isAdmin }, 'Admin check completed');

    return isAdmin;
  }

  /**
   * Archive a chat room (soft delete alternative)
   */
  async archiveRoom(roomId: string): Promise<ChatRoom> {
    this.logger?.debug({ roomId }, 'Archiving chat room');
    
    const archivedRoom = await this.updateOneById(roomId, {
      status: 'archived'
    });
    
    this.logger?.info({ roomId }, 'Chat room archived');
    
    return archivedRoom;
  }
}