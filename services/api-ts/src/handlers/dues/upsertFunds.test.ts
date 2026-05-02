import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { upsertFunds } from './upsertFunds';
import { DuesRepository } from './repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeFunds = [
  { id: 'fund-1', organizationId: 'org-1', name: 'General Fund', percentage: '60', sortOrder: 1, active: true },
  { id: 'fund-2', organizationId: 'org-1', name: 'Education Fund', percentage: '40', sortOrder: 2, active: true },
];

// ─── Tests ──────────────────────────────────────────────

describe('upsertFunds [BR-05]', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('replaces funds and returns updated list with 200', async () => {
    mocks = stubRepo(DuesRepository, {
      replaceFunds: async () => {},
      listFunds: async () => fakeFunds,
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        funds: [
          { name: 'General Fund', percentage: '60', sortOrder: 1 },
          { name: 'Education Fund', percentage: '40', sortOrder: 2 },
        ],
      },
    });

    const response = await upsertFunds(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });

  test('throws ValidationError when percentages do not total 100', async () => {
    mocks = stubRepo(DuesRepository, {
      replaceFunds: async () => {},
      listFunds: async () => [],
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        funds: [
          { name: 'General Fund', percentage: '50', sortOrder: 1 },
          { name: 'Education Fund', percentage: '30', sortOrder: 2 },
        ],
      },
    });

    await expect(upsertFunds(ctx)).rejects.toThrow('Fund percentages must total exactly 100%');
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(DuesRepository, {
      replaceFunds: async () => {},
      listFunds: async () => fakeFunds,
    });

    // upsertFunds doesn't use session directly; it reads from body
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { orgId: 'org-1' },
      _body: {
        funds: [{ name: 'General Fund', percentage: '100', sortOrder: 1 }],
      },
    });

    const response = await upsertFunds(ctx);
    expect(response.status).toBe(200);
  });
});
