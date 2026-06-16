// Acceptance Criteria: [AC-M10-005]
import { describe, test, expect, mock, spyOn } from 'bun:test';

import { adjustCreditEntry } from './adjustCreditEntry';
import { domainEvents } from '@/core/domain-events';

const OFFICER_TERM = { positionTitle: 'President' };
const ORG_CONFIG = { cycleStartMonth: 1, cycleLengthYears: 3, requiredCredits: 60, sdlCapPercent: 40 };

function buildMockDb(opts: { insertResult?: any[]; insertThrows?: any; executeThrow?: boolean } = {}) {
  const executeSpy = mock((_s: any) => {
    if (opts.executeThrow) return Promise.reject(new Error('view missing'));
    return Promise.resolve();
  });
  let selectCallIdx = 0;
  const db = {
    select: (..._a: any[]) => ({
      from: (_t: any) => {
        const idx = selectCallIdx++;
        const result = idx === 0 ? [OFFICER_TERM] : [ORG_CONFIG];
        const chain: any = {
          limit: (_n: number) => Promise.resolve(result),
          then: (r: any, j?: any) => Promise.resolve(result).then(r, j),
        };
        chain.where = (_c: any) => chain;
        chain.innerJoin = (_t2: any, _c2: any) => chain;
        chain.leftJoin = (_t2: any, _c2: any) => chain;
        return chain;
      },
    }),
    insert: (_t: any) => ({
      values: (_v: any) => ({
        returning: () => {
          if (opts.insertThrows) return Promise.reject(opts.insertThrows);
          return Promise.resolve(opts.insertResult ?? [{ id: 'credit-1', creditAmount: 5 }]);
        },
      }),
    }),
    execute: executeSpy,
  };
  return { db, executeSpy };
}

function buildMockDbNonOfficer() {
  const db = {
    select: (..._a: any[]) => ({
      from: (_t: any) => {
        const chain: any = {
          limit: (_n: number) => Promise.resolve([]),
          then: (r: any, j?: any) => Promise.resolve([]).then(r, j),
        };
        chain.where = (_c: any) => chain;
        chain.innerJoin = (_t2: any, _c2: any) => chain;
        chain.leftJoin = (_t2: any, _c2: any) => chain;
        return chain;
      },
    }),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
    execute: mock(() => Promise.resolve()),
  };
  return { db };
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
  personId: '11111111-1111-1111-1111-111111111111',
  creditAmount: 5,
  reason: 'Conference attendance verified via signed attendance sheet',
};

