/**
 * marketplace-advertising-route-prefix — org-context reachability invariant (AHA FIX-001 / G-01)
 *
 * Root cause (D-11): the Marketplace and Advertising module interfaces are
 * re-exported in specs/api/src/main.tsp (`interface X extends Module.Y {}`)
 * WITHOUT an `@route("/association/...")` decorator. Every other module's
 * re-export carries one (e.g. `@route("/association/member/tiers")`). Without
 * it, TypeSpec drops the source namespace's `@route("/association/marketplace")`
 * / `@route("/association/advertising")` prefix and emits the operations at
 * ROOT paths (`/vendors`, `/advertisers`, `/opt-out`, ...).
 *
 * app.ts mounts `orgContextMiddleware()` on `/association/*` only. Root-path
 * routes therefore never resolve `organizationId`, and every insert hits the
 * `organization_id` NOT NULL constraint → 500.
 *
 * This test is a deterministic regression net (no DB / no live server). It
 * proves — in BOTH the generated OpenAPI spec AND the generated Hono route
 * registrations (routes.ts) — that every marketplace/advertising operation
 * lives under `/association/marketplace/*` or `/association/advertising/*`,
 * i.e. inside the org-context middleware boundary. It also proves none of
 * those operations leak back to the root namespace.
 *
 * If a future spec/codegen change drops the prefix again, this test goes RED.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import openapi from '@monobase/api-spec/openapi.json';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_TS = resolve(__dirname, '../../generated/openapi/routes.ts');
const routesSource = readFileSync(ROUTES_TS, 'utf-8');

const openapiPaths = Object.keys((openapi as { paths: Record<string, unknown> }).paths);

// Every operation defined in marketplace.tsp / advertising.tsp, with the
// org-context-scoped path it MUST be reachable at, and the Hono-style path
// (':' params) that routes.ts must register.
const MARKETPLACE_PREFIX = '/association/marketplace';
const ADVERTISING_PREFIX = '/association/advertising';

const EXPECTED = [
  // marketplace
  { op: 'createVendor', method: 'post', openapi: `${MARKETPLACE_PREFIX}/vendors`, hono: `'${MARKETPLACE_PREFIX}/vendors'` },
  { op: 'listVendors', method: 'get', openapi: `${MARKETPLACE_PREFIX}/vendors`, hono: `'${MARKETPLACE_PREFIX}/vendors'` },
  { op: 'getVendor', method: 'get', openapi: `${MARKETPLACE_PREFIX}/vendors/{vendorId}`, hono: `'${MARKETPLACE_PREFIX}/vendors/:vendorId'` },
  { op: 'updateVendor', method: 'patch', openapi: `${MARKETPLACE_PREFIX}/vendors/{vendorId}`, hono: `'${MARKETPLACE_PREFIX}/vendors/:vendorId'` },
  { op: 'verifyVendor', method: 'post', openapi: `${MARKETPLACE_PREFIX}/vendors/{vendorId}/verify`, hono: `'${MARKETPLACE_PREFIX}/vendors/:vendorId/verify'` },
  { op: 'createListing', method: 'post', openapi: `${MARKETPLACE_PREFIX}/listings`, hono: `'${MARKETPLACE_PREFIX}/listings'` },
  { op: 'listListings', method: 'get', openapi: `${MARKETPLACE_PREFIX}/listings`, hono: `'${MARKETPLACE_PREFIX}/listings'` },
  { op: 'createOrder', method: 'post', openapi: `${MARKETPLACE_PREFIX}/orders`, hono: `'${MARKETPLACE_PREFIX}/orders'` },
  { op: 'fulfillOrder', method: 'post', openapi: `${MARKETPLACE_PREFIX}/orders/{orderId}/fulfill`, hono: `'${MARKETPLACE_PREFIX}/orders/:orderId/fulfill'` },
  // advertising
  { op: 'createAdvertiser', method: 'post', openapi: `${ADVERTISING_PREFIX}/advertisers`, hono: `'${ADVERTISING_PREFIX}/advertisers'` },
  { op: 'createCampaign', method: 'post', openapi: `${ADVERTISING_PREFIX}/campaigns`, hono: `'${ADVERTISING_PREFIX}/campaigns'` },
  { op: 'createCreative', method: 'post', openapi: `${ADVERTISING_PREFIX}/creatives`, hono: `'${ADVERTISING_PREFIX}/creatives'` },
  { op: 'reviewCreative', method: 'post', openapi: `${ADVERTISING_PREFIX}/creatives/{creativeId}/review`, hono: `'${ADVERTISING_PREFIX}/creatives/:creativeId/review'` },
  { op: 'reportAd', method: 'post', openapi: `${ADVERTISING_PREFIX}/creatives/{creativeId}/report`, hono: `'${ADVERTISING_PREFIX}/creatives/:creativeId/report'` },
  { op: 'getAdForPlacement', method: 'get', openapi: `${ADVERTISING_PREFIX}/placement`, hono: `'${ADVERTISING_PREFIX}/placement'` },
  { op: 'setMemberOptOut', method: 'post', openapi: `${ADVERTISING_PREFIX}/opt-out`, hono: `'${ADVERTISING_PREFIX}/opt-out'` },
] as const;

// Root-level paths that MUST NOT exist (would bypass org-context middleware).
const FORBIDDEN_ROOT_PATHS = [
  '/vendors',
  '/listings',
  '/orders',
  '/advertisers',
  '/campaigns',
  '/creatives',
  '/placement',
  '/opt-out',
];

describe('marketplace/advertising routes are org-context scoped (FIX-001 / G-01)', () => {
  describe('OpenAPI spec emits the /association prefix', () => {
    for (const e of EXPECTED) {
      test(`${e.op} → ${e.method.toUpperCase()} ${e.openapi}`, () => {
        const item = (openapi as { paths: Record<string, Record<string, { operationId?: string }>> }).paths[e.openapi];
        expect(item, `OpenAPI is missing path ${e.openapi}`).toBeDefined();
        expect(item[e.method]?.operationId).toBe(e.op);
      });
    }
  });

  describe('generated Hono routes register under the /association prefix', () => {
    for (const e of EXPECTED) {
      test(`${e.op} → app.${e.method}(${e.hono})`, () => {
        const needle = `app.${e.method}(${e.hono}`;
        expect(
          routesSource.includes(needle),
          `routes.ts does not register ${needle}`,
        ).toBe(true);
      });
    }
  });

  describe('no marketplace/advertising operation leaks to a root path', () => {
    for (const p of FORBIDDEN_ROOT_PATHS) {
      test(`OpenAPI has no root path ${p}`, () => {
        expect(openapiPaths).not.toContain(p);
      });
      test(`routes.ts does not register a root path ${p}`, () => {
        // Match `app.<verb>('/vendors'` exactly (start of the Hono path arg),
        // not the prefixed `'/association/marketplace/vendors'`.
        const leak = new RegExp(`app\\.(get|post|patch|put|delete)\\('${p.replace(/[/]/g, '\\$&')}'`);
        expect(routesSource).not.toMatch(leak);
      });
    }
  });
});
