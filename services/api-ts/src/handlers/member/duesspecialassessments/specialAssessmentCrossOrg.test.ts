/**
 * specialAssessmentCrossOrg.test.ts — regression for cross-org IDOR (P1).
 *
 * All four special-assessment handlers must scope the lookup by the caller's
 * org. A treasurer in org-B presenting org-A's assessment id must get 404
 * (no existence leak), while the owning org gets normal success.
 *
 * findByIdAndOrg is stubbed org-aware: it returns the assessment only when
 * the organizationId matches the owner (org-A), mirroring the repo's
 * `WHERE id = ? AND organizationId = ?`.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SpecialAssessmentRepository } from '@/handlers/association:member/repos/special-assessments.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { applySpecialAssessment } from './applySpecialAssessment';
import { deleteSpecialAssessment } from './deleteSpecialAssessment';
import { updateSpecialAssessment } from './updateSpecialAssessment';
import { getSpecialAssessmentCollection } from './getSpecialAssessmentCollection';

const OWNER_ORG = 'org-A';
const OTHER_ORG = 'org-B';

const ASSESSMENT = {
  id: 'sa-1', organizationId: OWNER_ORG, name: 'Building Fund',
  amount: 50000, currency: 'PHP', dueDate: '2026-06-01',
  status: 'draft', appliesTo: 'all' as const, fundId: null,
};

// Org-aware lookup: only the owning org sees the row.
function orgScopedFindStub() {
  return {
    findByIdAndOrg: async (_id: string, organizationId: string) =>
      organizationId === OWNER_ORG ? ASSESSMENT : null,
  };
}

function asTreasurer() {
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }],
  });
}

describe('special-assessment cross-org IDOR', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(SpecialAssessmentRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(SpecialAssessmentRepository);
  });

  // ─── Cross-org → 404 for all four handlers ───────────────

  test('applySpecialAssessment: cross-org id → 404', async () => {
    asTreasurer();
    stubRepo(SpecialAssessmentRepository, orgScopedFindStub());
    const ctx = makeCtx({ organizationId: OTHER_ORG, _params: { id: 'sa-1' } });
    const res = await applySpecialAssessment(ctx as any);
    expect(res.status).toBe(404);
  });

  test('deleteSpecialAssessment: cross-org id → 404', async () => {
    asTreasurer();
    stubRepo(SpecialAssessmentRepository, orgScopedFindStub());
    const ctx = makeCtx({ organizationId: OTHER_ORG, _params: { id: 'sa-1' } });
    const res = await deleteSpecialAssessment(ctx as any);
    expect(res.status).toBe(404);
  });

  test('updateSpecialAssessment: cross-org id → 404', async () => {
    asTreasurer();
    stubRepo(SpecialAssessmentRepository, orgScopedFindStub());
    const ctx = makeCtx({ organizationId: OTHER_ORG, _params: { id: 'sa-1' }, _body: { name: 'Hijacked' } });
    const res = await updateSpecialAssessment(ctx as any);
    expect(res.status).toBe(404);
  });

  test('getSpecialAssessmentCollection: cross-org id → 404', async () => {
    asTreasurer();
    stubRepo(SpecialAssessmentRepository, orgScopedFindStub());
    const ctx = makeCtx({ organizationId: OTHER_ORG, _params: { id: 'sa-1' } });
    const res = await getSpecialAssessmentCollection(ctx as any);
    expect(res.status).toBe(404);
  });

  // ─── Same-org → normal success ───────────────────────────

  test('applySpecialAssessment: same-org id → success', async () => {
    asTreasurer();
    stubRepo(SpecialAssessmentRepository, {
      ...orgScopedFindStub(),
      getActiveOrgMemberPersonIds: async () => ['p-1'],
      getTargets: async () => [],
      addTargets: async () => [{ assessmentId: 'sa-1', personId: 'p-1', invoiceId: null, status: 'pending' }],
      markTargetWithInvoice: async () => ({}),
      setStatus: async () => ({ ...ASSESSMENT, status: 'active' }),
      createInvoiceForTarget: async (data: any) => ({ id: `inv-${data.personId}`, ...data }),
    });
    const ctx = makeCtx({ organizationId: OWNER_ORG, _params: { id: 'sa-1' } });
    const res = await applySpecialAssessment(ctx as any);
    expect(res.status).toBe(200);
  });

  test('deleteSpecialAssessment: same-org id → success', async () => {
    asTreasurer();
    stubRepo(SpecialAssessmentRepository, {
      ...orgScopedFindStub(),
      softDelete: async () => ({ ...ASSESSMENT, status: 'closed' }),
    });
    const ctx = makeCtx({ organizationId: OWNER_ORG, _params: { id: 'sa-1' } });
    const res = await deleteSpecialAssessment(ctx as any);
    expect(res.status).toBe(200);
  });

  test('updateSpecialAssessment: same-org id → success', async () => {
    asTreasurer();
    stubRepo(SpecialAssessmentRepository, {
      ...orgScopedFindStub(),
      update: async () => ({ ...ASSESSMENT, name: 'Renamed' }),
    });
    const ctx = makeCtx({ organizationId: OWNER_ORG, _params: { id: 'sa-1' }, _body: { name: 'Renamed' } });
    const res = await updateSpecialAssessment(ctx as any);
    expect(res.status).toBe(200);
  });

  test('getSpecialAssessmentCollection: same-org id → success', async () => {
    asTreasurer();
    stubRepo(SpecialAssessmentRepository, {
      ...orgScopedFindStub(),
      getCollectionMetrics: async () => ({
        totalTargets: 1, paidCount: 0, paidAmount: 0,
        pendingCount: 1, pendingAmount: 50000, totalAmount: 50000,
      }),
    });
    const ctx = makeCtx({ organizationId: OWNER_ORG, _params: { id: 'sa-1' } });
    const res = await getSpecialAssessmentCollection(ctx as any);
    expect(res.status).toBe(200);
  });
});
