/**
 * deleteElection handler tests — RED phase
 *
 * Business rules:
 * - Only draft elections can be deleted
 * - Officer authorization required
 * - Hard delete with cascade (nominees/votes removed by FK cascade)
 * - Audit trail logged
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeElection as createFakeElection } from '@/test-utils/factories';
import { ElectionsRepository } from './repos/elections.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { BusinessLogicError } from '@/core/errors';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

// ─── Fixtures ───────────────────────────────────────────

const draftElection = createFakeElection({ status: 'draft' });
const activeElection = createFakeElection({ status: 'nominationsOpen' });
const publishedElection = createFakeElection({ status: 'published' });
const cancelledElection = createFakeElection({ status: 'cancelled' });

// ─── Tests ──────────────────────────────────────────────

describe('deleteElection', () => {
  let deleteElection: typeof import('./deleteElection').deleteElection;

  beforeEach(async () => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
    // Default: user is officer (authorized)
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    deleteElection = (await import('./deleteElection')).deleteElection;
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
  });

  // ─── Happy path ─────────────────────────────────────────

  test('deletes draft election and returns 200', async () => {
    let deletedId: string | null = null;
    stubRepo(ElectionsRepository, {
      get: async () => draftElection,
      delete: async (id: string) => { deletedId = id; },
    });

    const ctx = makeCtx({ _params: { id: 'election-1' } });
    const response = await deleteElection(ctx);

    expect(response.status).toBe(200);
    expect(deletedId).toBe('election-1');
  });

  // ─── Draft-only guard ───────────────────────────────────

  test('throws ELECTION_NOT_DRAFT when status is nominationsOpen', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => activeElection,
    });

    const ctx = makeCtx({ _params: { id: 'election-1' } });
    const err = await deleteElection(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('ELECTION_NOT_DRAFT');
  });

  test('throws ELECTION_NOT_DRAFT when status is published', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => publishedElection,
    });

    const ctx = makeCtx({ _params: { id: 'election-1' } });
    const err = await deleteElection(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('ELECTION_NOT_DRAFT');
  });

  test('throws ELECTION_NOT_DRAFT when status is cancelled', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => cancelledElection,
    });

    const ctx = makeCtx({ _params: { id: 'election-1' } });
    const err = await deleteElection(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('ELECTION_NOT_DRAFT');
  });

  // ─── Not found ──────────────────────────────────────────

  test('throws NotFoundError when election does not exist', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({ _params: { id: 'missing-id' } });
    await expect(deleteElection(ctx)).rejects.toThrow('Election not found');
  });

  // ─── Authorization ──────────────────────────────────────

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'election-1' },
    });
    await expect(deleteElection(ctx)).rejects.toThrow('Unauthorized');
  });

  test('throws ForbiddenError when user is not officer', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });

    stubRepo(ElectionsRepository, {
      get: async () => draftElection,
    });

    const ctx = makeCtx({ _params: { id: 'election-1' } });
    await expect(deleteElection(ctx)).rejects.toThrow('Officer access required');
  });
});
