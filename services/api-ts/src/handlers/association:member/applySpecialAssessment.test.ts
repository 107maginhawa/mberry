/**
 * applySpecialAssessment.test.ts — TDD tests for AC-T8-007, AC-T8-009, BR-T8-002/003/004/005
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SpecialAssessmentRepository } from './repos/special-assessments.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { applySpecialAssessment } from './applySpecialAssessment';

const DRAFT_ASSESSMENT = {
  id: 'sa-1', organizationId: 'org-1', name: 'Building Fund',
  amount: 50000, currency: 'PHP', dueDate: '2026-06-01',
  status: 'draft', appliesTo: 'all' as const, fundId: null,
};

const ASSESSMENT_WITH_FUND = {
  ...DRAFT_ASSESSMENT, id: 'sa-2', fundId: 'fund-1',
};

const SELECTED_ASSESSMENT = {
  ...DRAFT_ASSESSMENT, id: 'sa-3', appliesTo: 'selected' as const,
};

describe('[AC-T8-007] applySpecialAssessment', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(SpecialAssessmentRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(SpecialAssessmentRepository);
  });

  test('[AC-T8-007] returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { id: 'sa-1' } });
    const res = await applySpecialAssessment(ctx as any);
    expect(res.status).toBe(401);
  });

  test('[AC-T8-007] returns 403 when not officer', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { id: 'sa-1' } });
    const res = await applySpecialAssessment(ctx as any);
    expect(res.status).toBe(403);
  });

  test('[AC-T8-007] returns 404 when assessment not found', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    stubRepo(SpecialAssessmentRepository, { findById: async () => null });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { id: 'nonexistent' } });
    const res = await applySpecialAssessment(ctx as any);
    expect(res.status).toBe(404);
  });

  test('[BR-T8-002] appliesTo=all generates invoices for all active members', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    let createdInvoices: any[] = [];
    let addedTargets: any[] = [];
    stubRepo(SpecialAssessmentRepository, {
      findById: async () => DRAFT_ASSESSMENT,
      getActiveOrgMemberPersonIds: async () => ['p-1', 'p-2', 'p-3'],
      getTargets: async () => [],
      addTargets: async (_aid: string, pids: string[]) => {
        addedTargets = pids;
        return pids.map(p => ({ assessmentId: 'sa-1', personId: p, invoiceId: null, status: 'pending' }));
      },
      markTargetWithInvoice: async () => ({}),
      setStatus: async () => ({ ...DRAFT_ASSESSMENT, status: 'active' }),
      createInvoiceForTarget: async (data: any) => {
        createdInvoices.push(data);
        return { id: `inv-${data.personId}`, ...data };
      },
    });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { id: 'sa-1' } });
    const res = await applySpecialAssessment(ctx as any);
    expect(res.status).toBe(200);
    expect(createdInvoices).toHaveLength(3);
  });

  test('[BR-T8-003] appliesTo=selected generates invoices only for targets', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    let createdInvoices: any[] = [];
    stubRepo(SpecialAssessmentRepository, {
      findById: async () => SELECTED_ASSESSMENT,
      getTargetPersonIds: async () => ['p-1', 'p-2'],
      getTargets: async () => [
        { assessmentId: 'sa-3', personId: 'p-1', invoiceId: null, status: 'pending' },
        { assessmentId: 'sa-3', personId: 'p-2', invoiceId: null, status: 'pending' },
      ],
      markTargetWithInvoice: async () => ({}),
      setStatus: async () => ({ ...SELECTED_ASSESSMENT, status: 'active' }),
      createInvoiceForTarget: async (data: any) => {
        createdInvoices.push(data);
        return { id: `inv-${data.personId}`, ...data };
      },
    });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { id: 'sa-3' } });
    const res = await applySpecialAssessment(ctx as any);
    expect(res.status).toBe(200);
    expect(createdInvoices).toHaveLength(2);
  });

  test('[BR-T8-004] idempotent — skips members who already have invoice (AC-T8-009)', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    let createdInvoices: any[] = [];
    const ACTIVE_ASSESSMENT = { ...DRAFT_ASSESSMENT, status: 'active' };
    stubRepo(SpecialAssessmentRepository, {
      findById: async () => ACTIVE_ASSESSMENT,
      getActiveOrgMemberPersonIds: async () => ['p-1', 'p-2', 'p-3'],
      getTargets: async () => [
        { assessmentId: 'sa-1', personId: 'p-1', invoiceId: 'inv-existing', status: 'pending' },
        { assessmentId: 'sa-1', personId: 'p-2', invoiceId: null, status: 'pending' },
        { assessmentId: 'sa-1', personId: 'p-3', invoiceId: null, status: 'pending' },
      ],
      addTargets: async () => [],
      markTargetWithInvoice: async () => ({}),
      setStatus: async () => ACTIVE_ASSESSMENT,
      createInvoiceForTarget: async (data: any) => {
        createdInvoices.push(data);
        return { id: `inv-${data.personId}`, ...data };
      },
    });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { id: 'sa-1' } });
    const res = await applySpecialAssessment(ctx as any);
    expect(res.status).toBe(200);
    // p-1 already has invoice — should be skipped
    expect(createdInvoices).toHaveLength(2);
    expect(createdInvoices.map((i: any) => i.personId)).not.toContain('p-1');
  });

  test('[BR-T8-005] assessment with fundId passes fund to generated invoices', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    let createdInvoices: any[] = [];
    stubRepo(SpecialAssessmentRepository, {
      findById: async () => ASSESSMENT_WITH_FUND,
      getActiveOrgMemberPersonIds: async () => ['p-1'],
      getTargets: async () => [],
      addTargets: async () => [{ assessmentId: 'sa-2', personId: 'p-1', invoiceId: null, status: 'pending' }],
      markTargetWithInvoice: async () => ({}),
      setStatus: async () => ({ ...ASSESSMENT_WITH_FUND, status: 'active' }),
      createInvoiceForTarget: async (data: any) => {
        createdInvoices.push(data);
        return { id: `inv-${data.personId}`, ...data };
      },
    });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { id: 'sa-2' } });
    const res = await applySpecialAssessment(ctx as any);
    expect(res.status).toBe(200);
    expect(createdInvoices[0].fundAllocations).toBeDefined();
    expect(createdInvoices[0].fundAllocations[0].fundName).toBe('fund-1');
  });
});
