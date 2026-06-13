/**
 * dues-position-gate.routes.test.ts
 *
 * [FIX-004 Batch B] Treasurer/President position gate on financial dues mutations.
 *
 * These ops were gated at the route layer via the TypeSpec extension
 * `@extension("x-require-position", #["Treasurer", "President"])`, which the
 * generator (scripts/generate.ts) emits as `requirePositionMiddleware(...)`
 * into the generated routes.ts — BEFORE the handler.
 *
 * The existing dues-mutation-auth.test.ts calls handlers DIRECTLY, so it only
 * exercises INLINE gating and cannot observe route-level generated middleware.
 * This test proves the wiring at its source: it reads the generated routes.ts
 * and asserts each gated op's route registration carries the position
 * middleware. RED before the TypeSpec regen, GREEN after.
 *
 * requirePositionMiddleware itself (officer-term lookup, OR-title match, 2FA
 * enforcement, path/ctx orgId resolution) is unit-tested separately under
 * middleware/; this test only proves the 11 ops are wired to it.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROUTES_PATH = path.join(import.meta.dir, '../../../generated/openapi/routes.ts');
const routesSrc = readFileSync(ROUTES_PATH, 'utf8');

const EXPECTED_MIDDLEWARE = 'requirePositionMiddleware({ titles: ["Treasurer", "President"] })';

// The ~10 ungated financial mutations FIX-004 must gate (fix-ready plan §3).
const GATED_OPS = [
  'updateDuesConfig',
  'deleteDuesConfig',
  'upsertDuesGatewayConfig',
  'disconnectDuesGateway',
  'testDuesGatewayConnection',
  'upsertDuesFunds',
  'createDunningTemplate',
  'updateDunningTemplate',
  'deleteDunningTemplate',
  'runDunning',
  'recalculateAgingBucket',
];

/**
 * Slice the route-registration block for an operation: from its `app.<method>(`
 * line up to the `registry.<opId> as unknown as Handler` line that closes it.
 */
function routeBlockFor(opId: string): string {
  const marker = `registry.${opId} as unknown as Handler`;
  const idx = routesSrc.indexOf(marker);
  expect(idx, `route registration for ${opId} not found in generated routes.ts`).toBeGreaterThan(-1);
  const start = routesSrc.lastIndexOf('app.', idx);
  expect(start, `app.<method>( opener for ${opId} not found`).toBeGreaterThan(-1);
  return routesSrc.slice(start, idx);
}

describe('[FIX-004] dues financial mutations carry Treasurer/President position gate', () => {
  for (const op of GATED_OPS) {
    test(`${op} route includes ${EXPECTED_MIDDLEWARE} [RED→GREEN]`, () => {
      const block = routeBlockFor(op);
      expect(block).toContain(EXPECTED_MIDDLEWARE);
    });
  }
});
