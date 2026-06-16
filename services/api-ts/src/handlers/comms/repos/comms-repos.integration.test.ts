/**
 * Real-DB integration tests for the comms repository layer.
 *
 * Targets the three LOW-coverage repos:
 *   - ChatRoomMemberRepository (membership join table — WS authz chokepoint)
 *   - ChatMessageRepository    (message create/pagination/video-call lifecycle)
 *   - ChatRoomRepository       (org-scoping, participant filters, atomic claims)
 *
 * Pattern: per-run scratch schema with hand-written DDL (mirrors
 * member/governance/position-identity.integration.test.ts). Every method is
 * driven against REAL drizzle queries on REAL Postgres rows, so the query
 * builders, WHERE predicates, pagination, ordering, soft-delete/archive and
 * conflict branches all execute end-to-end.
 *
 * Requires a reachable Postgres (DATABASE_URL or the repo default). If
 * unreachable the suite skips with a clear message rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { ChatRoomMemberRepository } from './chatRoomMember.repo';
import { ChatMessageRepository } from './chatMessage.repo';
import { ChatRoomRepository } from './chatRoom.repo';
import { ConflictError, NotFoundError, ValidationError, BusinessLogicError } from '@/core/errors';
import type { CallParticipant, VideoCallData } from './comms.schema';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

const TEST_SCHEMA = `comms_repos_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

let setupPool: Pool;
let scopedPool: Pool;
let db: ReturnType<typeof drizzle>;
let dbReachable = false;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;

const ORG_A = '00000000-0000-4000-8000-00000000000a';
const ORG_B = '00000000-0000-4000-8000-00000000000b';

// sender_id / participant.user columns are uuid NOT NULL — use real UUIDs.
const U1 = '00000000-0000-4000-8000-0000000000f1';
const U2 = '00000000-0000-4000-8000-0000000000f2';
const HOST = '00000000-0000-4000-8000-0000000000f3';
const GUEST = '00000000-0000-4000-8000-0000000000f4';

/** Fresh org id per test to isolate findMany/buildWhereConditions assertions. */
function freshOrg(): string {
  return crypto.randomUUID();
}

