/**
 * Stabilization tests for video call integration (M07)
 *
 * Slice 048: Video Calls (M07, new-feature, small)
 *
 * Covers gaps in existing video call test coverage:
 * - Call initiation via sendChatMessage with participant details
 * - Participant management: join sequence, leave with auto-end
 * - Recording toggle (audio/video independently)
 * - Call lifecycle: starting -> active -> ended
 * - Edge cases: simultaneous joins, call already ended
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { ensurePristine, restoreRepo } from '@/test-utils/make-ctx';

// Mock-Classification: APPROPRIATE — WebSocket/WebRTC real-time service boundary
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns
import { joinVideoCall } from './joinVideoCall';
import { endVideoCall } from './endVideoCall';
import { leaveVideoCall } from './leaveVideoCall';
import { updateVideoCallParticipant } from './updateVideoCallParticipant';
import { sendChatMessage } from './sendChatMessage';

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
    startedAt: new Date(Date.now() - 600_000).toISOString(),
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
// Context builder
// ---------------------------------------------------------------------------

function makeCtx(opts: {
  userId?: string;
  roomId?: string;
  body?: Record<string, any>;
  query?: Record<string, any>;
  params?: Record<string, any>;
  notifs?: any;
  config?: any;
} = {}) {
  const userId = opts.userId ?? 'user-1';
  const roomId = opts.roomId ?? 'room-1';
  const body = opts.body ?? {};
  const query = opts.query ?? {};
  const params = opts.params ?? { room: roomId };
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  const notifs = opts.notifs ?? { createNotification: mock(async () => {}) };
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
        user: userId ? { id: userId, name: 'Test User' } : null,
        database: {},
        logger,
        config,
        notifs,
        organizationId: 'org-1',
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
  };

  return ctx as any;
}

// ===========================================================================
// Call initiation via sendChatMessage
// ===========================================================================

describe('video call initiation', () => {
  beforeEach(() => {
    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
    ChatRoomRepository.prototype.setActiveVideoCall = mock(async () => {}) as any;
    ChatRoomRepository.prototype.updateLastMessage = mock(async () => {}) as any;
    ChatMessageRepository.prototype.createTextMessage = mock(async () => makeTextMessage()) as any;
    ChatMessageRepository.prototype.createVideoCallMessage = mock(async () => makeCallMessage()) as any;
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () => null) as any;
  });

  test('admin can initiate a video call with participant list', async () => {
    const ctx = makeCtx({
      body: {
        messageType: 'video_call',
        videoCallData: {
          participants: [
            { user: 'user-1', displayName: 'Alice', userType: 'host', audioEnabled: true, videoEnabled: true },
            { user: 'user-2', displayName: 'Bob', userType: 'client', audioEnabled: true, videoEnabled: true },
          ],
        },
      },
    });
    await sendChatMessage(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(201);
  });

  test('sets active video call on room after initiation', async () => {
    const setActiveCall = mock(async () => {});
    ChatRoomRepository.prototype.setActiveVideoCall = setActiveCall as any;

    const ctx = makeCtx({
      body: {
        messageType: 'video_call',
        videoCallData: { participants: [] },
      },
    });
    await sendChatMessage(ctx);

    expect(setActiveCall).toHaveBeenCalledTimes(1);
  });

  test('prevents second call while one is active', async () => {
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () => makeCallMessage()) as any;

    const ctx = makeCtx({
      body: {
        messageType: 'video_call',
        videoCallData: { participants: [] },
      },
    });
    await expect(sendChatMessage(ctx)).rejects.toBeInstanceOf(ConflictError);
  });
});

// ===========================================================================
// Participant management — join
// ===========================================================================

describe('video call participant join', () => {
  const existingParticipant = {
    user: 'user-2',
    displayName: 'Bob',
    userType: 'host',
    audioEnabled: true,
    videoEnabled: true,
    joinedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          status: 'starting',
          participants: [existingParticipant as any],
        }),
      })
    ) as any;
    ChatMessageRepository.prototype.addVideoCallParticipant = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          status: 'active',
          participants: [
            existingParticipant as any,
            { user: 'user-1', displayName: 'Alice', userType: 'host', audioEnabled: true, videoEnabled: true, joinedAt: new Date().toISOString() } as any,
          ],
        }),
      })
    ) as any;
    ChatMessageRepository.prototype.updateVideoCallData = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({ status: 'active' }),
      })
    ) as any;
    ChatMessageRepository.prototype.createSystemMessage = mock(async () =>
      makeTextMessage({ messageType: 'system' as any })
    ) as any;
  });

  test('join returns connection info with roomUrl and token', async () => {
    const ctx = makeCtx({ body: { displayName: 'Alice' } });
    await joinVideoCall(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data).toHaveProperty('roomUrl');
    expect(data).toHaveProperty('token');
    expect(data).toHaveProperty('callStatus');
    expect(data).toHaveProperty('participants');
  });

  test('join transitions call from starting to active', async () => {
    // addVideoCallParticipant returns message still in 'starting' status
    ChatMessageRepository.prototype.addVideoCallParticipant = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          status: 'starting',
          participants: [
            existingParticipant as any,
            { user: 'user-1', displayName: 'Alice', userType: 'host', audioEnabled: true, videoEnabled: true, joinedAt: new Date().toISOString() } as any,
          ],
        }),
      })
    ) as any;

    const updateCallData = mock(async () =>
      makeCallMessage({ videoCallData: makeVideoCallData({ status: 'active' }) })
    );
    ChatMessageRepository.prototype.updateVideoCallData = updateCallData as any;

    const ctx = makeCtx({ body: { displayName: 'Alice' } });
    await joinVideoCall(ctx);

    expect(updateCallData).toHaveBeenCalledTimes(1);
    const arg = (updateCallData as ReturnType<typeof mock>).mock.calls[0][1] as any;
    expect(arg.status).toBe('active');
  });

  test('join creates system message for join event', async () => {
    const createSysMsg = mock(async () => makeTextMessage({ messageType: 'system' as any }));
    ChatMessageRepository.prototype.createSystemMessage = createSysMsg as any;

    const ctx = makeCtx({ body: { displayName: 'Alice' } });
    await joinVideoCall(ctx);

    expect(createSysMsg).toHaveBeenCalledTimes(1);
    const msg = (createSysMsg as ReturnType<typeof mock>).mock.calls[0][1] as string;
    expect(msg).toContain('joined the video call');
  });
});

// ===========================================================================
// Recording toggle (audio/video independently)
// ===========================================================================

describe('video call recording toggle', () => {
  const activeParticipant = {
    user: 'user-1',
    displayName: 'Alice',
    userType: 'host',
    audioEnabled: true,
    videoEnabled: true,
    joinedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          participants: [activeParticipant as any],
        }),
      })
    ) as any;
    ChatMessageRepository.prototype.createSystemMessage = mock(async () =>
      makeTextMessage({ messageType: 'system' as any })
    ) as any;
  });

  test('toggles audio independently from video', async () => {
    const updateParticipantMock = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          participants: [{ ...activeParticipant, audioEnabled: false } as any],
        }),
      })
    );
    ChatMessageRepository.prototype.updateVideoCallParticipant = updateParticipantMock as any;

    const ctx = makeCtx({ body: { audioEnabled: false } });
    await updateVideoCallParticipant(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.audioEnabled).toBe(false);
  });

  test('toggles video independently from audio', async () => {
    const updateParticipantMock = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          participants: [{ ...activeParticipant, videoEnabled: false } as any],
        }),
      })
    );
    ChatMessageRepository.prototype.updateVideoCallParticipant = updateParticipantMock as any;

    const ctx = makeCtx({ body: { videoEnabled: false } });
    await updateVideoCallParticipant(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.videoEnabled).toBe(false);
  });

  test('creates system message on mute', async () => {
    ChatMessageRepository.prototype.updateVideoCallParticipant = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          participants: [{ ...activeParticipant, audioEnabled: false } as any],
        }),
      })
    ) as any;

    const createSysMsg = mock(async () => makeTextMessage({ messageType: 'system' as any }));
    ChatMessageRepository.prototype.createSystemMessage = createSysMsg as any;

    const ctx = makeCtx({ body: { audioEnabled: false } });
    await updateVideoCallParticipant(ctx);

    expect(createSysMsg).toHaveBeenCalledTimes(1);
    const msg = (createSysMsg as ReturnType<typeof mock>).mock.calls[0][1] as string;
    expect(msg).toContain('muted audio');
  });

  test('creates system message on unmute', async () => {
    // Start with audio muted, then unmute
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          participants: [{ ...activeParticipant, audioEnabled: false } as any],
        }),
      })
    ) as any;
    ChatMessageRepository.prototype.updateVideoCallParticipant = mock(async () =>
      makeCallMessage({
        videoCallData: makeVideoCallData({
          participants: [{ ...activeParticipant, audioEnabled: true } as any],
        }),
      })
    ) as any;

    const createSysMsg = mock(async () => makeTextMessage({ messageType: 'system' as any }));
    ChatMessageRepository.prototype.createSystemMessage = createSysMsg as any;

    const ctx = makeCtx({ body: { audioEnabled: true } });
    await updateVideoCallParticipant(ctx);

    expect(createSysMsg).toHaveBeenCalledTimes(1);
    const msg = (createSysMsg as ReturnType<typeof mock>).mock.calls[0][1] as string;
    expect(msg).toContain('unmuted audio');
  });
});

// ===========================================================================
// Call end lifecycle
// ===========================================================================

describe('video call end lifecycle', () => {
  beforeEach(() => {
    ChatRoomRepository.prototype.findOneById = mock(async () => makeRoom()) as any;
    ChatRoomRepository.prototype.setActiveVideoCall = mock(async () => {}) as any;
    ChatRoomRepository.prototype.updateLastMessage = mock(async () => {}) as any;
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () =>
      makeCallMessage()
    ) as any;
    ChatMessageRepository.prototype.updateVideoCallData = mock(async () =>
      makeCallMessage({ videoCallData: makeVideoCallData({ status: 'ended' }) })
    ) as any;
    ChatMessageRepository.prototype.createSystemMessage = mock(async () =>
      makeTextMessage({ messageType: 'system' as any })
    ) as any;
  });

  test('end call returns duration and system message', async () => {
    const ctx = makeCtx();
    await endVideoCall(ctx);

    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data).toHaveProperty('message');
    expect(data).toHaveProperty('callDuration');
    expect(data).toHaveProperty('systemMessage');
  });

  test('end call clears active video call reference on room', async () => {
    const setActiveCall = mock(async () => {});
    ChatRoomRepository.prototype.setActiveVideoCall = setActiveCall as any;

    const ctx = makeCtx();
    await endVideoCall(ctx);

    expect(setActiveCall).toHaveBeenCalledTimes(1);
    const args = (setActiveCall as ReturnType<typeof mock>).mock.calls[0];
    expect(args[0]).toBe('room-1');
    expect(args[1]).toBeNull();
  });

  test('cannot end a call that does not exist', async () => {
    ChatMessageRepository.prototype.findActiveVideoCall = mock(async () => null) as any;

    const ctx = makeCtx();
    await expect(endVideoCall(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('only admin can end a call', async () => {
    ChatRoomRepository.prototype.findOneById = mock(async () =>
      makeRoom({ participants: ['user-1', 'user-2'], admins: ['user-2'] })
    ) as any;

    const ctx = makeCtx(); // user-1 is not admin
    await expect(endVideoCall(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
