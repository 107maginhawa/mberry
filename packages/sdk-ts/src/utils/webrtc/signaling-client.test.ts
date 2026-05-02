/**
 * Tests for SignalingClient.
 *
 * SignalingClient uses the browser WebSocket API. We implement a lightweight
 * MockWebSocket that records calls and lets tests fire event callbacks
 * synchronously.
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { SignalingClient } from './signaling-client';
import type { SignalMessage, ChatMessage } from './signaling-client';

// -------------------------------------------------------------------
// MockWebSocket
// -------------------------------------------------------------------

type WsReadyState = 0 | 1 | 2 | 3;

class MockWebSocket {
  static CONNECTING: WsReadyState = 0;
  static OPEN: WsReadyState = 1;
  static CLOSING: WsReadyState = 2;
  static CLOSED: WsReadyState = 3;

  readyState: WsReadyState = MockWebSocket.CONNECTING;
  url: string;

  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  onclose: (() => void) | null = null;

  sentMessages: string[] = [];
  closeCalled = false;

  static instances: MockWebSocket[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.closeCalled = true;
    this.readyState = MockWebSocket.CLOSED;
  }

  /** Test helper: simulate a successful connection open */
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  /** Test helper: deliver a raw message string */
  simulateMessage(data: string): void {
    this.onmessage?.({ data });
  }

  /** Test helper: simulate a close event */
  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  /** Test helper: simulate an error */
  simulateError(error: unknown): void {
    this.onerror?.(error);
  }
}

// -------------------------------------------------------------------
// Install MockWebSocket globally before tests run
// -------------------------------------------------------------------

const OriginalWebSocket = (globalThis as Record<string, unknown>).WebSocket;

beforeEach(() => {
  MockWebSocket.instances = [];
  (globalThis as Record<string, unknown>).WebSocket = MockWebSocket;
  // Patch the static OPEN constant so readyState comparisons work
  (MockWebSocket as unknown as typeof WebSocket).OPEN = 1 as never;
});

afterEach(() => {
  if (OriginalWebSocket !== undefined) {
    (globalThis as Record<string, unknown>).WebSocket = OriginalWebSocket;
  }
  MockWebSocket.instances = [];
});

// Helper to get the most recently created MockWebSocket instance
function latestWs(): MockWebSocket {
  const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
  if (!ws) throw new Error('No MockWebSocket instance found');
  return ws;
}

// -------------------------------------------------------------------
// Constructor / URL conversion
// -------------------------------------------------------------------

