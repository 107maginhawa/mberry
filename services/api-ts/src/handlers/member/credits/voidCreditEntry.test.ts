import { describe, test, expect, mock } from 'bun:test';

import { voidCreditEntry } from './voidCreditEntry';

const OFFICER_TERM = { positionTitle: 'President' };

function buildMockDb(opts: { updateResult?: any[]; executeThrow?: boolean } = {}) {
  const executeSpy = mock((_s: any) => {
    if (opts.executeThrow) return Promise.reject(new Error('view missing'));
    return Promise.resolve();
  });
  const db = {
    select: (..._a: any[]) => ({
      from: (_t: any) => {
        const chain = {
          limit: (_n: number) => Promise.resolve([OFFICER_TERM]),
          then: (r: any, j?: any) => Promise.resolve([OFFICER_TERM]).then(r, j),
        };
        return {
          where: (_c: any) => chain,
          limit: (_n: number) => Promise.resolve([OFFICER_TERM]),
          then: (r: any, j?: any) => Promise.resolve([OFFICER_TERM]).then(r, j),
          innerJoin: (_t2: any, _c2: any) => ({ where: (_c: any) => chain, ...chain }),
          leftJoin: (_t2: any, _c2: any) => ({ where: (_c: any) => chain, ...chain }),
        };
      },
    }),
    update: (_t: any) => ({
      set: (_v: any) => ({
        where: (_c: any) => ({
          returning: (_f: any) => Promise.resolve(opts.updateResult ?? []),
        }),
      }),
    }),
    execute: executeSpy,
  };
  return { db, executeSpy };
}

function buildMockDbWithSelectSequence(selectResults: any[][]) {
  let selectIdx = 0;
  const executeSpy = mock((_s: any) => Promise.resolve());
  const db = {
    select: (..._a: any[]) => ({
      from: (_t: any) => {
        const idx = selectIdx++;
        const result = idx < selectResults.length ? selectResults[idx] : [];
        const chain = {
          limit: (_n: number) => Promise.resolve(result),
          then: (r: any, j?: any) => Promise.resolve(result).then(r, j),
        };
        return {
          where: (_c: any) => chain,
          limit: (_n: number) => Promise.resolve(result),
          then: (r: any, j?: any) => Promise.resolve(result).then(r, j),
          innerJoin: (_t2: any, _c2: any) => ({ where: (_c: any) => chain, ...chain }),
          leftJoin: (_t2: any, _c2: any) => ({ where: (_c: any) => chain, ...chain }),
        };
      },
    }),
    update: (_t: any) => ({
      set: (_v: any) => ({
        where: (_c: any) => ({
          returning: (_f: any) => Promise.resolve([]),
        }),
      }),
    }),
    execute: executeSpy,
  };
  return { db, executeSpy };
}

function createMockCtx(overrides: {
  session?: any;
  user?: any;
  database?: any;
  organizationId?: string;
  body?: any;
}) {
  const getMap: Record<string, any> = {
    session: 'session' in overrides ? overrides.session : { user: { id: 'user-1' } },
    user: 'user' in overrides ? overrides.user : { id: 'user-1', twoFactorEnabled: true },
    database: overrides.database,
    organizationId: overrides.organizationId ?? 'org-1',
  };
  return {
    get: (key: string) => getMap[key],
    req: {
      param: (_key: string) => '',
      query: (_key: string) => undefined,
      json: () => Promise.resolve(overrides.body ?? {}),
    },
    json: (data: any, status?: number) =>
      new Response(JSON.stringify(data), {
        status: status ?? 200,
        headers: { 'content-type': 'application/json' },
      }),
  } as any;
}

const validBody = {
  activityName: 'Annual Conference',
  personIds: ['person-1', 'person-2'],
  reason: 'Fraudulent attendance record confirmed by committee',
};

describe('voidCreditEntry', () => {
  test('returns 401 when no user', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, session: null, user: null, body: validBody });
    const res = await voidCreditEntry(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no officer terms (wrong position)', async () => {
    const { db } = buildMockDbWithSelectSequence([[]]);
    const ctx = createMockCtx({ database: db, body: validBody });
    const res = await voidCreditEntry(ctx);
    expect(res.status).toBe(403);
  });

  test('throws ValidationError when reason too short', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, body: { ...validBody, reason: 'short' } });
    await expect(voidCreditEntry(ctx)).rejects.toThrow('reason required (min 10 characters)');
  });

  test('throws ValidationError when personIds missing', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, body: { activityName: 'Test', reason: 'Long enough reason here' } });
    await expect(voidCreditEntry(ctx)).rejects.toThrow('activityName and personIds[] required');
  });

  test('throws ValidationError when personIds is empty array', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, body: { ...validBody, personIds: [] } });
    await expect(voidCreditEntry(ctx)).rejects.toThrow('activityName and personIds[] required');
  });

  test('throws NotFoundError when no matching credits to void', async () => {
    const { db } = buildMockDb({ updateResult: [] });
    const ctx = createMockCtx({ database: db, body: validBody });
    await expect(voidCreditEntry(ctx)).rejects.toThrow('No active credits found to revoke');
  });

  test('success: voids credits and returns 200 with voidedCount', async () => {
    const { db, executeSpy } = buildMockDb({ updateResult: [{ id: 'c-1' }, { id: 'c-2' }] });
    const ctx = createMockCtx({ database: db, body: validBody });
    const res = await voidCreditEntry(ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.voidedCount).toBe(2);
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  test('success: handles materialized view refresh failure gracefully', async () => {
    const { db } = buildMockDb({ updateResult: [{ id: 'c-1' }], executeThrow: true });
    const ctx = createMockCtx({ database: db, body: validBody });
    const res = await voidCreditEntry(ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.voidedCount).toBe(1);
  });
});
