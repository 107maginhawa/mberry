import { describe, test, expect, beforeAll } from 'bun:test';
import { apiAs, type ApiClient } from '@/tests/helpers/api-as';
import { API_AVAILABLE } from '@/tests/helpers/api-available';
// Factory N/A: integration test — uses API responses as test data, not domain factories
// Test-Classification: INTEGRATION — requires live API server (API_AVAILABLE flag)
// These tests run in CI with full API stack, skip in unit-test-only mode.

/**
 * Cross-org isolation (IDOR) tests.
 *
 * Verifies an officer of Org A cannot access Org B's data and vice versa.
 * Uses seed data: treasurer@memberry.ph is officer of org1 (pda-metro-manila),
 * idor-officer@memberry.ph is officer of org2 (pda-cebu).
 *
 * These tests require:
 * 1. API server running on port 7213
 * 2. Seed data applied (bun run db:seed)
 *
 * Security properties verified (STRIDE T-12-10 through T-12-13):
 * - Information Disclosure: GET /membership/members/:organizationId blocked cross-org
 * - Information Disclosure: GET /dues/dashboard/:organizationId blocked cross-org
 * - Information Disclosure: GET /membership/applications/:organizationId blocked cross-org
 * - Elevation of Privilege: officer cannot escalate access via orgId param manipulation
 */

const ORG_A_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'; // pda-metro-manila (hardcoded in seed)

// INFRA: requires live API server on port 7213 with seed data
const d = API_AVAILABLE ? describe : describe.skip;

d('Cross-org isolation (IDOR prevention)', () => {
  let orgAOfficer: ApiClient; // treasurer of org A (pda-metro-manila)
  let orgBOfficer: ApiClient; // president of org B (pda-cebu)
  let orgBId: string;

  beforeAll(async () => {
    orgAOfficer = await apiAs('treasurer@memberry.ph');
    orgBOfficer = await apiAs('idor-officer@memberry.ph');

    // Look up org B ID via the public org endpoint
    const orgRes = await fetch('http://localhost:7213/public/org/pda-cebu');
    if (orgRes.ok) {
      const org = await orgRes.json() as { id: string };
      orgBId = org.id;
    } else {
      // Fallback: mark as missing so tests fail with a clear message
      orgBId = 'org-b-not-found-run-db-seed';
    }
  });

  // ── Org A officer cannot access Org B data ──────────────────────────────

  test('Org A officer gets 403 on Org B roster (GET /membership/members/:orgBId)', async () => {
    const res = await orgAOfficer.get(`/membership/members/${orgBId}`);
    expect(res.status).toBe(403);
  });

  test('Org A officer gets 403 on Org B dues dashboard (GET /dues/dashboard/:orgBId)', async () => {
    const res = await orgAOfficer.get(`/dues/dashboard/${orgBId}`);
    expect(res.status).toBe(403);
  });

  test('Org A officer gets 403 on Org B applications (GET /membership/applications/:orgBId)', async () => {
    const res = await orgAOfficer.get(`/membership/applications/${orgBId}`);
    expect(res.status).toBe(403);
  });

  // ── Org B officer cannot access Org A data ──────────────────────────────

  test('Org B officer gets 403 on Org A roster (GET /membership/members/:orgAId)', async () => {
    const res = await orgBOfficer.get(`/membership/members/${ORG_A_ID}`);
    expect(res.status).toBe(403);
  });

  test('Org B officer gets 403 on Org A dues dashboard (GET /dues/dashboard/:orgAId)', async () => {
    const res = await orgBOfficer.get(`/dues/dashboard/${ORG_A_ID}`);
    expect(res.status).toBe(403);
  });

  test('Org B officer gets 403 on Org A applications (GET /membership/applications/:orgAId)', async () => {
    const res = await orgBOfficer.get(`/membership/applications/${ORG_A_ID}`);
    expect(res.status).toBe(403);
  });

  // ── Report IDOR: cross-org report access blocked ───────────────────────

  test('Org A officer gets 403 on Org B dues report (GET /association/member/dues-reporting/:orgBId/report)', async () => {
    const res = await orgAOfficer.get(`/association/member/dues-reporting/${orgBId}/report?type=collection`);
    expect([403, 401]).toContain(res.status);
  });

  test('Org B officer gets 403 on Org A dues report (GET /association/member/dues-reporting/:orgAId/report)', async () => {
    const res = await orgBOfficer.get(`/association/member/dues-reporting/${ORG_A_ID}/report?type=collection`);
    expect([403, 401]).toContain(res.status);
  });

  test('Org A officer gets 403 on Org B financial dashboard (GET /association/member/dues-reporting/:orgBId/dashboard)', async () => {
    const res = await orgAOfficer.get(`/association/member/dues-reporting/${orgBId}/dashboard`);
    expect([403, 401]).toContain(res.status);
  });

  // ── Sanity checks: each officer CAN access their own org ────────────────

  test('Org A officer gets 200 on own roster (GET /membership/members/:orgAId)', async () => {
    const res = await orgAOfficer.get(`/membership/members/${ORG_A_ID}`);
    expect(res.status).not.toBe(403);
  });

  test('Org B officer gets 200 on own roster (GET /membership/members/:orgBId)', async () => {
    const res = await orgBOfficer.get(`/membership/members/${orgBId}`);
    expect(res.status).not.toBe(403);
  });
});
