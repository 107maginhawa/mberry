import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { EmailTemplateRepository } from './repos/template.repo';
import { EmailQueueRepository } from './repos/queue.repo';
import { testEmailTemplate } from './testEmailTemplate';

describe('testEmailTemplate', () => {
  beforeEach(() => {
    restoreRepo(EmailTemplateRepository);
    restoreRepo(EmailQueueRepository);
  });
  afterEach(() => {
    restoreRepo(EmailTemplateRepository);
    restoreRepo(EmailQueueRepository);
  });

  test('returns 403 for non-admin user', async () => {
    const ctx = makeCtx({ user: { id: 'u1', role: 'user' }, _params: { template: 'tmpl-1' } });
    await expect(testEmailTemplate(ctx)).rejects.toThrow('Admin role required');
  });

  test('throws ValidationError for missing recipientEmail', async () => {
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _params: { template: 'tmpl-1' },
      _body: {},
    });
    await expect(testEmailTemplate(ctx)).rejects.toThrow('Recipient email address is required');
  });

  test('throws ValidationError for invalid email format', async () => {
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _params: { template: 'tmpl-1' },
      _body: { recipientEmail: 'not-an-email' },
    });
    await expect(testEmailTemplate(ctx)).rejects.toThrow('Invalid recipient email address format');
  });

  test('throws NotFoundError when template not active', async () => {
    stubRepo(EmailTemplateRepository, { getActiveTemplate: async () => null });
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _params: { template: 'tmpl-1' },
      _body: { recipientEmail: 'test@example.com' },
    });
    await expect(testEmailTemplate(ctx)).rejects.toThrow('Email template not found or not active');
  });

  test('returns 200 on success and queues test email', async () => {
    const queueItem = { id: 'q-1', template: 'tmpl-1', recipient: 'test@example.com', priority: 1 };
    stubRepo(EmailTemplateRepository, {
      getActiveTemplate: async () => ({ id: 'tmpl-1', name: 'Welcome', status: 'active' }),
    });
    stubRepo(EmailQueueRepository, {
      queueEmail: async () => queueItem,
    });
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _params: { template: 'tmpl-1' },
      _body: { recipientEmail: 'test@example.com' },
    });
    const res = await testEmailTemplate(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body).toEqual({ queue: queueItem });
  });
});
