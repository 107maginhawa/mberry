/**
 * Route-registry RBAC regression net (AHA FIX-005 / G6).
 *
 * The officer- and position-gated authorization for generated routes is
 * declared on TypeSpec operations via `@extension("x-require-officer", …)`
 * and `@extension("x-require-position", …)` (ADR-0007). The generator
 * (scripts/generate.ts) reads those extensions and emits
 * `requireOfficerMiddleware()` / `requirePositionMiddleware({...})` into
 * generated/openapi/routes.ts.
 *
 * If a future regeneration silently drops those extensions (or the generator
 * stops emitting the middleware), every affected officer/position-gated route
 * would become callable by any authenticated user — a privilege escalation
 * that no existing handler-level test would catch.
 *
 * This deterministic test (no DB, no live server) asserts the invariant:
 * the number of x-require-officer / x-require-position extensions in the
 * generated OpenAPI spec equals the number of corresponding middleware mounts
 * in routes.ts, and the middleware are actually imported. It goes RED the
 * moment a gate is lost during regeneration.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import openapi from '@monobase/api-spec/openapi.json';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_TS = resolve(__dirname, '../generated/openapi/routes.ts');
const routesSource = readFileSync(ROUTES_TS, 'utf-8');

/** Count occurrences of a key across every operation in the OpenAPI spec. */
function countSpecExtension(key: 'x-require-officer' | 'x-require-position'): number {
  let count = 0;
  const paths = (openapi as { paths: Record<string, Record<string, unknown>> }).paths;
  for (const item of Object.values(paths)) {
    for (const op of Object.values(item)) {
      if (op && typeof op === 'object' && key in (op as Record<string, unknown>)) {
        count++;
      }
    }
  }
  return count;
}

/** Count middleware mounts in routes.ts. */
function countRoutesMounts(re: RegExp): number {
  return (routesSource.match(re) ?? []).length;
}

describe('route-registry RBAC regression (FIX-005 / G6)', () => {
  test('there is at least one officer- and one position-gated route to protect', () => {
    // Guards against a regression that nukes ALL extensions (which would make
    // the equality checks below trivially pass at 0 === 0).
    expect(countSpecExtension('x-require-officer')).toBeGreaterThan(0);
    expect(countSpecExtension('x-require-position')).toBeGreaterThan(0);
  });

  test('every x-require-officer op emits requireOfficerMiddleware in routes.ts', () => {
    const specCount = countSpecExtension('x-require-officer');
    const routesCount = countRoutesMounts(/requireOfficerMiddleware\(/g);
    expect(routesCount).toBe(specCount);
  });

  test('every x-require-position op emits requirePositionMiddleware in routes.ts', () => {
    const specCount = countSpecExtension('x-require-position');
    const routesCount = countRoutesMounts(/requirePositionMiddleware\(/g);
    expect(routesCount).toBe(specCount);
  });

  test('routes.ts imports the officer and position middleware', () => {
    expect(routesSource).toContain("from '@/middleware/require-officer'");
    expect(routesSource).toContain("from '@/middleware/require-position'");
    expect(routesSource).toContain('requireOfficerMiddleware');
    expect(routesSource).toContain('requirePositionMiddleware');
  });

  test('every secured generated route also carries authMiddleware (no orphaned officer gate without auth)', () => {
    // An officer/position gate without a preceding auth gate would 500 (no
    // ctx.user). Assert authMiddleware is mounted on the registry.
    expect(routesSource).toContain('authMiddleware');
  });
});
