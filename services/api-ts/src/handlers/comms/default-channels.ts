/**
 * Default Channel Auto-Creation — Phase 4
 *
 * When a chapter or organization is created, auto-creates default channels:
 *   - #general — open discussion
 *   - #announcements — read-only for officers to post updates
 *
 * Called from association:member handler after chapter creation.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { chatRooms, chatRoomMembers } from './repos/comms.schema';

export interface DefaultChannelConfig {
  name: string;
  roomType: 'channel';
  context: string;
}

const DEFAULT_CHANNELS: DefaultChannelConfig[] = [
  { name: 'general', roomType: 'channel', context: 'channel:general' },
  { name: 'announcements', roomType: 'channel', context: 'channel:announcements' },
];

/**
 * Create default channels for an organization/chapter.
 * Idempotent — skips if channels with same context already exist.
 */
export async function createDefaultChannels(
  db: DatabaseInstance,
  organizationId: string,
  adminPersonIds: string[],
): Promise<string[]> {
  const createdIds: string[] = [];

  for (const channel of DEFAULT_CHANNELS) {
    // Check if already exists (idempotent)
    const [existing] = await db
      .select({ id: chatRooms.id })
      .from(chatRooms)
      .where(
        and(
          eq(chatRooms.organizationId, organizationId),
          eq(chatRooms.context, channel.context),
        ),
      )
      .limit(1);

    if (existing) {
      createdIds.push(existing.id);
      continue;
    }

    // Create channel room
    const [room] = await db
      .insert(chatRooms)
      .values({
        organizationId,
        name: channel.name,
        roomType: channel.roomType,
        context: channel.context,
        participants: adminPersonIds, // Legacy field — kept for compat
        admins: adminPersonIds,
        status: 'active',
        messageCount: 0,
      })
      .returning();

    if (room) {
      createdIds.push(room.id);

      // Add admins as members via join table
      if (adminPersonIds.length > 0) {
        await db
          .insert(chatRoomMembers)
          .values(
            adminPersonIds.map((personId) => ({
              chatRoomId: room.id,
              personId,
              role: 'admin' as const,
            })),
          )
          .onConflictDoNothing();
      }
    }
  }

  return createdIds;
}
