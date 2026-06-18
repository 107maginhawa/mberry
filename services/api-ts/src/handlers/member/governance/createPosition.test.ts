import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createPosition } from './createPosition';
import { PositionRepository } from '@/handlers/association:member/repos/governance.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakePosition = {
  id: 'pos-1',
  organizationId: 'tenant-1',
  title: 'Vice President',
  description: 'Deputy leader',
  level: 1,
  termLengthMonths: 12,
  maxTerms: 2,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Default: user is President (passes requirePosition gate)
function stubPresidentAccess() {
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }],
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('createPosition', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(PositionRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(PositionRepository);
  });

  test('returns 401 when requirePosition finds no user', async () => {
    // requirePosition returns 401 if no user
    const ctx = makeCtx({
      user: null,
      session: null,
      _body: { title: 'VP', level: 1, termLengthMonths: 12 },
    });
    const res = await createPosition(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when user is not a President', async () => {
    // Non-officer (no active terms with President title)
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Secretary' }],
    });

    const ctx = makeCtx({
      _body: { title: 'VP', level: 1, termLengthMonths: 12 },
    });
    const res = await createPosition(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 403 when user has no officer terms', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });

    const ctx = makeCtx({
      _body: { title: 'VP', level: 1, termLengthMonths: 12 },
    });
    const res = await createPosition(ctx);
    expect(res.status).toBe(403);
  });

  test('happy path — creates position and returns 201', async () => {
    stubPresidentAccess();
    stubRepo(PositionRepository, {
      create: async () => fakePosition,
    });

    const ctx = makeCtx({
      _body: {
        title: 'Vice President',
        description: 'Deputy leader',
        level: 1,
        termLengthMonths: 12,
        maxTerms: 2,
      },
    });
    const res = await createPosition(ctx);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('pos-1');
    expect(res.body.title).toBe('Vice President');
  });

  test('passes all body fields to repo.create', async () => {
    stubPresidentAccess();
    let capturedData: any;
    stubRepo(PositionRepository, {
      create: async (data: any) => {
        capturedData = data;
        return fakePosition;
      },
    });

    const ctx = makeCtx({
      _body: {
        title: 'Board Member',
        level: 2,
        termLengthMonths: 24,
        maxTerms: 3,
        sortOrder: 5,
      },
    });
    await createPosition(ctx);

    expect(capturedData.title).toBe('Board Member');
    expect(capturedData.level).toBe(2);
    expect(capturedData.termLengthMonths).toBe(24);
    expect(capturedData.maxTerms).toBe(3);
    expect(capturedData.sortOrder).toBe(5);
    expect(capturedData.organizationId).toBe('tenant-1');
  });

  test('defaults sortOrder to 0 when not provided', async () => {
    stubPresidentAccess();
    let capturedData: any;
    stubRepo(PositionRepository, {
      create: async (data: any) => {
        capturedData = data;
        return fakePosition;
      },
    });

    const ctx = makeCtx({
      _body: { title: 'VP', level: 1, termLengthMonths: 12 },
    });
    await createPosition(ctx);

    expect(capturedData.sortOrder).toBe(0);
  });

  test('defaults maxTerms to null when not provided', async () => {
    stubPresidentAccess();
    let capturedData: any;
    stubRepo(PositionRepository, {
      create: async (data: any) => {
        capturedData = data;
        return { ...fakePosition, maxTerms: null };
      },
    });

    const ctx = makeCtx({
      _body: { title: 'VP', level: 1, termLengthMonths: 12 },
    });
    await createPosition(ctx);

    expect(capturedData.maxTerms).toBeNull();
  });

  test('returns 403 when no organizationId after passing position check', async () => {
    stubPresidentAccess();

    const ctx = makeCtx({
      organizationId: '',
      _body: { title: 'VP', level: 1, termLengthMonths: 12 },
    });
    const res = await createPosition(ctx);
    // requirePosition returns 403 for missing orgId before we even check user
    expect(res.status).toBe(403);
  });
});
