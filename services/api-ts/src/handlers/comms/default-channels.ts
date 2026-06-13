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

/**
 * Auto-join a person to every channel in an org (PD-1).
 *
 * Called when a member is provisioned (membership.created / membership.imported)
 * so the `/messages` surface is non-empty out of the box. Adds the person to
 * both the authoritative `chat_room_member` join table AND the legacy JSONB
 * `participants` array — the latter keeps `listChatRooms` (which filters on the
 * participants array) surfacing the channel in the member's sidebar.
 *
 * Idempotent: the join-table insert no-ops on conflict, and the JSONB append is
 * skipped when the person is already present.
 *
 * @returns ids of the channels the person was (or already is) a member of
 */
export async function autoJoinOrgChannels(
  db: DatabaseInstance,
  organizationId: string,
  personId: string,
): Promise<string[]> {
  const channels = await db
    .select({ id: chatRooms.id, participants: chatRooms.participants })
    .from(chatRooms)
    .where(
      and(
        eq(chatRooms.organizationId, organizationId),
        eq(chatRooms.roomType, 'channel'),
      ),
    );

  const joined: string[] = [];

  for (const ch of channels) {
    await db
      .insert(chatRoomMembers)
      .values({ chatRoomId: ch.id, personId, role: 'member' as const })
      .onConflictDoNothing();

    const current: string[] = ch.participants ?? [];
    if (!current.includes(personId)) {
      await db
        .update(chatRooms)
        .set({ participants: [...current, personId] })
        .where(eq(chatRooms.id, ch.id));
    }

    joined.push(ch.id);
  }

  return joined;
}
