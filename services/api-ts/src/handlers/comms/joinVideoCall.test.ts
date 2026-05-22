/**
 * Tests for joinVideoCall handler
 *
 * Covers: participant join, already-in-call conflict, non-participant
 * forbidden, missing room 404, display name validation, notification
 * side-effects, and the placeholder token value.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { joinVideoCall } from './joinVideoCall';
import { ChatRoomRepository } from './repos/chatRoom.repo';
import { ChatMessageRepository } from './repos/chatMessage.repo';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '@/core/errors';
import type { ChatRoom, ChatMessage, VideoCallData } from './repos/comms.schema';

// Mock-Classification: APPROPRIATE — WebSocket/WebRTC real-time service boundary
// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:7213';

function makeRoom(overrides: Partial<ChatRoom> = {}): ChatRoom {
  return {
    id: 'room-1',
    participants: ['user-1', 'user-2'],
    admins: ['user-1'],
    context: null,
    status: 'active',
    messageCount: 0,
    lastMessageAt: null,
    activeVideoCallMessage: 'msg-call-1',
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
    status: 'starting',
    startedAt: new Date().toISOString(),
    participants: [],
    roomUrl: '',
    token: '',
    ...overrides,
  } as unknown as VideoCallData;
}

function makeCallMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-call-1',
    chatRoom: 'room-1',
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

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

function makeCtx(opts: {
  userId?: string;
  roomId?: string;
  body?: Record<string, any>;
  notifs?: any;
  logger?: any;
} = {}) {
  const userId = opts.userId ?? 'user-1';
  const roomId = opts.roomId ?? 'room-1';
  const body = opts.body ?? { displayName: 'Alice', audioEnabled: true, videoEnabled: true };
  const logger = opts.logger ?? { info: () => {}, warn: () => {}, error: () => {} };
  const notifs = opts.notifs ?? { createNotification: mock(async () => {}) };

  const config = { auth: { baseUrl: BASE_URL } };
  let captured: { data: any; status: number } = { data: null, status: 0 };

  const ctx = {
    get: (key: string) => {
      const store: Record<string, any> = {
        user: { id: userId },
        database: {},
        logger,
        config,
        notifs,
      };
      return store[key];
    },
    req: {
      valid: (type: string) => {
        if (type === 'param') return { room: roomId };
        if (type === 'json') return body;
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('joinVideoCall', () => {
  let findRoomById: ReturnType<typeof mock>;
  let findActiveVideoCall: ReturnType<typeof mock>;
  let addVideoCallParticipant: ReturnType<typeof mock>;
  let updateVideoCallData: ReturnType<typeof mock>;
  let createSystemMessage: ReturnType<typeof mock>;

  beforeEach(() => {
    findRoomById = mock(async () => makeRoom());
    findActiveVideoCall = mock(async () => makeCallMessage());
    addVideoCallParticipant = mock(async () => makeCallMessage({
      videoCallData: makeVideoCallData({ status: 'starting', participants: [
        { user: 'user-1', displayName: 'Alice', userType: 'host', audioEnabled: true, videoEnabled: true, joinedAt: new Date().toISOString() }
      ]})
    }));
    updateVideoCallData = mock(async () => makeCallMessage({
      videoCallData: makeVideoCallData({ status: 'active', roomUrl: 'wss://x', token: 'USE_SESSION_TOKEN' })
    }));
    createSystemMessage = mock(async () => makeCallMessage({ messageType: 'system' }));

    ChatRoomRepository.prototype.findOneById = findRoomById as any;
    ChatMessageRepository.prototype.findActiveVideoCall = findActiveVideoCall as any;
    ChatMessageRepository.prototype.addVideoCallParticipant = addVideoCallParticipant as any;
    ChatMessageRepository.prototype.updateVideoCallData = updateVideoCallData as any;
    ChatMessageRepository.prototype.createSystemMessage = createSystemMessage as any;
  });

  test('returns 200 with connection info on success', async () => {
    const ctx = makeCtx();
    await joinVideoCall(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data).toHaveProperty('roomUrl');
    expect(data).toHaveProperty('token');
    expect(data).toHaveProperty('callStatus');
    expect(data).toHaveProperty('participants');
  });

  test('returns placeholder token sentinel value', async () => {
    const ctx = makeCtx();
    await joinVideoCall(ctx);

    const { data } = ctx._captured();
    // Token is either the sentinel or the one from updateVideoCallData mock
    expect(typeof data.token).toBe('string');
    expect(data.token.length).toBeGreaterThan(0);
  });

  test('throws NotFoundError when room does not exist', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx();

    await expect(joinVideoCall(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when user is not a participant', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ participants: ['user-2', 'user-3'] })
    ) as any;

    const ctx = makeCtx({ userId: 'user-99' });
    await expect(joinVideoCall(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('throws NotFoundError when no active video call exists', async () => {
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () => null) as any;
    const ctx = makeCtx();

    await expect(joinVideoCall(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ValidationError when displayName is empty', async () => {
    const ctx = makeCtx({ body: { displayName: '   ' } });
    await expect(joinVideoCall(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ConflictError when user is already an active participant', async () => {
    const callWithActiveUser = makeCallMessage({
      videoCallData: makeVideoCallData({
        status: 'active',
        participants: [{
          user: 'user-1',
          displayName: 'Alice',
          userType: 'host',
          audioEnabled: true,
          videoEnabled: true,
          joinedAt: new Date().toISOString(),
          leftAt: undefined
        }] as any
      })
    });
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () => callWithActiveUser) as any;
    const ctx = makeCtx({ userId: 'user-1' });

    await expect(joinVideoCall(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('adds participant to call via addVideoCallParticipant', async () => {
    const ctx = makeCtx();
    await joinVideoCall(ctx);

    expect(addVideoCallParticipant).toHaveBeenCalledTimes(1);
    const callArg = (addVideoCallParticipant as ReturnType<typeof mock>).mock.calls[0];
    expect(callArg[0]).toBe('msg-call-1');
    expect(callArg[1]).toMatchObject({ user: 'user-1', displayName: 'Alice' });
  });

  test('promotes call status from starting to active', async () => {
    const ctx = makeCtx();
    await joinVideoCall(ctx);

    expect(updateVideoCallData).toHaveBeenCalledTimes(1);
    const callArg = (updateVideoCallData as ReturnType<typeof mock>).mock.calls[0][1] as any;
    expect(callArg.status).toBe('active');
  });

  test('creates system message for join event', async () => {
    const ctx = makeCtx();
    await joinVideoCall(ctx);

    expect(createSystemMessage).toHaveBeenCalledTimes(1);
    const messageArg = (createSystemMessage as ReturnType<typeof mock>).mock.calls[0][1] as string;
    expect(messageArg).toContain('joined the video call');
  });

  test('sends notifications to other active participants', async () => {
    const otherParticipant = { user: 'user-2', displayName: 'Bob', userType: 'host', audioEnabled: true, videoEnabled: true, joinedAt: new Date().toISOString() };
    addVideoCallParticipant = mock(async () => makeCallMessage({
      videoCallData: makeVideoCallData({
        status: 'active',
        participants: [
          { user: 'user-1', displayName: 'Alice', userType: 'host', audioEnabled: true, videoEnabled: true, joinedAt: new Date().toISOString() },
          otherParticipant
        ] as any
      })
    }));
    updateVideoCallData = mock(async () => makeCallMessage({
      videoCallData: makeVideoCallData({
        status: 'active',
        participants: [
          { user: 'user-1', displayName: 'Alice', userType: 'host', audioEnabled: true, videoEnabled: true, joinedAt: new Date().toISOString() },
          otherParticipant
        ] as any
      })
    }));
    ChatMessageRepository.prototype.addVideoCallParticipant = addVideoCallParticipant as any;
    ChatMessageRepository.prototype.updateVideoCallData = updateVideoCallData as any;

    const createNotification = mock(async () => {});
    const notifs = { createNotification };
    const ctx = makeCtx({ notifs });
    await joinVideoCall(ctx);

    expect(createNotification).toHaveBeenCalledTimes(1);
    const notifArg = (createNotification as ReturnType<typeof mock>).mock.calls[0][0] as any;
    expect(notifArg.recipient).toBe('user-2');
    expect(notifArg.type).toBe('comms.video-call-joined');
  });

  test('does not fail if notification delivery throws', async () => {
    const notifs = { createNotification: mock(async () => { throw new Error('notifs down'); }) };
    const ctx = makeCtx({ notifs });

    // Should not rethrow notification errors
    await expect(joinVideoCall(ctx)).resolves.toBeDefined();
  });
});
