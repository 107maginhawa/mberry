import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { OnboardingStateRepository } from './repos/onboarding.repo';
import { getOnboardingState } from './getOnboardingState';
import { updateOnboardingStep } from './updateOnboardingStep';
import { domainEvents } from '@/core/domain-events';
import { BusinessLogicError, ForbiddenError, NotFoundError } from '@/core/errors';

const ORG = '11111111-1111-1111-1111-111111111111';

function fakeState(over: Partial<any> = {}) {
  return {
    id: 'onb-1',
    organizationId: ORG,
    currentStep: 1,
    stepsCompleted: [] as number[],
    completedAt: null as Date | null,
    ...over,
  };
}

function asOfficer() {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ id: 't1', organizationId: ORG }],
  });
}

describe('getOnboardingState', () => {
  let mocks: Array<ReturnType<typeof stubRepo>> = [];
  afterEach(() => {
    mocks.forEach((m) => Object.values(m).forEach((x) => x.mockRestore()));
    mocks = [];
  });

  test('returns the wizard state for an officer', async () => {
    mocks.push(asOfficer());
    mocks.push(stubRepo(OnboardingStateRepository, {
      findByOrg: async () => fakeState({ currentStep: 3, stepsCompleted: [1, 2] }),
    }));
    const ctx = makeCtx({ _query: { orgId: ORG } });
    const res = await getOnboardingState(ctx);
    expect(res.body.currentStep).toBe(3);
    expect(res.body.stepsCompleted).toEqual([1, 2]);
    expect(res.body.completedAt).toBeNull();
  });

  test('404 when wizard not started', async () => {
    mocks.push(asOfficer());
    mocks.push(stubRepo(OnboardingStateRepository, { findByOrg: async () => undefined }));
    const ctx = makeCtx({ _query: { orgId: ORG } });
    await expect(getOnboardingState(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('403 when caller has no officer term in the org', async () => {
    mocks.push(stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] }));
    const ctx = makeCtx({ _query: { orgId: ORG } });
    await expect(getOnboardingState(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null, _query: { orgId: ORG } });
    await expect(getOnboardingState(ctx)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('updateOnboardingStep', () => {
  let mocks: Array<ReturnType<typeof stubRepo>> = [];
  afterEach(() => {
    mocks.forEach((m) => Object.values(m).forEach((x) => x.mockRestore()));
    mocks = [];
  });

  test('bootstraps a fresh wizard at step 1 and advances to step 2', async () => {
    mocks.push(asOfficer());
    let created: any = null;
    mocks.push(stubRepo(OnboardingStateRepository, {
      findByOrg: async () => undefined,
      create: async (d: any) => { created = { ...fakeState(), ...d }; return created; },
      update: async (_o: string, d: any) => ({ ...created, ...d }),
    }));
    const ctx = makeCtx({ _body: { orgId: ORG, step: 1, data: {} } });
    const res = await updateOnboardingStep(ctx);
    expect(res.body.saved).toBe(true);
    expect(res.body.currentStep).toBe(2);
    expect(res.body.stepsCompleted).toEqual([1]);
  });

  test('rejects starting beyond step 1 (M01-004 out of order)', async () => {
    mocks.push(asOfficer());
    mocks.push(stubRepo(OnboardingStateRepository, { findByOrg: async () => undefined }));
    const ctx = makeCtx({ _body: { orgId: ORG, step: 3, data: {} } });
    await expect(updateOnboardingStep(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('rejects skipping ahead of the current step', async () => {
    mocks.push(asOfficer());
    mocks.push(stubRepo(OnboardingStateRepository, {
      findByOrg: async () => fakeState({ currentStep: 2, stepsCompleted: [1] }),
    }));
    const ctx = makeCtx({ _body: { orgId: ORG, step: 4, data: {} } });
    await expect(updateOnboardingStep(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('completing the final step sets completedAt and emits onboarding.completed', async () => {
    mocks.push(asOfficer());
    mocks.push(stubRepo(OnboardingStateRepository, {
      findByOrg: async () => fakeState({ currentStep: 5, stepsCompleted: [1, 2, 3, 4] }),
      update: async (_o: string, d: any) => ({ ...fakeState({ currentStep: 5 }), ...d }),
    }));

    const emitted: Array<{ e: string; p: any }> = [];
    const origEmit = domainEvents.emit.bind(domainEvents);
    (domainEvents as any).emit = async (e: string, p: any) => { emitted.push({ e, p }); };
    try {
      const ctx = makeCtx({ _body: { orgId: ORG, step: 5, data: {} } });
      const res = await updateOnboardingStep(ctx);
      expect(res.body.currentStep).toBe(5);
      expect(res.body.stepsCompleted).toEqual([1, 2, 3, 4, 5]);
      expect(emitted).toHaveLength(1);
      expect(emitted[0]!.e).toBe('onboarding.completed');
      expect(emitted[0]!.p.organizationId).toBe(ORG);
    } finally {
      (domainEvents as any).emit = origEmit;
    }
  });

  test('does not re-emit when the final step is saved again', async () => {
    mocks.push(asOfficer());
    mocks.push(stubRepo(OnboardingStateRepository, {
      findByOrg: async () => fakeState({ currentStep: 5, stepsCompleted: [1, 2, 3, 4, 5], completedAt: new Date() }),
      update: async (_o: string, d: any) => ({ ...fakeState({ currentStep: 5, completedAt: new Date() }), ...d }),
    }));
    const emitted: any[] = [];
    const origEmit = domainEvents.emit.bind(domainEvents);
    (domainEvents as any).emit = async (e: string, p: any) => { emitted.push({ e, p }); };
    try {
      const ctx = makeCtx({ _body: { orgId: ORG, step: 5, data: {} } });
      await updateOnboardingStep(ctx);
      expect(emitted).toHaveLength(0);
    } finally {
      (domainEvents as any).emit = origEmit;
    }
  });

  test('403 when caller has no officer term', async () => {
    mocks.push(stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] }));
    const ctx = makeCtx({ _body: { orgId: ORG, step: 1, data: {} } });
    await expect(updateOnboardingStep(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
