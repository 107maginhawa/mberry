import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonSubscriptionRepository, SubscriptionTopicRepository } from './repos/communication.repo';
import { bulkUpdatePersonSubscriptions } from './bulkUpdatePersonSubscriptions';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('bulkUpdatePersonSubscriptions', () => {
  beforeEach(() => { restoreRepo(PersonSubscriptionRepository); restoreRepo(SubscriptionTopicRepository); });
  afterEach(() => { restoreRepo(PersonSubscriptionRepository); restoreRepo(SubscriptionTopicRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await bulkUpdatePersonSubscriptions(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _body: { updates: [] } });
    const res = await bulkUpdatePersonSubscriptions(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 on happy path', async () => {
    stubRepo(PersonSubscriptionRepository, {
      bulkUpsert: async () => [{ id: 'ps-1', topicId: 'tp-1', enabled: true }],
    });
    stubRepo(SubscriptionTopicRepository, {
      findOrCreateByName: async () => ({ id: '33333333-3333-3333-3333-333333333333' }),
    });
    const ctx = makeCtx({ _body: { updates: [{ topicId: 'dues-email', enabled: true }] } });
    const res = await bulkUpdatePersonSubscriptions(ctx);
    expect(res.status).toBe(200);
  });

  // FIX-005: the UI sends synthetic category-channel keys ("dues-email") but the
  // person_subscription.topic_id column is uuid. The handler MUST resolve each
  // synthetic key to a real seeded topic UUID before upsert, or the insert
  // throws a uuid-cast error at runtime. This test proves the resolution happens.
  test('resolves synthetic UI key (dues-email) to a topic UUID before upsert', async () => {
    const SEEDED_TOPIC_UUID = '44444444-4444-4444-4444-444444444444';
    let upsertedTopicIds: string[] = [];
    let resolvedNames: string[] = [];

    stubRepo(SubscriptionTopicRepository, {
      findOrCreateByName: async (_orgId: string, name: string) => {
        resolvedNames.push(name);
        return { id: SEEDED_TOPIC_UUID };
      },
    });
    stubRepo(PersonSubscriptionRepository, {
      bulkUpsert: async (items: Array<{ topicId: string }>) => {
        upsertedTopicIds = items.map((i) => i.topicId);
        return items.map((i, idx) => ({ id: `ps-${idx}`, ...i }));
      },
    });

    const ctx = makeCtx({ _body: { updates: [{ topicId: 'dues-email', enabled: false }] } });
    const res = await bulkUpdatePersonSubscriptions(ctx);

    expect(res.status).toBe(200);
    // The category name was extracted from the synthetic key and resolved.
    expect(resolvedNames).toContain('dues');
    // What actually got persisted is a UUID, never the raw "dues-email" string.
    expect(upsertedTopicIds).toHaveLength(1);
    expect(upsertedTopicIds[0]).toBe(SEEDED_TOPIC_UUID);
    expect(UUID_RE.test(upsertedTopicIds[0]!)).toBe(true);
    expect(upsertedTopicIds[0]).not.toBe('dues-email');
  });

  // An already-UUID topicId must pass through unchanged (do not double-resolve).
  test('passes through an already-UUID topicId unchanged', async () => {
    const REAL_UUID = '55555555-5555-5555-5555-555555555555';
    let upsertedTopicIds: string[] = [];
    let findOrCreateCalled = false;

    stubRepo(SubscriptionTopicRepository, {
      findOrCreateByName: async () => { findOrCreateCalled = true; return { id: 'should-not-be-used' }; },
    });
    stubRepo(PersonSubscriptionRepository, {
      bulkUpsert: async (items: Array<{ topicId: string }>) => {
        upsertedTopicIds = items.map((i) => i.topicId);
        return items.map((i, idx) => ({ id: `ps-${idx}`, ...i }));
      },
    });

    const ctx = makeCtx({ _body: { updates: [{ topicId: REAL_UUID, enabled: true }] } });
    const res = await bulkUpdatePersonSubscriptions(ctx);

    expect(res.status).toBe(200);
    expect(upsertedTopicIds[0]).toBe(REAL_UUID);
    expect(findOrCreateCalled).toBe(false);
  });
});
