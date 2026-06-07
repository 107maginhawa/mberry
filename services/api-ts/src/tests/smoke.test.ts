/**
 * Smoke test: verifies the full API server boots and responds to health endpoints.
 *
 * This is the Day 1 TDD entry point for the fix-forward plan.
 * Tests that the entire app wiring (middleware, routes, dependencies) is functional.
 *
 * Requires: API server running on API_URL (default http://localhost:7213)
 */

import { describe, test, expect } from 'bun:test';
import { API_AVAILABLE } from './helpers/api-available';
// Factory N/A: integration test — uses API responses as test data, not domain factories
// Test-Classification: INTEGRATION — requires live API server (API_AVAILABLE flag)
// These tests run in CI with full API stack, skip in unit-test-only mode.

const API_URL = process.env['API_URL'] || 'http://localhost:7213';
const d = API_AVAILABLE ? describe : describe.skip; // allow-skip: integration gate — runs only when live API on $API_URL

d('Smoke: API server health', () => {
  test('GET /livez returns 200 with "ok"', async () => {
    const res = await fetch(`${API_URL}/livez`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('ok');
  });

  test('GET /readyz returns structured health response', async () => {
    const res = await fetch(`${API_URL}/readyz?verbose`);
    // May be 200 or 503 depending on which deps are running (minio, etc.)
    expect([200, 503]).toContain(res.status);
    const body = await res.json() as { status: string; checks: Record<string, string> };
    expect(['pass', 'fail']).toContain(body.status);
    // Database must be healthy for app to be useful
    expect(body.checks.database).toBe('pass');
    // Storage and jobs may fail in local dev without Docker
    expect(body.checks).toHaveProperty('storage');
    expect(body.checks).toHaveProperty('jobs');
  });

  test('GET /auth/ok returns 200 (auth endpoint wired)', async () => {
    const res = await fetch(`${API_URL}/auth/ok`);
    expect(res.status).toBe(200);
  });
});
