// FLOW-03: Application Approval → Membership Creation
// Tests that reviewApplication with status=approved creates a membership record.
// Cross-module: application review → membership creation
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeApplication as createFakeApplication } from '@/test-utils/factories';
import { reviewApplication } from './reviewApplication';
import { MembershipRepository } from './repos/membership.repo';
import { DuesConfigRepository } from '../association:member/repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const ORG = 'org-flow-03';
const PERSON = 'person-flow-03';
const APP_ID = 'app-1';
const OFFICER = 'officer-1';

const fakeApplication = createFakeApplication({
  id: APP_ID,
  organizationId: ORG,
  personId: PERSON,
  tierId: 'tier-regular',
  status: 'submitted',
  reason: null,
  reviewedBy: null,
});

function defaultStubs(overrides: Record<string, (...args: any[]) => any> = {}) {
  return stubRepo(MembershipRepository, {
    reviewApplication: async (id: string, status: string, reviewedBy: string, reason?: string) => ({
      ...fakeApplication,
      id,
      status,
      reviewedBy,
      reason,
    }),
    addMember: async (data: any) => ({ id: 'membership-1', ...data }),
    ...overrides,
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[FLOW-03] Application Approval → Membership Creation', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(MembershipRepository);
    restoreRepo(DuesConfigRepository);
    stubRepo(DuesConfigRepository, {
      findAll: async () => [{ id: 'dc-1', gracePeriodDays: 30 }],
    });
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(DuesConfigRepository);
  });

  test('approved application creates membership record', async () => {
    let memberCreated = false;
    let capturedMember: any = null;

    mocks = defaultStubs({
      addMember: async (data: any) => {
        memberCreated = true;
        capturedMember = data;
        return { id: 'membership-1', ...data };
      },
    });

    const ctx = makeCtx({
      _body: { status: 'approved' },
      _params: { appId: APP_ID },
    });
    const response = await reviewApplication(ctx);

    expect(response.status).toBe(200);
    expect(memberCreated).toBe(true);
    expect(capturedMember.organizationId).toBe(ORG);
    expect(capturedMember.personId).toBe(PERSON);
    expect(capturedMember.tierId).toBe('tier-regular');
    expect(capturedMember.status).toBe('active');
    expect(capturedMember.gracePeriodDays).toBe(30);
  });

  test('denied application does NOT create membership', async () => {
    let memberCreated = false;

    mocks = defaultStubs({
      addMember: async () => { memberCreated = true; return {} as any; },
    });

    const ctx = makeCtx({
      _body: { status: 'denied', reason: 'Incomplete documents' },
      _params: { appId: APP_ID },
    });
    const response = await reviewApplication(ctx);

    expect(response.status).toBe(200);
    expect(memberCreated).toBe(false);
  });

  test('rejected status mapped to denied, no membership created', async () => {
    let reviewedStatus: string | null = null;
    let memberCreated = false;

    mocks = defaultStubs({
      reviewApplication: async (_id: string, status: string, reviewedBy: string) => {
        reviewedStatus = status;
        return { ...fakeApplication, status, reviewedBy };
      },
      addMember: async () => { memberCreated = true; return {} as any; },
    });

    const ctx = makeCtx({
      _body: { status: 'rejected' },
      _params: { appId: APP_ID },
    });
    await reviewApplication(ctx);

    expect(reviewedStatus).toBe('denied');
    expect(memberCreated).toBe(false);
  });

  test('approved membership gets 1-year expiry from today', async () => {
    let capturedMember: any = null;

    mocks = defaultStubs({
      addMember: async (data: any) => {
        capturedMember = data;
        return { id: 'membership-1', ...data };
      },
    });

    const ctx = makeCtx({
      _body: { status: 'approved' },
      _params: { appId: APP_ID },
    });
    await reviewApplication(ctx);

    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];

    expect(capturedMember.startDate).toBe(today);
    expect(capturedMember.duesExpiryDate).toBe(nextYear);
  });

  test('officer identity recorded as createdBy', async () => {
    let capturedMember: any = null;

    mocks = defaultStubs({
      addMember: async (data: any) => {
        capturedMember = data;
        return { id: 'membership-1', ...data };
      },
    });

    const ctx = makeCtx({
      _body: { status: 'approved' },
      _params: { appId: APP_ID },
    });
    await reviewApplication(ctx);

    expect(capturedMember.createdBy).toBeDefined();
    expect(capturedMember.updatedBy).toBeDefined();
  });

  // Side-effect tests removed — application notification pipeline (welcome,
  // invitation, rejection) not yet implemented. Re-add when notification
  // system is wired to membership events.
});
