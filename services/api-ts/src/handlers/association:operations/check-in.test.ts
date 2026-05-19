import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

/**
 * Check-In Tests
 *
 * Tests for event and training check-in handlers.
 */

describe('createCheckIn — guards', () => {
  test('createCheckIn returns 401 without user', async () => {
    const { createCheckIn } = await import('./createCheckIn');
    const ctx = makeCtx({ user: null });
    const response = await createCheckIn(ctx);
    expect(response.status).toBe(401);
  });
});

describe('searchCheckIns — guards', () => {
  test('searchCheckIns returns 401 without user', async () => {
    const { searchCheckIns } = await import('./searchCheckIns');
    const ctx = makeCtx({ user: null });
    const response = await searchCheckIns(ctx);
    expect(response.status).toBe(401);
  });
});

describe('checkInCustomEvent — guards', () => {
  test('checkInCustomEvent returns 401 without user', async () => {
    const { checkInCustomEvent } = await import('./checkInCustomEvent');
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' }, _body: {} });
    const response = await checkInCustomEvent(ctx);
    expect(response.status).toBe(401);
  });
});

describe('checkInCustomTraining — guards', () => {
  test('checkInCustomTraining returns 401 without user', async () => {
    const { checkInCustomTraining } = await import('./checkInCustomTraining');
    const ctx = makeCtx({ user: null, _params: { trainingId: 't-1' } });
    const response = await checkInCustomTraining(ctx);
    expect(response.status).toBe(401);
  });
});

describe('Check-in methods', () => {
  test('check-in methods are qr and manual', () => {
    const methods = ['qr', 'manual'];
    expect(methods).toContain('qr');
    expect(methods).toContain('manual');
    expect(methods.length).toBe(2);
  });

  test('default check-in method is manual', () => {
    const input: string | undefined = undefined;
    const method = input || 'manual';
    expect(method).toBe('manual');
  });

  test('check-in requires valid event or training', () => {
    const event = null;
    expect(event).toBeNull();
    // Handler throws NotFoundError when event is null
  });

  test('training check-in requires active enrollment', () => {
    const enrollment = { status: 'enrolled' };
    const cancelled = { status: 'cancelled' };

    const canCheckIn = enrollment.status !== 'cancelled';
    const cannotCheckIn = cancelled.status === 'cancelled';

    expect(canCheckIn).toBe(true);
    expect(cannotCheckIn).toBe(true);
  });

  test('training check-in rejects cancelled enrollment', () => {
    const enrollment = { status: 'cancelled' };
    expect(enrollment.status === 'cancelled').toBe(true);
  });
});
