/**
 * updateSpecialAssessment.test.ts — TDD tests for AC-T8-005 + BR-T8-001
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SpecialAssessmentRepository } from '@/handlers/association:member/repos/special-assessments.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { updateSpecialAssessment } from './updateSpecialAssessment';

const DRAFT_ASSESSMENT = {
  id: 'sa-1', organizationId: 'org-1', name: 'Building Fund',
  amount: 50000, status: 'draft', appliesTo: 'all',
};

const ACTIVE_ASSESSMENT = {
  id: 'sa-2', organizationId: 'org-1', name: 'Active One',
  amount: 50000, status: 'active', appliesTo: 'all',
};

describe('[AC-T8-005] updateSpecialAssessment', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(SpecialAssessmentRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(SpecialAssessmentRepository);
  });

  test('[AC-T8-005] returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { id: 'sa-1' }, _body: {} });
    const res = await updateSpecialAssessment(ctx as any);
    expect(res.status).toBe(401);
  });

  test('[AC-T8-005] returns 403 when not officer', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { id: 'sa-1' },
      _body: { name: 'Updated' },
    });
    const res = await updateSpecialAssessment(ctx as any);
    expect(res.status).toBe(403);
  });

  test('[BR-T8-001] returns 409 when assessment is active', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    stubRepo(SpecialAssessmentRepository, { findByIdAndOrg: async () => ACTIVE_ASSESSMENT });
    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { id: 'sa-2' },
      _body: { name: 'Updated' },
    });
    const res = await updateSpecialAssessment(ctx as any);
    expect(res.status).toBe(409);
  });

  test('[BR-T8-001] returns 409 when assessment is closed', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    stubRepo(SpecialAssessmentRepository, { findByIdAndOrg: async () => ({ ...ACTIVE_ASSESSMENT, status: 'closed' }) });
    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { id: 'sa-2' },
      _body: { name: 'Updated' },
    });
    const res = await updateSpecialAssessment(ctx as any);
    expect(res.status).toBe(409);
  });

  test('[AC-T8-005] updates draft assessment successfully', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    const updated = { ...DRAFT_ASSESSMENT, name: 'Updated Fund' };
    stubRepo(SpecialAssessmentRepository, {
      findByIdAndOrg: async () => DRAFT_ASSESSMENT,
      update: async () => updated,
    });
    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { id: 'sa-1' },
      _body: { name: 'Updated Fund' },
    });
    const res = await updateSpecialAssessment(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.name).toBe('Updated Fund');
  });

  test('[AC-T8-005] returns 404 when assessment not found', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    stubRepo(SpecialAssessmentRepository, { findByIdAndOrg: async () => null });
    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { id: 'nonexistent' },
      _body: { name: 'Updated' },
    });
    const res = await updateSpecialAssessment(ctx as any);
    expect(res.status).toBe(404);
  });
});
