/**
 * listSpecialAssessments.test.ts — TDD tests for AC-T8-004
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SpecialAssessmentRepository } from '@/handlers/association:member/repos/special-assessments.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { listSpecialAssessments } from './listSpecialAssessments';

const ASSESSMENT_1 = {
  id: 'sa-1', organizationId: 'org-1', name: 'Building Fund',
  amount: 50000, currency: 'PHP', dueDate: '2026-06-01',
  status: 'active', appliesTo: 'all', fundId: null,
  createdAt: new Date(), updatedAt: new Date(),
};

describe('[AC-T8-004] listSpecialAssessments', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(SpecialAssessmentRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(SpecialAssessmentRepository);
  });

  test('[AC-T8-004] returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { orgId: 'org-1' } });
    const res = await listSpecialAssessments(ctx as any);
    expect(res.status).toBe(401);
  });

  test('[AC-T8-004] returns 403 when not officer', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { orgId: 'org-1' },
    });
    const res = await listSpecialAssessments(ctx as any);
    expect(res.status).toBe(403);
  });

  test('[AC-T8-004] returns assessments with collection summary', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    stubRepo(SpecialAssessmentRepository, {
      listByOrg: async () => [ASSESSMENT_1],
      getCollectionMetrics: async () => ({
        totalTargets: 10, paidCount: 3, paidAmount: 150000,
        pendingCount: 7, pendingAmount: 350000, totalAmount: 500000,
      }),
    });
    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { orgId: 'org-1' },
    });
    const res = await listSpecialAssessments(ctx as any);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.assessments).toHaveLength(1);
    expect(body.assessments[0].collection).toBeDefined();
  });
});
