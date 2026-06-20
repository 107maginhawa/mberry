/**
 * rejectCreditEntry.test.ts
 *
 * Officer rejects a member self-logged CPD credit entry sitting at
 * verification_status='pending', with an optional reason. Mirrors
 * rejectPaymentProof.test.ts — the dues payment-proof review analog.
 *
 * Covers:
 *   - Unauthorized (no session → throws)
 *   - NotFound (entry missing → throws)
 *   - Position guard: non-officer → 403
 *   - Cross-org officer → 403 (org derived from the loaded entry, not the path)
 *   - Status guard: non-pending entry → 409 (ConflictError)
 *   - Happy path with reason: flips to 'rejected', persists reason into
 *     attestation, emits compliance.recompute, 200
 *   - Happy path without reason: rejection still succeeds (reason ignored
 *     gracefully)
 */
import { describe, test, expect, afterEach, beforeEach, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { rejectCreditEntry } from './rejectCreditEntry';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';

// ─── Fixtures ───────────────────────────────────────────

const ENTRY_ID = 'credit-1';

function makeEntry(overrides: Record<string, any> = {}) {
  return {
    id: ENTRY_ID,
    personId: 'person-1',
    organizationId: 'tenant-1',
    activityName: 'Annual Dental Symposium',
    provider: 'PDA',
    activityDate: new Date('2026-03-01T00:00:00Z'),
    creditAmount: 3.5,
    category: 'General',
    supportingDocumentId: 'doc-1',
    verificationStatus: 'pending',
    status: 'active',
    attestation: null,
    createdAt: new Date('2026-03-02T08:00:00Z'),
    ...overrides,
  };
}

function makeEntryDb(entry: any) {
  return {
    select: () => {
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: async () => (entry ? [entry] : []),
      };
      return chain;
    },
    update: () => ({
      set: (data: any) => ({
        where: () => ({ returning: async () => [{ ...entry, ...data }] }),
      }),
    }),
  } as any;
}

function stubOfficerAccess() {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
  });
}

describe('rejectCreditEntry', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      database: makeEntryDb(makeEntry()),
      _params: { creditEntryId: ENTRY_ID },
      _body: { reason: 'x' },
    });
    await expect(rejectCreditEntry(ctx)).rejects.toThrow();
  });

  test('throws NotFoundError when entry missing', async () => {
    stubOfficerAccess();
    const ctx = makeCtx({
      database: makeEntryDb(null),
      _params: { creditEntryId: 'missing' },
      _body: { reason: 'x' },
    });
    await expect(rejectCreditEntry(ctx)).rejects.toThrow('CreditEntry');
  });

  test('returns 403 when caller holds no officer term (non-officer)', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({
      database: makeEntryDb(makeEntry()),
      _params: { creditEntryId: ENTRY_ID },
      _body: { reason: 'x' },
    });
    const res = await rejectCreditEntry(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 403 for an officer of a different org (org derived from entry)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async (_personId: string, orgId: string) =>
        orgId === 'tenant-1' ? [] : [{ positionTitle: 'President' }],
    });
    const ctx = makeCtx({
      database: makeEntryDb(makeEntry({ organizationId: 'tenant-1' })),
      _params: { creditEntryId: ENTRY_ID },
      _body: { reason: 'x' },
    });
    const res = await rejectCreditEntry(ctx);
    expect(res.status).toBe(403);
  });

  test('throws ConflictError (409) when entry is not pending', async () => {
    stubOfficerAccess();
    const ctx = makeCtx({
      database: makeEntryDb(makeEntry({ verificationStatus: 'rejected' })),
      _params: { creditEntryId: ENTRY_ID },
      _body: { reason: 'x' },
    });
    await expect(rejectCreditEntry(ctx)).rejects.toThrow("Must be 'pending'");
  });

  test('happy path with reason: flips to rejected, persists reason in attestation, emits (200)', async () => {
    stubOfficerAccess();
    const emitSpy = spyOn(domainEvents, 'emit').mockResolvedValue(undefined as any);
    const ctx = makeCtx({
      database: makeEntryDb(makeEntry()),
      _params: { creditEntryId: ENTRY_ID },
      _body: { reason: 'Provider not accredited' },
    });

    const res = await rejectCreditEntry(ctx);
    expect(res.status).toBe(200);

    const body = (res as any).body;
    expect(body.data.verificationStatus).toBe('rejected');
    expect(body.data.updatedBy).toBe('user-1');
    expect(body.data.attestation).toMatchObject({
      rejectionReason: 'Provider not accredited',
      rejectedBy: 'user-1',
    });

    const call = emitSpy.mock.calls.find((c) => c[0] === 'compliance.recompute');
    expect(call).toBeDefined();
    expect(call?.[1]).toMatchObject({ organizationId: 'tenant-1', reason: 'credit_rejected' });
    emitSpy.mockRestore();
  });

  test('happy path without reason: rejection still succeeds (reason ignored gracefully)', async () => {
    stubOfficerAccess();
    const emitSpy = spyOn(domainEvents, 'emit').mockResolvedValue(undefined as any);
    const ctx = makeCtx({
      database: makeEntryDb(makeEntry()),
      _params: { creditEntryId: ENTRY_ID },
      _body: {},
    });

    const res = await rejectCreditEntry(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data.verificationStatus).toBe('rejected');
    // No reason supplied → attestation untouched (stays null), never blocks.
    expect(body.data.attestation).toBeNull();
    emitSpy.mockRestore();
  });
});
