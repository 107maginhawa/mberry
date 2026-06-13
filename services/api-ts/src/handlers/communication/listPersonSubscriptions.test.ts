import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonSubscriptionRepository } from './repos/communication.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { listPersonSubscriptions } from './listPersonSubscriptions';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

// In this codebase the authenticated user's id IS the caller's personId
// (see getPerson / listDuesPayments). makeCtx defaults user.id to 'user-1', so a
// self-read passes personId: 'user-1'.
const SELF = 'user-1';

describe('listPersonSubscriptions', () => {
  beforeEach(() => { restoreRepo(PersonSubscriptionRepository); restoreRepo(OfficerTermRepository); });
  afterEach(() => { restoreRepo(PersonSubscriptionRepository); restoreRepo(OfficerTermRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await listPersonSubscriptions(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _query: { personId: SELF } });
    const res = await listPersonSubscriptions(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 on happy path (self)', async () => {
    stubRepo(PersonSubscriptionRepository, {
      findByPersonWithTopic: async () => [],
    });
    const ctx = makeCtx({ _query: { personId: SELF } });
    const res = await listPersonSubscriptions(ctx);
    expect(res.status).toBe(200);
  });

  // FIX-004: response must conform to the generated PersonSubscriptionListResponseSchema
  // contract shape ({ data, pagination }), NOT the legacy { items, total, offset, limit }.
  // The frontend reads `data.data`; the old shape made it permanently undefined.
  test('returns contract shape { data, pagination } — not legacy { items }', async () => {
    const rows = [
      { id: 'ps-1', topicId: '11111111-1111-1111-1111-111111111111', enabled: true, topicName: 'dues' },
      { id: 'ps-2', topicId: '22222222-2222-2222-2222-222222222222', enabled: false, topicName: 'events' },
    ];
    stubRepo(PersonSubscriptionRepository, {
      findByPersonWithTopic: async () => rows as never,
    });
    const ctx = makeCtx({ _query: { personId: SELF } });
    const res = await listPersonSubscriptions(ctx) as unknown as { status: number; body: any };

    expect(res.status).toBe(200);
    // Contract shape
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.count).toBe(2);
    expect(res.body.pagination.totalCount).toBe(2);
    expect(typeof res.body.pagination.offset).toBe('number');
    expect(typeof res.body.pagination.limit).toBe('number');
    // Legacy keys must be gone
    expect(res.body.items).toBeUndefined();
  });

  // FIX-005 (load round-trip): each subscription item carries its topic NAME so
  // the prefs UI can map a stored topic UUID back to its category and reflect
  // the saved toggle state on reload. Without this the UI cannot round-trip.
  test('enriches each subscription with topicName for UI round-trip', async () => {
    const rows = [
      { id: 'ps-1', topicId: '11111111-1111-1111-1111-111111111111', enabled: false, topicName: 'dues' },
    ];
    stubRepo(PersonSubscriptionRepository, {
      findByPersonWithTopic: async () => rows as never,
    });
    const ctx = makeCtx({ _query: { personId: SELF } });
    const res = await listPersonSubscriptions(ctx) as unknown as { status: number; body: any };

    expect(res.status).toBe(200);
    expect(res.body.data[0].topicName).toBe('dues');
    expect(res.body.data[0].enabled).toBe(false);
  });

  // ─── DEC-COMMS-05: self/officer PII scoping on ?personId= ────────────────
  // person_subscription rows are consent/opt-out records. The route gate is
  // `member:owner` (ownership enforced in the handler, not middleware), but the
  // handler scoped by org only — so a member could read ANOTHER member's consent
  // state by passing their personId. The handler must allow a self-read, and
  // require officer access for any other person's records.

  test('DEC-COMMS-05: denies a member reading ANOTHER member\'s subscriptions (403) and does not leak data', async () => {
    let fetched = false;
    stubRepo(PersonSubscriptionRepository, {
      findByPersonWithTopic: async () => { fetched = true; return []; },
    });
    // caller is a non-officer member ('user-1') requesting someone else's records
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const ctx = makeCtx({ _query: { personId: 'someone-else' } });
    const res = await listPersonSubscriptions(ctx);
    expect(res.status).toBe(403);
    // The other member's rows must never be fetched.
    expect(fetched).toBe(false);
  });

  test('DEC-COMMS-05: allows an OFFICER to read another member\'s subscriptions (200)', async () => {
    stubRepo(PersonSubscriptionRepository, {
      findByPersonWithTopic: async () => [],
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Director' }],
    });
    const ctx = makeCtx({ _query: { personId: 'someone-else' } });
    const res = await listPersonSubscriptions(ctx);
    expect(res.status).toBe(200);
  });
});
