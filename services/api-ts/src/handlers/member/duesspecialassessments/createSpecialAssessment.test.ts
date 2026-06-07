/**
 * createSpecialAssessment.test.ts — TDD tests for AC-T8-003
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SpecialAssessmentRepository } from '@/handlers/association:member/repos/special-assessments.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { createSpecialAssessment } from './createSpecialAssessment';

describe('[AC-T8-003] createSpecialAssessment', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(SpecialAssessmentRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(SpecialAssessmentRepository);
  });

  test('[AC-T8-003] returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _body: {} });
    const res = await createSpecialAssessment(ctx as any);
    expect(res.status).toBe(401);
  });

  test('[AC-T8-003] returns 403 when not officer', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: { name: 'Test', amount: 5000, currency: 'PHP', dueDate: '2026-06-01' },
    });
    const res = await createSpecialAssessment(ctx as any);
    expect(res.status).toBe(403);
  });

  test('[AC-T8-003] creates assessment in draft status on success', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });
    const created = {
      id: 'sa-1',
      organizationId: 'org-1',
      name: 'Building Fund',
      description: 'One-time building levy',
      amount: 50000,
      currency: 'PHP',
      dueDate: '2026-06-01',
      fundId: null,
      appliesTo: 'all',
      status: 'draft',
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    stubRepo(SpecialAssessmentRepository, { create: async () => created });
    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        name: 'Building Fund',
        description: 'One-time building levy',
        amount: 50000,
        currency: 'PHP',
        dueDate: '2026-06-01',
      },
    });
    const res = await createSpecialAssessment(ctx as any);
    expect(res.status).toBe(201);
    const body = (res as any).body;
    expect(body.name).toBe('Building Fund');
    expect(body.status).toBe('draft');
  });
});
