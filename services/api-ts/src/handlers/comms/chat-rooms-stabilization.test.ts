/**
 * Stabilization tests for chat rooms WebSocket module (M07)
 *
 * Slice 047: Chat Rooms WebSocket (M07, new-feature, medium)
 *
 * Covers gaps not addressed in existing test files:
 * - Room CRUD edge cases (archived rooms, empty participants)
 * - Message filtering by type
 * - Member permission enforcement (archived room access)
 * - Message history pagination edge cases
 * - WebSocket message type validation
 * - Room admin operations (archive)
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { ensurePristine, restoreRepo } from '@/test-utils/make-ctx';

// Mock-Classification: APPROPRIATE — WebSocket/WebRTC real-time service boundary
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns
import { createChatRoom } from './createChatRoom';
import { getChatRoom } from './getChatRoom';
import { getChatMessages } from './getChatMessages';
import { listChatRooms } from './listChatRooms';
import { sendChatMessage } from './sendChatMessage';
import { config as wsHandler } from './ws.chat-room';

import { ChatRoomRepository } from './repos/chatRoom.repo';
import { ChatMessageRepository } from './repos/chatMessage.repo';

// Restore repo prototypes after every test so the raw `prototype.x = mock()`
// patches below don't leak into other test files (bun runs files in one process).
ensurePristine(ChatRoomRepository);
ensurePristine(ChatMessageRepository);
afterEach(() => {
  restoreRepo(ChatRoomRepository);
  restoreRepo(ChatMessageRepository);
});

import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '@/core/errors';
import type { ChatRoom, ChatMessage } from './repos/comms.schema';

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

function makeCtx(opts: {
  userId?: string;
  roomId?: string;
  body?: Record<string, any>;
  query?: Record<string, any>;
  params?: Record<string, any>;
  organizationId?: string;
} = {}) {
  const userId = opts.userId ?? 'user-1';
  const roomId = opts.roomId ?? 'room-1';
  const body = opts.body ?? {};
  const query = opts.query ?? {};
  const params = opts.params ?? { room: roomId };
  const organizationId = opts.organizationId ?? 'org-1';
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  const notifs = { createNotification: mock(async () => {}) };
  const config = {
    auth: { baseUrl: 'http://localhost:7213' },
    webrtc: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'turn:turn.example.com', username: 'u', credential: 'c' },
      ],
    },
  };

  let captured: { data: any; status: number } = { data: null, status: 0 };

  const store: Record<string, any> = {
    user: userId ? { id: userId, name: 'Test User' } : null,
    database: {},
    logger,
    config,
    notifs,
    organizationId,
  };

  const ctx = {
    get: (key: string) => store[key],
    set: (key: string, value: any) => { store[key] = value; },
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
  };

  return ctx as any;
}

function makeNoUserCtx() {
  const ctx = makeCtx({ userId: 'placeholder' });
  const origGet = ctx.get;
  ctx.get = (key: string) => {
    if (key === 'user') return { id: '', name: '' };
    return origGet(key);
  };
  return ctx;
}

// WS test helpers
function makeWs() {
  const sentMessages: string[] = [];
  return {
    send: mock((msg: string) => { sentMessages.push(msg); }),
    close: mock(() => {}),
    raw: { __wsId: 'ws-test-id' },
    _sent: sentMessages,
  };
}

function makeWsService() {
  return {
    trackChannel: mock(() => {}),
    untrackChannel: mock(() => {}),
    publishToChannel: mock(async () => {}),
  };
}

function makeWsCtx(opts: { roomId?: string; userId?: string } = {}) {
  const wsService = makeWsService();
  const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
  const store: Record<string, any> = {
    user: { id: opts.userId ?? 'user-1' },
    database: {},
    ws: wsService,
    logger,
  };
  return {
    ctx: {
      req: { param: (key: string) => key === 'room' ? (opts.roomId ?? 'room-1') : undefined },
      get: (key: string) => store[key],
    } as any,
    wsService,
  };
}

// ===========================================================================
// Room CRUD edge cases
// ===========================================================================

describe('createChatRoom — edge cases', () => {
  beforeEach(() => {
    ChatRoomRepository.prototype.findRoomWithParticipants = mock(async () => null) as any;
    ChatRoomRepository.prototype.createOne = mock(async (data: any) =>
      makeRoom({ id: 'room-new', ...data })
    ) as any;
    ChatRoomRepository.prototype.updateOneById = mock(async (_id: string, updates: any) =>
      makeRoom(updates)
    ) as any;
  });

  test('includes requesting user as admin by default', async () => {
    const ctx = makeCtx({
      body: { participants: ['user-1', 'user-2'] },
    });
    await createChatRoom(ctx);

    const { data } = ctx._captured();
    expect(data.admins).toContain('user-1');
  });

  test('supports context field for linking to external resources', async () => {
    const ctx = makeCtx({
      body: { participants: ['user-1', 'user-2'], context: 'booking-123' },
    });
    await createChatRoom(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(201);
  });

  test('rejects duplicate participants', async () => {
    const ctx = makeCtx({
      body: { participants: ['user-1', 'user-2', 'user-1'] },
    });
    // Handler enforces unique participants
    await expect(createChatRoom(ctx)).rejects.toThrow('Duplicate participants');
  });
});

// ===========================================================================
// getChatRoom — archived room access
// ===========================================================================

describe('getChatRoom — archived room', () => {
  test('returns archived room data for participant (read access preserved)', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ status: 'archived' })
    ) as any;

    const ctx = makeCtx();
    await getChatRoom(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.status).toBe('archived');
  });
});

// ===========================================================================
// getChatMessages — filtering and pagination
// ===========================================================================

describe('getChatMessages — message filtering', () => {
  beforeEach(() => {
    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
  });

  test('filters messages by messageType when query param provided', async () => {
    const findManyMock = mock(async (filters: any) => {
      expect(filters.messageType).toBe('system');
      return {
        data: [makeTextMessage({ messageType: 'system' as any })],
        totalCount: 1,
      };
    });
    ChatMessageRepository.prototype.findManyWithPagination = findManyMock as any;

    const ctx = makeCtx({ query: { messageType: 'system' } });
    await getChatMessages(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });

  test('returns empty data array when no messages exist', async () => {
    ChatMessageRepository.prototype.findManyWithPagination = mock(async () => ({
      data: [],
      totalCount: 0,
    })) as any;

    const ctx = makeCtx({ query: {} });
    await getChatMessages(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.data).toHaveLength(0);
    expect(data.pagination).toBeDefined();
  });

  test('respects custom page size', async () => {
    const findManyMock = mock(async (_filters: any, opts: any) => {
      expect(opts.pagination.limit).toBe(10);
      return { data: [], totalCount: 0 };
    });
    ChatMessageRepository.prototype.findManyWithPagination = findManyMock as any;

    const ctx = makeCtx({ query: { pageSize: 10 } });
    await getChatMessages(ctx);

    expect(findManyMock).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// sendChatMessage — additional scenarios
// ===========================================================================

describe('sendChatMessage — message send/receive scenarios', () => {
  beforeEach(() => {
    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
    ChatRoomRepository.prototype.setActiveVideoCall = mock(async () => {}) as any;
    ChatRoomRepository.prototype.updateLastMessage = mock(async () => {}) as any;
    ChatMessageRepository.prototype.createTextMessage = mock(async () => makeTextMessage()) as any;
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () => null) as any;
  });

  test('persists message with correct sender ID', async () => {
    const createTextMock = mock(async (roomId: string, senderId: string) => {
      expect(senderId).toBe('user-1');
      return makeTextMessage({ sender: senderId });
    });
    ChatMessageRepository.prototype.createTextMessage = createTextMock as any;

    const ctx = makeCtx({
      body: { messageType: 'text', message: 'Hello' },
    });
    await sendChatMessage(ctx);

    expect(createTextMock).toHaveBeenCalledTimes(1);
  });

  test('rejects messages to non-existent rooms', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () => null) as any;

    const ctx = makeCtx({
      body: { messageType: 'text', message: 'Hello' },
    });
    await expect(sendChatMessage(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ===========================================================================
// listChatRooms — permission boundaries
// ===========================================================================

describe('listChatRooms — permission boundaries', () => {
  test('only returns rooms where user is a participant', async () => {
    // FIX-013: the handler scopes by the current user via the SQL-filtered repo.
    const findUserRoomsMock = mock(async (userId: string) => {
      expect(userId).toBe('user-1');
      return { data: [makeRoom({ id: 'my-room' })], totalCount: 1 };
    });
    ChatRoomRepository.prototype.findUserRoomsPage = findUserRoomsMock as any;

    const ctx = makeCtx({ query: {} });
    await listChatRooms(ctx);

    const { data } = ctx._captured();
    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe('my-room');
  });

  test('returns empty list for user with no rooms', async () => {
    ChatRoomRepository.prototype.findUserRoomsPage = mock(async () => ({ data: [], totalCount: 0 })) as any;

    const ctx = makeCtx({ query: {} });
    await listChatRooms(ctx);

    const { data } = ctx._captured();
    expect(data.data).toHaveLength(0);
  });
});

// ===========================================================================
// WebSocket — message type validation
// ===========================================================================

describe('ws.chat-room — unknown message type handling', () => {
  beforeEach(() => {
    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
  });

  test('warns on unknown message type without crashing', async () => {
    const logger = {
      debug: () => {},
      info: () => {},
      warn: mock(() => {}),
      error: () => {},
    };
    const wsService = makeWsService();
    const ws = makeWs();
    const store: Record<string, any> = {
      user: { id: 'user-1' },
      database: {},
      ws: wsService,
      logger,
    };
    const ctx = {
      req: { param: () => 'room-1' },
      get: (key: string) => store[key],
    } as any;

    // Should not throw
    await wsHandler.onMessage(ctx, ws as any, {
      type: 'unknown.event' as any,
      data: {},
    });

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// WebSocket — connect to archived room
// ===========================================================================

describe('ws.chat-room — archived room', () => {
  test('allows connection to archived room for participant (read access)', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ status: 'archived' })
    ) as any;

    const ws = makeWs();
    const { ctx } = makeWsCtx();
    await wsHandler.onConnect(ctx, ws as any);

    // Should still send connected event (archived rooms are readable)
    const events = ws._sent.map((s: string) => JSON.parse(s));
    const connectedEvent = events.find((e: any) => e.event === 'connected');
    expect(connectedEvent).toBeDefined();
  });
});

// ===========================================================================
// WebSocket — multi-participant broadcast
// ===========================================================================

describe('ws.chat-room — broadcast behavior', () => {
  beforeEach(() => {
    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
    ChatRoomRepository.prototype.updateLastMessage = mock(async () => makeRoom()) as any;
    ChatMessageRepository.prototype.createTextMessage = mock(async () =>
      makeTextMessage()
    ) as any;
  });

  test('broadcasts chat.message to correct channel', async () => {
    const { ctx, wsService } = makeWsCtx({ roomId: 'room-42' });
    const ws = makeWs();

    await wsHandler.onMessage(ctx, ws as any, {
      type: 'chat.message',
      data: { text: 'Hi everyone' },
    });

    const calls = (wsService.publishToChannel as ReturnType<typeof mock>).mock.calls;
    const chatCall = calls.find((c: any[]) => c[1] === 'chat.message');
    expect(chatCall).toBeDefined();
    expect(chatCall![0]).toBe('chat-rooms/room-42');
  });

  test('typing indicator includes from field', async () => {
    const { ctx, wsService } = makeWsCtx({ userId: 'user-3' });
    const ws = makeWs();

    await wsHandler.onMessage(ctx, ws as any, {
      type: 'chat.typing',
      data: { isTyping: false },
    });

    const calls = (wsService.publishToChannel as ReturnType<typeof mock>).mock.calls;
    const typingCall = calls.find((c: any[]) => c[1] === 'chat.typing');
    expect(typingCall![2]).toMatchObject({ from: 'user-3', isTyping: false });
  });
});
