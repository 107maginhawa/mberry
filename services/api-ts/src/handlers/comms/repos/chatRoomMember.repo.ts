/**
 * ChatRoomMemberRepository - Data access layer for chat room membership
 * Manages join table for scalable participant tracking + read state
 */

import { eq, and, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  chatRoomMembers,
  chatMessages,
  type ChatRoomMember,
} from './comms.schema';

export class ChatRoomMemberRepository {
  constructor(
    private db: DatabaseInstance,
    private logger?: any
  ) {}

  /**
   * Add a person to a chat room
   */
  async addMember(
    chatRoomId: string,
    personId: string,
    role: 'member' | 'admin' = 'member'
  ): Promise<ChatRoomMember> {
    this.logger?.debug({ chatRoomId, personId, role }, 'Adding chat room member');

    const [member] = await this.db
      .insert(chatRoomMembers)
      .values({ chatRoomId, personId, role })
      .onConflictDoNothing({ target: [chatRoomMembers.chatRoomId, chatRoomMembers.personId] })
      .returning();

    // If conflict (already exists), fetch existing
    if (!member) {
      const [existing] = await this.db
        .select()
        .from(chatRoomMembers)
        .where(
          and(
            eq(chatRoomMembers.chatRoomId, chatRoomId),
            eq(chatRoomMembers.personId, personId)
          )
        );
      return existing!;
    }

    return member;
  }

  /**
   * Add multiple members to a chat room (bulk insert)
   */
  async addMembers(
    chatRoomId: string,
    members: Array<{ personId: string; role?: 'member' | 'admin' }>
  ): Promise<ChatRoomMember[]> {
    if (members.length === 0) return [];

    const values = members.map(m => ({
      chatRoomId,
      personId: m.personId,
      role: m.role ?? ('member' as const),
    }));

    const result = await this.db
      .insert(chatRoomMembers)
      .values(values)
      .onConflictDoNothing({ target: [chatRoomMembers.chatRoomId, chatRoomMembers.personId] })
      .returning();

    return result;
  }

  /**
   * Remove a person from a chat room
   */
  async removeMember(chatRoomId: string, personId: string): Promise<void> {
    await this.db
      .delete(chatRoomMembers)
      .where(
        and(
          eq(chatRoomMembers.chatRoomId, chatRoomId),
          eq(chatRoomMembers.personId, personId)
        )
      );
  }

  /**
   * Get all members of a chat room
   */
  async getRoomMembers(chatRoomId: string): Promise<ChatRoomMember[]> {
    return this.db
      .select()
      .from(chatRoomMembers)
      .where(eq(chatRoomMembers.chatRoomId, chatRoomId))
      .orderBy(chatRoomMembers.joinedAt);
  }

  /**
   * Check if a person is a member of a chat room
   */
  async isMember(chatRoomId: string, personId: string): Promise<boolean> {
    const [member] = await this.db
      .select({ id: chatRoomMembers.id })
      .from(chatRoomMembers)
      .where(
        and(
          eq(chatRoomMembers.chatRoomId, chatRoomId),
          eq(chatRoomMembers.personId, personId)
        )
      )
      .limit(1);

    return !!member;
  }

  /**
   * Update lastReadAt timestamp for a member in a room
   */
  async markRead(chatRoomId: string, personId: string): Promise<void> {
    await this.db
      .update(chatRoomMembers)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(chatRoomMembers.chatRoomId, chatRoomId),
          eq(chatRoomMembers.personId, personId)
        )
      );
  }

  /**
   * Get unread count for a member in a room
   */
  async getUnreadCount(chatRoomId: string, personId: string): Promise<number> {
    const [member] = await this.db
      .select({ lastReadAt: chatRoomMembers.lastReadAt })
      .from(chatRoomMembers)
      .where(
        and(
          eq(chatRoomMembers.chatRoomId, chatRoomId),
          eq(chatRoomMembers.personId, personId)
        )
      )
      .limit(1);

    if (!member) return 0;

    const condition = member.lastReadAt
      ? and(
          eq(chatMessages.chatRoom, chatRoomId),
          sql`${chatMessages.timestamp} > ${member.lastReadAt}`
        )
      : eq(chatMessages.chatRoom, chatRoomId);

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatMessages)
      .where(condition!);

    return result?.count ?? 0;
  }

  /**
   * Get all rooms a person is a member of, with unread counts
   */
  async getPersonRoomsWithUnread(personId: string): Promise<
    Array<{ chatRoomId: string; role: string; lastReadAt: Date | null; unreadCount: number }>
  > {
    const memberships = await this.db
      .select()
      .from(chatRoomMembers)
      .where(eq(chatRoomMembers.personId, personId));

    const results = await Promise.all(
      memberships.map(async (m) => ({
        chatRoomId: m.chatRoomId,
        role: m.role,
        lastReadAt: m.lastReadAt,
        unreadCount: await this.getUnreadCount(m.chatRoomId, personId),
      }))
    );

    return results;
  }

  /**
   * Mute a room for a person until a given time
   */
  async muteRoom(chatRoomId: string, personId: string, until: Date): Promise<void> {
    await this.db
      .update(chatRoomMembers)
      .set({ mutedUntil: until })
      .where(
        and(
          eq(chatRoomMembers.chatRoomId, chatRoomId),
          eq(chatRoomMembers.personId, personId)
        )
      );
  }

  /**
   * Unmute a room for a person
   */
  async unmuteRoom(chatRoomId: string, personId: string): Promise<void> {
    await this.db
      .update(chatRoomMembers)
      .set({ mutedUntil: null })
      .where(
        and(
          eq(chatRoomMembers.chatRoomId, chatRoomId),
          eq(chatRoomMembers.personId, personId)
        )
      );
  }
}
