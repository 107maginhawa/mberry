import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { requireOfficerTerm, requirePosition } from './officer-checks';
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns

describe('requireOfficerTerm', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    restoreRepo(OfficerTermRepository);
  });

  test('returns null (allows) when officer has active term', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }],
    });
    const ctx = makeCtx({});
    const result = await requireOfficerTerm(ctx as any);
    expect(result).toBeNull();
  });

  test('returns 403 when officer has NO active terms (deactivated)', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const ctx = makeCtx({});
    const result = await requireOfficerTerm(ctx as any);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('returns 401 when no user', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const result = await requireOfficerTerm(ctx as any);
    expect(result!.status).toBe(401);
  });

  test('returns 403 when no org context', async () => {
    const ctx = makeCtx({ organizationId: null, organizationId: null });
    const origGet = ctx.get.bind(ctx);
    ctx.get = (key: string) => key === 'orgId' ? null : origGet(key);
    const result = await requireOfficerTerm(ctx as any);
    expect(result!.status).toBe(403);
  });
});

describe('requirePosition', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    restoreRepo(OfficerTermRepository);
  });

  test('allows when officer has matching position', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }],
    });
    const ctx = makeCtx({});
    const result = await requirePosition(ctx as any, ['Treasurer', 'President']);
    expect(result).toBeNull();
  });

  test('blocks when officer has wrong position', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Secretary' }],
    });
    const ctx = makeCtx({});
    const result = await requirePosition(ctx as any, ['Treasurer', 'President']);
    expect(result!.status).toBe(403);
  });

  test('blocks deactivated officer (no active terms)', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const ctx = makeCtx({});
    const result = await requirePosition(ctx as any, ['Treasurer']);
    expect(result!.status).toBe(403);
  });

  test('case-insensitive position matching (D-08)', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'TREASURER' }],
    });
    const ctx = makeCtx({});
    const result = await requirePosition(ctx as any, ['treasurer']);
    expect(result).toBeNull();
  });
});
