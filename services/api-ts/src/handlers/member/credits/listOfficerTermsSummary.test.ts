import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listOfficerTermsSummary } from './listOfficerTermsSummary';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { UnauthorizedError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const fakeTerm = {
  id: 'term-1',
  positionId: 'pos-1',
  personId: 'person-1',
  organizationId: 'org-1',
  status: 'active',
  startDate: new Date('2025-01-01'),
  endDate: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('listOfficerTermsSummary', () => {
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
      _params: { organizationId: 'org-1' },
    });
    await expect(listOfficerTermsSummary(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('happy path — returns terms with total count', async () => {
    stubRepo(OfficerTermRepository, {
      findByOrg: async () => [fakeTerm],
    });

    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await listOfficerTermsSummary(ctx);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].id).toBe('term-1');
  });

  test('returns empty list with total 0 when no terms', async () => {
    stubRepo(OfficerTermRepository, {
      findByOrg: async () => [],
    });

    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await listOfficerTermsSummary(ctx);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  test('total matches data length for multiple terms', async () => {
    stubRepo(OfficerTermRepository, {
      findByOrg: async () => [
        { ...fakeTerm, id: 'term-1' },
        { ...fakeTerm, id: 'term-2' },
        { ...fakeTerm, id: 'term-3' },
      ],
    });

    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await listOfficerTermsSummary(ctx);

    expect(res.body.total).toBe(3);
    expect(res.body.data).toHaveLength(3);
  });

  test('passes organizationId param to repo.findByOrg', async () => {
    let capturedOrgId: string | undefined;
    stubRepo(OfficerTermRepository, {
      findByOrg: async (orgId: string) => {
        capturedOrgId = orgId;
        return [];
      },
    });

    const ctx = makeCtx({ _params: { organizationId: 'specific-org' } });
    await listOfficerTermsSummary(ctx);

    expect(capturedOrgId).toBe('specific-org');
  });
});
