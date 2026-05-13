import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { transitionOrgStatus } from './transitionOrgStatus';
import { OrganizationRepository } from './repos/platform-admin.repo';
import { NotFoundError, BusinessLogicError } from '@/core/errors';

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

// ─── Tests ───────────────────────────────────────────────

describe('transitionOrgStatus', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns 401 when no session', async () => {
    const ctx = makeCtx({ session: null, _params: { orgId: 'org-1' }, _body: { status: 'active' } });
    const response = await transitionOrgStatus(ctx);
    expect(response.status).toBe(401);
  });

  // ─── Valid transitions ────────────────────────────────

  const validTransitions: [string, string][] = [
    ['trial', 'active'],
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
        _params: { orgId: 'org-1' },
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
    ['trial', 'cancelled'],
  ];

  for (const [from, to] of invalidTransitions) {
    test(`rejects invalid transition ${from} -> ${to} with BusinessLogicError`, async () => {
      mocks = stubRepo(OrganizationRepository, {
        findById: async () => makeOrg(from),
        update: async () => makeOrg(to),
      });

      const ctx = makeCtx({
        _params: { orgId: 'org-1' },
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
      _params: { orgId: 'nonexistent' },
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
      _params: { orgId: 'org-1' },
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
      _params: { orgId: 'org-1' },
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
      _params: { orgId: 'org-1' },
      _body: { status: 'active' },
    });

    const response = await transitionOrgStatus(ctx);
    expect(response.status).toBe(200);
  });
});
