import { describe, test, expect, mock } from 'bun:test';
import { ValidationError } from '@/core/errors';

import { updateCpdConfig } from './updateCpdConfig';

const OFFICER_TERM = { positionTitle: 'President' };

function createMockCtx(overrides: {
  session?: any;
  user?: any;
  database?: any;
  params?: Record<string, string>;
  body?: any;
}) {
  const getMap: Record<string, any> = {
    session: overrides.session ?? { user: { id: 'user-1' } },
    user: 'user' in overrides ? overrides.user : { id: 'user-1' },
    database: overrides.database,
    organizationId: 'org-1',
  };
  return {
    get: (key: string) => getMap[key],
    req: {
      param: (key: string) => overrides.params?.[key] ?? 'org-1',
      json: () => Promise.resolve(overrides.body ?? {}),
    },
    json: (data: any, status?: number) => new Response(JSON.stringify(data), { status: status ?? 200 }),
  } as any;
}

function buildMockDb(selectResults: any[][] = [], updateReturning: any[] = [], insertReturning: any[] = []) {
  let selectIdx = 0;
  const insertSpy = mock((_v: any) => {});
  const updateSpy = mock((_v: any) => {});
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
        return { returning: () => Promise.resolve(insertReturning) };
      },
    }),
    update: (_t: any) => ({
      set: (v: any) => {
        updateSpy(v);
        return {
          where: (_c: any) => ({
            returning: () => Promise.resolve(updateReturning),
          }),
        };
      },
    }),
  };
  return { db, insertSpy, updateSpy };
}

describe('updateCpdConfig', () => {
  test('updates existing config with partial body', async () => {
    const existing = { id: 'cfg-1', organizationId: 'org-1', requiredCredits: 60 };
    const updated = { ...existing, requiredCredits: 80 };
    const { db, updateSpy } = buildMockDb([[OFFICER_TERM], [existing]], [updated]);
    const ctx = createMockCtx({ database: db, body: { requiredCredits: 80 } });
    const res = await updateCpdConfig(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.requiredCredits).toBe(80);
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  test('creates config if none exists (upsert)', async () => {
    const created = { id: 'cfg-new', organizationId: 'org-1', requiredCredits: 90, cycleLengthYears: 3, sdlCapPercent: 40, cycleStartMonth: 1 };
    const { db, insertSpy } = buildMockDb([[OFFICER_TERM], []], [], [created]);
    const ctx = createMockCtx({ database: db, body: { requiredCredits: 90 } });
    const res = await updateCpdConfig(ctx);
    expect(res.status).toBe(201);
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });

  test('validates requiredCredits > 0', async () => {
    const { db } = buildMockDb([[OFFICER_TERM]]);
    const ctx = createMockCtx({ database: db, body: { requiredCredits: 0 } });
    await expect(updateCpdConfig(ctx)).rejects.toThrow(ValidationError);
  });

  test('validates requiredCredits rejects negative', async () => {
    const { db } = buildMockDb([[OFFICER_TERM]]);
    const ctx = createMockCtx({ database: db, body: { requiredCredits: -5 } });
    await expect(updateCpdConfig(ctx)).rejects.toThrow(ValidationError);
  });

  test('validates cycleLengthYears 1-5', async () => {
    const { db } = buildMockDb([[OFFICER_TERM]]);
    const ctx1 = createMockCtx({ database: db, body: { cycleLengthYears: 0 } });
    expect(updateCpdConfig(ctx1)).rejects.toThrow(ValidationError);
    const { db: db2 } = buildMockDb([[OFFICER_TERM]]);
    const ctx2 = createMockCtx({ database: db2, body: { cycleLengthYears: 6 } });
    expect(updateCpdConfig(ctx2)).rejects.toThrow(ValidationError);
  });

  test('validates sdlCapPercent 0-100', async () => {
    const { db } = buildMockDb([[OFFICER_TERM]]);
    const ctx1 = createMockCtx({ database: db, body: { sdlCapPercent: -1 } });
    expect(updateCpdConfig(ctx1)).rejects.toThrow(ValidationError);
    const { db: db2 } = buildMockDb([[OFFICER_TERM]]);
    const ctx2 = createMockCtx({ database: db2, body: { sdlCapPercent: 101 } });
    expect(updateCpdConfig(ctx2)).rejects.toThrow(ValidationError);
  });

  test('validates cycleStartMonth 1-12', async () => {
    const { db } = buildMockDb([[OFFICER_TERM]]);
    const ctx1 = createMockCtx({ database: db, body: { cycleStartMonth: 0 } });
    expect(updateCpdConfig(ctx1)).rejects.toThrow(ValidationError);
    const { db: db2 } = buildMockDb([[OFFICER_TERM]]);
    const ctx2 = createMockCtx({ database: db2, body: { cycleStartMonth: 13 } });
    expect(updateCpdConfig(ctx2)).rejects.toThrow(ValidationError);
  });
});
