/**
 * Tests for ws.chat-room WebSocket handler
 *
 * We test the three exported lifecycle hooks — onConnect, onMessage, onClose —
 * in isolation.  All repository/service dependencies are replaced with
 * lightweight stubs so the tests run without a real database or WS server.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { config as wsHandler } from './ws.chat-room';
import { ChatRoomRepository } from './repos/chatRoom.repo';
import { ChatMessageRepository } from './repos/chatMessage.repo';
import type { ChatRoom, ChatMessage } from './repos/comms.schema';

// Mock-Classification: APPROPRIATE — WebSocket/WebRTC real-time service boundary
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns
// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRoom(overrides: Partial<ChatRoom> = {}): ChatRoom {
  return {
    id: 'room-1',
    participants: ['user-1', 'user-2'],
    admins: ['user-1'],
    context: null,
    status: 'active',
    messageCount: 0,
    lastMessageAt: null,
    activeVideoCallMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    version: 1,
    ...overrides,
  } as unknown as ChatRoom;
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    chatRoom: 'room-1',
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
// Context / WS stub builders
// ---------------------------------------------------------------------------

function makeWs() {
  const sentMessages: string[] = [];
  let closedWith: { code: number; reason: string } | null = null;

  return {
    send: mock((msg: string) => { sentMessages.push(msg); }),
    close: mock((code: number, reason: string) => { closedWith = { code, reason }; }),
    raw: { __wsId: 'ws-test-id' },
    _sent: sentMessages,
    _closed: () => closedWith,
  };
}

function makeWsService() {
  return {
    trackChannel: mock(() => {}),
    untrackChannel: mock(() => {}),
    publishToChannel: mock(async () => {}),
  };
}

function makeLogger() {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

function makeCtx(opts: {
  roomId?: string;
  userId?: string;
  wsService?: ReturnType<typeof makeWsService>;
  logger?: ReturnType<typeof makeLogger>;
} = {}) {
  const roomId = opts.roomId ?? 'room-1';
  const userId = opts.userId ?? 'user-1';
  const wsService = opts.wsService ?? makeWsService();
  const logger = opts.logger ?? makeLogger();

  const store: Record<string, any> = {
    user: { id: userId },
    database: {},
    ws: wsService,
    logger,
  };

  return {
    req: { param: (key: string) => key === 'room' ? roomId : undefined },
    get: (key: string) => store[key],
    wsService,
  } as any;
}

// ---------------------------------------------------------------------------
// Tests: onConnect
// ---------------------------------------------------------------------------

describe('ws.chat-room onConnect', () => {
  beforeEach(() => {
    // Default: room exists, user is participant
    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
  });

  test('sends connected event when user is participant', async () => {
    const ws = makeWs();
    const ctx = makeCtx();

    await wsHandler.onConnect(ctx, ws as any);

    const events = ws._sent.map(s => JSON.parse(s));
    const connectedEvent = events.find((e: any) => e.event === 'connected');
    expect(connectedEvent).toBeDefined();
    expect(connectedEvent.payload.roomId).toBe('room-1');
    expect(connectedEvent.payload.userId).toBe('user-1');
  });

  test('tracks channel on successful connect', async () => {
    const wsService = makeWsService();
    const ws = makeWs();
    const ctx = makeCtx({ wsService });

    await wsHandler.onConnect(ctx, ws as any);

    expect(wsService.trackChannel).toHaveBeenCalledWith('chat-rooms/room-1', ws);
  });

  test('publishes user.joined to channel excluding self', async () => {
    const wsService = makeWsService();
    const ws = makeWs();
    const ctx = makeCtx({ wsService });

    await wsHandler.onConnect(ctx, ws as any);

    const calls = (wsService.publishToChannel as ReturnType<typeof mock>).mock.calls;
    const joinedCall = calls.find((c: any[]) => c[1] === 'user.joined');
    expect(joinedCall).toBeDefined();
    expect(joinedCall![3]).toBe(ws); // excludeSelf ws reference
  });

  test('closes with 1008 when room does not exist', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () => null) as any;
    const ws = makeWs();
    const ctx = makeCtx();

    await wsHandler.onConnect(ctx, ws as any);

    expect(ws.close).toHaveBeenCalledWith(1008, 'Room not found');
  });

  test('sends error event and closes when user is not a participant', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ participants: ['user-2', 'user-3'] })
    ) as any;

    const ws = makeWs();
    const ctx = makeCtx({ userId: 'user-99' });

    await wsHandler.onConnect(ctx, ws as any);

    const events = ws._sent.map(s => JSON.parse(s));
    const errorEvent = events.find((e: any) => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect(ws.close).toHaveBeenCalledWith(1008, 'Not authorized');
  });
});

// ---------------------------------------------------------------------------
// Tests: onMessage — ping
// ---------------------------------------------------------------------------

describe('ws.chat-room onMessage — ping', () => {
  test('responds with pong event', async () => {
    const ws = makeWs();
    const ctx = makeCtx();

    await wsHandler.onMessage(ctx, ws as any, { type: 'ping', data: {} });

    const events = ws._sent.map(s => JSON.parse(s));
    const pong = events.find((e: any) => e.event === 'pong');
    expect(pong).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: onMessage — chat.message
// ---------------------------------------------------------------------------

describe('ws.chat-room onMessage — chat.message', () => {
  test('persists message and broadcasts to channel', async () => {
    const savedMsg = makeMessage();
    ChatMessageRepository.prototype.createTextMessage = mock(async () => savedMsg) as any;
    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
    ChatRoomRepository.prototype.updateLastMessage = mock(async () => makeRoom()) as any;

    const wsService = makeWsService();
    const ws = makeWs();
    const ctx = makeCtx({ wsService });

    await wsHandler.onMessage(ctx, ws as any, {
      type: 'chat.message',
      data: { text: 'Hello world' },
    });

    const calls = (wsService.publishToChannel as ReturnType<typeof mock>).mock.calls;
    const broadcastCall = calls.find((c: any[]) => c[1] === 'chat.message');
    expect(broadcastCall).toBeDefined();
    expect(broadcastCall![2]).toEqual(savedMsg);
  });
});

// ---------------------------------------------------------------------------
// Tests: onMessage — chat.typing
// ---------------------------------------------------------------------------

describe('ws.chat-room onMessage — chat.typing', () => {
  test('relays typing indicator with sender id and isTyping flag', async () => {
    const wsService = makeWsService();
    const ws = makeWs();
    const ctx = makeCtx({ wsService, userId: 'user-1' });

    await wsHandler.onMessage(ctx, ws as any, {
      type: 'chat.typing',
      data: { isTyping: true },
    });

    const calls = (wsService.publishToChannel as ReturnType<typeof mock>).mock.calls;
    const typingCall = calls.find((c: any[]) => c[1] === 'chat.typing');
    expect(typingCall).toBeDefined();
    expect(typingCall![2]).toMatchObject({ from: 'user-1', isTyping: true });
  });
});

// ---------------------------------------------------------------------------
// Tests: onMessage — video signaling
// ---------------------------------------------------------------------------

describe('ws.chat-room onMessage — video signaling', () => {
  const signalTypes = ['video.offer', 'video.answer', 'video.ice-candidate'] as const;

  for (const signalType of signalTypes) {
    test(`relays ${signalType} with sender excluded`, async () => {
      const wsService = makeWsService();
      const ws = makeWs();
      const ctx = makeCtx({ wsService, userId: 'user-1' });
      const data = { sdp: 'test' };

      await wsHandler.onMessage(ctx, ws as any, { type: signalType, data });

      const calls = (wsService.publishToChannel as ReturnType<typeof mock>).mock.calls;
      const sigCall = calls.find((c: any[]) => c[1] === signalType);
      expect(sigCall).toBeDefined();
      expect(sigCall![2]).toMatchObject({ type: signalType, from: 'user-1', data });
      expect(sigCall![3]).toBe(ws); // Sender excluded
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: onClose
// ---------------------------------------------------------------------------

describe('ws.chat-room onClose', () => {
  test('untracks channel connection', async () => {
    const wsService = makeWsService();
    const ws = makeWs();
    const ctx = makeCtx({ wsService });

    await wsHandler.onClose(ctx, ws as any);

    expect(wsService.untrackChannel).toHaveBeenCalledWith('chat-rooms/room-1', ws);
  });

  test('publishes user.left to channel', async () => {
    const wsService = makeWsService();
    const ws = makeWs();
    const ctx = makeCtx({ wsService, userId: 'user-1' });

    await wsHandler.onClose(ctx, ws as any);

    const calls = (wsService.publishToChannel as ReturnType<typeof mock>).mock.calls;
    const leftCall = calls.find((c: any[]) => c[1] === 'user.left');
    expect(leftCall).toBeDefined();
    expect(leftCall![2]).toMatchObject({ userId: 'user-1' });
  });
});
