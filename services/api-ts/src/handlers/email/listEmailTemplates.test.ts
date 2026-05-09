import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { EmailTemplateRepository } from './repos/template.repo';
import { listEmailTemplates } from './listEmailTemplates';

describe('listEmailTemplates', () => {
  beforeEach(() => { restoreRepo(EmailTemplateRepository); });
  afterEach(() => { restoreRepo(EmailTemplateRepository); });

  test('returns 403 for non-admin user', async () => {
    const ctx = makeCtx({ user: { id: 'u1', role: 'user' } });
    await expect(listEmailTemplates(ctx)).rejects.toThrow('Admin role required');
  });

  test('returns 200 with data and pagination', async () => {
    const templates = [{ id: 'tmpl-1', name: 'Welcome' }];
    stubRepo(EmailTemplateRepository, {
      findMany: async () => templates,
      count: async () => 1,
    });
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _query: {},
    });
    const res = await listEmailTemplates(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toEqual(templates);
    expect(body.pagination).toBeDefined();
  });
});
