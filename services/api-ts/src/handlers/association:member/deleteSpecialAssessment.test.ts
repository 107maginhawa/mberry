/**
 * deleteSpecialAssessment.test.ts — TDD tests for AC-T8-006 + BR-T8-001
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SpecialAssessmentRepository } from './repos/special-assessments.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { deleteSpecialAssessment } from './deleteSpecialAssessment';

const DRAFT = { id: 'sa-1', organizationId: 'org-1', status: 'draft' };
const ACTIVE = { id: 'sa-2', organizationId: 'org-1', status: 'active' };

describe('[AC-T8-006] deleteSpecialAssessment', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(SpecialAssessmentRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(SpecialAssessmentRepository);
  });

  test('[AC-T8-006] returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { id: 'sa-1' } });
    const res = await deleteSpecialAssessment(ctx as any);
    expect(res.status).toBe(401);
  });

  test('[AC-T8-006] returns 403 when not officer', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { id: 'sa-1' } });
    const res = await deleteSpecialAssessment(ctx as any);
    expect(res.status).toBe(403);
  });

  test('[BR-T8-001] returns 409 when assessment is active', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    stubRepo(SpecialAssessmentRepository, { findById: async () => ACTIVE });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { id: 'sa-2' } });
    const res = await deleteSpecialAssessment(ctx as any);
    expect(res.status).toBe(409);
  });

  test('[AC-T8-006] soft-deletes draft assessment', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    stubRepo(SpecialAssessmentRepository, {
      findById: async () => DRAFT,
      softDelete: async () => ({ ...DRAFT, status: 'closed' }),
    });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { id: 'sa-1' } });
    const res = await deleteSpecialAssessment(ctx as any);
    expect(res.status).toBe(200);
  });

  test('[AC-T8-006] returns 404 when not found', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    stubRepo(SpecialAssessmentRepository, { findById: async () => null });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { id: 'nonexistent' } });
    const res = await deleteSpecialAssessment(ctx as any);
    expect(res.status).toBe(404);
  });
});
