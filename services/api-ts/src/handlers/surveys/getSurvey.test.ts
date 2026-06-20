/**
 * Tests for getSurvey handler
 *
 * Covers:
 * - Returns 401 without session
 * - Returns 404 when survey not found
 * - Returns 404 when survey belongs to different org (x-org-id present)
 * - FIX-001 (M18 read-auth): non-officer member cannot read survey detail
 *   (drafts + internal targetAudience/settings are officer-only)
 * - Officer/admin can read survey detail
 * - /my/surveys/* (no x-org-id): member with membership → 200 sanitized
 * - /my/surveys/* (no x-org-id): non-member → 404 (tenant boundary enforced)
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository, SurveyResponseRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';
import { getSurvey } from './getSurvey';

// ─── Fixtures ───────────────────────────────────────────

const fakeSurvey = {
  id: 'survey-1',
  organizationId: 'tenant-1',
  title: 'Member Satisfaction',
  description: 'Annual survey',
  status: 'active',
  surveyType: 'general',
  questions: [{ id: 'q1', type: 'text', text: 'Feedback?', required: true, order: 1 }],
  settings: {},
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const draftSurvey = {
  ...fakeSurvey,
  id: 'survey-draft',
  title: 'Confidential Draft',
  status: 'draft',
  settings: { anonymous: false, targetAudience: { tiers: ['gold'] } },
};

const fakeMembership = {
  id: 'membership-1',
  personId: 'member-1',
  organizationId: 'tenant-1',
  status: 'active',
};

// ─── Tests ──────────────────────────────────────────────

describe('getSurvey', () => {
  afterEach(() => {
    restoreRepo(SurveyRepository);
    restoreRepo(OfficerTermRepository);
    restoreRepo(SurveyResponseRepository);
    restoreRepo(MembershipRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { survey: 'survey-1' },
    });
    await expect(getSurvey(ctx)).rejects.toThrow();
  });

  test('throws NotFoundError when survey not found', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => undefined,
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'missing' },
    });
    await expect(getSurvey(ctx)).rejects.toThrow('Survey not found');
  });

  test('throws NotFoundError when survey belongs to different org (x-org-id present)', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...fakeSurvey, organizationId: 'other-org' }),
    });
    // organizationId: 'tenant-1' (default in makeCtx) — mismatch → 404
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });
    await expect(getSurvey(ctx)).rejects.toThrow('Survey not found');
  });

  // Member read of an ACTIVE survey is now allowed (aligns handler to its `user` spec)
  test('member reads an active survey — 200 sanitized (no targetAudience)', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    stubRepo(MembershipRepository, { findByPersonAndOrg: async () => fakeMembership });
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...fakeSurvey, settings: { deadline: '2099-01-01', anonymous: false, allowReedit: true, targetAudience: { tiers: ['gold'] } } }),
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => undefined,
    });
    const ctx = makeCtx({ user: { id: 'member-1', role: 'user' }, _params: { survey: 'survey-1' } });
    const res = await getSurvey(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.id).toBe('survey-1');
    expect((res as any).body.settings.targetAudience).toBeUndefined();
    expect((res as any).body.settings.deadline).toBe('2099-01-01');
  });

  test('member reading a draft survey — 404 (no existence leak)', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    stubRepo(SurveyRepository, { findById: async () => draftSurvey });
    // membership check is never reached (draft check fires first) — no stub needed
    const ctx = makeCtx({ user: { id: 'member-1', role: 'user' }, _params: { survey: 'survey-draft' } });
    await expect(getSurvey(ctx)).rejects.toThrow('Survey not found');
  });

  test('member reads an active poll — includes pollResults and myResponseStatus (voted)', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    stubRepo(MembershipRepository, { findByPersonAndOrg: async () => fakeMembership });
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...fakeSurvey, surveyType: 'poll', questions: [{ id: 'q1', type: 'single_choice', text: 'Pick', options: ['A', 'B'], required: true, order: 1 }] }),
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => ({ status: 'completed', answers: [{ questionId: 'q1', value: 'A' }] }),
      findAllBySurveyId: async () => [{ answers: [{ questionId: 'q1', value: 'A' }] }],
    });
    const ctx = makeCtx({ user: { id: 'member-1', role: 'user' }, _params: { survey: 'survey-1' } });
    const res = await getSurvey(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.pollResults[0]).toEqual({ questionId: 'q1', counts: { A: 1 }, total: 1 });
    expect((res as any).body.myResponseStatus).toBe('completed');
  });

  // Regression guard: unvoted member must get myResponseStatus null (not 'completed'),
  // so the frontend vote form is shown (not locked out by the old pollResults check).
  test('unvoted member reads an active poll — myResponseStatus is null (vote form not locked)', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    stubRepo(MembershipRepository, { findByPersonAndOrg: async () => fakeMembership });
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...fakeSurvey, surveyType: 'poll', questions: [{ id: 'q1', type: 'single_choice', text: 'Pick', options: ['A', 'B'], required: true, order: 1 }] }),
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => undefined,
      findAllBySurveyId: async () => [],
    });
    const ctx = makeCtx({ user: { id: 'member-1', role: 'user' }, _params: { survey: 'survey-1' } });
    const res = await getSurvey(ctx);
    expect(res.status).toBe(200);
    // null → frontend showResults = false → vote form renders (lockout prevented)
    expect((res as any).body.myResponseStatus).toBeNull();
  });

  test('FIX-001: officer (active term) can read survey detail — 200', async () => {
    stubRepo(OfficerTermRepository, {
      // Officer check now uses survey.organizationId ('tenant-1') — stub accordingly
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(SurveyRepository, {
      findById: async () => draftSurvey,
    });
    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user' },
      _params: { survey: 'survey-draft' },
    });

    const res = await getSurvey(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.id).toBe('survey-draft');
  });

  test('returns survey by ID for admin — 200', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => fakeSurvey,
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });

    const res = await getSurvey(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.id).toBe('survey-1');
    expect((res as any).body.title).toBe('Member Satisfaction');
    expect((res as any).body.status).toBe('active');
  });

  // ─── /my/surveys/* — no x-org-id (ISSUE-FIX) ────────────────────────────

  test('/my route: member with no x-org-id but membership in survey org → 200 sanitized', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    stubRepo(MembershipRepository, { findByPersonAndOrg: async () => fakeMembership });
    stubRepo(SurveyRepository, {
      findById: async () => fakeSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => undefined,
    });
    // Simulate /my/surveys/* — no x-org-id header → organizationId undefined
    const ctx = makeCtx({
      user: { id: 'member-1', role: 'user' },
      organizationId: undefined,
      _params: { survey: 'survey-1' },
    });
    const res = await getSurvey(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.id).toBe('survey-1');
    expect((res as any).body.myResponseStatus).toBeNull();
  });

  test('/my route: member with no x-org-id and NO membership in survey org → 404', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    // Non-member: findByPersonAndOrg returns null
    stubRepo(MembershipRepository, { findByPersonAndOrg: async () => null });
    stubRepo(SurveyRepository, {
      findById: async () => fakeSurvey,
    });
    const ctx = makeCtx({
      user: { id: 'outsider-1', role: 'user' },
      organizationId: undefined,
      _params: { survey: 'survey-1' },
    });
    await expect(getSurvey(ctx)).rejects.toThrow('Survey not found');
  });
});
