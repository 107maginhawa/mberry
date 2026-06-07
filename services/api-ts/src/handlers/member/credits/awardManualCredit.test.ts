import { describe, test, expect, mock } from 'bun:test';

import { awardManualCredit } from './awardManualCredit';

const OFFICER_TERM = { positionTitle: 'President' };

function buildMockDb(
  selectResponses: any[][] = [],
  insertBehavior: 'success' | 'duplicate' = 'success'
) {
  let selectIdx = 0;
  const insertSpy = mock((_v: any) => {});
  const executeSpy = mock((_s: any) => Promise.resolve());
  const db = {
    select: (..._a: any[]) => ({
      from: (_t: any) => {
        const idx = selectIdx++;
        const result = idx < selectResponses.length ? selectResponses[idx] : [];
        const w = {
          limit: (_n: number) => Promise.resolve(result),
          then: (r: any, j?: any) => Promise.resolve(result).then(r, j),
        };
        const whereChain = {
          where: (_c: any) => w,
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
        if (insertBehavior === 'duplicate') {
          const e: any = new Error('uq_credit_source_person');
          e.code = '23505';
          return { returning: () => Promise.reject(e) };
        }
        return { returning: () => Promise.resolve([{ id: 'credit-1', ...v }]) };
      },
    }),
    execute: executeSpy,
  };
  return { db, insertSpy, executeSpy };
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
    user: 'user' in overrides ? overrides.user : { id: 'user-1' },
    database: overrides.database,
    organizationId: overrides.organizationId ?? 'org-1',
    jobs: null,
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
  personId: 'person-1',
  activityName: 'Annual Conference',
  activityDate: '2025-06-15',
  creditAmount: 5,
  idempotencyKey: 'idem-1',
  category: 'General',
  cpdActivityType: 'seminar',
};

describe('awardManualCredit', () => {
  test('creates credit entry with correct fields and returns 201', async () => {
    const { db, insertSpy } = buildMockDb([
      [OFFICER_TERM],
      [{ cycleStartMonth: 1, cycleLengthYears: 3, requiredCredits: 60, sdlCapPercent: 40 }],
    ]);
    const ctx = createMockCtx({ database: db, body: validBody });
    const res = await awardManualCredit(ctx);
    expect(res.status).toBe(201);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const json = await res.json();
    expect(json.data.personId).toBe('person-1');
    expect(json.data.activityName).toBe('Annual Conference');
    expect(json.data.creditAmount).toBe(5);
  });

  test('throws ValidationError when required fields missing', async () => {
    const { db } = buildMockDb([[OFFICER_TERM]]);
    const ctx = createMockCtx({ database: db, body: { personId: 'p1' } });
    await expect(awardManualCredit(ctx)).rejects.toThrow('personId, activityName, activityDate, creditAmount, idempotencyKey required');
  });

  test('throws ValidationError when creditAmount is 0 (falsy)', async () => {
    const { db } = buildMockDb([[OFFICER_TERM]]);
    const ctx = createMockCtx({
      database: db,
      body: { ...validBody, creditAmount: 0 },
    });
    await expect(awardManualCredit(ctx)).rejects.toThrow('personId, activityName, activityDate, creditAmount, idempotencyKey required');
  });

  test('throws ValidationError when creditAmount is negative', async () => {
    const { db } = buildMockDb([[OFFICER_TERM]]);
    const ctx = createMockCtx({
      database: db,
      body: { ...validBody, creditAmount: -5 },
    });
    await expect(awardManualCredit(ctx)).rejects.toThrow('creditAmount must be positive');
  });

  test('throws ConflictError on duplicate idempotency key', async () => {
    const { db } = buildMockDb(
      [
        [OFFICER_TERM],
        [{ cycleStartMonth: 1, cycleLengthYears: 3, requiredCredits: 60, sdlCapPercent: 40 }],
      ],
      'duplicate'
    );
    const ctx = createMockCtx({ database: db, body: validBody });
    try {
      await awardManualCredit(ctx);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.message).toContain('Credit already awarded with this idempotency key');
    }
  });

  test('returns SDL cap warning when Self-Directed exceeds limit', async () => {
    const sdlBody = { ...validBody, category: 'Self-Directed', creditAmount: 20 };
    const { db } = buildMockDb([
      [OFFICER_TERM],
      [{ cycleStartMonth: 1, cycleLengthYears: 3, requiredCredits: 60, sdlCapPercent: 40 }],
      [{ total: 10 }],
      [{ cycleStartMonth: 1, cycleLengthYears: 3, requiredCredits: 60, sdlCapPercent: 40 }],
    ]);
    const ctx = createMockCtx({ database: db, body: sdlBody });
    const res = await awardManualCredit(ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.warning).toContain('SDL cap exceeded');
    expect(json.warning).toContain('30/24');
  });

  test('computes correct cycle boundaries', async () => {
    const { db, insertSpy } = buildMockDb([
      [OFFICER_TERM],
      [{ cycleStartMonth: 7, cycleLengthYears: 2, requiredCredits: 40, sdlCapPercent: 40 }],
    ]);
    const body = { ...validBody, activityDate: '2024-03-15' };
    const ctx = createMockCtx({ database: db, body });
    await awardManualCredit(ctx);
    const insertedValues = insertSpy.mock.calls[0][0];
    expect(insertedValues.cycleStart).toEqual(new Date(2022, 6, 1));
    expect(insertedValues.cycleEnd).toEqual(new Date(2024, 6, 1));
  });

  test('returns 401 when no user', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, session: null, user: null, body: validBody });
    const res = await awardManualCredit(ctx);
    expect(res.status).toBe(401);
  });
});
