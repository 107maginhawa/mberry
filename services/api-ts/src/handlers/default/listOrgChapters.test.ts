import { describe, test, expect } from 'bun:test';
import { listOrgChapters } from './listOrgChapters';
import { UnauthorizedError, ValidationError } from '@/core/errors';

function makeDb(rows: any[]) {
  const chain = {
    selectDistinct: () => chain,
    from: () => chain,
    leftJoin: () => chain,
    where: async () => rows,
  };
  return chain;
}

function makeCtx(opts: {
  hasSession?: boolean;
  orgId?: string | null;
  rows?: any[];
} = {}) {
  const hasSession = opts.hasSession ?? true;
  const orgId = opts.orgId === undefined ? 'org-1' : opts.orgId;
  const db = makeDb(opts.rows ?? []);

  let captured: { data: any; status: number } = { data: null, status: 0 };
  return {
    get: (k: string) => {
      const store: Record<string, any> = {
        session: hasSession ? { userId: 'user-1' } : null,
        organizationId: orgId,
        database: db,
        logger: { info: () => {}, error: () => {}, debug: () => {}, warn: () => {} },
      };
      return store[k];
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  } as any;
}

describe('listOrgChapters', () => {
  test('[AC-ORGCH-001] returns 401 without session', async () => {
    const ctx = makeCtx({ hasSession: false });
    await expect(listOrgChapters(ctx)).rejects.toThrow(UnauthorizedError);
  });

  test('[AC-ORGCH-002] throws ValidationError without orgContext', async () => {
    const ctx = makeCtx({ orgId: null });
    await expect(listOrgChapters(ctx)).rejects.toThrow(ValidationError);
  });

  test('[AC-ORGCH-003] maps distinct rows to public shape', async () => {
    const ctx = makeCtx({
      rows: [
        { chapterId: 'ch-1', chapterName: 'Manila Central' },
        { chapterId: 'ch-2', chapterName: 'Cebu Visayas' },
      ],
    });
    const res = await listOrgChapters(ctx);
    expect(res.status).toBe(200);
    const out = ctx._captured().data.data;
    expect(out).toEqual([
      { id: 'ch-1', chapterId: 'ch-1', chapterName: 'Manila Central' },
      { id: 'ch-2', chapterId: 'ch-2', chapterName: 'Cebu Visayas' },
    ]);
  });

  test('[AC-ORGCH-004] tolerates null chapterName (chapter org row missing)', async () => {
    const ctx = makeCtx({
      rows: [{ chapterId: 'ch-1', chapterName: null }],
    });
    await listOrgChapters(ctx);
    const out = ctx._captured().data.data;
    expect(out[0]).toEqual({ id: 'ch-1', chapterId: 'ch-1', chapterName: undefined });
  });

  test('[AC-ORGCH-005] empty result returns empty data', async () => {
    const ctx = makeCtx({ rows: [] });
    await listOrgChapters(ctx);
    expect(ctx._captured().data).toEqual({ data: [] });
  });
});
