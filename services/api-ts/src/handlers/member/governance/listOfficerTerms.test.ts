import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listOfficerTerms } from './listOfficerTerms';
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

describe('listOfficerTerms', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 when no user', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await listOfficerTerms(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organizationId', async () => {
    const ctx = makeCtx({ organizationId: '' });
    const res = await listOfficerTerms(ctx);
    expect(res.status).toBe(403);
  });

  test('happy path — returns enriched terms', async () => {
    stubRepo(OfficerTermRepository, {
      findByOrg: async () => [fakeTerm],
    });

    // listOfficerTerms does direct db.select for enrichment; makeCtx db returns []
    // So positionTitle/personName fall back to defaults.
    const ctx = makeCtx();
    const res = await listOfficerTerms(ctx);

    expect(res.status).toBeUndefined(); // ctx.json with no status arg
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe('term-1');
    // enrichment fallbacks
    expect(res.body.items[0].positionTitle).toBe('Officer');
    expect(res.body.items[0].personName).toBe('Unknown');
  });

  test('returns empty items when no terms', async () => {
    stubRepo(OfficerTermRepository, {
      findByOrg: async () => [],
    });

    const ctx = makeCtx();
    const res = await listOfficerTerms(ctx);

    expect(res.body.items).toHaveLength(0);
  });

  test('handles multiple terms', async () => {
    stubRepo(OfficerTermRepository, {
      findByOrg: async () => [
        { ...fakeTerm, id: 'term-1', positionId: 'pos-1', personId: 'person-1' },
        { ...fakeTerm, id: 'term-2', positionId: 'pos-2', personId: 'person-2' },
      ],
    });

    const ctx = makeCtx();
    const res = await listOfficerTerms(ctx);

    expect(res.body.items).toHaveLength(2);
  });

  test('passes organizationId to repo.findByOrg', async () => {
    let capturedOrgId: string | undefined;
    stubRepo(OfficerTermRepository, {
      findByOrg: async (orgId: string) => {
        capturedOrgId = orgId;
        return [];
      },
    });

    const ctx = makeCtx({ organizationId: 'my-org' });
    await listOfficerTerms(ctx);

    expect(capturedOrgId).toBe('my-org');
  });
});
