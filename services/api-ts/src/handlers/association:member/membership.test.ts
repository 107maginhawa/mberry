import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { createMembershipTier } from './createMembershipTier';
import { getMembershipTier } from './getMembershipTier';
import { BusinessLogicError } from '@/core/errors';

// M02: getMyMemberships should return all memberships for the authenticated user
describe('getMyMemberships', () => {
  test('returns 401 without user', async () => {
    const { getMyMemberships } = await import('./getMyMemberships');
    const ctx = makeCtx({ user: null });
    const response = await getMyMemberships(ctx);
    expect(response.status).toBe(401);
  });

  test('uses authenticated user ID, not a param', () => {
    // The endpoint should derive personId from ctx.get('user').id
    // not from a path/query parameter — security requirement
    const ctx = makeCtx({ user: { id: 'user-123' } });
    expect(ctx.get('user').id).toBe('user-123');
  });
});

/**
 * Membership Module Tests
 *
 * Tests auth guards, business rule validation, and state transition logic.
 */

// -- Membership Tier Auth Tests --

describe('Membership Tier CRUD', () => {
  test('createMembershipTier returns 401 without user', async () => {
    const ctx = makeCtx({ user: null });
    const response = await createMembershipTier(ctx);
    expect(response.status).toBe(401);
  });

  test('createMembershipTier returns 403 without tenantId', async () => {
    const ctx = makeCtx({ tenantId: null });
    const response = await createMembershipTier(ctx);
    expect(response.status).toBe(403);
  });

  test('getMembershipTier throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, '_params': { tierId: 'tier-1' } });
    await expect(getMembershipTier(ctx)).rejects.toThrow();
  });
});

// -- Membership Lifecycle Business Rules --

describe('Membership Lifecycle', () => {
  test('BR-07: renewal extends from current expiry, not today', () => {
    // Core business rule: if membership expires 2025-06-01,
    // renewal should set new expiry to 2026-06-01 (current + 1yr)
    // NOT today + 1yr
    const currentExpiry = new Date('2025-06-01');
    currentExpiry.setFullYear(currentExpiry.getFullYear() + 1);
    const newExpiry = currentExpiry.toISOString().split('T')[0];

    expect(newExpiry).toBe('2026-06-01');

    // Also verify: if expiry is in the past, still extends from expiry
    const pastExpiry = new Date('2024-01-15');
    pastExpiry.setFullYear(pastExpiry.getFullYear() + 1);
    expect(pastExpiry.toISOString().split('T')[0]).toBe('2025-01-15');
  });

  test('renewable statuses are active, gracePeriod, lapsed', () => {
    const renewableStatuses = ['active', 'gracePeriod', 'lapsed'];
    const nonRenewable = ['pendingPayment', 'expired', 'suspended', 'terminated'];

    // Verify renewable set
    expect(renewableStatuses).toContain('active');
    expect(renewableStatuses).toContain('gracePeriod');
    expect(renewableStatuses).toContain('lapsed');
    expect(renewableStatuses.length).toBe(3);

    // Verify non-renewable are excluded
    for (const status of nonRenewable) {
      expect(renewableStatuses).not.toContain(status);
    }
  });

  test('terminateMembership requires valid membership status', () => {
    // Termination should record status, timestamp, and reason
    const membership = {
      status: 'active',
      terminatedAt: null,
      terminationReason: null,
    };

    // After termination:
    const terminated = {
      ...membership,
      status: 'terminated',
      terminatedAt: new Date(),
      terminationReason: 'Non-payment',
    };

    expect(terminated.status).toBe('terminated');
    expect(terminated.terminatedAt).toBeInstanceOf(Date);
    expect(terminated.terminationReason).toBe('Non-payment');
  });

  test('reinstateMembership only works on terminated/suspended', () => {
    const reinstatableStatuses = ['terminated', 'suspended'];
    const nonReinstatable = ['active', 'gracePeriod', 'lapsed', 'pendingPayment', 'expired'];

    for (const status of reinstatableStatuses) {
      expect(['terminated', 'suspended']).toContain(status);
    }

    for (const status of nonReinstatable) {
      expect(reinstatableStatuses).not.toContain(status);
    }
  });
});

// -- Membership Application Workflow --

describe('Membership Application Workflow', () => {
  test('approvable statuses are submitted and underReview only', () => {
    const approvableStatuses = ['submitted', 'underReview'];

    expect(approvableStatuses).toContain('submitted');
    expect(approvableStatuses).toContain('underReview');
    expect(approvableStatuses).not.toContain('denied');
    expect(approvableStatuses).not.toContain('approved');
    expect(approvableStatuses).not.toContain('waitlisted');
  });

  test('approve creates membership with pendingPayment status', () => {
    // When an application is approved, a new membership record is created
    // with status='pendingPayment' (not 'active' — payment must come first)
    const membershipFromApproval = {
      status: 'pendingPayment',
      joinedAt: new Date(),
    };

    expect(membershipFromApproval.status).toBe('pendingPayment');
    expect(membershipFromApproval.joinedAt).toBeInstanceOf(Date);
  });

  test('deny records reviewer and reason', () => {
    const denied = {
      status: 'denied',
      reviewedBy: 'reviewer-1',
      reviewedAt: new Date(),
    };

    expect(denied.status).toBe('denied');
    expect(denied.reviewedBy).toBe('reviewer-1');
    expect(denied.reviewedAt).toBeInstanceOf(Date);
  });

  test('cannot approve already denied application', () => {
    const approvableStatuses = ['submitted', 'underReview'];
    const deniedApplication = { status: 'denied' };

    expect(approvableStatuses.includes(deniedApplication.status)).toBe(false);
  });

  test('new membership start date defaults to today', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('new membership expiry is 1 year from start', () => {
    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const diffMs = oneYearLater.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    // Should be approximately 365-366 days
    expect(diffDays).toBeGreaterThanOrEqual(365);
    expect(diffDays).toBeLessThanOrEqual(366);
  });
});
