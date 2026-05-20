import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateOfficerTerm } from './updateOfficerTerm';
import { OfficerTermRepository } from './repos/governance.repo';
import { NotFoundError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const existingTerm = {
  id: 'term-1',
  positionId: 'pos-1',
  personId: 'person-1',
  organizationId: 'org-1',
  startDate: new Date('2025-01-01'),
  endDate: null,
  status: 'active',
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ───────────────────────────────────────────────

describe('updateOfficerTerm', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  test('updates officer term and returns the updated record', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findById: async () => existingTerm,
      update: async (_id: string, data: any) => ({ ...existingTerm, ...data }),
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { termId: 'term-1' },
      _body: { endDate: new Date('2025-12-31'), status: 'completed' },
    });

    const response = await updateOfficerTerm(ctx);
    // handler calls ctx.json(updated) with no status — body contains the record
    expect(response.body.id).toBe('term-1');
    expect(response.body.status).toBe('completed');
  });

  test('passes correct termId to repo.update', async () => {
    let capturedId: string | null = null;
    mocks = stubRepo(OfficerTermRepository, {
      findById: async () => existingTerm,
      update: async (id: string, data: any) => {
        capturedId = id;
        return { ...existingTerm, ...data };
      },
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { termId: 'term-1' },
      _body: { notes: 'Updated note' },
    });

    await updateOfficerTerm(ctx);
    expect(capturedId).toBe('term-1');
  });

  test('updates only the fields present in body', async () => {
    let capturedData: any = null;
    mocks = stubRepo(OfficerTermRepository, {
      findById: async () => existingTerm,
      update: async (_id: string, data: any) => {
        capturedData = data;
        return { ...existingTerm, ...data };
      },
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { termId: 'term-1' },
      _body: { notes: 'Term ended early' },
    });

    await updateOfficerTerm(ctx);
    expect(capturedData.notes).toBe('Term ended early');
    // positionId not in update body — should not be overwritten by the handler
    expect(capturedData.positionId).toBeUndefined();
  });

  test('throws NotFoundError when term does not exist', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findById: async () => undefined,
      update: async () => existingTerm,
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });

    const ctx = makeCtx({
      _params: { termId: 'nonexistent' },
      _body: { status: 'completed' },
    });

    await expect(updateOfficerTerm(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError when term belongs to a different tenant', async () => {
    const termInOtherTenant = { ...existingTerm, organizationId: 'tenant-99' };
    mocks = stubRepo(OfficerTermRepository, {
      findById: async () => termInOtherTenant,
      update: async () => termInOtherTenant,
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });

    // ctx uses organizationId: 'tenant-1' by default — mismatch should trigger NotFoundError
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { termId: 'term-1' },
      _body: { status: 'completed' },
    });

    await expect(updateOfficerTerm(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('returns 401 when no user session', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const response = await updateOfficerTerm(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 when organizationId is missing', async () => {
    const ctx = makeCtx({ user: { id: 'u1', role: 'user' }, organizationId: null });
    const response = await updateOfficerTerm(ctx);
    expect(response.status).toBe(403);
  });

  test('audit action fires after update without crashing', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findById: async () => existingTerm,
      update: async (_id: string, data: any) => ({ ...existingTerm, ...data }),
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      audit: null,
      _params: { termId: 'term-1' },
      _body: { notes: 'Audit no-op test' },
    });

    // Must not throw — audit is null and handler is fire-and-forget
    const response = await updateOfficerTerm(ctx);
    expect(response.body.id).toBe('term-1');
  });
});
