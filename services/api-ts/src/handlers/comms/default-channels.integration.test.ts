/**
 * Real-PG integration suite for the WIRED-but-untested PD-1 prod path:
 * `createDefaultChannels` + `autoJoinOrgChannels` (default-channels.ts).
 *
 * Both functions are wired in core/domain-event-consumers.ts
 * (organization.created → createDefaultChannels; membership.created /
 * membership.imported → autoJoinOrgChannels) yet had ZERO tests — not even a
 * mock. This proves the real persisted rows against Postgres via createScratch
 * (LIKE public.<t> INCLUDING ALL — faithful enums/NOT NULL/unique constraint).
 *
 * createScratch DROPS FKs, so chat_room parents are seeded first; the
 * chat_room_members_unique (chat_room_id, person_id) constraint IS copied —
 * it is what backs the onConflictDoNothing idempotency these tests assert.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { createDefaultChannels, autoJoinOrgChannels } from './default-channels';

let H: ScratchDb;

const ORG_A = '00000000-0000-4000-8000-00000000c001';
const ORG_B = '00000000-0000-4000-8000-00000000c002';
const ADMIN_A = '00000000-0000-4000-8000-00000000ad01';
const ADMIN_B = '00000000-0000-4000-8000-00000000ad02';
const PERSON_X = '00000000-0000-4000-8000-00000000be01';

beforeAll(async () => {
  H = await createScratch(['chat_room', 'chat_room_member']);
});
afterAll(async () => {
  await H?.teardown();
});

/** Read every chat_room row for an org, ordered by context_id for stable assertions. */
async function roomsForOrg(org: string) {
  const { rows } = await H.scopedPool.query(
    `SELECT id, name, room_type, status, message_count, context_id, participants, admins
       FROM chat_room WHERE organization_id = $1 ORDER BY context_id`,
    [org],
  );
  return rows as Array<{
    id: string;
    name: string | null;
    room_type: string;
    status: string;
    message_count: number;
    context_id: string | null;
    participants: string[];
    admins: string[];
  }>;
}

async function membersForRoom(roomId: string) {
  const { rows } = await H.scopedPool.query(
    `SELECT person_id, role FROM chat_room_member WHERE chat_room_id = $1 ORDER BY person_id`,
    [roomId],
  );
  return rows as Array<{ person_id: string; role: string }>;
}

describe('createDefaultChannels — real-PG persistence', () => {
  test('persists exactly 2 channel rooms (general + announcements) with correct columns', async () => {
    if (!H.dbReachable) return;

    const ids = await createDefaultChannels(H.db as never, ORG_A, [ADMIN_A]);
    expect(ids.length).toBe(2);

    const rooms = await roomsForOrg(ORG_A);
    expect(rooms.length).toBe(2);

    // ordered by context_id: 'channel:announcements' < 'channel:general'
    const announcements = rooms[0]!;
    const general = rooms[1]!;

    expect(announcements.name).toBe('announcements');
    expect(announcements.context_id).toBe('channel:announcements');
    expect(announcements.room_type).toBe('channel');
    expect(announcements.status).toBe('active');
    expect(announcements.message_count).toBe(0);
    expect(announcements.participants).toEqual([ADMIN_A]);
    expect(announcements.admins).toEqual([ADMIN_A]);

    expect(general.name).toBe('general');
    expect(general.context_id).toBe('channel:general');
    expect(general.room_type).toBe('channel');
    expect(general.status).toBe('active');
    expect(general.message_count).toBe(0);
    expect(general.participants).toEqual([ADMIN_A]);
    expect(general.admins).toEqual([ADMIN_A]);

    // returned ids are exactly the two persisted rooms
    expect(new Set(ids)).toEqual(new Set([announcements.id, general.id]));
  });

  test('each created channel gets a chat_room_member role=admin per admin', async () => {
    if (!H.dbReachable) return;

    // ORG_B with two admins.
    const ids = await createDefaultChannels(H.db as never, ORG_B, [ADMIN_A, ADMIN_B]);
    expect(ids.length).toBe(2);

    for (const roomId of ids) {
      const members = await membersForRoom(roomId);
      expect(members.length).toBe(2);
      expect(members.map((m) => m.role)).toEqual(['admin', 'admin']);
      expect(new Set(members.map((m) => m.person_id))).toEqual(
        new Set([ADMIN_A, ADMIN_B]),
      );
    }
  });

  test('idempotent on (organization_id, context_id): second call adds no rows, returns same ids', async () => {
    if (!H.dbReachable) return;

    const first = await createDefaultChannels(H.db as never, ORG_A, [ADMIN_A]);
    // ORG_A already provisioned in the first test of this describe block.
    const rooms = await roomsForOrg(ORG_A);
    expect(rooms.length).toBe(2); // still exactly 2 — no duplicates created

    const second = await createDefaultChannels(H.db as never, ORG_A, [ADMIN_A]);
    expect(new Set(second)).toEqual(new Set(first));

    // and STILL exactly 2 rooms afterwards
    expect((await roomsForOrg(ORG_A)).length).toBe(2);
  });
});

