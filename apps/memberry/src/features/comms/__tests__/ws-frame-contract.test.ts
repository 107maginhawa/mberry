/**
 * WS frame-contract test (FIX-001 / G1).
 *
 * The realtime chat journey was broken end-to-end because the memberry client
 * spoke a different WebSocket frame dialect than the server:
 *
 *   - OUTBOUND: the client hook sent `{ type, ...data }` (spread), but the
 *     server (`services/api-ts/src/handlers/comms/ws.chat-room.ts`) reads
 *     `message.type` + `message.data`. The spread meant `data.text` was
 *     `undefined` on the server.
 *   - INBOUND: the server broadcasts `{ event, payload }` (see
 *     `services/api-ts/src/core/ws.ts` `publishToChannel`), but the client
 *     read `.type` / `.data`, silently dropping every chat/typing/presence
 *     frame.
 *
 * This is a SHARED fixture: it pins the exact wire shapes both sides must use,
 * killing the fake-green where each side was only ever tested against itself.
 *
 * Pure-logic test — exercises the frame serialize/parse helpers directly, no
 * DOM / WebSocket needed.
 */
import { describe, test, expect } from '@/test/vitest-shim'
import { serializeOutboundFrame, parseInboundFrame } from '../hooks/comms-ws-frames'

// ---------------------------------------------------------------------------
// OUTBOUND: client -> server. Must match the server's `{ type, data }` reader.
// ---------------------------------------------------------------------------
describe('outbound frame (client -> server)', () => {
  test('wraps payload under `data` (not spread) so server sees data.text', () => {
    const frame = JSON.parse(serializeOutboundFrame('chat.message', { text: 'Hello world' }))
    // Server reads `const { type, data } = message` then `data.text`.
    expect(frame.type).toBe('chat.message')
    expect(frame.data).toEqual({ text: 'Hello world' })
    // Regression guard against the old spread bug: text must NOT be top-level.
    expect((frame as Record<string, unknown>).text).toBeUndefined()
  })

  test('typing frame carries isTyping under data', () => {
    const frame = JSON.parse(serializeOutboundFrame('chat.typing', { isTyping: true }))
    expect(frame.type).toBe('chat.typing')
    expect(frame.data).toEqual({ isTyping: true })
  })

  test('ping frame serializes with type and empty data', () => {
    const frame = JSON.parse(serializeOutboundFrame('ping', {}))
    expect(frame.type).toBe('ping')
  })
})

// ---------------------------------------------------------------------------
// INBOUND: server -> client. Server uses the { event, payload } envelope.
// These fixtures mirror exactly what core/ws.ts publishToChannel emits.
// ---------------------------------------------------------------------------
describe('inbound frame (server -> client)', () => {
  test('parses { event, payload } chat.message into a normalized shape', () => {
    const serverFrame = {
      event: 'chat.message',
      payload: { id: 'msg-1', message: 'hi', sender: 'user-2' },
    }
    const parsed = parseInboundFrame(serverFrame)
    expect(parsed.event).toBe('chat.message')
    expect(parsed.payload).toEqual({ id: 'msg-1', message: 'hi', sender: 'user-2' })
  })

  test('recognizes server pong (event:"pong"), not type:"pong"', () => {
    const parsed = parseInboundFrame({ event: 'pong', payload: { timestamp: 'now' } })
    expect(parsed.event).toBe('pong')
  })

  test('parses typing presence frame with payload.from / payload.isTyping', () => {
    const parsed = parseInboundFrame({
      event: 'chat.typing',
      payload: { from: 'user-2', isTyping: true },
    })
    expect(parsed.event).toBe('chat.typing')
    expect(parsed.payload).toEqual({ from: 'user-2', isTyping: true })
  })

  test('does NOT read the legacy { type, data } shape as a valid event', () => {
    // Old (wrong) server-shape would have had `.type`; the new client must
    // key off `.event`. A legacy-shaped frame yields an undefined event.
    const parsed = parseInboundFrame({ type: 'chat.message', data: { id: 'x' } } as never)
    expect(parsed.event).toBeUndefined()
  })
})
