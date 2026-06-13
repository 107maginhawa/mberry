/**
 * Tests for comms REST handlers (excluding joinVideoCall and ws.chat-room
 * which have their own test files).
 *
 * Covers 9 handlers: createChatRoom, getChatRoom, getChatMessages,
 * listChatRooms, sendChatMessage, endVideoCall, leaveVideoCall,
 * updateVideoCallParticipant, getIceServers.
 *
 * Each handler tests: auth guard, happy path, not-found / forbidden.
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { ensurePristine, restoreRepo } from '@/test-utils/make-ctx';

// Mock-Classification: APPROPRIATE — WebSocket/WebRTC real-time service boundary
import { createChatRoom } from './createChatRoom';
import { getChatRoom } from './getChatRoom';
import { getChatMessages } from './getChatMessages';
import { listChatRooms } from './listChatRooms';
import { sendChatMessage } from './sendChatMessage';
import { endVideoCall } from './endVideoCall';
import { leaveVideoCall } from './leaveVideoCall';
import { updateVideoCallParticipant } from './updateVideoCallParticipant';
import { getIceServers } from './getIceServers';

import { ChatRoomRepository } from './repos/chatRoom.repo';
import { ChatMessageRepository } from './repos/chatMessage.repo';
import { ChatRoomMemberRepository } from './repos/chatRoomMember.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

// Restore repo prototypes after every test so the raw `prototype.x = mock()`
// patches below don't leak into other test files (bun runs files in one process).
ensurePristine(ChatRoomRepository);
ensurePristine(ChatMessageRepository);
ensurePristine(ChatRoomMemberRepository);
ensurePristine(OfficerTermRepository);
afterEach(() => {
  restoreRepo(ChatRoomRepository);
  restoreRepo(ChatMessageRepository);
  restoreRepo(ChatRoomMemberRepository);
  restoreRepo(OfficerTermRepository);
});

import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  BusinessLogicError,
} from '@/core/errors';
import type { ChatRoom, ChatMessage, VideoCallData } from './repos/comms.schema';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRoom(overrides: Partial<ChatRoom> = {}): ChatRoom {
  return {
    id: 'room-1',
    organizationId: 'org-1',
    participants: ['user-1', 'user-2'],
    admins: ['user-1'],
    context: null,
    status: 'active',
    messageCount: 5,
    lastMessageAt: new Date(),
    activeVideoCallMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    version: 1,
    ...overrides,
  } as unknown as ChatRoom;
}

function makeVideoCallData(overrides: Partial<VideoCallData> = {}): VideoCallData {
  return {
    status: 'active',
    startedAt: new Date(Date.now() - 600_000).toISOString(), // 10 min ago
    participants: [
      {
        user: 'user-2',
        displayName: 'Bob',
        userType: 'host',
        audioEnabled: true,
        videoEnabled: true,
        joinedAt: new Date().toISOString(),
      },
    ],
    roomUrl: 'wss://x',
    token: 'tok',
    ...overrides,
  } as unknown as VideoCallData;
}

function makeCallMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-call-1',
    chatRoom: 'room-1',
    organizationId: 'org-1',
    sender: 'user-1',
    messageType: 'video_call',
    message: null,
    videoCallData: makeVideoCallData(),
    timestamp: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    version: 1,
    ...overrides,
  } as unknown as ChatMessage;
}

function makeTextMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    chatRoom: 'room-1',
    organizationId: 'org-1',
    sender: 'user-1',
    messageType: 'text',
    message: 'Hello',
    videoCallData: null,
    timestamp: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    version: 1,
    ...overrides,
  } as unknown as ChatMessage;
}

// ---------------------------------------------------------------------------
// Context builder (mirrors joinVideoCall.test.ts pattern)
// ---------------------------------------------------------------------------

function makeCtx(opts: {
  userId?: string;
  userName?: string;
  roomId?: string;
  body?: Record<string, any>;
  query?: Record<string, any>;
  params?: Record<string, any>;
  notifs?: any;
  logger?: any;
  config?: any;
  organizationId?: string;
  ws?: any;
} = {}) {
  const userId = opts.userId ?? 'user-1';
  const userName = opts.userName ?? 'Test User';
  const roomId = opts.roomId ?? 'room-1';
  const body = opts.body ?? {};
  const query = opts.query ?? {};
  const params = opts.params ?? { room: roomId };
  const logger = opts.logger ?? { info: () => {}, warn: () => {}, error: () => {} };
  const notifs = opts.notifs ?? { createNotification: mock(async () => {}) };
  const organizationId = opts.organizationId ?? 'org-1';
  const ws = opts.ws ?? { publishToChannel: mock(async () => 0) };
  const config = opts.config ?? {
    auth: { baseUrl: 'http://localhost:7213' },
    webrtc: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'turn:turn.example.com', username: 'u', credential: 'c' },
      ],
    },
  };

  let captured: { data: any; status: number } = { data: null, status: 0 };

  // Mutable store so handlers can `ctx.set(...)` (e.g. FIX-017 auditResourceId).
  const store: Record<string, any> = {
    user: userId ? { id: userId, name: userName } : null,
    database: {},
    logger,
    config,
    notifs,
    organizationId,
    ws,
  };

  const ctx = {
    get: (key: string) => store[key],
    set: (key: string, value: any) => { store[key] = value; },
    _set: () => store,
    req: {
      valid: (type: string) => {
        if (type === 'param') return params;
        if (type === 'json') return body;
        if (type === 'query') return query;
        return {};
      },
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
    _ws: () => ws,
  };

  return ctx as any;
}

// A ctx whose user has empty id (triggers ValidationError in handlers)
function makeNoUserCtx(opts: Record<string, any> = {}) {
  const ctx = makeCtx({ ...opts, userId: 'placeholder' });
  // Override get to return user with falsy id
  const origGet = ctx.get;
  ctx.get = (key: string) => {
    if (key === 'user') return { id: '', name: '' };
    return origGet(key);
  };
  return ctx;
}

// ---------------------------------------------------------------------------
// createChatRoom
// ---------------------------------------------------------------------------

describe('createChatRoom', () => {
  beforeEach(() => {
    ChatRoomRepository.prototype.findRoomWithParticipants = mock(async () => null) as any;
    ChatRoomRepository.prototype.createOne = mock(async (data: any) =>
      makeRoom({ id: 'room-new', ...data })
    ) as any;
    ChatRoomRepository.prototype.updateOneById = mock(async (_id: string, updates: any) =>
      makeRoom(updates)
    ) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({
      body: { participants: ['user-1', 'user-2'], messageType: 'text' },
    });
    await expect(createChatRoom(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 201 when creating a new chat room', async () => {
    const ctx = makeCtx({
      body: { participants: ['user-1', 'user-2'] },
    });
    await createChatRoom(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(201);
    expect(data.created).toBe(true);
    expect(data.participants).toEqual(['user-1', 'user-2']);
  });

  // FIX-017: createChatRoom has no path param, so the per-route x-audit
  // middleware would log resource 'unknown' unless the handler surfaces the new
  // room id via ctx.set('auditResourceId', ...).
  test('sets auditResourceId to the new room id for the x-audit middleware (FIX-017)', async () => {
    const ctx = makeCtx({ body: { participants: ['user-1', 'user-2'] } });
    await createChatRoom(ctx);
    expect(ctx._set().auditResourceId).toBe('room-new');
  });

  test('throws ValidationError when participants < 2', async () => {
    const ctx = makeCtx({ body: { participants: ['user-1'] } });
    await expect(createChatRoom(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when participants is empty', async () => {
    const ctx = makeCtx({ body: { participants: [] } });
    await expect(createChatRoom(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ForbiddenError when user is not in participants', async () => {
    const ctx = makeCtx({
      userId: 'user-99',
      body: { participants: ['user-1', 'user-2'] },
    });
    await expect(createChatRoom(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('throws ConflictError when room exists and upsert is false', async () => {
    ChatRoomRepository.prototype.findRoomWithParticipants = mock(async () =>
      makeRoom()
    ) as any;

    const ctx = makeCtx({
      body: { participants: ['user-1', 'user-2'], upsert: false },
    });
    await expect(createChatRoom(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('returns 200 with upsert when room already exists', async () => {
    ChatRoomRepository.prototype.findRoomWithParticipants = mock(async () =>
      makeRoom()
    ) as any;

    const ctx = makeCtx({
      body: { participants: ['user-1', 'user-2'], upsert: true },
    });
    await createChatRoom(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.created).toBe(false);
  });

  // FIX-005 (G6): Admin-escalation guard. On upsert of an existing room, a
  // caller who is NOT already an admin must not be able to overwrite the
  // room's `admins` or `context` (privilege escalation via self-promotion).
  describe('upsert admin/context escalation guard (FIX-005 / G6)', () => {
    let updateOneById: ReturnType<typeof mock>;

    beforeEach(() => {
      // Existing room: admins = [user-1]; user-2 is a plain participant.
      ChatRoomRepository.prototype.findRoomWithParticipants = mock(async () =>
        makeRoom({ participants: ['user-1', 'user-2'], admins: ['user-1'], context: null })
      ) as any;
      updateOneById = mock(async (_id: string, updates: any) =>
        makeRoom({ ...updates })
      );
      ChatRoomRepository.prototype.updateOneById = updateOneById as any;
    });

    test('non-admin participant cannot promote themselves to admin via upsert', async () => {
      const ctx = makeCtx({
        userId: 'user-2', // plain participant, not an existing admin
        body: {
          participants: ['user-1', 'user-2'],
          admins: ['user-1', 'user-2'], // attempt self-promotion
          upsert: true,
        },
      });

      await createChatRoom(ctx);

      // The escalation must be ignored: admins must NOT be mutated.
      const adminsUpdate = updateOneById.mock.calls.find(
        (c: any[]) => c[1] && 'admins' in c[1]
      );
      expect(adminsUpdate).toBeUndefined();
    });

    test('non-admin participant cannot relink context via upsert', async () => {
      const ctx = makeCtx({
        userId: 'user-2',
        body: {
          participants: ['user-1', 'user-2'],
          context: '11111111-1111-1111-1111-111111111111',
          upsert: true,
        },
      });

      await createChatRoom(ctx);

      const contextUpdate = updateOneById.mock.calls.find(
        (c: any[]) => c[1] && 'context' in c[1]
      );
      expect(contextUpdate).toBeUndefined();
    });

    test('existing admin can still change admins via upsert', async () => {
      const ctx = makeCtx({
        userId: 'user-1', // existing admin
        body: {
          participants: ['user-1', 'user-2'],
          admins: ['user-1', 'user-2'],
          upsert: true,
        },
      });

      await createChatRoom(ctx);

      const adminsUpdate = updateOneById.mock.calls.find(
        (c: any[]) => c[1] && 'admins' in c[1]
      );
      expect(adminsUpdate).toBeDefined();
      expect(adminsUpdate![1].admins).toEqual(['user-1', 'user-2']);
    });
  });
});

// ---------------------------------------------------------------------------
// createChatRoom — channels (FIX-002 dialog payload / FIX-003 modeling /
// FIX-007 officer-only creation + join-table population)
//
// PD-1 decision: channel creation is officer-only; the creator auto-joins as
// an admin member (JSONB participants + chat_room_member join table). Channels
// may be created with no other participants (relaxed ≥2 rule).
// ---------------------------------------------------------------------------

describe('createChatRoom — channels (FIX-002/003/007)', () => {
  let createOne: ReturnType<typeof mock>;
  let addMember: ReturnType<typeof mock>;
  let findActiveByPersonAndOrg: ReturnType<typeof mock>;

  beforeEach(() => {
    createOne = mock(async (data: any) => makeRoom({ id: 'room-chan', ...data }));
    addMember = mock(async () => ({}));
    // Officer by default (one active term, non-privileged title → no 2FA gate).
    findActiveByPersonAndOrg = mock(async () => [{ positionTitle: 'Officer' }]);

    ChatRoomRepository.prototype.findRoomWithParticipants = mock(async () => null) as any;
    ChatRoomRepository.prototype.createOne = createOne as any;
    ChatRoomMemberRepository.prototype.addMember = addMember as any;
    OfficerTermRepository.prototype.findActiveByPersonAndOrg = findActiveByPersonAndOrg as any;
  });

  test('officer creates a channel: 201, roomType=channel, name persisted, creator auto-added', async () => {
    const ctx = makeCtx({
      userId: 'officer-1',
      body: { name: 'general', roomType: 'channel', participants: [] },
    });
    await createChatRoom(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(201);

    // The room is persisted as a named channel with the creator auto-joined.
    const created = createOne.mock.calls[0][0] as any;
    expect(created.roomType).toBe('channel');
    expect(created.name).toBe('general');
    expect(created.participants).toContain('officer-1');
    expect(created.admins).toContain('officer-1');
  });

  test('officer channel create populates the chat_room_member join table (creator as admin)', async () => {
    const ctx = makeCtx({
      userId: 'officer-1',
      body: { name: 'events', roomType: 'channel', participants: [] },
    });
    await createChatRoom(ctx);

    expect(addMember).toHaveBeenCalledTimes(1);
    const [roomId, personId, role] = addMember.mock.calls[0];
    expect(roomId).toBe('room-chan');
    expect(personId).toBe('officer-1');
    expect(role).toBe('admin');
  });

  test('non-officer is denied channel creation (403, officer-only PD-1)', async () => {
    findActiveByPersonAndOrg = mock(async () => []); // no active officer term
    OfficerTermRepository.prototype.findActiveByPersonAndOrg = findActiveByPersonAndOrg as any;

    const ctx = makeCtx({
      userId: 'member-9',
      body: { name: 'general', roomType: 'channel', participants: [] },
    });
    const res = await createChatRoom(ctx);

    expect(res.status).toBe(403);
    expect(createOne).not.toHaveBeenCalled();
    expect(addMember).not.toHaveBeenCalled();
  });

  test('non-channel rooms keep the ≥2 participant rule (regression)', async () => {
    const ctx = makeCtx({
      userId: 'user-1',
      body: { roomType: 'dm', participants: ['user-1'] },
    });
    await expect(createChatRoom(ctx)).rejects.toBeInstanceOf(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// getChatRoom
// ---------------------------------------------------------------------------

describe('getChatRoom', () => {
  beforeEach(() => {
    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
    // Default: not in the join table; JSONB participants is the only grant path.
    ChatRoomMemberRepository.prototype.isMember = mock(async () => false) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx();
    await expect(getChatRoom(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with room data for participant', async () => {
    const ctx = makeCtx();
    await getChatRoom(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.id).toBe('room-1');
    expect(data.participants).toContain('user-1');
  });

  test('throws NotFoundError when room does not exist', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx();
    await expect(getChatRoom(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when user is not a participant', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ participants: ['user-2', 'user-3'] })
    ) as any;
    const ctx = makeCtx({ userId: 'user-99' });
    await expect(getChatRoom(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // FIX-007 (G5): membership compatibility OR-shim. A member tracked only in
  // the `chat_room_member` join table (NOT in the legacy JSONB participants
  // array) must still be granted access.
  test('grants access to a join-table member not in JSONB participants (FIX-007)', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ participants: ['user-2', 'user-3'] })
    ) as any;
    ChatRoomMemberRepository.prototype.isMember = mock(async () => true) as any;

    const ctx = makeCtx({ userId: 'user-99' });
    await getChatRoom(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.id).toBe('room-1');
  });

  // FIX-007 regression: the shim must NOT be fail-open. A user in neither the
  // JSONB participants array nor the join table is still denied.
  test('denies a user in neither JSONB participants nor the join table (FIX-007)', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ participants: ['user-2', 'user-3'] })
    ) as any;
    ChatRoomMemberRepository.prototype.isMember = mock(async () => false) as any;

    const ctx = makeCtx({ userId: 'user-99' });
    await expect(getChatRoom(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // FIX-008 (G4 read-path): tenant isolation for org-scoped rooms. A caller
  // whose active org context differs from the room's org must NOT read a
  // channel/group/booking room — even as a (stale) participant.
  test('denies cross-org read of a non-DM room (FIX-008)', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ roomType: 'channel', organizationId: 'org-1', participants: ['user-99'] })
    ) as any;
    const ctx = makeCtx({ userId: 'user-99', organizationId: 'org-2' });
    await expect(getChatRoom(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // FIX-008: DM rooms are org-agnostic (PD-2 gated) — the org guard must NOT
  // apply; participant access still governs.
  test('allows cross-org read of a DM room (FIX-008, PD-2 preserved)', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ roomType: 'dm', organizationId: 'org-1', participants: ['user-99'] })
    ) as any;
    const ctx = makeCtx({ userId: 'user-99', organizationId: 'org-2' });
    await getChatRoom(ctx);
    expect(ctx._captured().status).toBe(200);
  });

  // FIX-008 regression: same-org participant of a non-DM room is unaffected.
  test('allows same-org read of a non-DM room (FIX-008 regression)', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ roomType: 'channel', organizationId: 'org-1', participants: ['user-1'] })
    ) as any;
    const ctx = makeCtx({ userId: 'user-1', organizationId: 'org-1' });
    await getChatRoom(ctx);
    expect(ctx._captured().status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// getChatMessages
// ---------------------------------------------------------------------------

describe('getChatMessages', () => {
  beforeEach(() => {
    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
    // Default: not in the join table; JSONB participants is the only grant path.
    ChatRoomMemberRepository.prototype.isMember = mock(async () => false) as any;
    ChatMessageRepository.prototype.findManyWithPagination = mock(async () => ({
      data: [makeTextMessage({ id: 'msg-1' }), makeTextMessage({ id: 'msg-2' })],
      totalCount: 2,
    })) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx();
    await expect(getChatMessages(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with messages and pagination', async () => {
    const ctx = makeCtx({ query: {} });
    await getChatMessages(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('pagination');
    expect(data.data.length).toBe(2);
  });

  test('throws NotFoundError when room does not exist', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx();
    await expect(getChatMessages(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when user is not a participant', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ participants: ['user-2', 'user-3'] })
    ) as any;
    const ctx = makeCtx({ userId: 'user-99' });
    await expect(getChatMessages(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // FIX-007 (G5): join-table member (not in JSONB participants) can read the
  // message history via the membership compatibility OR-shim.
  test('grants message-read access to a join-table member not in JSONB participants (FIX-007)', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ participants: ['user-2', 'user-3'] })
    ) as any;
    ChatRoomMemberRepository.prototype.isMember = mock(async () => true) as any;

    const ctx = makeCtx({ userId: 'user-99', query: {} });
    await getChatMessages(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.data.length).toBe(2);
  });

  // FIX-007 regression: shim is not fail-open.
  test('denies message-read for a user in neither JSONB participants nor the join table (FIX-007)', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ participants: ['user-2', 'user-3'] })
    ) as any;
    ChatRoomMemberRepository.prototype.isMember = mock(async () => false) as any;

    const ctx = makeCtx({ userId: 'user-99' });
    await expect(getChatMessages(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // FIX-008 (G4 read-path): cross-org message-read of a non-DM room is denied.
  test('denies cross-org message-read of a non-DM room (FIX-008)', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ roomType: 'channel', organizationId: 'org-1', participants: ['user-99'] })
    ) as any;
    const ctx = makeCtx({ userId: 'user-99', organizationId: 'org-2' });
    await expect(getChatMessages(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // FIX-008: DM message-read is org-agnostic (PD-2 preserved).
  test('allows cross-org message-read of a DM room (FIX-008, PD-2 preserved)', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ roomType: 'dm', organizationId: 'org-1', participants: ['user-99'] })
    ) as any;
    const ctx = makeCtx({ userId: 'user-99', organizationId: 'org-2', query: {} });
    await getChatMessages(ctx);
    expect(ctx._captured().status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// listChatRooms
// ---------------------------------------------------------------------------

describe('listChatRooms', () => {
  beforeEach(() => {
    // FIX-013: handler now delegates to the SQL-filtered, paginated repo method.
    ChatRoomRepository.prototype.findUserRoomsPage = mock(async () => ({
      data: [makeRoom({ id: 'room-1' }), makeRoom({ id: 'room-2' })],
      totalCount: 2,
    })) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ query: {} });
    await expect(listChatRooms(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with paginated rooms', async () => {
    const ctx = makeCtx({ query: {} });
    await listChatRooms(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('pagination');
    expect(data.data.length).toBe(2);
  });

  // FIX-013: context + withParticipant must be applied in SQL (passed to the
  // repo), NOT filtered in-memory after a pagination slice — otherwise a
  // matching room on a later page silently vanishes.
  test('passes withParticipant + context filters through to the repo (SQL-side)', async () => {
    const page = mock(async () => ({
      data: [makeRoom({ id: 'room-1', participants: ['user-1', 'user-2'] })],
      totalCount: 1,
    }));
    ChatRoomRepository.prototype.findUserRoomsPage = page as any;

    const ctx = makeCtx({ query: { withParticipant: 'user-2', context: 'booking-9' } });
    await listChatRooms(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.data.length).toBe(1);
    expect(data.data[0].id).toBe('room-1');

    // The filters reached the repo (not applied post-slice).
    const callArgs = (page as ReturnType<typeof mock>).mock.calls[0];
    expect(callArgs[0]).toBe('user-1'); // current user
    expect(callArgs[1].withParticipant).toBe('user-2');
    expect(callArgs[1].context).toBe('booking-9');
  });

  // FIX-013: total must reflect the SQL count across all pages, not the page length.
  test('pagination totalCount reflects the SQL total, not the current page size', async () => {
    ChatRoomRepository.prototype.findUserRoomsPage = mock(async () => ({
      data: [makeRoom({ id: 'room-1' })],
      totalCount: 42,
    })) as any;

    const ctx = makeCtx({ query: { page: 1, pageSize: 1 } });
    await listChatRooms(ctx);

    const { data } = ctx._captured();
    expect(data.pagination.totalCount).toBe(42);
  });

  // FIX-008 (G4 read-path): when the caller's org context is known, scope the
  // listing to that org (non-DM rooms) while preserving DMs. The handler passes
  // the caller org to the repo, which ANDs an (org OR room_type='dm') clause.
  test('passes the caller org context to the repo for org-scoped listing (FIX-008)', async () => {
    const page = mock(async () => ({ data: [makeRoom({ id: 'room-1' })], totalCount: 1 }));
    ChatRoomRepository.prototype.findUserRoomsPage = page as any;

    const ctx = makeCtx({ query: {}, organizationId: 'org-7' });
    await listChatRooms(ctx);

    const callArgs = (page as ReturnType<typeof mock>).mock.calls[0];
    expect(callArgs[1].organizationId).toBe('org-7');
  });
});

// ---------------------------------------------------------------------------
// sendChatMessage — text
// ---------------------------------------------------------------------------

describe('sendChatMessage', () => {
  let createTextMessage: ReturnType<typeof mock>;
  let createVideoCallMessage: ReturnType<typeof mock>;
  let findActiveVideoCall: ReturnType<typeof mock>;
  let setActiveVideoCall: ReturnType<typeof mock>;
  let updateLastMessage: ReturnType<typeof mock>;

  beforeEach(() => {
    createTextMessage = mock(async () => makeTextMessage());
    createVideoCallMessage = mock(async () => makeCallMessage());
    findActiveVideoCall = mock(async () => null) as any;
    setActiveVideoCall = mock(async () => {}) as any;
    updateLastMessage = mock(async () => {}) as any;

    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
    ChatRoomRepository.prototype.setActiveVideoCall = setActiveVideoCall as any;
    ChatRoomRepository.prototype.updateLastMessage = updateLastMessage as any;
    ChatMessageRepository.prototype.createTextMessage = createTextMessage as any;
    ChatMessageRepository.prototype.createVideoCallMessage = createVideoCallMessage as any;
    ChatMessageRepository.prototype.findActiveVideoCall = findActiveVideoCall as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({
      body: { messageType: 'text', message: 'hi' },
    });
    await expect(sendChatMessage(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 201 when sending a text message', async () => {
    const ctx = makeCtx({
      body: { messageType: 'text', message: 'Hello world' },
    });
    await sendChatMessage(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(201);
    expect(createTextMessage).toHaveBeenCalledTimes(1);
  });

  test('throws ValidationError for empty text message', async () => {
    const ctx = makeCtx({
      body: { messageType: 'text', message: '   ' },
    });
    await expect(sendChatMessage(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError for invalid messageType', async () => {
    const ctx = makeCtx({
      body: { messageType: 'emoji' },
    });
    await expect(sendChatMessage(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws NotFoundError when room does not exist', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({
      body: { messageType: 'text', message: 'hi' },
    });
    await expect(sendChatMessage(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when user is not a participant', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ participants: ['user-2', 'user-3'] })
    ) as any;
    const ctx = makeCtx({
      userId: 'user-99',
      body: { messageType: 'text', message: 'hi' },
    });
    await expect(sendChatMessage(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('returns 201 when starting a video call as admin', async () => {
    const ctx = makeCtx({
      body: {
        messageType: 'video_call',
        videoCallData: {
          participants: [
            { user: 'user-1', displayName: 'Alice', userType: 'host', audioEnabled: true, videoEnabled: true },
          ],
        },
      },
    });
    await sendChatMessage(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(201);
    expect(createVideoCallMessage).toHaveBeenCalledTimes(1);
    expect(setActiveVideoCall).toHaveBeenCalledTimes(1);
  });

  test('throws ConflictError when starting video call while one is active', async () => {
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () =>
      makeCallMessage()
    ) as any;

    const ctx = makeCtx({
      body: {
        messageType: 'video_call',
        videoCallData: { participants: [] },
      },
    });
    await expect(sendChatMessage(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('throws ForbiddenError when non-admin tries to start video call', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ participants: ['user-1', 'user-2'], admins: ['user-2'] })
    ) as any;

    const ctx = makeCtx({
      body: {
        messageType: 'video_call',
        videoCallData: { participants: [] },
      },
    });
    await expect(sendChatMessage(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('updates room lastMessage after sending', async () => {
    const ctx = makeCtx({
      body: { messageType: 'text', message: 'hi' },
    });
    await sendChatMessage(ctx);

    expect(updateLastMessage).toHaveBeenCalledTimes(1);
  });

  // PD-3 (FIX-011) — V1 capacity cap on the start signaling path
  describe('V1 video capacity cap (PD-3)', () => {
    function participants(n: number) {
      return Array.from({ length: n }, (_, i) => ({
        user: `seed-${i}`,
        displayName: `Seed ${i}`,
        userType: 'host',
        audioEnabled: true,
        videoEnabled: true,
      }));
    }

    test('rejects starting a call seeded above the V1 cap (6)', async () => {
      // 6 seeds + initiator (user-1, not in seeds) → 7 > cap
      const ctx = makeCtx({
        body: {
          messageType: 'video_call',
          videoCallData: { participants: participants(6) },
        },
      });
      await expect(sendChatMessage(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
      expect(createVideoCallMessage).not.toHaveBeenCalled();
    });

    test('allows starting a call at exactly the V1 cap', async () => {
      // 5 seeds + initiator (user-1) → 6 == cap → allowed
      const ctx = makeCtx({
        body: {
          messageType: 'video_call',
          videoCallData: { participants: participants(5) },
        },
      });
      await sendChatMessage(ctx);
      expect(ctx._captured().status).toBe(201);
      expect(createVideoCallMessage).toHaveBeenCalledTimes(1);
    });
  });

  // PD-3 (FIX-011) — V1 no-recording invariant on the start signaling path
  describe('V1 no-recording invariant (PD-3)', () => {
    test('rejects a start payload carrying a recording flag', async () => {
      const ctx = makeCtx({
        body: {
          messageType: 'video_call',
          videoCallData: {
            participants: [
              { user: 'user-2', displayName: 'Bob', userType: 'host', audioEnabled: true, videoEnabled: true },
            ],
            recording: true,
          },
        },
      });
      await expect(sendChatMessage(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
      expect(createVideoCallMessage).not.toHaveBeenCalled();
    });

    test('persisted video call data carries no recording field', async () => {
      const ctx = makeCtx({
        body: {
          messageType: 'video_call',
          videoCallData: {
            participants: [
              { user: 'user-2', displayName: 'Bob', userType: 'host', audioEnabled: true, videoEnabled: true },
            ],
          },
        },
      });
      await sendChatMessage(ctx);
      expect(createVideoCallMessage).toHaveBeenCalledTimes(1);
      const persisted = (createVideoCallMessage as ReturnType<typeof mock>).mock.calls[0][2] as any;
      expect(persisted).not.toHaveProperty('recording');
      expect(persisted).not.toHaveProperty('recordingEnabled');
    });
  });

  // FIX-001 (G1): REST send must broadcast the persisted message to the
  // room's WS channel using the spec envelope { event, payload }, so other
  // participants receive it live instead of only on a manual refetch.
  test('broadcasts persisted text message to the room WS channel', async () => {
    const savedMessage = makeTextMessage({ id: 'msg-broadcast-1' });
    ChatMessageRepository.prototype.createTextMessage = mock(async () => savedMessage) as any;

    const ctx = makeCtx({
      body: { messageType: 'text', message: 'Hello world' },
    });
    await sendChatMessage(ctx);

    const publish = ctx._ws().publishToChannel as ReturnType<typeof mock>;
    const chatCall = publish.mock.calls.find((c: any[]) => c[1] === 'chat.message');
    expect(chatCall).toBeDefined();
    // channelId is namespaced as `chat-rooms/${roomId}`
    expect(chatCall![0]).toBe('chat-rooms/room-1');
    // payload is the full saved message object
    expect(chatCall![2]).toEqual(savedMessage);
  });

  test('broadcasts started video_call message to the room WS channel', async () => {
    const ctx = makeCtx({
      body: {
        messageType: 'video_call',
        videoCallData: {
          participants: [
            { user: 'user-1', displayName: 'Alice', userType: 'host', audioEnabled: true, videoEnabled: true },
          ],
        },
      },
    });
    await sendChatMessage(ctx);

    const publish = ctx._ws().publishToChannel as ReturnType<typeof mock>;
    const callBroadcast = publish.mock.calls.find((c: any[]) => c[1] === 'chat.message');
    expect(callBroadcast).toBeDefined();
    expect(callBroadcast![0]).toBe('chat-rooms/room-1');
  });

  // FIX-012 (G10): archived rooms are read-only — REST send must reject.
  test('rejects text message to an archived room (FIX-012)', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ status: 'archived' })
    ) as any;

    const ctx = makeCtx({ body: { messageType: 'text', message: 'hi' } });
    await expect(sendChatMessage(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
    expect(createTextMessage).not.toHaveBeenCalled();
  });

  // FIX-014 (G11): the active-call slot is claimed atomically. If setActiveVideoCall
  // throws ConflictError (a concurrent start won the race), the just-created call
  // message must be retired (status ended) so it can't masquerade as active later.
  test('retires the orphan call message when the active-call claim is lost (FIX-014)', async () => {
    const callMessage = makeCallMessage({ id: 'msg-orphan' });
    ChatMessageRepository.prototype.createVideoCallMessage = mock(async () => callMessage) as any;
    const updateVideoCallData = mock(async () => callMessage);
    ChatMessageRepository.prototype.updateVideoCallData = updateVideoCallData as any;
    // Claim lost: the conditional UPDATE found the slot already taken.
    ChatRoomRepository.prototype.setActiveVideoCall = mock(async () => {
      throw new ConflictError('An active video call already exists in this room');
    }) as any;

    const ctx = makeCtx({
      body: {
        messageType: 'video_call',
        videoCallData: {
          participants: [
            { user: 'user-1', displayName: 'Alice', userType: 'host', audioEnabled: true, videoEnabled: true },
          ],
        },
      },
    });

    await expect(sendChatMessage(ctx)).rejects.toBeInstanceOf(ConflictError);
    // The orphan was retired.
    const endedCall = updateVideoCallData.mock.calls.find(
      (c: any[]) => c[0] === 'msg-orphan' && c[1]?.status === 'ended'
    );
    expect(endedCall).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// sendChatMessage — #announcements officer-post-only (PD-1 decision-3, Step 41)
//
// The provisioned #announcements channel (context 'channel:announcements') is
// read-only for members: only officers may post. #general and other channels
// stay open to any participant.
// ---------------------------------------------------------------------------

describe('sendChatMessage — announcements officer-post gate (PD-1 d3)', () => {
  let createTextMessage: ReturnType<typeof mock>;
  let findActiveByPersonAndOrg: ReturnType<typeof mock>;

  beforeEach(() => {
    createTextMessage = mock(async () => makeTextMessage());
    // Officer by default (one active non-privileged term → no 2FA gate).
    findActiveByPersonAndOrg = mock(async () => [{ positionTitle: 'Officer' }]);

    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ context: 'channel:announcements', participants: ['user-1'] })
    ) as any;
    ChatRoomRepository.prototype.updateLastMessage = mock(async () => {}) as any;
    ChatMessageRepository.prototype.createTextMessage = createTextMessage as any;
    OfficerTermRepository.prototype.findActiveByPersonAndOrg = findActiveByPersonAndOrg as any;
  });

  test('officer may post to #announcements (201)', async () => {
    const ctx = makeCtx({ userId: 'user-1', body: { messageType: 'text', message: 'notice' } });
    await sendChatMessage(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(201);
    expect(createTextMessage).toHaveBeenCalledTimes(1);
  });

  test('non-officer member is blocked from posting to #announcements (403)', async () => {
    findActiveByPersonAndOrg = mock(async () => []); // no active officer term
    OfficerTermRepository.prototype.findActiveByPersonAndOrg = findActiveByPersonAndOrg as any;

    const ctx = makeCtx({ userId: 'user-1', body: { messageType: 'text', message: 'notice' } });
    const res = await sendChatMessage(ctx);

    expect(res.status).toBe(403);
    expect(createTextMessage).not.toHaveBeenCalled();
  });

  test('regression: any member may post to a non-announcements channel (#general)', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ context: 'channel:general', participants: ['user-1'] })
    ) as any;
    // No officer term — must be irrelevant for #general.
    OfficerTermRepository.prototype.findActiveByPersonAndOrg = mock(async () => []) as any;

    const ctx = makeCtx({ userId: 'user-1', body: { messageType: 'text', message: 'hi' } });
    await sendChatMessage(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(201);
    expect(createTextMessage).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// endVideoCall
// ---------------------------------------------------------------------------

describe('endVideoCall', () => {
  let updateVideoCallData: ReturnType<typeof mock>;
  let setActiveVideoCall: ReturnType<typeof mock>;
  let createSystemMessage: ReturnType<typeof mock>;
  let updateLastMessage: ReturnType<typeof mock>;

  beforeEach(() => {
    updateVideoCallData = mock(async () => makeCallMessage({
      videoCallData: makeVideoCallData({ status: 'ended' }),
    }));
    setActiveVideoCall = mock(async () => {});
    createSystemMessage = mock(async () => makeTextMessage({ messageType: 'system' } as any));
    updateLastMessage = mock(async () => {});

    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
    ChatRoomRepository.prototype.setActiveVideoCall = setActiveVideoCall as any;
    ChatRoomRepository.prototype.updateLastMessage = updateLastMessage as any;
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () =>
      makeCallMessage()
    ) as any;
    ChatMessageRepository.prototype.updateVideoCallData = updateVideoCallData as any;
    ChatMessageRepository.prototype.createSystemMessage = createSystemMessage as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx();
    await expect(endVideoCall(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with duration and system message', async () => {
    const ctx = makeCtx();
    await endVideoCall(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data).toHaveProperty('message');
    expect(data).toHaveProperty('callDuration');
    expect(data).toHaveProperty('systemMessage');
  });

  test('throws NotFoundError when room does not exist', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx();
    await expect(endVideoCall(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when user is not a participant', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ participants: ['user-2', 'user-3'], admins: ['user-2'] })
    ) as any;
    const ctx = makeCtx({ userId: 'user-99' });
    await expect(endVideoCall(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('throws ForbiddenError when non-admin tries to end call', async () => {
    // user-1 is participant but NOT admin
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ participants: ['user-1', 'user-2'], admins: ['user-2'] })
    ) as any;
    const ctx = makeCtx();
    await expect(endVideoCall(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('throws NotFoundError when no active video call', async () => {
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () => null) as any;
    const ctx = makeCtx();
    await expect(endVideoCall(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('clears room active video call reference', async () => {
    const ctx = makeCtx();
    await endVideoCall(ctx);

    expect(setActiveVideoCall).toHaveBeenCalledTimes(1);
    const args = (setActiveVideoCall as ReturnType<typeof mock>).mock.calls[0];
    expect(args[0]).toBe('room-1');
    expect(args[1]).toBeNull();
  });

  test('creates system message on end', async () => {
    const ctx = makeCtx();
    await endVideoCall(ctx);

    expect(createSystemMessage).toHaveBeenCalledTimes(1);
    const msgArg = (createSystemMessage as ReturnType<typeof mock>).mock.calls[0][1] as string;
    expect(msgArg).toContain('Video call ended');
  });
});

// ---------------------------------------------------------------------------
// leaveVideoCall
// ---------------------------------------------------------------------------

describe('leaveVideoCall', () => {
  let removeVideoCallParticipant: ReturnType<typeof mock>;
  let createSystemMessage: ReturnType<typeof mock>;
  let setActiveVideoCall: ReturnType<typeof mock>;
  let updateVideoCallData: ReturnType<typeof mock>;

  const activeParticipant = {
    user: 'user-1',
    displayName: 'Alice',
    userType: 'host',
    audioEnabled: true,
    videoEnabled: true,
    joinedAt: new Date().toISOString(),
  };

  const otherParticipant = {
    user: 'user-2',
    displayName: 'Bob',
    userType: 'host',
    audioEnabled: true,
    videoEnabled: true,
    joinedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    removeVideoCallParticipant = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          participants: [
            { ...activeParticipant, leftAt: new Date().toISOString() } as any,
            otherParticipant as any,
          ],
        }),
      })
    );
    createSystemMessage = mock(async () => makeTextMessage({ messageType: 'system' } as any));
    setActiveVideoCall = mock(async () => {});
    updateVideoCallData = mock(async () => makeCallMessage());

    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
    ChatRoomRepository.prototype.setActiveVideoCall = setActiveVideoCall as any;
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          participants: [activeParticipant as any, otherParticipant as any],
        }),
      })
    ) as any;
    ChatMessageRepository.prototype.removeVideoCallParticipant = removeVideoCallParticipant as any;
    ChatMessageRepository.prototype.createSystemMessage = createSystemMessage as any;
    ChatMessageRepository.prototype.updateVideoCallData = updateVideoCallData as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx();
    await expect(leaveVideoCall(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with leave confirmation', async () => {
    const ctx = makeCtx();
    await leaveVideoCall(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.message).toContain('Successfully left');
    expect(typeof data.callStillActive).toBe('boolean');
    expect(typeof data.remainingParticipants).toBe('number');
  });

  test('throws NotFoundError when room does not exist', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx();
    await expect(leaveVideoCall(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when user is not a room participant', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ participants: ['user-2', 'user-3'] })
    ) as any;
    const ctx = makeCtx({ userId: 'user-99' });
    await expect(leaveVideoCall(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('throws NotFoundError when no active video call', async () => {
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () => null) as any;
    const ctx = makeCtx();
    await expect(leaveVideoCall(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError when user is not in the call', async () => {
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          participants: [otherParticipant as any],
        }),
      })
    ) as any;
    const ctx = makeCtx();
    await expect(leaveVideoCall(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError when user has already left', async () => {
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          participants: [
            { ...activeParticipant, leftAt: new Date().toISOString() } as any,
          ],
        }),
      })
    ) as any;
    const ctx = makeCtx();
    await expect(leaveVideoCall(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('creates system message when leaving', async () => {
    const ctx = makeCtx();
    await leaveVideoCall(ctx);

    expect(createSystemMessage).toHaveBeenCalledTimes(1);
    const msgArg = (createSystemMessage as ReturnType<typeof mock>).mock.calls[0][1] as string;
    expect(msgArg).toContain('left the video call');
  });
});

// ---------------------------------------------------------------------------
// updateVideoCallParticipant
// ---------------------------------------------------------------------------

describe('updateVideoCallParticipant', () => {
  const activeParticipant = {
    user: 'user-1',
    displayName: 'Alice',
    userType: 'host',
    audioEnabled: true,
    videoEnabled: true,
    joinedAt: new Date().toISOString(),
  };

  let updateVideoCallParticipantMock: ReturnType<typeof mock>;
  let createSystemMessage: ReturnType<typeof mock>;

  beforeEach(() => {
    updateVideoCallParticipantMock = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          participants: [
            { ...activeParticipant, audioEnabled: false } as any,
          ],
        }),
      })
    );
    createSystemMessage = mock(async () => makeTextMessage({ messageType: 'system' } as any));

    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          participants: [activeParticipant as any],
        }),
      })
    ) as any;
    ChatMessageRepository.prototype.updateVideoCallParticipant = updateVideoCallParticipantMock as any;
    ChatMessageRepository.prototype.createSystemMessage = createSystemMessage as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ body: { audioEnabled: false } });
    await expect(updateVideoCallParticipant(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 with updated participant data', async () => {
    const ctx = makeCtx({ body: { audioEnabled: false } });
    await updateVideoCallParticipant(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.audioEnabled).toBe(false);
  });

  test('throws NotFoundError when room does not exist', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ body: { audioEnabled: false } });
    await expect(updateVideoCallParticipant(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when user is not a room participant', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ participants: ['user-2', 'user-3'] })
    ) as any;
    const ctx = makeCtx({ userId: 'user-99', body: { audioEnabled: false } });
    await expect(updateVideoCallParticipant(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('throws NotFoundError when no active video call', async () => {
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () => null) as any;
    const ctx = makeCtx({ body: { audioEnabled: false } });
    await expect(updateVideoCallParticipant(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError when user is not in the call', async () => {
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          participants: [
            { ...activeParticipant, user: 'user-other' } as any,
          ],
        }),
      })
    ) as any;
    const ctx = makeCtx({ body: { audioEnabled: false } });
    await expect(updateVideoCallParticipant(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('creates system message for mute/unmute changes', async () => {
    const ctx = makeCtx({ body: { audioEnabled: false } });
    await updateVideoCallParticipant(ctx);

    expect(createSystemMessage).toHaveBeenCalledTimes(1);
    const msgArg = (createSystemMessage as ReturnType<typeof mock>).mock.calls[0][1] as string;
    expect(msgArg).toContain('muted audio');
  });
});

// ---------------------------------------------------------------------------
// getIceServers
// ---------------------------------------------------------------------------

describe('getIceServers', () => {
  test('returns 200 with ICE server configuration', async () => {
    const ctx = makeCtx();
    await getIceServers(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data).toHaveProperty('iceServers');
    expect(data.iceServers).toHaveLength(2);
    expect(data.iceServers[0].urls).toBe('stun:stun.l.google.com:19302');
  });

  test('returns servers from config even without auth', async () => {
    // getIceServers uses BaseContext (no auth check in handler)
    const ctx = makeCtx({ userId: '' });
    await getIceServers(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.iceServers).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PD-2 (CONTINUE-48): DMs / rooms are org-scoped — no cross-org messaging.
// ---------------------------------------------------------------------------

describe('sendChatMessage — PD-2 org scoping', () => {
  test('rejects a send when the caller org does not match the room org', async () => {
    // Room belongs to org-2; caller context is org-1 → cross-org send must 403.
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ organizationId: 'org-2' })
    ) as any;
    const ctx = makeCtx({
      organizationId: 'org-1',
      body: { message: 'hi', messageType: 'text' },
    });
    await expect(sendChatMessage(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // Note: the matching-org happy path (org-1 ctx / org-1 room) is already proven
  // green by the existing sendChatMessage success tests above; the guard only
  // fires on a true org mismatch, so no separate allow-case stub is added here.
});
