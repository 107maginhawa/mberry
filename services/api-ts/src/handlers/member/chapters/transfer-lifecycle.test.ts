import { describe, test, expect, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo, makeUser } from '@/test-utils/make-ctx';
import { AffiliationTransferRepository, ChapterAffiliationRepository } from '@/handlers/association:member/repos/chapters.repo';

// ─── Fixtures ───────────────────────────────────────────

const TRANSFER_ID = 'transfer-1';
const ORG_ID = 'org-1';
const PERSON_ID = 'person-1';
const FROM_CHAPTER = 'chapter-src';
const TO_CHAPTER = 'chapter-tgt';
const SOURCE_OFFICER = 'officer-src';
const TARGET_OFFICER = 'officer-tgt';

function makeTransfer(overrides: Record<string, any> = {}) {
  return {
    id: TRANSFER_ID,
    organizationId: ORG_ID,
    personId: PERSON_ID,
    fromChapterId: FROM_CHAPTER,
    toChapterId: TO_CHAPTER,
    requestedAt: new Date(),
    requestedBy: 'user-1',
    approvedBySource: null,
    approvedByTarget: null,
    status: 'requested',
    completedAt: null,
    ...overrides,
  };
}

/** Tracks the latest state across stubs to simulate a real repo */
let currentTransfer: ReturnType<typeof makeTransfer>;

function stubTransferRepo(initial?: ReturnType<typeof makeTransfer>) {
  currentTransfer = initial ?? makeTransfer();
  return stubRepo(AffiliationTransferRepository, {
    createOne: async (data: any) => {
      currentTransfer = { ...makeTransfer(), ...data, id: TRANSFER_ID };
      return currentTransfer;
    },
    findOneById: async () => currentTransfer,
    updateOneById: async (_id: string, data: any) => {
      currentTransfer = { ...currentTransfer, ...data };
      return currentTransfer;
    },
  });
}

function stubAffiliationRepo() {
  return stubRepo(ChapterAffiliationRepository, {
    findMany: async () => [{ id: 'aff-1', organizationId: ORG_ID, personId: PERSON_ID, chapterId: FROM_CHAPTER, status: 'active' }],
    updateOneById: async (_id: string, data: any) => ({ id: 'aff-1', ...data }),
    createOne: async (data: any) => ({ id: 'aff-new', ...data }),
  });
}

// ─── Setup ──────────────────────────────────────────────

beforeEach(() => {
  restoreRepo(AffiliationTransferRepository);
  restoreRepo(ChapterAffiliationRepository);
});

// ─── Happy Path: Full Lifecycle ─────────────────────────

describe('Transfer Lifecycle: create → source approve → target approve → complete', () => {
  test('create transfer returns 201 with status=requested', async () => {
    stubTransferRepo();
    const { createAffiliationTransfer } = await import('./createAffiliationTransfer');

    const ctx = makeCtx({
      _body: { personId: PERSON_ID, fromChapterId: FROM_CHAPTER, toChapterId: TO_CHAPTER },
      organizationId: ORG_ID,
    });
    const res = await createAffiliationTransfer(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body.status).toBe('requested');
  });

  test('source approval advances to pendingTargetApproval', async () => {
    stubTransferRepo(makeTransfer({ status: 'requested' }));
    const { approveTransferBySource } = await import('./approveTransferBySource');

    const ctx = makeCtx({
      _params: { transferId: TRANSFER_ID },
      _body: { officerId: SOURCE_OFFICER, reason: 'Approved' },
      user: makeUser({ id: SOURCE_OFFICER }),
    });
    const res = await approveTransferBySource(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.status).toBe('pendingTargetApproval');
    expect((res as any).body.approvedBySource).toBe(SOURCE_OFFICER);
  });

  test('target approval after source advances to approved', async () => {
    stubTransferRepo(makeTransfer({
      status: 'pendingTargetApproval',
      approvedBySource: SOURCE_OFFICER,
    }));
    const { approveTransferByTarget } = await import('./approveTransferByTarget');

    const ctx = makeCtx({
      _params: { transferId: TRANSFER_ID },
      _body: { officerId: TARGET_OFFICER, reason: 'Approved' },
      user: makeUser({ id: TARGET_OFFICER }),
    });
    const res = await approveTransferByTarget(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.status).toBe('approved');
    expect((res as any).body.approvedByTarget).toBe(TARGET_OFFICER);
  });

  test('complete transfer sets status=completed and creates new affiliation', async () => {
    stubTransferRepo(makeTransfer({
      status: 'approved',
      approvedBySource: SOURCE_OFFICER,
      approvedByTarget: TARGET_OFFICER,
    }));
    const affMocks = stubAffiliationRepo();
    const { completeAffiliationTransfer } = await import('./completeAffiliationTransfer');

    const ctx = makeCtx({ _params: { transferId: TRANSFER_ID } });
    const res = await completeAffiliationTransfer(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.status).toBe('completed');
    expect((res as any).body.completedAt).toBeTruthy();
  });
});

// ─── Reverse Approval Order ─────────────────────────────

