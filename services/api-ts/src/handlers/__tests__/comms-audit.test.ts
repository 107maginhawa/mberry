/**
 * FIX-017 (Realtime Comms Batch C) audit-trail regression net.
 *
 * Asserts that the `@extension("x-audit", …)` declarations on the two
 * privileged comms operations (createChatRoom, endVideoCall) are emitted as
 * `createPerRouteAuditMiddleware(...)` in the generated Hono route table — i.e.
 * room creation and call termination leave an audit-module trail, not just pino
 * logs.
 *
 * Deterministic: reads the generated routes file, no DB/server. Goes RED if the
 * x-audit extension is ever dropped from either op (or the regen is skipped).
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const routesPath = join(import.meta.dir, '../../generated/openapi/routes.ts');
const routes = readFileSync(routesPath, 'utf8');

/**
 * Slice the generated registration block for an operationId — from its
 * `// <op>` marker comment to the `registry.<op> as unknown` handler line — so
 * the audit assertion is bound to the right route, not a coincidental substring.
 */
function blockFor(op: string): string {
  const start = routes.indexOf(`// ${op}\n`);
  expect(start, `marker comment for ${op} not found in routes.ts`).toBeGreaterThan(-1);
  const handlerMarker = `registry.${op} as unknown`;
  const end = routes.indexOf(handlerMarker, start);
  expect(end, `handler registration for ${op} not found after its marker`).toBeGreaterThan(start);
  return routes.slice(start, end);
}

describe('FIX-017: x-audit middleware on privileged comms ops', () => {
  const cases: Array<{ op: string; mw: string }> = [
    { op: 'createChatRoom', mw: 'createPerRouteAuditMiddleware({ action: "create", resourceType: "chat-room" })' },
    { op: 'endVideoCall', mw: 'createPerRouteAuditMiddleware({ action: "complete", resourceType: "video-call" })' },
  ];

  for (const { op, mw } of cases) {
    test(`${op} registers its per-route audit middleware`, () => {
      expect(blockFor(op)).toContain(mw);
    });
  }
});
