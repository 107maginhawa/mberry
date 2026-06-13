/**
 * FIX-012 (Marketplace/Ads/Reviews Batch D) regression net.
 *
 * Asserts that the `@extension("x-audit", …)` declarations on the four
 * trust-sensitive operations (verifyVendor, fulfillOrder, reviewCreative,
 * deleteReview) are emitted as `createPerRouteAuditMiddleware(...)` in the
 * generated Hono route table — i.e. each decision leaves an audit-module trail.
 *
 * Deterministic: reads the generated routes file, no DB/server. Goes RED if the
 * x-audit extension is ever dropped from any of these ops.
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const routesPath = join(import.meta.dir, '../../generated/openapi/routes.ts');
const routes = readFileSync(routesPath, 'utf8');

/**
 * Slice the generated registration block for an operationId — from its
 * `// <op>` marker comment to the `registry.<op> as unknown` handler line —
 * so the audit assertion is bound to the right route, not a coincidental
 * substring match elsewhere in the file.
 */
function blockFor(op: string): string {
  const start = routes.indexOf(`// ${op}\n`);
  expect(start, `marker comment for ${op} not found in routes.ts`).toBeGreaterThan(-1);
  const handlerMarker = `registry.${op} as unknown`;
  const end = routes.indexOf(handlerMarker, start);
  expect(end, `handler registration for ${op} not found after its marker`).toBeGreaterThan(start);
  return routes.slice(start, end);
}

describe('FIX-012: x-audit middleware on trust-sensitive marketplace/advertising/reviews ops', () => {
  const cases: Array<{ op: string; mw: string }> = [
    { op: 'verifyVendor', mw: 'createPerRouteAuditMiddleware({ action: "update", resourceType: "marketplace-vendor" })' },
    { op: 'fulfillOrder', mw: 'createPerRouteAuditMiddleware({ action: "complete", resourceType: "marketplace-order" })' },
    { op: 'reviewCreative', mw: 'createPerRouteAuditMiddleware({ action: "update", resourceType: "ad-creative" })' },
    { op: 'deleteReview', mw: 'createPerRouteAuditMiddleware({ action: "delete", resourceType: "review" })' },
  ];

  for (const { op, mw } of cases) {
    test(`${op} registers its per-route audit middleware`, () => {
      expect(blockFor(op)).toContain(mw);
    });
  }
});
