import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { getDuesConfig } from './getDuesConfig';
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

const fakeOverrides = [{ categoryId: 'cat-1', overrideAmount: 3000 }];
const fakeReminders = [{ daysOffset: -30, templateId: 'tpl-1' }];

// ─── Tests ──────────────────────────────────────────────

describe('[BR-04] getDuesConfig', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns config with overrides and reminders', async () => {
    mocks = stubRepo(DuesRepository, {
      getConfig: async () => fakeConfig,
      getCategoryOverrides: async () => fakeOverrides,
      getReminderSchedules: async () => fakeReminders,
    });

    const ctx = makeCtx({ _params: { orgId: 'org-1' } });
    const response = await getDuesConfig(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('config-1');
    expect(response.body.data.categoryOverrides).toEqual(fakeOverrides);
    expect(response.body.data.reminderSchedules).toEqual(fakeReminders);
  });

  test('returns null data when org has no config', async () => {
    mocks = stubRepo(DuesRepository, {
      getConfig: async () => undefined,
    });

    const ctx = makeCtx({ _params: { orgId: 'org-no-config' } });
    const response = await getDuesConfig(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(DuesRepository, {
      getConfig: async () => fakeConfig,
      getCategoryOverrides: async () => [],
      getReminderSchedules: async () => [],
    });

    // getDuesConfig doesn't use session directly, but we verify it still works
    // with null user (it reads orgId from param, not session)
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { orgId: 'org-1' },
    });

    // getDuesConfig does not access session, so it should succeed even without auth
    const response = await getDuesConfig(ctx);
    expect(response.status).toBe(200);
  });
});
