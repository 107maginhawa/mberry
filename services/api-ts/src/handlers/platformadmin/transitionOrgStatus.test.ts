import { describe, test, expect, afterEach, spyOn } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { transitionOrgStatus } from './transitionOrgStatus';
import { OrganizationRepository } from './repos/platform-admin.repo';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';

// ─── Fixtures ────────────────────────────────────────────

function makeOrg(status: string, updatedAt?: Date) {
  return {
    id: 'org-1',
    associationId: 'assoc-1',
    name: 'Manila Chapter',
    slug: 'manila-chapter',
    status,
    orgType: 'chapter',
    updatedAt: updatedAt ?? new Date(),
    createdAt: new Date(),
  };
}

const SUPER_ADMIN = { id: 'pa-1', userId: 'admin-1', role: 'super' };

// ─── Tests ───────────────────────────────────────────────

describe('transitionOrgStatus', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns 401 when no session', async () => {
    const ctx = makeCtx({ session: null, _params: { organizationId: 'org-1' }, _body: { status: 'active' } });
    const response = await transitionOrgStatus(ctx);
    expect(response.status).toBe(401);
  });

  // ─── FIX-001 (G1): super-only platform mutation ──────────────────────
  // Matrix §3.7: transition org status = super only. analyst/support rejected.
  test('returns 403 for analyst platform admin (not super)', async () => {
    mocks = stubRepo(OrganizationRepository, {
      findById: async () => makeOrg('trial'),
      update: async () => makeOrg('active'),
    });
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', userId: 'admin-1', role: 'analyst' },
      _params: { organizationId: 'org-1' },
      _body: { status: 'active' },
    });
    const response = await transitionOrgStatus(ctx);
    expect(response.status).toBe(403);
  });

  test('returns 403 for support platform admin (not super)', async () => {
    mocks = stubRepo(OrganizationRepository, {
      findById: async () => makeOrg('trial'),
      update: async () => makeOrg('active'),
    });
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', userId: 'admin-1', role: 'support' },
      _params: { organizationId: 'org-1' },
      _body: { status: 'active' },
    });
    const response = await transitionOrgStatus(ctx);
    expect(response.status).toBe(403);
  });

  test('returns 403 when platformAdmin context is absent', async () => {
    mocks = stubRepo(OrganizationRepository, {
      findById: async () => makeOrg('trial'),
      update: async () => makeOrg('active'),
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'member' },
      platformAdmin: undefined,
      _params: { organizationId: 'org-1' },
      _body: { status: 'active' },
    });
    const response = await transitionOrgStatus(ctx);
    expect(response.status).toBe(403);
  });

  // ─── Valid transitions ────────────────────────────────

  const validTransitions: [string, string][] = [
    ['trial', 'active'],
    ['trial', 'cancelled'], // [EM-M03-c7d8e9f0] trial expired, no conversion
    ['active', 'suspended'],
    ['active', 'cancelled'],
    ['suspended', 'active'],
    ['suspended', 'cancelled'],
    ['cancelled', 'active'],
  ];

  for (const [from, to] of validTransitions) {
    test(`allows transition ${from} -> ${to}`, async () => {
      const updatedOrg = makeOrg(to);
      mocks = stubRepo(OrganizationRepository, {
        findById: async () => makeOrg(from),
        update: async () => updatedOrg,
      });

      const ctx = makeCtx({
        platformAdmin: SUPER_ADMIN,
        _params: { organizationId: 'org-1' },
        _body: { status: to },
      });

      const response = await transitionOrgStatus(ctx);
      expect(response.status).toBe(200);
      expect(response.body.status).toBe(to);
    });
  }

  // ─── Invalid transitions ──────────────────────────────

  const invalidTransitions: [string, string][] = [
    ['trial', 'suspended'],
    ['cancelled', 'suspended'],
  ];

  for (const [from, to] of invalidTransitions) {
    test(`rejects invalid transition ${from} -> ${to} with BusinessLogicError`, async () => {
      mocks = stubRepo(OrganizationRepository, {
        findById: async () => makeOrg(from),
        update: async () => makeOrg(to),
      });

      const ctx = makeCtx({
        platformAdmin: SUPER_ADMIN,
        _params: { organizationId: 'org-1' },
        _body: { status: to },
      });

      await expect(transitionOrgStatus(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
    });
  }

  // ─── Not found ───────────────────────────────────────

  test('throws NotFoundError when organization does not exist', async () => {
    mocks = stubRepo(OrganizationRepository, {
      findById: async () => undefined,
      update: async () => undefined,
    });

    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      _params: { organizationId: 'nonexistent' },
      _body: { status: 'active' },
    });

    await expect(transitionOrgStatus(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  // ─── Reactivation window ─────────────────────────────

  test('allows cancelled -> active within 90 days', async () => {
    const recentCancellation = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const updatedOrg = makeOrg('active');
    mocks = stubRepo(OrganizationRepository, {
      findById: async () => makeOrg('cancelled', recentCancellation),
      update: async () => updatedOrg,
    });

    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      _params: { organizationId: 'org-1' },
      _body: { status: 'active' },
    });

    const response = await transitionOrgStatus(ctx);
    expect(response.status).toBe(200);
  });

  test('rejects cancelled -> active after 90 days with BusinessLogicError', async () => {
    const oldCancellation = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000); // 91 days ago
    mocks = stubRepo(OrganizationRepository, {
      findById: async () => makeOrg('cancelled', oldCancellation),
      update: async () => makeOrg('active'),
    });

    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      _params: { organizationId: 'org-1' },
      _body: { status: 'active' },
    });

    await expect(transitionOrgStatus(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  // ─── Audit ───────────────────────────────────────────

  test('audit action fires without crashing when audit is null', async () => {
    mocks = stubRepo(OrganizationRepository, {
      findById: async () => makeOrg('trial'),
      update: async () => makeOrg('active'),
    });

    const ctx = makeCtx({
      audit: null,
      platformAdmin: SUPER_ADMIN,
      _params: { organizationId: 'org-1' },
      _body: { status: 'active' },
    });

    const response = await transitionOrgStatus(ctx);
    expect(response.status).toBe(200);
  });

  // ─── Domain event [EM-M03-d1e2f3a4] ──────────────────

  test('emits org.status.transitioned with from/to statuses', async () => {
    mocks = stubRepo(OrganizationRepository, {
      findById: async () => makeOrg('trial'),
      update: async () => makeOrg('active'),
    });
    const emitSpy = spyOn(domainEvents, 'emit');

    const ctx = makeCtx({
      platformAdmin: SUPER_ADMIN,
      _params: { organizationId: 'org-1' },
      _body: { status: 'active' },
    });

    await transitionOrgStatus(ctx);

    const call = emitSpy.mock.calls.find((c) => c[0] === 'org.status.transitioned');
    expect(call).toBeDefined();
    expect(call?.[1]).toMatchObject({
      organizationId: 'org-1',
      fromStatus: 'trial',
      toStatus: 'active',
    });
    emitSpy.mockRestore();
  });
});
