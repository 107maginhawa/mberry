/**
 * Route auth coverage: verifies ALL generated routes have authMiddleware
 * unless explicitly listed as intentionally public.
 *
 * Regression test for codegen gap where routes with x-security-required-roles
 * but no `security` field in OpenAPI spec were generated without authMiddleware.
 *
 * RED: This test should FAIL before the codegen fix (66 routes missing auth).
 * GREEN: After fix, all non-public routes must have authMiddleware.
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

// Intentionally public routes — no auth required by design
const INTENTIONALLY_PUBLIC_ROUTES = new Set([
  'POST /billing/webhooks/stripe',
  'GET /certificates/verify/:certificateNumber',
  'GET /email/unsubscribe',
  'POST /email/unsubscribe',
  'GET /invite/validate/:token',
  'POST /pay/:token/checkout',
  'GET /pay/:token/validate',
  'GET /public/events',
  'GET /public/events/:slug',
  'GET /public/org/:slug',
  'GET /public/orgs',
  'GET /association/member/credentials/lookup/:credentialNumber',
  'POST /association/member/credentials/public-verify',
]);

describe('Generated route auth coverage', () => {
  const routesPath = join(import.meta.dir, '..', 'generated', 'openapi', 'routes.ts');
  const content = readFileSync(routesPath, 'utf-8');

  // Parse route blocks: each starts with "  // operationId" then "  app.method('path',"
  const routePattern = /\/\/ (\w+)\n\s+app\.(get|post|put|patch|delete)\('([^']+)',\n([\s\S]*?)registry\.\w+ as unknown as Handler\n\s+\);/g;

  const routes: Array<{ operationId: string; method: string; path: string; hasAuth: boolean }> = [];

  let match;
  while ((match = routePattern.exec(content)) !== null) {
    routes.push({
      operationId: match[1],
      method: match[2].toUpperCase(),
      path: match[3],
      hasAuth: match[4].includes('authMiddleware'),
    });
  }

  test('should parse all generated routes', () => {
    // Sanity check — ensure we parsed a reasonable number of routes
    expect(routes.length).toBeGreaterThan(300);
  });

  test('every non-public route must have authMiddleware', () => {
    const missing: string[] = [];

    for (const route of routes) {
      const key = `${route.method} ${route.path}`;
      if (INTENTIONALLY_PUBLIC_ROUTES.has(key)) continue;
      if (!route.hasAuth) {
        missing.push(`${key}  (${route.operationId})`);
      }
    }

    if (missing.length > 0) {
      const msg = `${missing.length} routes missing authMiddleware:\n${missing.join('\n')}`;
      expect(missing.length, msg).toBe(0);
    }

    expect(missing.length).toBe(0);
  });

  test('intentionally public routes should NOT have authMiddleware', () => {
    const wronglyProtected: string[] = [];

    for (const route of routes) {
      const key = `${route.method} ${route.path}`;
      if (INTENTIONALLY_PUBLIC_ROUTES.has(key) && route.hasAuth) {
        wronglyProtected.push(`${key} has authMiddleware but should be public`);
      }
    }

    expect(wronglyProtected.length).toBe(0);
  });
});
