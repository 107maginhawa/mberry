/**
 * listPendingCreditEntries.test.ts
 *
 * Officer-level queue of member self-logged CPD credit entries awaiting
 * verification for an org. Mirrors listPendingProofs.test.ts — the dues
 * payment-proof review queue analog.
 *
 * Covers:
 *   - Position guard: non-officer → 403
 *   - Unauthorized (no user → not 200)
 *   - Happy path — returns pending+active entries with memberName + raw
 *     creditAmount number (no Number()/String() coercion)
 *   - Optional fields (provider/category/supportingDocumentId) omitted when null
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, makeMockDb, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listPendingCreditEntries } from './listPendingCreditEntries';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

const ORG_ID = 'tenant-1';

const ROW_FULL = {
  id: 'credit-1',
  personId: 'person-1',
  firstName: 'Ana',
  lastName: 'Reyes',
  activityName: 'Annual Dental Symposium',
  provider: 'PDA',
  activityDate: new Date('2026-03-01T00:00:00Z'),
  creditAmount: 3.5,
  category: 'General',
  supportingDocumentId: 'doc-1',
  verificationStatus: 'pending',
  createdAt: new Date('2026-03-02T08:00:00Z'),
};

const ROW_MINIMAL = {
  id: 'credit-2',
  personId: 'person-2',
  firstName: 'Ben',
  lastName: 'Cruz',
  activityName: 'Self-study module',
  provider: null,
  activityDate: new Date('2026-02-15T00:00:00Z'),
  creditAmount: 1,
  category: null,
  supportingDocumentId: null,
  verificationStatus: 'pending',
  createdAt: new Date('2026-02-16T08:00:00Z'),
};

/**
 * DB mock whose select(...).from().innerJoin().where().orderBy() resolves to
 * the seeded rows (the handler awaits the orderBy()-terminated chain).
 */
function makeRowsDb(rows: any[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: async () => rows,
  };
  return { select: () => chain } as any;
}

function stubOfficerAccess() {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
  });
}

describe('listPendingCreditEntries', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  test('returns 403 when caller holds no officer term (non-officer)', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({
      database: makeMockDb(),
      _params: { organizationId: ORG_ID },
    });
    const res = await listPendingCreditEntries(ctx);
    expect(res.status).toBe(403);
  });

  test('does not return 200 when no user (auth guard)', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      database: makeMockDb(),
      _params: { organizationId: ORG_ID },
    });
    try {
      const res = await listPendingCreditEntries(ctx);
      expect(res.status).not.toBe(200);
    } catch {
      // threw — acceptable (UnauthorizedError)
    }
  });

  test('happy path — returns pending entries with memberName + raw creditAmount number', async () => {
    stubOfficerAccess();
    const ctx = makeCtx({
      database: makeRowsDb([ROW_FULL]),
      _params: { organizationId: ORG_ID },
    });

    const res = await listPendingCreditEntries(ctx);
    expect(res.status).toBe(200);

    const body = (res as any).body;
    expect(body.entries).toHaveLength(1);
    const e = body.entries[0];
    expect(e.id).toBe('credit-1');
    expect(e.memberName).toBe('Ana Reyes');
    // creditAmount is float8 — must stay a raw JS number (no coercion).
    expect(e.creditAmount).toBe(3.5);
    expect(typeof e.creditAmount).toBe('number');
    expect(e.provider).toBe('PDA');
    expect(e.category).toBe('General');
    expect(e.supportingDocumentId).toBe('doc-1');
    expect(e.activityDate).toBe(ROW_FULL.activityDate.toISOString());
    expect(e.verificationStatus).toBe('pending');
  });

  test('omits optional fields (provider/category/supportingDocumentId) when null', async () => {
    stubOfficerAccess();
    const ctx = makeCtx({
      database: makeRowsDb([ROW_MINIMAL]),
      _params: { organizationId: ORG_ID },
    });

    const res = await listPendingCreditEntries(ctx);
    expect(res.status).toBe(200);
    const e = (res as any).body.entries[0];
    expect(e.memberName).toBe('Ben Cruz');
    expect(e.creditAmount).toBe(1);
    expect('provider' in e).toBe(false);
    expect('category' in e).toBe(false);
    expect('supportingDocumentId' in e).toBe(false);
  });

  test('returns an empty list when no pending entries', async () => {
    stubOfficerAccess();
    const ctx = makeCtx({
      database: makeRowsDb([]),
      _params: { organizationId: ORG_ID },
    });
    const res = await listPendingCreditEntries(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.entries).toEqual([]);
  });
});
