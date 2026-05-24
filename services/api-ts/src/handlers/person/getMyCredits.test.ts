import { describe, test, expect, mock } from 'bun:test';
import { getMyCredits } from './getMyCredits';

function buildMockDb(selectResponses: any[][] = []) {
  let selectIdx = 0;
  const db = {
    select: (..._a: any[]) => ({
      from: (_t: any) => {
        const idx = selectIdx++;
        const result = idx < selectResponses.length ? selectResponses[idx] : [];
        const w = {
          limit: (_n: number) => Promise.resolve(result),
          then: (r: any, j?: any) => Promise.resolve(result).then(r, j),
        };
        return {
          where: (_c: any) => w,
          leftJoin: (_t2: any, _c2: any) => ({ where: (_c3: any) => w }),
          limit: (_n: number) => Promise.resolve(result),
          then: (r: any, j?: any) => Promise.resolve(result).then(r, j),
        };
      },
    }),
  };
  return { db };
}

function createMockCtx(overrides: {
  session?: any;
  database?: any;
  organizationId?: string;
}) {
  const getMap: Record<string, any> = {
    session: 'session' in overrides ? overrides.session : { user: { id: 'user-1' } },
    database: overrides.database,
    organizationId: overrides.organizationId ?? 'org-1',
  };
  return {
    get: (key: string) => getMap[key],
    req: {
      param: (_key: string) => '',
      query: (_key: string) => undefined,
      json: () => Promise.resolve({}),
    },
    json: (data: any, status?: number) =>
      new Response(JSON.stringify(data), {
        status: status ?? 200,
        headers: { 'content-type': 'application/json' },
      }),
  } as any;
}

describe('getMyCredits', () => {
  test('returns credit summary with correct totals', async () => {
    const { db } = buildMockDb([
      [{ requiredCredits: 60, sdlCapPercent: 40 }], // orgCpdConfig
      [{ totalCredits: 30, generalCredits: 15, majorCredits: 10, sdlCredits: 5, entryCount: 6 }], // aggregate
      [{ id: 'c1', activityName: 'Seminar', creditAmount: 5, category: 'General', sourceType: 'event_checkin', verificationStatus: 'verified', status: 'active', createdAt: new Date() }], // history
    ]);
    const ctx = createMockCtx({ database: db });
    const res = await getMyCredits(ctx);
    const json = await res.json();
    expect(json.data.totalCredits).toBe(30);
    expect(json.data.requiredCredits).toBe(60);
    expect(json.data.entryCount).toBe(6);
  });

  test('returns correct category breakdown', async () => {
    const { db } = buildMockDb([
      [{ requiredCredits: 60, sdlCapPercent: 40 }],
      [{ totalCredits: 30, generalCredits: 15, majorCredits: 10, sdlCredits: 5, entryCount: 3 }],
      [],
    ]);
    const ctx = createMockCtx({ database: db });
    const res = await getMyCredits(ctx);
    const json = await res.json();
    expect(json.data.categoryBreakdown.general).toBe(15);
    expect(json.data.categoryBreakdown.major).toBe(10);
    expect(json.data.categoryBreakdown.selfDirected).toBe(5);
  });

  test('computes compliance percentage correctly (capped at 100)', async () => {
    const { db } = buildMockDb([
      [{ requiredCredits: 50, sdlCapPercent: 40 }],
      [{ totalCredits: 60, generalCredits: 60, majorCredits: 0, sdlCredits: 0, entryCount: 1 }],
      [],
    ]);
    const ctx = createMockCtx({ database: db });
    const res = await getMyCredits(ctx);
    const json = await res.json();
    expect(json.data.compliancePercent).toBe(100);
  });

  test('sets SDL cap exceeded flag when sdlCredits > sdlMax', async () => {
    const { db } = buildMockDb([
      [{ requiredCredits: 60, sdlCapPercent: 40 }], // sdlMax = 24
      [{ totalCredits: 40, generalCredits: 10, majorCredits: 5, sdlCredits: 25, entryCount: 5 }],
      [],
    ]);
    const ctx = createMockCtx({ database: db });
    const res = await getMyCredits(ctx);
    const json = await res.json();
    expect(json.data.sdlCap.exceeded).toBe(true);
    expect(json.data.sdlCap.max).toBe(24);
    expect(json.data.sdlCap.used).toBe(25);
  });

  test('returns mapped history entries', async () => {
    const historyEntry = {
      id: 'c1',
      activityName: 'Workshop',
      provider: 'PDA',
      activityDate: '2025-01-15',
      creditAmount: 8,
      category: 'Major',
      sourceType: 'event_checkin',
      verificationStatus: 'verified',
      status: 'active',
      createdAt: '2025-01-15T00:00:00Z',
    };
    const { db } = buildMockDb([
      [{ requiredCredits: 60, sdlCapPercent: 40 }],
      [{ totalCredits: 8, generalCredits: 0, majorCredits: 8, sdlCredits: 0, entryCount: 1 }],
      [historyEntry],
    ]);
    const ctx = createMockCtx({ database: db });
    const res = await getMyCredits(ctx);
    const json = await res.json();
    expect(json.data.history).toHaveLength(1);
    expect(json.data.history[0].activityName).toBe('Workshop');
    expect(json.data.history[0].creditAmount).toBe(8);
  });

  test('throws UnauthorizedError without session', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, session: null });
    await expect(getMyCredits(ctx)).rejects.toThrow('Unauthorized');
  });
});
