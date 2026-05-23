/**
 * getSpecialAssessmentCollection.test.ts — TDD tests for AC-T8-008
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SpecialAssessmentRepository } from './repos/special-assessments.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { getSpecialAssessmentCollection } from './getSpecialAssessmentCollection';

describe('[AC-T8-008] getSpecialAssessmentCollection', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(SpecialAssessmentRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(SpecialAssessmentRepository);
  });

  test('[AC-T8-008] returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { id: 'sa-1' } });
    const res = await getSpecialAssessmentCollection(ctx as any);
    expect(res.status).toBe(401);
  });

  test('[AC-T8-008] returns 403 when not officer', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { id: 'sa-1' } });
    const res = await getSpecialAssessmentCollection(ctx as any);
    expect(res.status).toBe(403);
  });

  test('[AC-T8-008] returns 404 when not found', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    stubRepo(SpecialAssessmentRepository, { findById: async () => null });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { id: 'nonexistent' } });
    const res = await getSpecialAssessmentCollection(ctx as any);
    expect(res.status).toBe(404);
  });

  test('[AC-T8-008] returns collection metrics (total, paid, pending counts + amounts)', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    stubRepo(SpecialAssessmentRepository, {
      findById: async () => ({ id: 'sa-1', organizationId: 'org-1', name: 'Test' }),
      getCollectionMetrics: async () => ({
        totalTargets: 10,
        paidCount: 4,
        paidAmount: 200000,
        pendingCount: 6,
        pendingAmount: 300000,
        totalAmount: 500000,
      }),
    });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { id: 'sa-1' } });
    const res = await getSpecialAssessmentCollection(ctx as any);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.totalTargets).toBe(10);
    expect(body.paidCount).toBe(4);
    expect(body.paidAmount).toBe(200000);
    expect(body.pendingCount).toBe(6);
    expect(body.pendingAmount).toBe(300000);
    expect(body.totalAmount).toBe(500000);
  });
});
