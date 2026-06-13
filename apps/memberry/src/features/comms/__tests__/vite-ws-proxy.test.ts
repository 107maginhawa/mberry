import { test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * FIX-009 (G8) regression guard.
 *
 * The memberry dev proxy must forward WebSocket *upgrade* requests on
 * `/api/ws/...` to the API. The chat hook connects to
 * `/api/ws/comms/chat-rooms/:room`; without `ws: true` on the `/api` proxy,
 * Vite silently drops the upgrade and the socket hangs (the chat UI shows a
 * permanent "Reconnecting…"). Verified live in the FIX-009 pass: before the
 * flag the proxied upgrade timed out; after it, the upgrade reached the API
 * on :7213 (CLOSE 1002 "Expected 101", identical to the direct backend).
 *
 * Scope note: this is a config-PRESENCE guard — it catches an accidental
 * removal of `ws: true`. It is NOT a functional proof that upgrades succeed
 * end-to-end; that functional regression guard is the (deferred) two-session
 * `apps/memberry/tests/e2e/comms/chat-connect.spec.ts`, which needs a
 * logged-in browser session to reach a "connected" state.
 */
test('vite /api proxy forwards WebSocket upgrades (FIX-009: ws:true)', () => {
  const configPath = join(import.meta.dir, '../../../../vite.config.ts')
  const src = readFileSync(configPath, 'utf8')

  // Isolate the `/api` proxy entry, then assert it enables ws forwarding.
  const apiProxyStart = src.indexOf("'/api'")
  expect(apiProxyStart).toBeGreaterThan(-1)
  const apiProxyRegion = src.slice(apiProxyStart)
  expect(apiProxyRegion).toContain('ws: true')
})