async function ddl(client: any) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
  await client.query(`SET search_path TO "${TEST_SCHEMA}", public`);

  const baseCols = `
    version integer NOT NULL DEFAULT 1,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()`;

  // chat_room — enums modelled as text (drizzle sends the literal string).
  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".chat_room (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      name text,
      room_type text NOT NULL DEFAULT 'group',
      participants jsonb NOT NULL,
      admins jsonb NOT NULL,
      context_id text,
      status text NOT NULL DEFAULT 'active',
      last_message_at timestamptz,
      message_count integer NOT NULL DEFAULT 0,
      active_video_call_message_id uuid,${baseCols}
    )
  `);

  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".chat_room_member (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_room_id uuid NOT NULL REFERENCES "${TEST_SCHEMA}".chat_room(id) ON DELETE CASCADE,
      person_id uuid NOT NULL,
      role text NOT NULL DEFAULT 'member',
      joined_at timestamptz NOT NULL DEFAULT now(),
      last_read_at timestamptz,
      muted_until timestamptz,
      CONSTRAINT chat_room_members_unique UNIQUE (chat_room_id, person_id)
    )
  `);

  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".chat_message (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      chat_room_id uuid NOT NULL REFERENCES "${TEST_SCHEMA}".chat_room(id) ON DELETE CASCADE,
      sender_id uuid NOT NULL,
      timestamp timestamptz NOT NULL DEFAULT now(),
      message_type text NOT NULL,
      parent_message_id uuid,
      reply_count integer NOT NULL DEFAULT 0,
      message text,
      video_call_data jsonb,${baseCols}
    )
  `);
}

/** Insert a chat room directly (bypassing repo) and return its id. */
async function insertRoom(opts: {
  organizationId?: string;
  participants?: string[];
  admins?: string[];
  context?: string | null;
  status?: string;
  roomType?: string;
  lastMessageAt?: Date | null;
}): Promise<string> {
  const res = await scopedPool.query(
    `INSERT INTO "${TEST_SCHEMA}".chat_room
       (organization_id, participants, admins, context_id, status, room_type, last_message_at, message_count)
     VALUES ($1,$2::jsonb,$3::jsonb,$4,$5,$6,$7,0)
     RETURNING id`,
    [
      opts.organizationId ?? ORG_A,
      JSON.stringify(opts.participants ?? []),
      JSON.stringify(opts.admins ?? []),
      opts.context ?? null,
      opts.status ?? 'active',
      opts.roomType ?? 'group',
      opts.lastMessageAt ?? null,
    ],
  );
  return res.rows[0].id as string;
}

beforeAll(async () => {
  setupPool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const client = await setupPool.connect();
    try {
      await ddl(client);
      dbReachable = true;
    } finally {
      client.release();
    }
  } catch (err) {
    dbReachable = false;
    // eslint-disable-next-line no-console
    console.warn(`[comms-repos integration] Postgres unreachable, skipping: ${(err as Error).message}`);
    return;
  }

  // Pin search_path at connection establishment via libpq `options` (-c …).
  // The previous `on('connect', c => c.query('SET search_path …'))` was
  // fire-and-forget: under pool churn a query could run on a connection before
  // its search_path was set, hit `public` instead of TEST_SCHEMA, and return
  // wrong counts — the source of this suite's flakiness under parallel DB load.
  // Setting it as a startup option is applied before any query runs, no race.
  scopedPool = new Pool({
    connectionString: DB_URL,
    options: `-c search_path="${TEST_SCHEMA}",public`,
  });
  db = drizzle(scopedPool);
});

afterAll(async () => {
  if (dbReachable) {
    try {
      const client = await setupPool.connect();
      try {
        await client.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
      } finally {
        client.release();
      }
    } catch {
      /* best-effort cleanup */
    }
  }
  if (scopedPool) await scopedPool.end();
  if (setupPool) await setupPool.end();
});

// ─── ChatRoomMemberRepository ─────────────────────────────────────────────

describe('ChatRoomMemberRepository (real DB)', () => {
  test('addMember inserts, returns the row; duplicate returns existing (onConflictDoNothing)', async () => {
    if (!dbReachable) return;
    const repo = new ChatRoomMemberRepository(db as any, noopLogger);
    const roomId = await insertRoom({});
    const person = '00000000-0000-4000-8000-000000000101';

    const created = await repo.addMember(roomId, person, 'admin');
    expect(created.chatRoomId).toBe(roomId);
    expect(created.personId).toBe(person);
    expect(created.role).toBe('admin');

    // Re-add same (room, person): conflict path → fetch existing, same id.
    const again = await repo.addMember(roomId, person, 'member');
    expect(again.id).toBe(created.id);
    expect(again.role).toBe('admin'); // unchanged — existing row returned
  });

  test('addMembers bulk insert; empty array short-circuits to []', async () => {
    if (!dbReachable) return;
    const repo = new ChatRoomMemberRepository(db as any, noopLogger);
    const roomId = await insertRoom({});

    expect(await repo.addMembers(roomId, [])).toEqual([]);

    const rows = await repo.addMembers(roomId, [
      { personId: '00000000-0000-4000-8000-000000000201' },
      { personId: '00000000-0000-4000-8000-000000000202', role: 'admin' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.role === 'admin')).toBeTruthy();
  });

  test('isMember true/false; getRoomMembers ordered by joinedAt', async () => {
    if (!dbReachable) return;
    const repo = new ChatRoomMemberRepository(db as any, noopLogger);
    const roomId = await insertRoom({});
    const p1 = '00000000-0000-4000-8000-000000000301';
    const p2 = '00000000-0000-4000-8000-000000000302';
    await repo.addMember(roomId, p1);
    await repo.addMember(roomId, p2);

    expect(await repo.isMember(roomId, p1)).toBe(true);
    expect(await repo.isMember(roomId, '00000000-0000-4000-8000-0000000003ff')).toBe(false);

    const members = await repo.getRoomMembers(roomId);
    expect(members.map((m) => m.personId)).toEqual([p1, p2]);
  });

  test('removeMember deletes the membership', async () => {
    if (!dbReachable) return;
    const repo = new ChatRoomMemberRepository(db as any, noopLogger);
    const roomId = await insertRoom({});
    const p = '00000000-0000-4000-8000-000000000401';
    await repo.addMember(roomId, p);
    await repo.removeMember(roomId, p);
    expect(await repo.isMember(roomId, p)).toBe(false);
  });

  test('markRead sets lastReadAt; getUnreadCount honours read cursor', async () => {
    if (!dbReachable) return;
    const memberRepo = new ChatRoomMemberRepository(db as any, noopLogger);
    const msgRepo = new ChatMessageRepository(db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });
    const p = '00000000-0000-4000-8000-000000000501';
    await memberRepo.addMember(roomId, p);

    // No lastReadAt yet → all messages count as unread.
    await msgRepo.createTextMessage(roomId, p, 'one', ORG_A);
    await msgRepo.createTextMessage(roomId, p, 'two', ORG_A);
    expect(await memberRepo.getUnreadCount(roomId, p)).toBe(2);

    // Mark read → cursor advances → 0 unread.
    await memberRepo.markRead(roomId, p);
    expect(await memberRepo.getUnreadCount(roomId, p)).toBe(0);

    // New message after read cursor → 1 unread.
    await msgRepo.createTextMessage(roomId, p, 'three', ORG_A);
    expect(await memberRepo.getUnreadCount(roomId, p)).toBe(1);
  });

  test('getUnreadCount returns 0 for a non-member', async () => {
    if (!dbReachable) return;
    const repo = new ChatRoomMemberRepository(db as any, noopLogger);
    const roomId = await insertRoom({});
    expect(await repo.getUnreadCount(roomId, '00000000-0000-4000-8000-0000000005ff')).toBe(0);
  });

  test('getPersonRoomsWithUnread aggregates rooms + unread per membership', async () => {
    if (!dbReachable) return;
    const memberRepo = new ChatRoomMemberRepository(db as any, noopLogger);
    const msgRepo = new ChatMessageRepository(db as any, noopLogger);
    const p = '00000000-0000-4000-8000-000000000601';
    const roomA = await insertRoom({ organizationId: ORG_A });
    const roomB = await insertRoom({ organizationId: ORG_A });
    await memberRepo.addMember(roomA, p, 'admin');
    await memberRepo.addMember(roomB, p);
    await msgRepo.createTextMessage(roomA, p, 'hi', ORG_A);

    const rooms = await memberRepo.getPersonRoomsWithUnread(p);
    expect(rooms).toHaveLength(2);
    const a = rooms.find((r) => r.chatRoomId === roomA)!;
    expect(a.role).toBe('admin');
    expect(a.unreadCount).toBe(1);
    const b = rooms.find((r) => r.chatRoomId === roomB)!;
    expect(b.unreadCount).toBe(0);
  });

  test('muteRoom sets mutedUntil; unmuteRoom clears it', async () => {
    if (!dbReachable) return;
    const repo = new ChatRoomMemberRepository(db as any, noopLogger);
    const roomId = await insertRoom({});
    const p = '00000000-0000-4000-8000-000000000701';
    await repo.addMember(roomId, p);

    const until = new Date(Date.now() + 3_600_000);
    await repo.muteRoom(roomId, p, until);
    let rows = await repo.getRoomMembers(roomId);
    expect(rows[0]!.mutedUntil).toBeTruthy();

    await repo.unmuteRoom(roomId, p);
    rows = await repo.getRoomMembers(roomId);
    expect(rows[0]!.mutedUntil).toBeNull();
  });
});

// ─── ChatMessageRepository ────────────────────────────────────────────────

describe('ChatMessageRepository (real DB)', () => {
  test('createTextMessage validates length + emptiness', async () => {
    if (!dbReachable) return;
    const repo = new ChatMessageRepository(db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });
    await expect(repo.createTextMessage(roomId, 'u', '   ', ORG_A)).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.createTextMessage(roomId, 'u', 'x'.repeat(5001), ORG_A)).rejects.toBeInstanceOf(ValidationError);
  });

  test('createTextMessage derives org from room when caller omits it (WS chokepoint)', async () => {
    if (!dbReachable) return;
    const repo = new ChatMessageRepository(db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_B });
    const msg = await repo.createTextMessage(roomId, '00000000-0000-4000-8000-000000000801', 'hello');
    expect(msg.organizationId).toBe(ORG_B);
    expect(msg.message).toBe('hello');
    expect(msg.messageType).toBe('text');
  });

  test('createTextMessage with explicit org skips room lookup', async () => {
    if (!dbReachable) return;
    const repo = new ChatMessageRepository(db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });
    const msg = await repo.createTextMessage(roomId, U1, 'hi', ORG_B);
    expect(msg.organizationId).toBe(ORG_B);
  });

  test('resolveOrgId throws NotFoundError when room is missing', async () => {
    if (!dbReachable) return;
    const repo = new ChatMessageRepository(db as any, noopLogger);
    await expect(
      repo.createTextMessage('00000000-0000-4000-8000-0000000008ff', U1, 'hi'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('createSystemMessage and createVideoCallMessage persist with derived org', async () => {
    if (!dbReachable) return;
    const repo = new ChatMessageRepository(db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });

    const sys = await repo.createSystemMessage(roomId, 'call ended', U1);
    expect(sys.messageType).toBe('system');
    expect(sys.organizationId).toBe(ORG_A);

    const vid = await repo.createVideoCallMessage(roomId, U1, {
      participants: [{ user: U1, userType: 'host', displayName: 'U', audioEnabled: true, videoEnabled: true }],
    } as VideoCallData);
    expect(vid.messageType).toBe('video_call');
    expect(vid.videoCallData!.status).toBe('starting');
    expect(vid.videoCallData!.startedAt).toBeTruthy();
  });

  test('createVideoCallMessage rejects empty participants', async () => {
    if (!dbReachable) return;
    const repo = new ChatMessageRepository(db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });
    await expect(
      repo.createVideoCallMessage(roomId, U1, { participants: [] } as any, ORG_A),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test('getChatRoomMessages: ordering (asc/desc), type filter, pagination', async () => {
    if (!dbReachable) return;
    const repo = new ChatMessageRepository(db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });
    // 3 text with increasing timestamps, plus a system message.
    for (let i = 0; i < 3; i++) {
      await scopedPool.query(
        `INSERT INTO "${TEST_SCHEMA}".chat_message (organization_id, chat_room_id, sender_id, message_type, message, timestamp)
         VALUES ($1,$2,$3,'text',$4, now() + ($5 || ' seconds')::interval)`,
        [ORG_A, roomId, U1, `m${i}`, String(i)],
      );
    }
    await repo.createSystemMessage(roomId, 'sys', U1, ORG_A);

    const desc = await repo.getChatRoomMessages(roomId, { messageType: 'text', orderBy: 'desc' });
    expect(desc.map((m) => m.message)).toEqual(['m2', 'm1', 'm0']);

    const asc = await repo.getChatRoomMessages(roomId, { messageType: 'text', orderBy: 'asc' });
    expect(asc.map((m) => m.message)).toEqual(['m0', 'm1', 'm2']);

    const page = await repo.getChatRoomMessages(roomId, { messageType: 'text', orderBy: 'asc', limit: 2, offset: 1 });
    expect(page.map((m) => m.message)).toEqual(['m1', 'm2']);

    const all = await repo.getChatRoomMessages(roomId);
    expect(all).toHaveLength(4);
  });

  test('updateVideoCallData: NotFound / not-a-call / no-data branches + duration on end', async () => {
    if (!dbReachable) return;
    const repo = new ChatMessageRepository(db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });

    await expect(
      repo.updateVideoCallData('00000000-0000-4000-8000-0000000009ff', { status: 'active' }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const text = await repo.createTextMessage(roomId, U1, 'plain', ORG_A);
    await expect(repo.updateVideoCallData(text.id, { status: 'active' })).rejects.toBeInstanceOf(BusinessLogicError);

    const call = await repo.createVideoCallMessage(roomId, U1, {
      participants: [{ user: U1, userType: 'host', displayName: 'U', audioEnabled: true, videoEnabled: true, joinedAt: new Date(Date.now() - 600_000).toISOString() }],
    } as VideoCallData, ORG_A);

    const ended = await repo.updateVideoCallData(call.id, { status: 'ended' });
    expect(ended.videoCallData!.status).toBe('ended');
    expect(ended.videoCallData!.endedAt).toBeTruthy();
    // Duration is computed from the call's startedAt (set to now on create),
    // so it's >= 0 — the branch that sets endedAt + durationMinutes ran.
    expect(typeof ended.videoCallData!.durationMinutes).toBe('number');
    expect(ended.videoCallData!.durationMinutes).toBeGreaterThanOrEqual(0);
  });

  test('add/update/remove video call participants', async () => {
    if (!dbReachable) return;
    const repo = new ChatMessageRepository(db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });
    const base: CallParticipant = { user: HOST, userType: 'host', displayName: 'Host', audioEnabled: true, videoEnabled: true };
    const call = await repo.createVideoCallMessage(roomId, HOST, { participants: [base] } as VideoCallData, ORG_A);

    // Add a new participant.
    const joined = await repo.addVideoCallParticipant(call.id, {
      user: GUEST, userType: 'client', displayName: 'Guest', audioEnabled: false, videoEnabled: false,
    });
    expect(joined.videoCallData!.participants).toHaveLength(2);

    // Add same user again → updates existing (still 2).
    const reAdd = await repo.addVideoCallParticipant(call.id, {
      user: GUEST, userType: 'client', displayName: 'Guest2', audioEnabled: true, videoEnabled: true,
    });
    expect(reAdd.videoCallData!.participants).toHaveLength(2);
    expect(reAdd.videoCallData!.participants.find((p) => p.user === GUEST)!.displayName).toBe('Guest2');

    // Update participant status.
    const updated = await repo.updateVideoCallParticipant(call.id, GUEST, { audioEnabled: false });
    expect(updated.videoCallData!.participants.find((p) => p.user === GUEST)!.audioEnabled).toBe(false);

    // Update unknown participant → NotFound.
    await expect(repo.updateVideoCallParticipant(call.id, U2, { audioEnabled: false })).rejects.toBeInstanceOf(NotFoundError);

    // Remove (mark left).
    const removed = await repo.removeVideoCallParticipant(call.id, GUEST);
    expect(removed.videoCallData!.participants.find((p) => p.user === GUEST)!.leftAt).toBeTruthy();
  });

  test('addVideoCallParticipant on a non-call message → NotFound', async () => {
    if (!dbReachable) return;
    const repo = new ChatMessageRepository(db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });
    const text = await repo.createTextMessage(roomId, U1, 'plain', ORG_A);
    await expect(
      repo.addVideoCallParticipant(text.id, { user: GUEST, userType: 'client', displayName: 'G', audioEnabled: true, videoEnabled: true }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('findActiveVideoCall returns the most recent active/starting call, else null', async () => {
    if (!dbReachable) return;
    const repo = new ChatMessageRepository(db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });
    expect(await repo.findActiveVideoCall(roomId)).toBeNull();

    const call = await repo.createVideoCallMessage(roomId, U1, {
      participants: [{ user: U1, userType: 'host', displayName: 'U', audioEnabled: true, videoEnabled: true }],
    } as VideoCallData, ORG_A);
    const active = await repo.findActiveVideoCall(roomId);
    expect(active!.id).toBe(call.id);

    // End it → no active call.
    await repo.updateVideoCallData(call.id, { status: 'ended' });
    expect(await repo.findActiveVideoCall(roomId)).toBeNull();
  });

  test('validateMessageContent pure helper', () => {
    const repo = new ChatMessageRepository(db as any, noopLogger);
    expect(repo.validateMessageContent('')).toEqual({ isValid: false, error: 'Message content cannot be empty' });
    expect(repo.validateMessageContent('x'.repeat(5001)).isValid).toBe(false);
    expect(repo.validateMessageContent('ok')).toEqual({ isValid: true });
  });

  test('getChatRoomStats counts by type with lastMessageAt', async () => {
    if (!dbReachable) return;
    const repo = new ChatMessageRepository(db as any, noopLogger);
    const empty = await insertRoom({ organizationId: ORG_A });
    const emptyStats = await repo.getChatRoomStats(empty);
    expect(emptyStats.totalMessages).toBe(0);
    expect(emptyStats.lastMessageAt).toBeUndefined();

    const roomId = await insertRoom({ organizationId: ORG_A });
    await repo.createTextMessage(roomId, U1, 'a', ORG_A);
    await repo.createTextMessage(roomId, U1, 'b', ORG_A);
    await repo.createSystemMessage(roomId, 'sys', U1, ORG_A);
    await repo.createVideoCallMessage(roomId, U1, {
      participants: [{ user: U1, userType: 'host', displayName: 'U', audioEnabled: true, videoEnabled: true }],
    } as VideoCallData, ORG_A);

    const stats = await repo.getChatRoomStats(roomId);
    expect(stats.totalMessages).toBe(4);
    expect(stats.textMessages).toBe(2);
    expect(stats.systemMessages).toBe(1);
    expect(stats.videoCallMessages).toBe(1);
    expect(stats.lastMessageAt).toBeInstanceOf(Date);
  });
});

// ─── ChatRoomRepository ───────────────────────────────────────────────────

describe('ChatRoomRepository (real DB)', () => {
  test('findUserChatRooms: participant filter + status, ordered by lastMessageAt desc', async () => {
    if (!dbReachable) return;
    const repo = new ChatRoomRepository(db as any, noopLogger);
    const user = '00000000-0000-4000-8000-000000001001';
    const older = await insertRoom({ participants: [user], lastMessageAt: new Date(Date.now() - 100_000) });
    const newer = await insertRoom({ participants: [user], lastMessageAt: new Date() });
    await insertRoom({ participants: ['someone-else'] }); // excluded
    await insertRoom({ participants: [user], status: 'archived' }); // excluded by status

    const rooms = await repo.findUserChatRooms(user, { status: 'active' });
    expect(rooms.map((r) => r.id)).toEqual([newer, older]);
  });

  test('findUserRoomsPage: AND participants + org scope + pagination + true total', async () => {
    if (!dbReachable) return;
    const repo = new ChatRoomRepository(db as any, noopLogger);
    const u = '00000000-0000-4000-8000-000000001101';
    const other = '00000000-0000-4000-8000-000000001102';
    // 3 rooms with both u+other in ORG_A; 1 with only u; 1 in ORG_B.
    for (let i = 0; i < 3; i++) {
      await insertRoom({ organizationId: ORG_A, participants: [u, other], lastMessageAt: new Date(Date.now() + i * 1000) });
    }
    await insertRoom({ organizationId: ORG_A, participants: [u] });
    await insertRoom({ organizationId: ORG_B, participants: [u, other] });

    const res = await repo.findUserRoomsPage(u, {
      withParticipant: other,
      organizationId: ORG_A,
      limit: 2,
      offset: 0,
    });
    expect(res.totalCount).toBe(3); // AND both + org A
    expect(res.data).toHaveLength(2); // page-limited
  });

  test('findRoomWithParticipants / findRoomBetweenParticipants', async () => {
    if (!dbReachable) return;
    const repo = new ChatRoomRepository(db as any, noopLogger);
    expect(await repo.findRoomWithParticipants([])).toBeNull();
    const a = '00000000-0000-4000-8000-000000001201';
    const b = '00000000-0000-4000-8000-000000001202';
    const roomId = await insertRoom({ participants: [a, b] });
    const found = await repo.findRoomBetweenParticipants(a, b);
    expect(found!.id).toBe(roomId);
    expect(await repo.findRoomWithParticipants([a, '00000000-0000-4000-8000-0000000012ff'])).toBeNull();
  });

  test('findOrCreateBookingChatRoom: create / link-existing / find-by-context', async () => {
    if (!dbReachable) return;
    const repo = new ChatRoomRepository(db as any, noopLogger);
    const a = '00000000-0000-4000-8000-000000001301';
    const b = '00000000-0000-4000-8000-000000001302';

    // 1. Fresh booking → create new room.
    const r1 = await repo.findOrCreateBookingChatRoom('booking-1', [a, b], undefined, ORG_A);
    expect(r1.created).toBe(true);
    expect(r1.room.context).toBe('booking-1');

    // 2. Same booking again → found by context (created=false).
    const r2 = await repo.findOrCreateBookingChatRoom('booking-1', [a, b], undefined, ORG_A);
    expect(r2.created).toBe(false);
    expect(r2.room.id).toBe(r1.room.id);

    // 3. Existing participant room without context → linked. Use a distinct
    // participant pair so the only match is this orphan (not the booking-1 room).
    const c = '00000000-0000-4000-8000-000000001303';
    const d = '00000000-0000-4000-8000-000000001304';
    const orphan = await insertRoom({ organizationId: ORG_A, participants: [c, d], context: null });
    const r3 = await repo.findOrCreateBookingChatRoom('booking-2', [c, d], undefined, ORG_A);
    expect(r3.created).toBe(false);
    expect(r3.room.id).toBe(orphan);
    expect(r3.room.context).toBe('booking-2');
  });

  test('updateLastMessage increments messageCount SQL-side', async () => {
    if (!dbReachable) return;
    const repo = new ChatRoomRepository(db as any, noopLogger);
    const roomId = await insertRoom({});
    const first = await repo.updateLastMessage(roomId);
    expect(first.messageCount).toBe(1);
    const second = await repo.updateLastMessage(roomId);
    expect(second.messageCount).toBe(2);
    expect(second.lastMessageAt).toBeInstanceOf(Date);
  });

  test('setActiveVideoCall: atomic claim, conflict on second claim, clear is unconditional', async () => {
    if (!dbReachable) return;
    const repo = new ChatRoomRepository(db as any, noopLogger);
    const roomId = await insertRoom({});
    const msg1 = '00000000-0000-4000-8000-000000001401';
    const msg2 = '00000000-0000-4000-8000-000000001402';

    const claimed = await repo.setActiveVideoCall(roomId, msg1);
    expect(claimed.activeVideoCallMessage).toBe(msg1);

    // Slot already taken → ConflictError.
    await expect(repo.setActiveVideoCall(roomId, msg2)).rejects.toBeInstanceOf(ConflictError);

    // Clear unconditionally.
    const cleared = await repo.setActiveVideoCall(roomId, null);
    expect(cleared.activeVideoCallMessage).toBeNull();

    // Now claimable again.
    const reclaimed = await repo.setActiveVideoCall(roomId, msg2);
    expect(reclaimed.activeVideoCallMessage).toBe(msg2);
  });

  test('isUserParticipant / isUserAdmin true/false + missing room', async () => {
    if (!dbReachable) return;
    const repo = new ChatRoomRepository(db as any, noopLogger);
    const part = '00000000-0000-4000-8000-000000001501';
    const admin = '00000000-0000-4000-8000-000000001502';
    const roomId = await insertRoom({ participants: [part, admin], admins: [admin] });

    expect(await repo.isUserParticipant(roomId, part)).toBe(true);
    expect(await repo.isUserParticipant(roomId, 'nobody')).toBe(false);
    expect(await repo.isUserAdmin(roomId, admin)).toBe(true);
    expect(await repo.isUserAdmin(roomId, part)).toBe(false);

    const missing = '00000000-0000-4000-8000-0000000015ff';
    expect(await repo.isUserParticipant(missing, part)).toBe(false);
    expect(await repo.isUserAdmin(missing, admin)).toBe(false);
  });

  test('archiveRoom flips status to archived', async () => {
    if (!dbReachable) return;
    const repo = new ChatRoomRepository(db as any, noopLogger);
    const roomId = await insertRoom({ status: 'active' });
    const archived = await repo.archiveRoom(roomId);
    expect(archived.status).toBe('archived');
  });

  test('buildWhereConditions emits org-or-dm clause and hasActiveCall variants', async () => {
    if (!dbReachable) return;
    const repo = new ChatRoomRepository(db as any, noopLogger);
    const org = freshOrg(); // isolate this test's rows from other tests
    // active call present
    const withCall = await insertRoom({ organizationId: org });
    await repo.setActiveVideoCall(withCall, '00000000-0000-4000-8000-000000001601');
    await insertRoom({ organizationId: org }); // no active call
    const dmOther = await insertRoom({ organizationId: ORG_B, roomType: 'dm' });

    // hasActiveCall true → only the room with a call (scoped to org).
    const active = await (repo as any).findMany({ organizationId: org, hasActiveCall: true });
    expect(active.map((r: any) => r.id)).toEqual([withCall]);

    // hasActiveCall false → the no-call room(s) in org only.
    const idle = await (repo as any).findMany({ organizationId: org, hasActiveCall: false });
    expect(idle.every((r: any) => r.activeVideoCallMessage === null)).toBe(true);
    expect(idle.length).toBeGreaterThanOrEqual(1);

    // org-or-dm: org rooms OR any dm → includes the ORG_B dm + this org's rooms.
    const orDm = await (repo as any).findMany({ organizationIdOrDm: org });
    const ids = orDm.map((r: any) => r.id);
    expect(ids).toContain(dmOther);
    expect(ids).toContain(withCall);

    // admins filter
    const adminRoom = await insertRoom({ organizationId: org, admins: [U1] });
    const byAdmin = await (repo as any).findMany({ admins: [U1] });
    expect(byAdmin.map((r: any) => r.id)).toContain(adminRoom);
  });
});