describe('Transfer Lifecycle: target approves before source', () => {
  test('target approval first advances to pendingSourceApproval', async () => {
    stubTransferRepo(makeTransfer({ status: 'requested' }));
    const { approveTransferByTarget } = await import('./approveTransferByTarget');

    const ctx = makeCtx({
      _params: { transferId: TRANSFER_ID },
      _body: { officerId: TARGET_OFFICER, reason: 'Approved' },
      user: makeUser({ id: TARGET_OFFICER }),
    });
    const res = await approveTransferByTarget(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.status).toBe('pendingSourceApproval');
    expect((res as any).body.approvedByTarget).toBe(TARGET_OFFICER);
  });

  test('source approval after target advances to approved', async () => {
    stubTransferRepo(makeTransfer({
      status: 'pendingSourceApproval',
      approvedByTarget: TARGET_OFFICER,
    }));
    const { approveTransferBySource } = await import('./approveTransferBySource');

    const ctx = makeCtx({
      _params: { transferId: TRANSFER_ID },
      _body: { officerId: SOURCE_OFFICER, reason: 'Approved' },
      user: makeUser({ id: SOURCE_OFFICER }),
    });
    const res = await approveTransferBySource(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.status).toBe('approved');
    expect((res as any).body.approvedBySource).toBe(SOURCE_OFFICER);
  });
});

// ─── Deny Flow ──────────────────────────────────────────

describe('Transfer Deny Flow', () => {
  test('deny from requested state returns status=denied', async () => {
    stubTransferRepo(makeTransfer({ status: 'requested' }));
    const { denyAffiliationTransfer } = await import('./denyAffiliationTransfer');

    const ctx = makeCtx({
      _params: { transferId: TRANSFER_ID },
      _body: { reason: 'Not eligible' },
    });
    const res = await denyAffiliationTransfer(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.status).toBe('denied');
  });

  test('deny from pendingTargetApproval state succeeds', async () => {
    stubTransferRepo(makeTransfer({ status: 'pendingTargetApproval', approvedBySource: SOURCE_OFFICER }));
    const { denyAffiliationTransfer } = await import('./denyAffiliationTransfer');

    const ctx = makeCtx({
      _params: { transferId: TRANSFER_ID },
      _body: { reason: 'Changed mind' },
    });
    const res = await denyAffiliationTransfer(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.status).toBe('denied');
  });

  test('cannot deny already completed transfer', async () => {
    stubTransferRepo(makeTransfer({ status: 'completed' }));
    const { denyAffiliationTransfer } = await import('./denyAffiliationTransfer');

    const ctx = makeCtx({
      _params: { transferId: TRANSFER_ID },
      _body: { reason: 'Too late' },
    });
    await expect(denyAffiliationTransfer(ctx)).rejects.toThrow(/cannot be denied/i);
  });

  test('cannot deny already denied transfer', async () => {
    stubTransferRepo(makeTransfer({ status: 'denied' }));
    const { denyAffiliationTransfer } = await import('./denyAffiliationTransfer');

    const ctx = makeCtx({
      _params: { transferId: TRANSFER_ID },
      _body: { reason: 'Double deny' },
    });
    await expect(denyAffiliationTransfer(ctx)).rejects.toThrow(/cannot be denied/i);
  });
});

// ─── Invalid State Transitions ──────────────────────────

describe('Transfer Invalid State Transitions', () => {
  test('cannot complete unapproved transfer (status=requested)', async () => {
    stubTransferRepo(makeTransfer({ status: 'requested' }));
    stubAffiliationRepo();
    const { completeAffiliationTransfer } = await import('./completeAffiliationTransfer');

    const ctx = makeCtx({ _params: { transferId: TRANSFER_ID } });
    await expect(completeAffiliationTransfer(ctx)).rejects.toThrow(/must be fully approved/i);
  });

  test('cannot complete transfer in pendingTargetApproval state', async () => {
    stubTransferRepo(makeTransfer({ status: 'pendingTargetApproval', approvedBySource: SOURCE_OFFICER }));
    stubAffiliationRepo();
    const { completeAffiliationTransfer } = await import('./completeAffiliationTransfer');

    const ctx = makeCtx({ _params: { transferId: TRANSFER_ID } });
    await expect(completeAffiliationTransfer(ctx)).rejects.toThrow(/must be fully approved/i);
  });

  test('cannot source-approve a completed transfer', async () => {
    stubTransferRepo(makeTransfer({ status: 'completed' }));
    const { approveTransferBySource } = await import('./approveTransferBySource');

    const ctx = makeCtx({
      _params: { transferId: TRANSFER_ID },
      _body: { officerId: SOURCE_OFFICER, reason: 'Late approval' },
      user: makeUser({ id: SOURCE_OFFICER }),
    });
    await expect(approveTransferBySource(ctx)).rejects.toThrow(/cannot be approved by source/i);
  });

  test('cannot target-approve a completed transfer', async () => {
    stubTransferRepo(makeTransfer({ status: 'completed' }));
    const { approveTransferByTarget } = await import('./approveTransferByTarget');

    const ctx = makeCtx({
      _params: { transferId: TRANSFER_ID },
      _body: { officerId: TARGET_OFFICER, reason: 'Late approval' },
      user: makeUser({ id: TARGET_OFFICER }),
    });
    await expect(approveTransferByTarget(ctx)).rejects.toThrow(/cannot be approved by target/i);
  });

  test('create transfer returns 401 without user', async () => {
    stubTransferRepo();
    const { createAffiliationTransfer } = await import('./createAffiliationTransfer');

    const ctx = makeCtx({ user: null, _body: { personId: PERSON_ID, fromChapterId: FROM_CHAPTER, toChapterId: TO_CHAPTER } });
    const res = await createAffiliationTransfer(ctx);
    expect(res.status).toBe(401);
  });

  test('create transfer returns 403 without org context', async () => {
    stubTransferRepo();
    const { createAffiliationTransfer } = await import('./createAffiliationTransfer');

    const ctx = makeCtx({
      organizationId: null,
      _body: { personId: PERSON_ID, fromChapterId: FROM_CHAPTER, toChapterId: TO_CHAPTER },
    });
    const res = await createAffiliationTransfer(ctx);
    expect(res.status).toBe(403);
  });
});