describe('autoJoinOrgChannels — PD-1 member onboarding', () => {
  const ORG_J = '00000000-0000-4000-8000-00000000c0aa';

  beforeAll(async () => {
    if (!H.dbReachable) return;
    // Seed: 2 default channels + one non-channel group room.
    await createDefaultChannels(H.db as never, ORG_J, [ADMIN_A]);
    await H.scopedPool.query(
      `INSERT INTO chat_room (organization_id, room_type, participants, admins, status, message_count)
       VALUES ($1, 'group', '[]'::jsonb, '[]'::jsonb, 'active', 0)`,
      [ORG_J],
    );
  });

  test('joins person to EVERY channel as role=member and NONE of the group room', async () => {
    if (!H.dbReachable) return;

    const joined = await autoJoinOrgChannels(H.db as never, ORG_J, PERSON_X);
    expect(joined.length).toBe(2);

    const rooms = await roomsForOrg(ORG_J);
    const channels = rooms.filter((r) => r.room_type === 'channel');
    const groups = rooms.filter((r) => r.room_type === 'group');
    expect(channels.length).toBe(2);
    expect(groups.length).toBe(1);

    // member row in EACH channel, role=member
    for (const ch of channels) {
      const members = await membersForRoom(ch.id);
      const px = members.find((m) => m.person_id === PERSON_X);
      expect(px).toBeTruthy();
      expect(px!.role).toBe('member');
    }

    // NONE in the group room
    const groupMembers = await membersForRoom(groups[0]!.id);
    expect(groupMembers.find((m) => m.person_id === PERSON_X)).toBeUndefined();

    // returned ids are exactly the 2 channel ids
    expect(new Set(joined)).toEqual(new Set(channels.map((c) => c.id)));
  });

  test('dual-writes personX into the legacy participants JSONB of each channel', async () => {
    if (!H.dbReachable) return;

    const rooms = await roomsForOrg(ORG_J);
    const channels = rooms.filter((r) => r.room_type === 'channel');
    for (const ch of channels) {
      expect(ch.participants).toContain(PERSON_X);
    }
    // group room participants untouched (no PERSON_X)
    const group = rooms.find((r) => r.room_type === 'group')!;
    expect(group.participants).not.toContain(PERSON_X);
  });

  test('idempotent on chat_room_members_unique: second call → one member row + no duplicate participant', async () => {
    if (!H.dbReachable) return;

    await autoJoinOrgChannels(H.db as never, ORG_J, PERSON_X);

    const rooms = await roomsForOrg(ORG_J);
    const channels = rooms.filter((r) => r.room_type === 'channel');
    for (const ch of channels) {
      const members = await membersForRoom(ch.id);
      const pxRows = members.filter((m) => m.person_id === PERSON_X);
      expect(pxRows.length).toBe(1); // exactly one — onConflictDoNothing held

      const occurrences = ch.participants.filter((p) => p === PERSON_X).length;
      expect(occurrences).toBe(1); // no duplicate in JSONB
    }
  });
});
