import { describe, test, expect, mock } from 'bun:test';

import { getCpdConfig } from './getCpdConfig';

const OFFICER_TERM = { positionTitle: 'President' };

function createMockCtx(overrides: {
  session?: any;
  user?: any;
  database?: any;
  organizationId?: string;
  params?: Record<string, string>;
}) {
  const getMap: Record<string, any> = {
    session: 'session' in overrides ? overrides.session : { user: { id: 'user-1' } },
    user: 'user' in overrides ? overrides.user : { id: 'user-1' },
    database: overrides.database,
    organizationId: overrides.organizationId ?? 'org-1',
  };
  return {
    get: (key: string) => getMap[key],
    req: {
      param: (key: string) => overrides.params?.[key] ?? 'org-1',
    },
    json: (data: any, status?: number) => new Response(JSON.stringify(data), { status: status ?? 200 }),
  } as any;
}

function buildMockDb(selectResults: any[][] = [], insertReturning: any[] = []) {
  let selectIdx = 0;
  const insertSpy = mock((_v: any) => {});
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
    insert: (_t: any) => ({
      values: (v: any) => {
        insertSpy(v);
        return {
          returning: () => Promise.resolve(insertReturning),
        };
      },
    }),
  };
  return { db, insertSpy };
}

describe('getCpdConfig', () => {
  test('returns existing config when found', async () => {
    const existing = { id: 'cfg-1', organizationId: 'org-1', requiredCredits: 80, cycleLengthYears: 2, sdlCapPercent: 50, cycleStartMonth: 6 };
    const { db } = buildMockDb([[OFFICER_TERM], [existing]]);
    const ctx = createMockCtx({ database: db });
    const res = await getCpdConfig(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.requiredCredits).toBe(80);
    expect(body.data.cycleLengthYears).toBe(2);
  });

  test('creates default config on first access (lazy init)', async () => {
    const defaultConfig = { id: 'cfg-new', organizationId: 'org-1', requiredCredits: 60, cycleLengthYears: 3, sdlCapPercent: 40, cycleStartMonth: 1 };
    const { db, insertSpy } = buildMockDb([[OFFICER_TERM], []], [defaultConfig]);
    const ctx = createMockCtx({ database: db });
    const res = await getCpdConfig(ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.requiredCredits).toBe(60);
    expect(body.data.cycleLengthYears).toBe(3);
    expect(body.data.sdlCapPercent).toBe(40);
    expect(body.data.cycleStartMonth).toBe(1);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const insertedValues = insertSpy.mock.calls[0][0];
    expect(insertedValues.requiredCredits).toBe(60);
    expect(insertedValues.cycleLengthYears).toBe(3);
    expect(insertedValues.sdlCapPercent).toBe(40);
    expect(insertedValues.cycleStartMonth).toBe(1);
  });

  test('returns 401 when no user', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, session: null, user: null });
    const res = await getCpdConfig(ctx);
    expect(res.status).toBe(401);
  });
});
