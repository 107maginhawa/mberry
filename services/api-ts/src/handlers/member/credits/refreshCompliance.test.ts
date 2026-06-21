import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { stubRepo } from '@/test-utils/make-ctx';
import { ComplianceRepository } from '@/handlers/association:member/repos/compliance.repo';
import { refreshCompliance } from './refreshCompliance';

const mockRefresh = mock(() => Promise.resolve());

// stubRepo (not mock.module) so the prototype is restored between files. The
// preload-pristine guard restores ComplianceRepository before every test, so the
// stub is (re)installed in beforeEach below (after the guard's restore).

const OFFICER_TERM = { positionTitle: 'President' };

function buildMockDb(selectResults: any[][] = []) {
  let selectIdx = 0;
  const db = {
    select: (..._a: any[]) => ({
      from: (_t: any) => {
        const idx = selectIdx++;
        const result = idx < selectResults.length ? selectResults[idx] : [];
        const chain = {
          limit: (_n: number) => Promise.resolve(result),
          then: (r: any, j?: any) => Promise.resolve(result).then(r, j),
        };
        const whereChain = {
          where: (_c: any) => chain,
          limit: (_n: number) => Promise.resolve(result),
          then: (r: any, j?: any) => Promise.resolve(result).then(r, j),
        };
        return {
          ...whereChain,
          innerJoin: (_t2: any, _c2: any) => whereChain,
          leftJoin: (_t2: any, _c2: any) => whereChain,
        };
      },
    }),
  };
  return { db };
}

function createMockCtx(overrides: {
  session?: any;
  user?: any;
  database?: any;
}) {
  const getMap: Record<string, any> = {
    session: 'session' in overrides ? overrides.session : { user: { id: 'user-1' } },
    user: 'user' in overrides ? overrides.user : { id: 'user-1' },
    database: overrides.database ?? {},
    organizationId: 'org-1',
  };
  return {
    get: (key: string) => getMap[key],
    req: {},
    json: (data: any, status?: number) => new Response(JSON.stringify(data), { status: status ?? 200 }),
  } as any;
}

describe('refreshCompliance', () => {
  beforeEach(() => {
    stubRepo(ComplianceRepository, { refresh: mockRefresh });
    mockRefresh.mockReset();
    mockRefresh.mockImplementation(() => Promise.resolve());
  });

  test('calls refresh and returns success', async () => {
    const { db } = buildMockDb([[OFFICER_TERM]]);
    const ctx = createMockCtx({ database: db });
    const res = await refreshCompliance(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.refreshed).toBe(true);
    expect(body.data.at).toBeDefined();
    expect(typeof body.data.at).toBe('string');
    expect(new Date(body.data.at).toISOString()).toBe(body.data.at);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  test('returns 401 when no user', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, session: null, user: null });
    const res = await refreshCompliance(ctx);
    expect(res.status).toBe(401);
  });
});
