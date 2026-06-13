/**
 * Comms WebSocket frame contract (FIX-001 / G1).
 *
 * Single source of truth for the wire shapes exchanged with the chat-room
 * WebSocket. Keep this aligned with the server:
 *
 *   - INBOUND  (server -> client): `{ event, payload }`
 *       emitted by `services/api-ts/src/core/ws.ts` `publishToChannel`.
 *   - OUTBOUND (client -> server): `{ type, data }`
 *       read by `services/api-ts/src/handlers/comms/ws.chat-room.ts` onMessage
 *       via `const { type, data } = message`.
 *
 * Both the `useChatWebSocket` hook and the `ChatView` consumer import from
 * here so the contract is exercised by `ws-frame-contract.test.ts` and can
 * never silently drift again.
 */

/** Server -> client envelope. */
export interface InboundFrame {
  event?: string
  payload?: unknown
}

/**
 * Serialize an outbound client -> server frame.
 *
 * IMPORTANT: the payload is nested under `data` (NOT spread). The previous
 * implementation spread the payload (`{ type, ...data }`), which left the
 * server reading `data.text` as `undefined`.
 */
export function serializeOutboundFrame(type: string, data: unknown): string {
  return JSON.stringify({ type, data })
}

/**
 * Normalize an inbound server -> client frame to the `{ event, payload }`
 * shape. Accepts the already-parsed JSON object.
 */
export function parseInboundFrame(raw: unknown): InboundFrame {
  const frame = (raw ?? {}) as Record<string, unknown>
  return {
    event: typeof frame.event === 'string' ? frame.event : undefined,
    payload: frame.payload,
  }
}
