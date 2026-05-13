import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { DuesRepository } from './repos/dues.repo';
import { getDuesDashboard } from './getDuesDashboard';

// Mock requirePosition to isolate handler logic
import { mock } from 'bun:test';

const STATS = {
  totalCollected: '5000',
  totalOutstanding: '2000',
  paidCount: 10,
  unpaidCount: 5,
  overdueCount: 2,
};

describe('getDuesDashboard', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      session: null,
      user: null,
    });
    await expect(getDuesDashboard(ctx as any)).rejects.toThrow();
  });

  test('returns dashboard stats with numeric coercion', async () => {
    mocks = stubRepo(DuesRepository, {
      getDashboardStats: async () => STATS,
    });

    // Mock requirePosition to allow access
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null, // null = no denial
    }));

    // Mock db.select chain for activity count
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      database: {
        select: () => ({
          from: () => ({
            where: async () => [{ count: 3 }],
          }),
        }),
      },
    });

    const res = await getDuesDashboard(ctx as any);
    expect(res.status).toBe(200);

    const body = res.body as any;
    expect(body.data.totalCollected).toBe(5000);
    expect(body.data.totalOutstanding).toBe(2000);
    expect(body.data.upcomingActivities).toBe(3);
  });
});