describe('adjustCreditEntry [AC-M10-005]', () => {
  test('[AC-M10-005] returns 401 when no session', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, session: null, user: null, body: validBody });
    const res = await adjustCreditEntry(ctx);
    expect(res.status).toBe(401);
  });

  test('[AC-M10-005] returns 403 when not officer', async () => {
    const { db } = buildMockDbNonOfficer();
    const ctx = createMockCtx({ database: db, body: validBody });
    const res = await adjustCreditEntry(ctx);
    expect(res.status).toBe(403);
  });

  test('[AC-M10-005] throws ValidationError when reason missing', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, body: { personId: validBody.personId, creditAmount: 5 } });
    await expect(adjustCreditEntry(ctx)).rejects.toThrow('reason required');
  });

  test('[AC-M10-005] throws ValidationError when reason empty string', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, body: { ...validBody, reason: '' } });
    await expect(adjustCreditEntry(ctx)).rejects.toThrow('reason required');
  });

  test('[AC-M10-005] throws ValidationError when reason is whitespace only', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, body: { ...validBody, reason: '          ' } });
    await expect(adjustCreditEntry(ctx)).rejects.toThrow('reason required');
  });

  test('[AC-M10-005] throws ValidationError when reason < 10 chars', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, body: { ...validBody, reason: 'too short' } });
    await expect(adjustCreditEntry(ctx)).rejects.toThrow('reason required (min 10 characters)');
  });

  test('throws ValidationError when personId missing', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, body: { creditAmount: 5, reason: validBody.reason } });
    await expect(adjustCreditEntry(ctx)).rejects.toThrow('personId');
  });

  test('throws ValidationError when creditAmount missing', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, body: { personId: validBody.personId, reason: validBody.reason } });
    await expect(adjustCreditEntry(ctx)).rejects.toThrow('creditAmount');
  });

  test('throws ValidationError when creditAmount is zero', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, body: { ...validBody, creditAmount: 0 } });
    await expect(adjustCreditEntry(ctx)).rejects.toThrow('creditAmount');
  });

  test('throws ValidationError when creditAmount is non-numeric', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, body: { ...validBody, creditAmount: 'five' } });
    await expect(adjustCreditEntry(ctx)).rejects.toThrow('creditAmount');
  });

  test('success: creates adjusted credit entry, returns 201 with data', async () => {
    const { db } = buildMockDb({ insertResult: [{ id: 'credit-9', creditAmount: 5, type: 'manual' }] });
    const ctx = createMockCtx({ database: db, body: validBody });
    const res = await adjustCreditEntry(ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe('credit-9');
  });

  test('success: allows negative creditAmount for deduction', async () => {
    const { db } = buildMockDb({ insertResult: [{ id: 'credit-10', creditAmount: -3 }] });
    const ctx = createMockCtx({ database: db, body: { ...validBody, creditAmount: -3 } });
    const res = await adjustCreditEntry(ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.creditAmount).toBe(-3);
  });

  test('success: trims reason and stores in attestation', async () => {
    const insertCalls: any[] = [];
    const db: any = {
      select: () => ({
        from: () => {
          const chain: any = {
            limit: () => Promise.resolve([OFFICER_TERM]),
            then: (r: any, j?: any) => Promise.resolve([OFFICER_TERM]).then(r, j),
          };
          chain.where = () => chain;
          chain.innerJoin = () => chain;
          chain.leftJoin = () => chain;
          return chain;
        },
      }),
      insert: () => ({
        values: (v: any) => {
          insertCalls.push(v);
          return { returning: () => Promise.resolve([{ id: 'credit-11', ...v }]) };
        },
      }),
      execute: mock(() => Promise.resolve()),
    };
    // first select = officer, second = orgConfig
    let i = 0;
    db.select = () => ({
      from: () => {
        const idx = i++;
        const result = idx === 0 ? [OFFICER_TERM] : [ORG_CONFIG];
        const chain: any = {
          limit: () => Promise.resolve(result),
          then: (r: any, j?: any) => Promise.resolve(result).then(r, j),
        };
        chain.where = () => chain;
        chain.innerJoin = () => chain;
        chain.leftJoin = () => chain;
        return chain;
      },
    });
    const ctx = createMockCtx({ database: db, body: { ...validBody, reason: '   Conference attendance verified via signed sheet   ' } });
    await adjustCreditEntry(ctx);
    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0].attestation).toBeDefined();
    expect(insertCalls[0].attestation.adjustmentReason).toBe('Conference attendance verified via signed sheet');
  });

  test('defers compliance matview refresh off the request path (emits, does not await db.execute)', async () => {
    const { db, executeSpy } = buildMockDb();
    const emitSpy = spyOn(domainEvents, 'emit').mockResolvedValue(undefined);
    try {
      const ctx = createMockCtx({ database: db, body: validBody });
      const res = await adjustCreditEntry(ctx);
      expect(res.status).toBe(201);
      // Refresh is no longer run inline on the request path.
      expect(executeSpy).not.toHaveBeenCalled();
      // It is dispatched as a fire-and-forget domain event instead.
      expect(emitSpy).toHaveBeenCalledWith('compliance.recompute', expect.objectContaining({ reason: 'adjustment' }));
    } finally {
      emitSpy.mockRestore();
    }
  });

  test('refresh dispatch failure does not fail the request', async () => {
    const { db } = buildMockDb();
    const emitSpy = spyOn(domainEvents, 'emit').mockRejectedValue(new Error('bus down'));
    try {
      const ctx = createMockCtx({ database: db, body: validBody });
      const res = await adjustCreditEntry(ctx);
      expect(res.status).toBe(201);
    } finally {
      emitSpy.mockRestore();
    }
  });

  test('throws ConflictError on duplicate idempotency key', async () => {
    const dupErr: any = new Error('duplicate'); dupErr.code = '23505';
    const { db } = buildMockDb({ insertThrows: dupErr });
    const ctx = createMockCtx({ database: db, body: { ...validBody, idempotencyKey: 'dup-key-1' } });
    await expect(adjustCreditEntry(ctx)).rejects.toThrow('already');
  });
});
