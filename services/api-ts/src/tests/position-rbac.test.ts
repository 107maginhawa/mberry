/**
 * RED Phase: Position-specific RBAC tests.
 *
 * These tests validate that position-restricted endpoints reject officers with
 * wrong positions. Expected initial state: tests FAIL because handlers still
 * use requireOfficerTerm (any officer passes). Tests go GREEN in Plans 13-03/13-04.
 *
 * Per D-03: Each handler category is restricted to specific positions.
 * Per D-04: ANY matching position grants access (President is a superuser).
 * Per D-08: Position matching uses canonical titles from POSITION_TITLES.
 *
 * PREREQUISITE: API server must be running on port 7213.
 * Start with: cd services/api-ts && bun dev
 * Seed data: cd services/api-ts && bun run db:seed
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiAs, type ApiClient } from '@/tests/helpers/api-as';
import { API_AVAILABLE } from '@/tests/helpers/api-available';

const d = API_AVAILABLE ? describe : describe.skip;

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'; // pda-metro-manila from seed

let presidentClient: ApiClient;
let treasurerClient: ApiClient;
let secretaryClient: ApiClient;
let societyClient: ApiClient;
let memberClient: ApiClient;

beforeAll(async () => {
  if (!API_AVAILABLE) return;
  presidentClient = await apiAs('test@memberry.ph');
  treasurerClient = await apiAs('treasurer@memberry.ph');
  secretaryClient = await apiAs('secretary@memberry.ph');
  societyClient = await apiAs('society@memberry.ph');
  memberClient = await apiAs('member@memberry.ph');
});

// ─── Treasurer Position Restrictions ──────────────────────────────────────────

d('Treasurer position restrictions', () => {
  test('Treasurer blocked: create event (POST /association/operations/events) returns 403', async () => {
    const res = await treasurerClient.post('/association/operations/events', {
      organizationId: ORG_ID,
      title: 'Unauthorized event',
      startDate: '2026-06-01T09:00:00Z',
      endDate: '2026-06-01T17:00:00Z',
    });
    expect(res.status).toBe(403);
  });

  test('Treasurer blocked: create training (POST /association/operations/trainings) returns 403', async () => {
    const res = await treasurerClient.post('/association/operations/trainings', {
      organizationId: ORG_ID,
      title: 'Unauthorized training',
      startDate: '2026-06-01T09:00:00Z',
      endDate: '2026-06-01T17:00:00Z',
    });
    expect(res.status).toBe(403);
  });

  test('Treasurer blocked: create course (POST /association/operations/courses) returns 403', async () => {
    const res = await treasurerClient.post('/association/operations/courses', {
      organizationId: ORG_ID,
      title: 'Unauthorized course',
    });
    expect(res.status).toBe(403);
  });

  test('Treasurer blocked: add roster member (POST /association/member/roster-members) returns 403', async () => {
    const res = await treasurerClient.post('/association/member/roster-members', {
      organizationId: ORG_ID,
      personId: 'some-person-id',
    });
    expect(res.status).toBe(403);
  });

  test('Treasurer blocked: create announcement (POST /association/member/announcements) returns 403', async () => {
    const res = await treasurerClient.post('/association/member/announcements', {
      organizationId: ORG_ID,
      title: 'Unauthorized announcement',
      content: 'Test content',
    });
    expect(res.status).toBe(403);
  });

  test('Treasurer blocked: create election (POST /association/member/elections) returns 403', async () => {
    const res = await treasurerClient.post('/association/member/elections', {
      organizationId: ORG_ID,
      title: 'Unauthorized election',
      startDate: '2026-06-01T09:00:00Z',
      endDate: '2026-06-30T17:00:00Z',
    });
    expect(res.status).toBe(403);
  });

  test('Treasurer blocked: create position (POST /association/member/positions) returns 403', async () => {
    const res = await treasurerClient.post('/association/member/positions', {
      organizationId: ORG_ID,
      title: 'Unauthorized position',
    });
    expect(res.status).toBe(403);
  });
});

// ─── Secretary Position Restrictions ──────────────────────────────────────────

d('Secretary position restrictions', () => {
  test('Secretary blocked: create dues payment (POST /association/member/dues-payments) returns 403', async () => {
    const res = await secretaryClient.post('/association/member/dues-payments', {
      organizationId: ORG_ID,
      memberId: 'some-member-id',
      amount: 1000,
    });
    expect(res.status).toBe(403);
  });

  test('Secretary blocked: create dues config (POST /association/member/dues-configs) returns 403', async () => {
    const res = await secretaryClient.post('/association/member/dues-configs', {
      organizationId: ORG_ID,
      amount: 2000,
      dueDate: '2026-12-31',
    });
    expect(res.status).toBe(403);
  });

  test('Secretary blocked: create election (POST /association/member/elections) returns 403', async () => {
    const res = await secretaryClient.post('/association/member/elections', {
      organizationId: ORG_ID,
      title: 'Unauthorized election',
      startDate: '2026-06-01T09:00:00Z',
      endDate: '2026-06-30T17:00:00Z',
    });
    expect(res.status).toBe(403);
  });

  test('Secretary blocked: create position (POST /association/member/positions) returns 403', async () => {
    const res = await secretaryClient.post('/association/member/positions', {
      organizationId: ORG_ID,
      title: 'Unauthorized position',
    });
    expect(res.status).toBe(403);
  });

  test('Secretary blocked: create event (POST /association/operations/events) returns 403', async () => {
    const res = await secretaryClient.post('/association/operations/events', {
      organizationId: ORG_ID,
      title: 'Unauthorized event',
      startDate: '2026-06-01T09:00:00Z',
      endDate: '2026-06-01T17:00:00Z',
    });
    expect(res.status).toBe(403);
  });
});

// ─── Society Officer Position Restrictions ─────────────────────────────────────

d('Society Officer position restrictions', () => {
  test('Society Officer blocked: create dues payment (POST /association/member/dues-payments) returns 403', async () => {
    const res = await societyClient.post('/association/member/dues-payments', {
      organizationId: ORG_ID,
      memberId: 'some-member-id',
      amount: 1000,
    });
    expect(res.status).toBe(403);
  });

  test('Society Officer blocked: add roster member (POST /association/member/roster-members) returns 403', async () => {
    const res = await societyClient.post('/association/member/roster-members', {
      organizationId: ORG_ID,
      personId: 'some-person-id',
    });
    expect(res.status).toBe(403);
  });

  test('Society Officer blocked: create announcement (POST /association/member/announcements) returns 403', async () => {
    const res = await societyClient.post('/association/member/announcements', {
      organizationId: ORG_ID,
      title: 'Unauthorized announcement',
      content: 'Test content',
    });
    expect(res.status).toBe(403);
  });

  test('Society Officer blocked: create election (POST /association/member/elections) returns 403', async () => {
    const res = await societyClient.post('/association/member/elections', {
      organizationId: ORG_ID,
      title: 'Unauthorized election',
      startDate: '2026-06-01T09:00:00Z',
      endDate: '2026-06-30T17:00:00Z',
    });
    expect(res.status).toBe(403);
  });

  test('Society Officer blocked: create position (POST /association/member/positions) returns 403', async () => {
    const res = await societyClient.post('/association/member/positions', {
      organizationId: ORG_ID,
      title: 'Unauthorized position',
    });
    expect(res.status).toBe(403);
  });
});

// ─── President Superuser Access ────────────────────────────────────────────────

d('President superuser access', () => {
  test('President allowed: create dues payment (POST /association/member/dues-payments) returns non-403', async () => {
    const res = await presidentClient.post(`/association/member/dues-payments?organizationId=${ORG_ID}`, {
      organizationId: ORG_ID,
      memberId: 'some-member-id',
      amount: 1000,
    });
    expect(res.status).not.toBe(403);
  });

  test('President allowed: add roster member (POST /association/member/roster-members) returns non-403', async () => {
    const res = await presidentClient.post(`/association/member/roster-members?organizationId=${ORG_ID}`, {
      organizationId: ORG_ID,
      personId: 'some-person-id',
    });
    expect(res.status).not.toBe(403);
  });

  test('President allowed: create event (POST /association/operations/events) returns non-403', async () => {
    const res = await presidentClient.post(`/association/operations/events?organizationId=${ORG_ID}`, {
      organizationId: ORG_ID,
      title: 'President event',
      startDate: '2026-06-01T09:00:00Z',
      endDate: '2026-06-01T17:00:00Z',
    });
    expect(res.status).not.toBe(403);
  });

  test('President allowed: create election (POST /association/member/elections) returns non-403', async () => {
    const res = await presidentClient.post(`/association/member/elections?organizationId=${ORG_ID}`, {
      organizationId: ORG_ID,
      title: 'President election',
      startDate: '2026-06-01T09:00:00Z',
      endDate: '2026-06-30T17:00:00Z',
    });
    expect(res.status).not.toBe(403);
  });

  test('President allowed: create position (POST /association/member/positions) returns non-403', async () => {
    const res = await presidentClient.post(`/association/member/positions?organizationId=${ORG_ID}`, {
      organizationId: ORG_ID,
      title: 'Board Member',
    });
    expect(res.status).not.toBe(403);
  });

  test('President allowed: create announcement (POST /association/member/announcements) returns non-403', async () => {
    const res = await presidentClient.post(`/association/member/announcements?organizationId=${ORG_ID}`, {
      organizationId: ORG_ID,
      title: 'President announcement',
      content: 'Test content',
    });
    expect(res.status).not.toBe(403);
  });
});

// ─── app.ts Position-Restricted Routes ────────────────────────────────────────

d('app.ts position-restricted routes', () => {
  test('Treasurer blocked: GET /credit-compliance/:orgId returns 403', async () => {
    const res = await treasurerClient.get(`/credit-compliance/${ORG_ID}`);
    expect(res.status).toBe(403);
  });

  test('Secretary blocked: GET /dues/dashboard/:orgId returns 403', async () => {
    const res = await secretaryClient.get(`/dues/dashboard/${ORG_ID}`);
    expect(res.status).toBe(403);
  });

  test('Society Officer blocked: PUT /membership/org-profile/:orgId returns 403', async () => {
    const res = await societyClient.put(`/membership/org-profile/${ORG_ID}`, {
      name: 'Unauthorized update',
    });
    expect(res.status).toBe(403);
  });

  test('President allowed: GET /dues/dashboard/:orgId returns non-403', async () => {
    const res = await presidentClient.get(`/dues/dashboard/${ORG_ID}`);
    expect(res.status).not.toBe(403);
  });

  test('President allowed: GET /credit-compliance/:orgId returns non-403', async () => {
    const res = await presidentClient.get(`/credit-compliance/${ORG_ID}`);
    expect(res.status).not.toBe(403);
  });

  test('Treasurer allowed: POST /association/member/dues-payments (Treasurer domain)', async () => {
    const res = await treasurerClient.post(`/association/member/dues-payments?organizationId=${ORG_ID}`, {
      organizationId: ORG_ID,
      memberId: 'some-member-id',
      amount: 1000,
    });
    expect(res.status).not.toBe(403);
  });

  test('Secretary allowed: POST /association/member/roster (Secretary domain)', async () => {
    const res = await secretaryClient.post(`/association/member/roster?organizationId=${ORG_ID}`, {
      organizationId: ORG_ID,
      personId: 'some-person-id',
    });
    expect(res.status).not.toBe(403);
  });

  test('Society Officer allowed: POST /association/events (Society Officer domain)', async () => {
    const res = await societyClient.post(`/association/events?organizationId=${ORG_ID}`, {
      organizationId: ORG_ID,
      title: 'Society event',
      startDate: '2026-06-01T09:00:00Z',
      endDate: '2026-06-01T17:00:00Z',
    });
    expect(res.status).not.toBe(403);
  });
});

// ─── Member Regression ─────────────────────────────────────────────────────────

d('Member still blocked (regression)', () => {
  test('Member blocked: create event (POST /association/operations/events) returns 403', async () => {
    const res = await memberClient.post('/association/operations/events', {
      organizationId: ORG_ID,
      title: 'Member event',
      startDate: '2026-06-01T09:00:00Z',
      endDate: '2026-06-01T17:00:00Z',
    });
    expect(res.status).toBe(403);
  });

  test('Member blocked: create dues payment (POST /association/member/dues-payments) returns 403', async () => {
    const res = await memberClient.post('/association/member/dues-payments', {
      organizationId: ORG_ID,
      memberId: 'some-member-id',
      amount: 1000,
    });
    expect(res.status).toBe(403);
  });

  test('Member blocked: create election (POST /association/member/elections) returns 403', async () => {
    const res = await memberClient.post('/association/member/elections', {
      organizationId: ORG_ID,
      title: 'Member election',
      startDate: '2026-06-01T09:00:00Z',
      endDate: '2026-06-30T17:00:00Z',
    });
    expect(res.status).toBe(403);
  });
});
