import { describe, test, expect } from 'bun:test';
import { listMemberCreditsForPeer } from './listMemberCreditsForPeer';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';

// Capture the filters passed to the underlying findMany so tests can assert
// the query is always org-scoped (no cross-tenant widening).
let lastFindManyFilters: any = null;

function stubRepo(returns: any[]) {
  const orig = (CreditEntryRepository.prototype as any).findMany;
  lastFindManyFilters = null;
  (CreditEntryRepository.prototype as any).findMany = async (filters: any) => {
    lastFindManyFilters = filters;
    return returns;
  };
  return () => {
    (CreditEntryRepository.prototype as any).findMany = orig;
  };
}

function makeCtx(opts: {
  hasSession?: boolean;
  personId?: string | null;
  orgId?: string | null;
} = {}) {
  const hasSession = opts.hasSession ?? true;
  const personId = opts.personId === undefined ? 'person-2' : opts.personId;
  // Distinguish "caller did not specify" (default org) from an explicit
  // absent/null org context (cross-org leak scenario).
  const orgId = opts.orgId === undefined ? 'org-1' : opts.orgId;

  let captured: { data: any; status: number } = { data: null, status: 0 };
  return {
    get: (key: string) => {
      const store: Record<string, any> = {
        session: hasSession ? { userId: 'user-1' } : null,
        organizationId: orgId,
        database: {},
        logger: { info: () => {}, error: () => {}, debug: () => {}, warn: () => {} },
      };
      return store[key];
    },
    req: {
      valid: (t: string) => (t === 'query' ? { personId } : {}),
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  } as any;
}

describe('listMemberCreditsForPeer', () => {
  test('[AC-PEER-001] returns 401 without session', async () => {
    const ctx = makeCtx({ hasSession: false });
    await expect(listMemberCreditsForPeer(ctx)).rejects.toThrow(UnauthorizedError);
  });

  test('[AC-PEER-002] throws ValidationError without personId', async () => {
    const ctx = makeCtx({ personId: '' });
    await expect(listMemberCreditsForPeer(ctx)).rejects.toThrow(ValidationError);
  });

  test('[AC-PEER-003] maps creditAmount + activityDate to public shape', async () => {
    const ts = new Date('2026-05-15T00:00:00Z');
    const restore = stubRepo([
      { creditAmount: 5, activityName: 'Cardio Workshop', activityDate: ts },
      { creditAmount: 3, activityName: 'Pediatrics CME', activityDate: ts },
    ]);
    try {
      const ctx = makeCtx({ personId: 'person-2' });
      const res = await listMemberCreditsForPeer(ctx);
      expect(res.status).toBe(200);
      const out = ctx._captured().data.data;
      expect(out).toEqual([
        { credits: 5, courseTitle: 'Cardio Workshop', earnedAt: ts.toISOString() },
        { credits: 3, courseTitle: 'Pediatrics CME', earnedAt: ts.toISOString() },
      ]);
    } finally {
      restore();
    }
  });

  test('[AC-PEER-004] empty result returns empty data array', async () => {
    const restore = stubRepo([]);
    try {
      const ctx = makeCtx({ personId: 'person-2' });
      const res = await listMemberCreditsForPeer(ctx);
      expect(res.status).toBe(200);
      expect(ctx._captured().data).toEqual({ data: [] });
    } finally {
      restore();
    }
  });

  // P1 cross-org data leak regression guards.
  test('[AC-PEER-005] rejects when org context is absent (no cross-org leak)', async () => {
    // findMany would return cross-org rows if ever reached without an org
    // filter — assert the handler fails closed before any query runs.
    const restore = stubRepo([
      { creditAmount: 9, activityName: 'Other Org Activity', activityDate: new Date() },
    ]);
    try {
      const ctx = makeCtx({ personId: 'person-2', orgId: null });
      await expect(listMemberCreditsForPeer(ctx)).rejects.toThrow(ValidationError);
      // The query must never have executed without an org scope.
      expect(lastFindManyFilters).toBeNull();
    } finally {
      restore();
    }
  });

  test('[AC-PEER-006] scopes the query to the caller org when present', async () => {
    const restore = stubRepo([
      { creditAmount: 4, activityName: 'In-Org Activity', activityDate: new Date() },
    ]);
    try {
      const ctx = makeCtx({ personId: 'person-2', orgId: 'org-42' });
      const res = await listMemberCreditsForPeer(ctx);
      expect(res.status).toBe(200);
      // Org filter is always present and equals the caller's org.
      expect(lastFindManyFilters).toMatchObject({
        organizationId: 'org-42',
        personId: 'person-2',
      });
      expect(lastFindManyFilters.organizationId).toBeTruthy();
    } finally {
      restore();
    }
  });
});
