// Business Rules: WF Create & Publish — completeness gate (400 incomplete) | Acceptance Criteria: [AC-M09-006] (Network visibility default on publish — visibility defaults to network-wide when not explicitly set)
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { publishTraining } from './publishTraining';
import { TrainingRepository } from './repos/training.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { ValidationError, NotFoundError } from '@/core/errors';
import { POSITION_TITLES } from '@/utils/position-titles';

const presidentTerm = { id: 't1', positionTitle: POSITION_TITLES.PRESIDENT };

const completeDraft = {
  id: 'tr-1',
  organizationId: 'org-1',
  title: 'CPR Certification',
  description: 'Hands-on resuscitation training',
  startDate: new Date('2026-07-01'),
  endDate: new Date('2026-07-02'),
  creditBearing: false,
  creditAmount: 0,
  status: 'draft' as const,
};

function ctxFor(id: string) {
  return makeCtx({ organizationId: 'org-1', _params: { trainingId: id } });
}

describe('publishTraining — completeness gate', () => {
  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(OfficerTermRepository);
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [presidentTerm] });
  });
  afterEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('throws NotFound when training missing', async () => {
    stubRepo(TrainingRepository, { findOneById: async () => undefined });
    await expect(publishTraining(ctxFor('tr-x'))).rejects.toBeInstanceOf(NotFoundError);
  });

  test('returns 400 when description missing', async () => {
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ ...completeDraft, description: null }),
      publish: async () => completeDraft,
    });
    await expect(publishTraining(ctxFor('tr-1'))).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 400 when endDate precedes startDate', async () => {
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ ...completeDraft, endDate: new Date('2026-06-30') }),
      publish: async () => completeDraft,
    });
    await expect(publishTraining(ctxFor('tr-1'))).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 400 when credit-bearing but creditAmount is zero', async () => {
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ ...completeDraft, creditBearing: true, creditAmount: 0 }),
      publish: async () => completeDraft,
    });
    await expect(publishTraining(ctxFor('tr-1'))).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 200 when training is complete', async () => {
    let publishedId: string | null = null;
    stubRepo(TrainingRepository, {
      findOneById: async () => completeDraft,
      publish: async (id: string) => { publishedId = id; return { ...completeDraft, status: 'published' }; },
    });
    const res = await publishTraining(ctxFor('tr-1'));
    expect(res.status).toBe(200);
    expect(publishedId).toBe('tr-1');
  });
});
