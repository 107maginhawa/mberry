import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { getOfficerTerm } from './getOfficerTerm';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeTerm = {
  id: 'term-1',
  positionId: 'pos-1',
  personId: 'person-1',
  organizationId: 'tenant-1',
  status: 'active',
  startDate: new Date('2025-01-01'),
  endDate: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('getOfficerTerm', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 when no user', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { termId: 'term-1' } });
    const res = await getOfficerTerm(ctx as any);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organizationId', async () => {
    const ctx = makeCtx({ organizationId: '', _params: { termId: 'term-1' } });
    const res = await getOfficerTerm(ctx as any);
    expect(res.status).toBe(403);
  });

  test('happy path — returns term', async () => {
    stubRepo(OfficerTermRepository, {
      findById: async () => fakeTerm,
    });

    const ctx = makeCtx({ _params: { termId: 'term-1' } });
    const res = await getOfficerTerm(ctx as any);

    expect(res.status).toBeUndefined(); // ctx.json called with no status → body only
    expect((res as any).body.id).toBe('term-1');
    expect((res as any).body.organizationId).toBe('tenant-1');
  });

  test('throws NotFoundError when term does not exist', async () => {
    stubRepo(OfficerTermRepository, {
      findById: async () => null,
    });

    const ctx = makeCtx({ _params: { termId: 'missing' } });
    await expect(getOfficerTerm(ctx as any)).rejects.toThrow('Officer term');
  });

  test('throws NotFoundError when term belongs to different org', async () => {
    stubRepo(OfficerTermRepository, {
      findById: async () => ({ ...fakeTerm, organizationId: 'other-org' }),
    });

    const ctx = makeCtx({ organizationId: 'tenant-1', _params: { termId: 'term-1' } });
    await expect(getOfficerTerm(ctx as any)).rejects.toThrow('Officer term');
  });

  test('passes termId to repo.findById', async () => {
    let capturedId: string | undefined;
    stubRepo(OfficerTermRepository, {
      findById: async (id: string) => {
        capturedId = id;
        return { ...fakeTerm, id };
      },
    });

    const ctx = makeCtx({ _params: { termId: 'term-abc' } });
    await getOfficerTerm(ctx as any);

    expect(capturedId).toBe('term-abc');
  });
});
