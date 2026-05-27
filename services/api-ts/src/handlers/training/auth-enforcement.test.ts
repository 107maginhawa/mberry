/**
 * P0 Auth enforcement tests for Training module (M8).
 *
 * Verifies:
 * - Officer role check on markComplete (CPD credit awarding)
 * - Officer role check on createTraining, updateTraining, cancelTraining
 * - Officer role check on listEnrollments
 * - Non-officer (regular member) gets 403
 *
 * Note: Authentication (401) is enforced by wildcard middleware on
 * /association/* in app.ts. These tests verify handler-level officer checks.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeTraining as createFakeTraining, fakeEnrollment as createFakeEnrollment } from '@/test-utils/factories';
import { markComplete } from './markComplete';
import { createTraining } from './createTraining';
import { updateTraining } from './updateTraining';
import { cancelTraining } from './cancelTraining';
import { listEnrollments } from './listEnrollments';
import { TrainingRepository } from './repos/training.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';

const fakeTraining = createFakeTraining({
  organizationId: 'org-1',
  title: 'CPD Seminar',
  status: 'completed',
  capacity: 50,
  creditAmount: 8,
  endDate: new Date('2024-01-01'),
});

const fakeEnrollment = createFakeEnrollment({
  orgId: 'org-1',
  trainingId: 'training-1',
  personId: 'person-1',
  status: 'enrolled',
  cancelledAt: null,
});

describe('Training auth enforcement', () => {
  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(TrainingRepository);
    restoreRepo(MembershipRepository);
  });

  // ─── markComplete: officer check ─────────────────────────

  describe('markComplete officer check', () => {
    test('returns 403 when caller is not an officer', async () => {
      // Non-officer: findActiveByPersonAndOrg returns empty array
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [],
      });

      const ctx = makeCtx({
        _params: { id: 'training-1', organizationId: 'org-1' },
        _body: { personId: 'person-1' },
      });

      await expect(markComplete(ctx)).rejects.toThrow('Officer access required');
    });

    test('allows officer to proceed', async () => {
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }],
      });

      stubRepo(TrainingRepository, {
        getByOrg: async () => fakeTraining,
        getEnrollmentCount: async () => 1,
        listEnrollments: async () => [fakeEnrollment],
        updateEnrollmentStatus: async (_id: string, status: string) => ({
          ...fakeEnrollment,
          status,
        }),
      });

      const ctx = makeCtx({
        _params: { id: 'training-1', organizationId: 'org-1' },
        _body: { personId: 'person-1' },
      });

      const response = await markComplete(ctx);
      expect(response.status).toBe(201);
    });
  });

  // ─── createTraining: officer check ────────────────────────

  describe('createTraining officer check', () => {
    test('returns 403 when caller is not an officer', async () => {
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [],
      });

      const ctx = makeCtx({
        _params: { organizationId: 'org-1' },
        _body: { title: 'Test', startDate: '2025-01-01', endDate: '2025-01-02' },
      });

      await expect(createTraining(ctx)).rejects.toThrow('Officer access required');
    });

    test('allows officer to create training', async () => {
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Secretary' }],
      });

      stubRepo(TrainingRepository, {
        create: async (data: any) => ({ id: 'training-new', ...data }),
      });

      const ctx = makeCtx({
        _params: { organizationId: 'org-1' },
        _body: {
          title: 'New Training',
          startDate: '2025-06-01',
          endDate: '2025-06-02',
        },
      });

      const response = await createTraining(ctx);
      expect(response.status).toBe(201);
    });
  });

  // ─── updateTraining: officer check ────────────────────────

  describe('updateTraining officer check', () => {
    test('returns 403 when caller is not an officer', async () => {
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [],
      });

      const ctx = makeCtx({
        _params: { id: 'training-1', organizationId: 'org-1' },
        _body: { title: 'Updated Title' },
      });

      await expect(updateTraining(ctx)).rejects.toThrow('Officer access required');
    });
  });

  // ─── cancelTraining: officer check ────────────────────────

  describe('cancelTraining officer check', () => {
    test('returns 403 when caller is not an officer', async () => {
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [],
      });

      const ctx = makeCtx({
        _params: { id: 'training-1', organizationId: 'org-1' },
        _body: {},
      });

      await expect(cancelTraining(ctx)).rejects.toThrow('Officer access required');
    });
  });

  // ─── listEnrollments: officer check ───────────────────────

  describe('listEnrollments officer check', () => {
    test('returns 403 when caller is not an officer', async () => {
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [],
      });

      const ctx = makeCtx({
        _params: { id: 'training-1', organizationId: 'org-1' },
      });

      await expect(listEnrollments(ctx)).rejects.toThrow('Officer access required');
    });

    test('allows officer to view enrollments', async () => {
      stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Secretary' }],
      });

      stubRepo(TrainingRepository, {
        getByOrg: async () => fakeTraining,
        listEnrollments: async () => [fakeEnrollment],
        getAttendanceStats: async () => ({ total: 1, completed: 0 }),
      });

      const ctx = makeCtx({
        _params: { id: 'training-1', organizationId: 'org-1' },
      });

      const response = await listEnrollments(ctx);
      expect(response.status).toBe(200);
    });
  });
});
