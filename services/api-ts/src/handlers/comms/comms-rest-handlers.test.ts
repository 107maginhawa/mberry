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

// Restore repo prototypes after every test so the raw `prototype.x = mock()`
// patches below don't leak into other test files (bun runs files in one process).
ensurePristine(ChatRoomRepository);
ensurePristine(ChatMessageRepository);
ensurePristine(ChatRoomMemberRepository);
afterEach(() => {
  restoreRepo(ChatRoomRepository);
  restoreRepo(ChatMessageRepository);
  restoreRepo(ChatRoomMemberRepository);
});

import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
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

  const ctx = {
    get: (key: string) => {
      const store: Record<string, any> = {
        user: userId ? { id: userId, name: userName } : null,
        database: {},
        logger,
        config,
        notifs,
        organizationId,
        ws,
      };
      return store[key];
    },
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
});

// ---------------------------------------------------------------------------
// listChatRooms
// ---------------------------------------------------------------------------

describe('listChatRooms', () => {
  beforeEach(() => {
    ChatRoomRepository.prototype.findUserChatRooms = mock(async () => [
      makeRoom({ id: 'room-1' }),
      makeRoom({ id: 'room-2' }),
    ]) as any;
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

  test('filters rooms by withParticipant', async () => {
    // Room-1 has user-2 as participant, room-2 does not
    ChatRoomRepository.prototype.findUserChatRooms = mock(async () => [
      makeRoom({ id: 'room-1', participants: ['user-1', 'user-2'] }),
      makeRoom({ id: 'room-2', participants: ['user-1', 'user-3'] }),
    ]) as any;

    const ctx = makeCtx({ query: { withParticipant: 'user-2' } });
    await listChatRooms(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    // Should only include room-1
    expect(data.data.length).toBe(1);
    expect(data.data[0].id).toBe('room-1');
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
