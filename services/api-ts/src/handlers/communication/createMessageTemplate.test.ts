import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MessageTemplateRepository } from './repos/communication.repo';
import { createMessageTemplate } from './createMessageTemplate';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

describe('createMessageTemplate', () => {
  beforeEach(() => { restoreRepo(MessageTemplateRepository); });
  afterEach(() => { restoreRepo(MessageTemplateRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await createMessageTemplate(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _body: { name: 'T', channel: 'email', body: 'b', mergeFields: [], category: 'c', isTransactional: false } });
    const res = await createMessageTemplate(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 201 on happy path', async () => {
    const template = { id: 'tpl-1', organizationId: 'tenant-1', name: 'T' };
    stubRepo(MessageTemplateRepository, {
      create: async () => template,
    });
    const ctx = makeCtx({ _body: { name: 'T', channel: 'email', body: 'b', mergeFields: [], category: 'c', isTransactional: false } });
    const res = await createMessageTemplate(ctx);
    expect(res.status).toBe(201);
  });
});
