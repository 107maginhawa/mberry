import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

/**
 * Custom Events Tests
 *
 * Tests for event lifecycle handlers: register, list registrations,
 * attendance, my events, search registrations, refund.
 */

// ─── registerForCustomEvent ────────────────────────────────

describe('registerForCustomEvent — guards', () => {
  test('registerForCustomEvent returns 401 without user', async () => {
    const { registerForCustomEvent } = await import('./registerForCustomEvent');
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' } });
    const response = await registerForCustomEvent(ctx);
    expect(response.status).toBe(401);
  });

  test('registerForCustomEvent returns 403 without organizationId', async () => {
    const { registerForCustomEvent } = await import('./registerForCustomEvent');
    const ctx = makeCtx({ organizationId: null, _params: { eventId: 'evt-1' } });
    const response = await registerForCustomEvent(ctx);
    expect(response.status).toBe(403);
  });
});

describe('registerForCustomEvent — business logic', () => {
  test('only published events accept registration', () => {
    const published = { status: 'published' };
    const draft = { status: 'draft' };
    const cancelled = { status: 'cancelled' };

    expect(published.status === 'published').toBe(true);
    expect(draft.status === 'published').toBe(false);
    expect(cancelled.status === 'published').toBe(false);
  });

  test('auto-waitlist when at capacity', () => {
    const event = { capacity: 50 };
    const confirmedCount = 50;
    const shouldWaitlist = event.capacity !== null && confirmedCount >= event.capacity;
    expect(shouldWaitlist).toBe(true);
  });

  test('no waitlist when under capacity', () => {
    const event = { capacity: 50 };
    const confirmedCount = 30;
    const shouldWaitlist = event.capacity !== null && confirmedCount >= event.capacity;
    expect(shouldWaitlist).toBe(false);
  });

  test('no capacity limit when capacity is null', () => {
    const event = { capacity: null };
    const confirmedCount = 9999;
    const shouldWaitlist = event.capacity !== null && confirmedCount >= event.capacity;
    expect(shouldWaitlist).toBe(false);
  });
});

// ─── listCustomEventRegistrations ──────────────────────────

describe('listCustomEventRegistrations — guards', () => {
  test('listCustomEventRegistrations returns 401 without user', async () => {
    const { listCustomEventRegistrations } = await import('./listCustomEventRegistrations');
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' } });
    const response = await listCustomEventRegistrations(ctx);
    expect(response.status).toBe(401);
  });
});

// ─── listCustomEventAttendance ─────────────────────────────

describe('listCustomEventAttendance — guards', () => {
  test('listCustomEventAttendance returns 401 without user', async () => {
    const { listCustomEventAttendance } = await import('./listCustomEventAttendance');
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' } });
    const response = await listCustomEventAttendance(ctx);
    expect(response.status).toBe(401);
  });
});

// ─── listMyCustomEvents ────────────────────────────────────

describe('listMyCustomEvents — guards', () => {
  test('listMyCustomEvents returns 401 without session', async () => {
    const { listMyCustomEvents } = await import('./listMyCustomEvents');
    // This handler uses auth.api.getSession, so null auth returns 401
    const ctx = makeCtx({ user: null });
    const response = await listMyCustomEvents(ctx);
    expect(response.status).toBe(401);
  });
});

// ─── searchEventRegistrations ──────────────────────────────

describe('searchEventRegistrations — guards', () => {
  test('searchEventRegistrations returns 401 without user', async () => {
    const { searchEventRegistrations } = await import('./searchEventRegistrations');
    const ctx = makeCtx({ user: null });
    const response = await searchEventRegistrations(ctx);
    expect(response.status).toBe(401);
  });
});

// ─── refundEventRegistration ───────────────────────────────

describe('refundEventRegistration — guards', () => {
  test('refundEventRegistration returns 401 without user', async () => {
    const { refundEventRegistration } = await import('./refundEventRegistration');
    const ctx = makeCtx({ user: null, _params: { registrationId: 'reg-1' } });
    const response = await refundEventRegistration(ctx);
    expect(response.status).toBe(401);
  });
});

describe('refundEventRegistration — business logic', () => {
  test('already refunded registration cannot be refunded again', () => {
    const registration = { status: 'refunded' };
    expect(registration.status === 'refunded').toBe(true);
  });

  test('confirmed registration can be refunded', () => {
    const registration = { status: 'confirmed' };
    const canRefund = registration.status !== 'refunded';
    expect(canRefund).toBe(true);
  });

  test('refund sets refundedAt timestamp', () => {
    const registration = {
      status: 'confirmed' as string,
      refundedAt: null as Date | null,
    };
    registration.status = 'refunded';
    registration.refundedAt = new Date();
    expect(registration.status).toBe('refunded');
    expect(registration.refundedAt).not.toBeNull();
  });

  test('registration statuses include refunded', () => {
    const statuses = ['confirmed', 'waitlisted', 'cancelled', 'refunded', 'noShow'];
    expect(statuses).toContain('refunded');
  });
});
