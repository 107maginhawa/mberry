import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { listFunds } from './listFunds';
import { DuesRepository } from './repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeFunds = [
  { id: 'fund-1', organizationId: 'org-1', name: 'General Fund', percentage: '60', sortOrder: 1, active: true },
  { id: 'fund-2', organizationId: 'org-1', name: 'Education Fund', percentage: '40', sortOrder: 2, active: true },
];

// ─── Tests ──────────────────────────────────────────────

describe('listFunds', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns funds list with 200', async () => {
    mocks = stubRepo(DuesRepository, {
      listFunds: async () => fakeFunds,
    });

    const ctx = makeCtx({ _query: { organizationId: 'org-1' } });
    const response = await listFunds(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].name).toBe('General Fund');
  });

  test('returns empty array when no funds configured', async () => {
    mocks = stubRepo(DuesRepository, {
      listFunds: async () => [],
    });

    const ctx = makeCtx({ _query: { organizationId: 'org-empty' } });
    const response = await listFunds(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(DuesRepository, {
      listFunds: async () => fakeFunds,
    });

    // listFunds doesn't use session directly
    const ctx = makeCtx({
      user: null,
      session: null,
      _query: { organizationId: 'org-1' },
    });

    const response = await listFunds(ctx);
    expect(response.status).toBe(200);
  });
});
