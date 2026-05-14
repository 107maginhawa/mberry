import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MessageTemplateRepository } from './repos/communication.repo';
import { searchMessageTemplates } from './searchMessageTemplates';

describe('searchMessageTemplates', () => {
  beforeEach(() => { restoreRepo(MessageTemplateRepository); });
  afterEach(() => { restoreRepo(MessageTemplateRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await searchMessageTemplates(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _query: {} });
    const res = await searchMessageTemplates(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 on happy path', async () => {
    stubRepo(MessageTemplateRepository, {
      search: async () => [],
    });
    const ctx = makeCtx({ _query: {} });
    const res = await searchMessageTemplates(ctx);
    expect(res.status).toBe(200);
  });
});
