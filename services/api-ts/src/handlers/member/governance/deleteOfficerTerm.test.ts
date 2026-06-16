import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { deleteOfficerTerm } from './deleteOfficerTerm';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { NotFoundError } from '@/core/errors';

const existingTerm = {
  id: 'term-1',
  positionId: 'pos-1',
  personId: 'person-1',
  organizationId: 'org-1',
  status: 'active',
};

describe('deleteOfficerTerm', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  test('deletes the term and returns success', async () => {
    let deletedId: string | null = null;
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
      findById: async () => existingTerm,
      delete: async (id: string) => { deletedId = id; },
    });

    const ctx = makeCtx({ organizationId: 'org-1', _params: { termId: 'term-1' } });
    const response = await deleteOfficerTerm(ctx);

    expect(response.body.success).toBe(true);
    expect(deletedId).toBe('term-1');
  });

  test('returns 403 when caller is not President', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Member' }],
    });

    const ctx = makeCtx({ organizationId: 'org-1', _params: { termId: 'term-1' } });
    const response = await deleteOfficerTerm(ctx);
    expect(response.status).toBe(403);
  });

  test('throws NotFoundError when term does not exist', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
      findById: async () => undefined,
      delete: async () => {},
    });

    const ctx = makeCtx({ organizationId: 'org-1', _params: { termId: 'nope' } });
    await expect(deleteOfficerTerm(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError when term belongs to another org', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
      findById: async () => ({ ...existingTerm, organizationId: 'other-org' }),
      delete: async () => {},
    });

    const ctx = makeCtx({ organizationId: 'org-1', _params: { termId: 'term-1' } });
    await expect(deleteOfficerTerm(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('revokes the affected user sessions when auth is present', async () => {
    let revokedUserId: string | null = null;
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
      findById: async () => existingTerm,
      delete: async () => {},
    });

    const auth = {
      api: {
        revokeUserSessions: async ({ body }: any) => { revokedUserId = body.userId; },
      },
    };

    const ctx = makeCtx({ organizationId: 'org-1', auth, _params: { termId: 'term-1' } });
    const response = await deleteOfficerTerm(ctx);

    expect(response.body.success).toBe(true);
    expect(revokedUserId).toBe('person-1');
  });

  test('still succeeds when session revocation throws', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
      findById: async () => existingTerm,
      delete: async () => {},
    });

    const auth = {
      api: {
        revokeUserSessions: async () => { throw new Error('auth down'); },
      },
    };

    const ctx = makeCtx({ organizationId: 'org-1', auth, _params: { termId: 'term-1' } });
    const response = await deleteOfficerTerm(ctx);
    expect(response.body.success).toBe(true);
  });
});
