/**
 * Real-DB integration tests for the comms repository layer.
 *
 * Targets the three LOW-coverage repos:
 *   - ChatRoomMemberRepository (membership join table — WS authz chokepoint)
 *   - ChatMessageRepository    (message create/pagination/video-call lifecycle)
 *   - ChatRoomRepository       (org-scoping, participant filters, atomic claims)
 *
 * Pattern: per-run scratch schema seeded by `createScratch([...])`, which copies
 * the REAL public table structures via `CREATE TABLE … (LIKE public.<t> INCLUDING
 * ALL)`. This is schema-faithful — the real PG enum types (`chat_room_status`,
 * `chat_room_type`, `message_type`, `chat_room_member_role`), the real
 * `chat_room_members_unique` constraint, the real NOT NULL set and CHECKs are all
 * copied, so a repo query reading a column/enum the old hand-written DDL
 * mis-modeled (it declared the enum columns as plain `text`) can no longer pass
 * against a thinner fake table. Every repo method is driven against REAL drizzle
 * queries on REAL Postgres rows, so the query builders, WHERE predicates,
 * pagination, ordering, soft-delete/archive and conflict branches all execute
 * end-to-end.
 *
 * NOTE: `createScratch` does NOT copy foreign keys (LIKE never copies FKs), so the
 * `chat_room_member.chat_room_id`/`chat_message.chat_room_id` ON DELETE CASCADE
 * FKs are absent. Parent `chat_room` rows are seeded first via `insertRoom`; no
 * test in this suite relies on FK cascade-delete.
 *
 * Requires a reachable Postgres (DATABASE_URL or the repo default) with the public
 * schema already migrated. If unreachable the suite skips cleanly
 * (`if (!H.dbReachable) return`).
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { ChatRoomMemberRepository } from './chatRoomMember.repo';
import { ChatMessageRepository } from './chatMessage.repo';
import { ChatRoomRepository } from './chatRoom.repo';
import { restoreRepo } from '@/test-utils/make-ctx';
import { ConflictError, NotFoundError, ValidationError, BusinessLogicError } from '@/core/errors';
import type { CallParticipant, VideoCallData } from './comms.schema';

let H: ScratchDb;

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

/** Capture a Postgres SQLSTATE code from a thrown driver error. */
function pgCode(e: unknown): string | undefined {
  return (
    (e as { code?: string; cause?: { code?: string } }).code ??
    (e as { cause?: { code?: string } }).cause?.code
  );
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
  const res = await H.scopedPool.query(
    `INSERT INTO chat_room
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
  // Defensive: sibling comms unit tests (chat-rooms-stabilization, ws.chat-room,
  // comms-rest-handlers) stub these repo prototypes. In the full suite a leaked
  // mock would reach this real-DB test and corrupt markRead/getUnreadCount —
  // restore the real methods before running against Postgres.
  restoreRepo(ChatRoomMemberRepository);
  restoreRepo(ChatMessageRepository);
  restoreRepo(ChatRoomRepository);

  // Schema-faithful scratch schema: LIKE public.<t> INCLUDING ALL copies the real
  // enum types, the chat_room_members_unique constraint and the real NOT NULL set.
  H = await createScratch(['chat_room', 'chat_room_member', 'chat_message']);
});

afterAll(async () => {
  await H?.teardown();
});

// ─── ChatRoomMemberRepository ─────────────────────────────────────────────

describe('ChatRoomMemberRepository (real DB)', () => {
  test('addMember inserts, returns the row; duplicate returns existing (onConflictDoNothing)', async () => {
    if (!H.dbReachable) return;
    const repo = new ChatRoomMemberRepository(H.db as any, noopLogger);
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
    if (!H.dbReachable) return;
    const repo = new ChatRoomMemberRepository(H.db as any, noopLogger);
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
    if (!H.dbReachable) return;
    const repo = new ChatRoomMemberRepository(H.db as any, noopLogger);
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
    if (!H.dbReachable) return;
    const repo = new ChatRoomMemberRepository(H.db as any, noopLogger);
    const roomId = await insertRoom({});
    const p = '00000000-0000-4000-8000-000000000401';
    await repo.addMember(roomId, p);
    await repo.removeMember(roomId, p);
    expect(await repo.isMember(roomId, p)).toBe(false);
  });

  test('markRead sets lastReadAt; getUnreadCount honours read cursor', async () => {
    if (!H.dbReachable) return;
    const memberRepo = new ChatRoomMemberRepository(H.db as any, noopLogger);
    const msgRepo = new ChatMessageRepository(H.db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });
    const p = '00000000-0000-4000-8000-000000000501';
    await memberRepo.addMember(roomId, p);

    // getUnreadCount compares message.createdAt > member.lastReadAt, both
    // sourced from Postgres now() (microsecond precision, = transaction start).
    // Consecutive ops can land in the same tick, making the cursor boundary a
    // tie that miscounts. Force strictly-increasing timestamps across each
    // read boundary so the test is deterministic (not a wall-clock race).
    const tick = () => new Promise((r) => setTimeout(r, 5));

    // No lastReadAt yet → all messages count as unread.
    await msgRepo.createTextMessage(roomId, p, 'one', ORG_A);
    await msgRepo.createTextMessage(roomId, p, 'two', ORG_A);
    expect(await memberRepo.getUnreadCount(roomId, p)).toBe(2);

    // Mark read strictly after the two messages → cursor advances → 0 unread.
    await tick();
    await memberRepo.markRead(roomId, p);
    expect(await memberRepo.getUnreadCount(roomId, p)).toBe(0);

    // New message strictly after the read cursor → 1 unread.
    await tick();
    await msgRepo.createTextMessage(roomId, p, 'three', ORG_A);
    expect(await memberRepo.getUnreadCount(roomId, p)).toBe(1);
  });

  test('getUnreadCount returns 0 for a non-member', async () => {
    if (!H.dbReachable) return;
    const repo = new ChatRoomMemberRepository(H.db as any, noopLogger);
    const roomId = await insertRoom({});
    expect(await repo.getUnreadCount(roomId, '00000000-0000-4000-8000-0000000005ff')).toBe(0);
  });

  test('getPersonRoomsWithUnread aggregates rooms + unread per membership', async () => {
    if (!H.dbReachable) return;
    const memberRepo = new ChatRoomMemberRepository(H.db as any, noopLogger);
    const msgRepo = new ChatMessageRepository(H.db as any, noopLogger);
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
    if (!H.dbReachable) return;
    const repo = new ChatRoomMemberRepository(H.db as any, noopLogger);
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
    if (!H.dbReachable) return;
    const repo = new ChatMessageRepository(H.db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });
    await expect(repo.createTextMessage(roomId, 'u', '   ', ORG_A)).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.createTextMessage(roomId, 'u', 'x'.repeat(5001), ORG_A)).rejects.toBeInstanceOf(ValidationError);
  });

  test('createTextMessage derives org from room when caller omits it (WS chokepoint)', async () => {
    if (!H.dbReachable) return;
    const repo = new ChatMessageRepository(H.db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_B });
    const msg = await repo.createTextMessage(roomId, '00000000-0000-4000-8000-000000000801', 'hello');
    expect(msg.organizationId).toBe(ORG_B);
    expect(msg.message).toBe('hello');
    expect(msg.messageType).toBe('text');
  });

  test('createTextMessage with explicit org skips room lookup', async () => {
    if (!H.dbReachable) return;
    const repo = new ChatMessageRepository(H.db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });
    const msg = await repo.createTextMessage(roomId, U1, 'hi', ORG_B);
    expect(msg.organizationId).toBe(ORG_B);
  });

  test('resolveOrgId throws NotFoundError when room is missing', async () => {
    if (!H.dbReachable) return;
    const repo = new ChatMessageRepository(H.db as any, noopLogger);
    await expect(
      repo.createTextMessage('00000000-0000-4000-8000-0000000008ff', U1, 'hi'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('createSystemMessage and createVideoCallMessage persist with derived org', async () => {
    if (!H.dbReachable) return;
    const repo = new ChatMessageRepository(H.db as any, noopLogger);
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
    if (!H.dbReachable) return;
    const repo = new ChatMessageRepository(H.db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });
    await expect(
      repo.createVideoCallMessage(roomId, U1, { participants: [] } as any, ORG_A),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test('getChatRoomMessages: ordering (asc/desc), type filter, pagination', async () => {
    if (!H.dbReachable) return;
    const repo = new ChatMessageRepository(H.db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });
    // 3 text with increasing timestamps, plus a system message.
    for (let i = 0; i < 3; i++) {
      await H.scopedPool.query(
        `INSERT INTO chat_message (organization_id, chat_room_id, sender_id, message_type, message, timestamp)
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
    if (!H.dbReachable) return;
    const repo = new ChatMessageRepository(H.db as any, noopLogger);
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
    if (!H.dbReachable) return;
    const repo = new ChatMessageRepository(H.db as any, noopLogger);
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
    if (!H.dbReachable) return;
    const repo = new ChatMessageRepository(H.db as any, noopLogger);
    const roomId = await insertRoom({ organizationId: ORG_A });
    const text = await repo.createTextMessage(roomId, U1, 'plain', ORG_A);
    await expect(
      repo.addVideoCallParticipant(text.id, { user: GUEST, userType: 'client', displayName: 'G', audioEnabled: true, videoEnabled: true }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('findActiveVideoCall returns the most recent active/starting call, else null', async () => {
    if (!H.dbReachable) return;
    const repo = new ChatMessageRepository(H.db as any, noopLogger);
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
    const repo = new ChatMessageRepository(H.db as any, noopLogger);
    expect(repo.validateMessageContent('')).toEqual({ isValid: false, error: 'Message content cannot be empty' });
    expect(repo.validateMessageContent('x'.repeat(5001)).isValid).toBe(false);
    expect(repo.validateMessageContent('ok')).toEqual({ isValid: true });
  });

  test('getChatRoomStats counts by type with lastMessageAt', async () => {
    if (!H.dbReachable) return;
    const repo = new ChatMessageRepository(H.db as any, noopLogger);
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
    if (!H.dbReachable) return;
    const repo = new ChatRoomRepository(H.db as any, noopLogger);
    const user = '00000000-0000-4000-8000-000000001001';
    const older = await insertRoom({ participants: [user], lastMessageAt: new Date(Date.now() - 100_000) });
    const newer = await insertRoom({ participants: [user], lastMessageAt: new Date() });
    await insertRoom({ participants: ['someone-else'] }); // excluded
    await insertRoom({ participants: [user], status: 'archived' }); // excluded by status

    const rooms = await repo.findUserChatRooms(user, { status: 'active' });
    expect(rooms.map((r) => r.id)).toEqual([newer, older]);
  });

  test('findUserRoomsPage: AND participants + org scope + pagination + true total', async () => {
    if (!H.dbReachable) return;
    const repo = new ChatRoomRepository(H.db as any, noopLogger);
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
    if (!H.dbReachable) return;
    const repo = new ChatRoomRepository(H.db as any, noopLogger);
    expect(await repo.findRoomWithParticipants([])).toBeNull();
    const a = '00000000-0000-4000-8000-000000001201';
    const b = '00000000-0000-4000-8000-000000001202';
    const roomId = await insertRoom({ participants: [a, b] });
    const found = await repo.findRoomBetweenParticipants(a, b);
    expect(found!.id).toBe(roomId);
    expect(await repo.findRoomWithParticipants([a, '00000000-0000-4000-8000-0000000012ff'])).toBeNull();
  });

  test('findOrCreateBookingChatRoom: create / link-existing / find-by-context', async () => {
    if (!H.dbReachable) return;
    const repo = new ChatRoomRepository(H.db as any, noopLogger);
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
    if (!H.dbReachable) return;
    const repo = new ChatRoomRepository(H.db as any, noopLogger);
    const roomId = await insertRoom({});
    const first = await repo.updateLastMessage(roomId);
    expect(first.messageCount).toBe(1);
    const second = await repo.updateLastMessage(roomId);
    expect(second.messageCount).toBe(2);
    expect(second.lastMessageAt).toBeInstanceOf(Date);
  });

  test('setActiveVideoCall: atomic claim, conflict on second claim, clear is unconditional', async () => {
    if (!H.dbReachable) return;
    const repo = new ChatRoomRepository(H.db as any, noopLogger);
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
    if (!H.dbReachable) return;
    const repo = new ChatRoomRepository(H.db as any, noopLogger);
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
    if (!H.dbReachable) return;
    const repo = new ChatRoomRepository(H.db as any, noopLogger);
    const roomId = await insertRoom({ status: 'active' });
    const archived = await repo.archiveRoom(roomId);
    expect(archived.status).toBe('archived');
  });

  test('buildWhereConditions emits org-or-dm clause and hasActiveCall variants', async () => {
    if (!H.dbReachable) return;
    const repo = new ChatRoomRepository(H.db as any, noopLogger);
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

// ─── Schema-faithfulness (only createScratch's LIKE-copy enables these) ───────
//
// The old hand-written DDL modeled chat_room.status / room_type / message_type
// and chat_room_member.role as plain `text`, so a bad enum value would have been
// silently accepted. createScratch copies the REAL Postgres enum types
// (chat_room_status / chat_room_type / message_type / chat_room_member_role), so
// an out-of-domain literal is now rejected at the type boundary with SQLSTATE
// 22P02 (invalid_text_representation). These asserts prove the suite is enforcing
// the live enum domains, not a thinner fake column.
describe('comms enum domains enforced by the real PG types (drift-proof)', () => {
  test("chat_room.status outside {active,archived} → 22P02 (real enum, not text)", async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO chat_room (organization_id, participants, admins, status)
         VALUES ($1, '[]'::jsonb, '[]'::jsonb, 'frozen')`,
        [ORG_A],
      );
      throw new Error('expected invalid status to be rejected');
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('22P02');
  });

  test("chat_room.room_type outside {channel,dm,group} → 22P02", async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO chat_room (organization_id, participants, admins, room_type)
         VALUES ($1, '[]'::jsonb, '[]'::jsonb, 'broadcast')`,
        [ORG_A],
      );
      throw new Error('expected invalid room_type to be rejected');
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('22P02');
  });

  test("chat_room_member.role outside {member,admin} → 22P02", async () => {
    if (!H.dbReachable) return;
    const roomId = await insertRoom({});
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO chat_room_member (chat_room_id, person_id, role)
         VALUES ($1, $2, 'owner')`,
        [roomId, '00000000-0000-4000-8000-000000001701'],
      );
      throw new Error('expected invalid role to be rejected');
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('22P02');
  });

  test("chat_message.message_type outside {text,system,video_call} → 22P02", async () => {
    if (!H.dbReachable) return;
    const roomId = await insertRoom({ organizationId: ORG_A });
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO chat_message (organization_id, chat_room_id, sender_id, message_type, message)
         VALUES ($1, $2, $3, 'audio', 'x')`,
        [ORG_A, roomId, U1],
      );
      throw new Error('expected invalid message_type to be rejected');
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('22P02');
  });
});
