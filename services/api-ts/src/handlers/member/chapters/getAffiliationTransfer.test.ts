import { describe, test, expect, afterEach } from 'bun:test';
import { getAffiliationTransfer } from './getAffiliationTransfer';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { AffiliationTransferRepository } from '@/handlers/association:member/repos/chapters.repo';

// ─── Fixtures ────────────────────────────────────────────

const fakeTransfer = {
  id: 'transfer-1',
  organizationId: 'tenant-1',
  personId: 'user-1',
  fromChapterId: 'chapter-a',
  toChapterId: 'chapter-b',
  requestedAt: new Date('2024-03-01'),
  requestedBy: 'officer-1',
  approvedBySource: null,
  approvedByTarget: null,
  status: 'requested' as const,
  completedAt: null,
};

// ─── Tests ───────────────────────────────────────────────

describe('getAffiliationTransfer', () => {
  afterEach(() => restoreRepo(AffiliationTransferRepository));

  test('happy path — returns 200 with transfer data', async () => {
    stubRepo(AffiliationTransferRepository, {
      findOneById: async () => fakeTransfer,
    });

    const ctx = makeCtx({ _params: { transferId: 'transfer-1' } });
    const res = await getAffiliationTransfer(ctx) as any;

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('transfer-1');
    expect(res.body.fromChapterId).toBe('chapter-a');
    expect(res.body.toChapterId).toBe('chapter-b');
    expect(res.body.status).toBe('requested');
  });

  test('throws NotFoundError when transfer does not exist', async () => {
    stubRepo(AffiliationTransferRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({ _params: { transferId: 'no-such' } });
    await expect(getAffiliationTransfer(ctx)).rejects.toThrow();
  });

  test('throws when no session (unauthorized)', async () => {
    stubRepo(AffiliationTransferRepository, {
      findOneById: async () => fakeTransfer,
    });

    const ctx = makeCtx({ user: null, session: null, _params: { transferId: 'transfer-1' } });
    await expect(getAffiliationTransfer(ctx)).rejects.toThrow();
  });

  test('calls findOneById with correct transferId', async () => {
    let capturedId: string | undefined;
    stubRepo(AffiliationTransferRepository, {
      findOneById: async (id: string) => {
        capturedId = id;
        return fakeTransfer;
      },
    });

    const ctx = makeCtx({ _params: { transferId: 'transfer-1' } });
    await getAffiliationTransfer(ctx);

    expect(capturedId).toBe('transfer-1');
  });
});
