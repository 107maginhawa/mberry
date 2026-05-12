import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { upsertDuesConfig } from './upsertDuesConfig';
import { DuesRepository } from './repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeConfig = {
  id: 'config-1',
  organizationId: 'org-1',
  defaultAmount: 5000,
  currency: 'PHP',
  billingFrequency: 'annual',
  dueDateMonth: 1,
  dueDateDay: 1,
  gracePeriodDays: 30,
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('[BR-02] upsertDuesConfig', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('upserts config and returns 200', async () => {
    mocks = stubRepo(DuesRepository, {
      upsertConfig: async () => fakeConfig,
    });

    const ctx = makeCtx({
      _params: { duesConfigId: 'org-1' },
      _body: { defaultAmount: 5000, currency: 'PHP' },
    });

    const response = await upsertDuesConfig(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('config-1');
  });

  test('replaces category overrides when provided', async () => {
    let overridesCaptured = false;
    mocks = stubRepo(DuesRepository, {
      upsertConfig: async () => fakeConfig,
      replaceCategoryOverrides: async () => { overridesCaptured = true; },
    });

    const ctx = makeCtx({
      _params: { duesConfigId: 'org-1' },
      _body: {
        defaultAmount: 5000,
        categoryOverrides: [{ categoryId: 'cat-1', overrideAmount: 3000 }],
      },
    });

    await upsertDuesConfig(ctx);
    expect(overridesCaptured).toBe(true);
  });

  test('replaces reminder schedules when provided', async () => {
    let remindersCaptured = false;
    mocks = stubRepo(DuesRepository, {
      upsertConfig: async () => fakeConfig,
      replaceReminderSchedules: async () => { remindersCaptured = true; },
    });

    const ctx = makeCtx({
      _params: { duesConfigId: 'org-1' },
      _body: {
        defaultAmount: 5000,
        reminderSchedules: [{ daysOffset: -30, templateId: 'tpl-1' }],
      },
    });

    await upsertDuesConfig(ctx);
    expect(remindersCaptured).toBe(true);
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(DuesRepository, {
      upsertConfig: async () => fakeConfig,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { duesConfigId: 'org-1' },
      _body: { defaultAmount: 5000 },
    });

    // session.user.id is accessed for createdBy/updatedBy
    await expect(upsertDuesConfig(ctx)).rejects.toThrow();
  });

  test('uses orgId from route param, not body', async () => {
    let capturedOrgId: string | null = null;
    mocks = stubRepo(DuesRepository, {
      upsertConfig: async (orgId: string) => { capturedOrgId = orgId; return fakeConfig; },
    });

    const ctx = makeCtx({
      _params: { duesConfigId: 'org-route' },
      _body: { defaultAmount: 5000, organizationId: 'org-body-ignored' },
    });

    await upsertDuesConfig(ctx);
    expect(capturedOrgId).toBe('org-route');
  });
});