describe('SignalingClient — constructor & URL', () => {
  test('converts http base URL to ws://', () => {
    const client = new SignalingClient('room-1', 'token', 'http://localhost:7213');
    client.connect();
    const ws = latestWs();
    expect(ws.url).toMatch(/^ws:\/\//);
  });

  test('converts https base URL to wss://', () => {
    const client = new SignalingClient('room-1', 'token', 'https://api.example.com');
    client.connect();
    const ws = latestWs();
    expect(ws.url).toMatch(/^wss:\/\//);
  });

  test('appends room ID to WebSocket URL', () => {
    const client = new SignalingClient('my-room', 'token', 'http://localhost:7213');
    client.connect();
    const ws = latestWs();
    expect(ws.url).toContain('my-room');
  });

  test('uses localhost:7213 as default when no apiBaseUrl given', () => {
    const client = new SignalingClient('room-x', 'token');
    client.connect();
    const ws = latestWs();
    expect(ws.url).toContain('localhost:7213');
  });

  test('uses expected path segment /ws/comms/chat-rooms/', () => {
    const client = new SignalingClient('abc', 'tok', 'http://host');
    client.connect();
    const ws = latestWs();
    expect(ws.url).toContain('/ws/comms/chat-rooms/');
  });
});

// -------------------------------------------------------------------
// Connection state management
// -------------------------------------------------------------------

describe('SignalingClient — connection state', () => {
  test('notifies state handlers with "open" on connect', () => {
    const client = new SignalingClient('r', 't', 'http://localhost:7213');
    const stateChanges: string[] = [];
    client.onStateChange((s) => stateChanges.push(s));
    client.connect();
    latestWs().simulateOpen();
    expect(stateChanges).toContain('open');
  });

  test('notifies state handlers with "closed" on close', () => {
    const client = new SignalingClient('r', 't', 'http://localhost:7213');
    const stateChanges: string[] = [];
    client.onStateChange((s) => stateChanges.push(s));
    client.connect();
    latestWs().simulateOpen();
    latestWs().simulateClose();
    expect(stateChanges).toContain('closed');
  });

  test('notifies state handlers with "error" on error', () => {
    const client = new SignalingClient('r', 't', 'http://localhost:7213');
    const stateChanges: string[] = [];
    client.onStateChange((s) => stateChanges.push(s));
    client.connect();
    latestWs().simulateError(new Event('error'));
    expect(stateChanges).toContain('error');
  });

  test('multiple state handlers are all notified', () => {
    const client = new SignalingClient('r', 't', 'http://localhost:7213');
    const results: string[] = [];
    client.onStateChange((s) => results.push(`h1:${s}`));
    client.onStateChange((s) => results.push(`h2:${s}`));
    client.connect();
    latestWs().simulateOpen();
    expect(results).toContain('h1:open');
    expect(results).toContain('h2:open');
  });
});

// -------------------------------------------------------------------
// Message serialization — send()
// -------------------------------------------------------------------

describe('SignalingClient — send()', () => {
  test('sends JSON-serialized message with video. prefix', () => {
    const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
    client.connect();
    const ws = latestWs();
    ws.simulateOpen();

    client.send('offer', { type: 'offer', sdp: 'sdp-string' });

    expect(ws.sentMessages).toHaveLength(1);
    const msg = JSON.parse(ws.sentMessages[0]);
    expect(msg.type).toBe('video.offer');
    expect(msg.data).toEqual({ type: 'offer', sdp: 'sdp-string' });
  });

  test('wraps ice-candidate with correct type', () => {
    const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
    client.connect();
    const ws = latestWs();
    ws.simulateOpen();

    const candidate: RTCIceCandidateInit = { candidate: 'candidate:…', sdpMid: '0' };
    client.send('ice-candidate', candidate);

    const msg = JSON.parse(ws.sentMessages[0]);
    expect(msg.type).toBe('video.ice-candidate');
    expect(msg.data).toEqual(candidate);
  });

  test('does not send when socket is not open', () => {
    const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
    client.connect();
    const ws = latestWs();
    // Do NOT call simulateOpen — readyState stays CONNECTING

    client.send('offer', { type: 'offer', sdp: '' });

    expect(ws.sentMessages).toHaveLength(0);
  });
});

// -------------------------------------------------------------------
// Message serialization — sendChatMessage()
// -------------------------------------------------------------------

describe('SignalingClient — sendChatMessage()', () => {
  test('sends chat.message type with text payload', () => {
    const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
    client.connect();
    const ws = latestWs();
    ws.simulateOpen();

    client.sendChatMessage('hello world');

    expect(ws.sentMessages).toHaveLength(1);
    const msg = JSON.parse(ws.sentMessages[0]);
    expect(msg.type).toBe('chat.message');
    expect(msg.data.text).toBe('hello world');
  });

  test('does not send when socket is not open', () => {
    const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
    client.connect();
    const ws = latestWs();

    client.sendChatMessage('hello');

    expect(ws.sentMessages).toHaveLength(0);
  });
});

// -------------------------------------------------------------------
// Incoming message routing — onMessage()
// -------------------------------------------------------------------

describe('SignalingClient — onMessage()', () => {
  test('delivers video.* envelope payload to registered handler', () => {
    const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
    const received: SignalMessage[] = [];
    client.onMessage((m) => received.push(m));
    client.connect();
    const ws = latestWs();
    ws.simulateOpen();

    const payload: SignalMessage = { type: 'answer', from: 'peer-1', data: { type: 'answer', sdp: 'sdp' } };
    ws.simulateMessage(JSON.stringify({ event: 'video.answer', payload }));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(payload);
  });

  test('multiple message handlers all receive the signal', () => {
    const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
    const r1: SignalMessage[] = [];
    const r2: SignalMessage[] = [];
    client.onMessage((m) => r1.push(m));
    client.onMessage((m) => r2.push(m));
    client.connect();
    const ws = latestWs();
    ws.simulateOpen();

    const payload: SignalMessage = { type: 'offer', from: 'p', data: { type: 'offer', sdp: '' } };
    ws.simulateMessage(JSON.stringify({ event: 'video.offer', payload }));

    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
  });

  test('ignores "connected" system event without calling message handler', () => {
    const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
    const received: SignalMessage[] = [];
    client.onMessage((m) => received.push(m));
    client.connect();
    const ws = latestWs();
    ws.simulateOpen();

    ws.simulateMessage(JSON.stringify({ event: 'connected', payload: {} }));

    expect(received).toHaveLength(0);
  });

  test('ignores user.joined / user.left events', () => {
    const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
    const received: SignalMessage[] = [];
    client.onMessage((m) => received.push(m));
    client.connect();
    const ws = latestWs();
    ws.simulateOpen();

    ws.simulateMessage(JSON.stringify({ event: 'user.joined', payload: { userId: 'u1' } }));
    ws.simulateMessage(JSON.stringify({ event: 'user.left', payload: { userId: 'u1' } }));

    expect(received).toHaveLength(0);
  });
});

// -------------------------------------------------------------------
// Incoming chat messages — onChatMessage()
// -------------------------------------------------------------------

describe('SignalingClient — onChatMessage()', () => {
  test('delivers chat.message envelope payload to registered handler', () => {
    const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
    const received: ChatMessage[] = [];
    client.onChatMessage((m) => received.push(m));
    client.connect();
    const ws = latestWs();
    ws.simulateOpen();

    const payload: ChatMessage = { from: 'alice', text: 'hi', timestamp: '2026-01-01T00:00:00Z' };
    ws.simulateMessage(JSON.stringify({ event: 'chat.message', payload }));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(payload);
  });

  test('does not deliver video signals to chat handler', () => {
    const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
    const chatReceived: ChatMessage[] = [];
    client.onChatMessage((m) => chatReceived.push(m));
    client.connect();
    const ws = latestWs();
    ws.simulateOpen();

    const payload: SignalMessage = { type: 'offer', from: 'p', data: { type: 'offer', sdp: '' } };
    ws.simulateMessage(JSON.stringify({ event: 'video.offer', payload }));

    expect(chatReceived).toHaveLength(0);
  });
});

// -------------------------------------------------------------------
// close()
// -------------------------------------------------------------------

describe('SignalingClient — close()', () => {
  test('closes the underlying WebSocket', () => {
    const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
    client.connect();
    const ws = latestWs();
    ws.simulateOpen();

    client.close();

    expect(ws.closeCalled).toBe(true);
  });

  test('clears all handlers so no further events are delivered', () => {
    const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
    const signals: SignalMessage[] = [];
    const chats: ChatMessage[] = [];
    const states: string[] = [];
    client.onMessage((m) => signals.push(m));
    client.onChatMessage((m) => chats.push(m));
    client.onStateChange((s) => states.push(s));
    client.connect();
    const ws = latestWs();
    ws.simulateOpen();
    client.close();

    // Try to deliver messages after close — handlers should be cleared
    const payload: SignalMessage = { type: 'offer', from: 'p', data: { type: 'offer', sdp: '' } };
    ws.simulateMessage(JSON.stringify({ event: 'video.offer', payload }));

    expect(signals).toHaveLength(0);
    expect(chats).toHaveLength(0);
  });
});

// -------------------------------------------------------------------
// Reconnect / backoff logic
// -------------------------------------------------------------------

describe('SignalingClient — reconnect logic', () => {
  test('attempts reconnect after close (creates new WebSocket)', async () => {
    // Override setTimeout so backoff fires immediately in tests
    const originalSetTimeout = globalThis.setTimeout;
    (globalThis as Record<string, unknown>).setTimeout = (fn: () => void, _delay: number) => {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    };

    try {
      const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
      client.connect();
      const firstWs = latestWs();
      firstWs.simulateOpen();

      const instancesBefore = MockWebSocket.instances.length;
      firstWs.simulateClose(); // triggers attemptReconnect

      // A new WebSocket should have been created for the reconnect
      expect(MockWebSocket.instances.length).toBeGreaterThan(instancesBefore);
    } finally {
      (globalThis as Record<string, unknown>).setTimeout = originalSetTimeout;
    }
  });

  test('stops reconnecting after maxReconnectAttempts (5)', async () => {
    const originalSetTimeout = globalThis.setTimeout;
    (globalThis as Record<string, unknown>).setTimeout = (fn: () => void, _delay: number) => {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    };

    try {
      const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
      client.connect();

      // To exhaust the reconnect budget we must close WITHOUT opening each time.
      // Closing without an open does NOT reset reconnectAttempts (only onopen does).
      // Sequence: connect WS#1 → close (attempt 1, WS#2 created) → close (attempt 2,
      // WS#3) → ... → close (attempt 5, WS#6) → close (guard blocks, WS count stays).
      // That gives us 1 + 5 = 6 instances total after exhaustion.
      for (let i = 0; i < 5; i++) {
        latestWs().simulateClose(); // triggers attemptReconnect → synchronous connect()
      }

      const countAfterExhaustion = MockWebSocket.instances.length;
      // Should be exactly 6 (1 initial + 5 reconnects)
      expect(countAfterExhaustion).toBe(6);

      // One more close — the guard (reconnectAttempts >= 5) should block it
      latestWs().simulateClose();
      expect(MockWebSocket.instances.length).toBe(countAfterExhaustion);
    } finally {
      (globalThis as Record<string, unknown>).setTimeout = originalSetTimeout;
    }
  });

  test('resets reconnect attempt counter after a successful reconnect', async () => {
    const originalSetTimeout = globalThis.setTimeout;
    (globalThis as Record<string, unknown>).setTimeout = (fn: () => void, _delay: number) => {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    };

    try {
      const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
      client.connect();

      // First disconnect → reconnect → successfully open
      latestWs().simulateOpen();
      latestWs().simulateClose();
      latestWs().simulateOpen(); // reconnected successfully → counter resets

      const countAfterReset = MockWebSocket.instances.length;

      // Now disconnect again — should still attempt another reconnect
      latestWs().simulateClose();

      expect(MockWebSocket.instances.length).toBeGreaterThan(countAfterReset);
    } finally {
      (globalThis as Record<string, unknown>).setTimeout = originalSetTimeout;
    }
  });
});

// -------------------------------------------------------------------
// Malformed message resilience
// -------------------------------------------------------------------

describe('SignalingClient — malformed messages', () => {
  test('does not throw when message is invalid JSON', () => {
    const client = new SignalingClient('room', 'tok', 'http://localhost:7213');
    const received: SignalMessage[] = [];
    client.onMessage((m) => received.push(m));
    client.connect();
    const ws = latestWs();
    ws.simulateOpen();

    // Should not throw
    expect(() => ws.simulateMessage('not-json')).not.toThrow();
    expect(received).toHaveLength(0);
  });
});
