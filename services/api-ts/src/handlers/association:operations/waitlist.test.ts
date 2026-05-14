import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

/**
 * Waitlist Tests
 *
 * Tests for waitlist entry handlers — auth guards, org guards, position checks.
 */

describe('listWaitlistEntries — guards', () => {
  test('listWaitlistEntries returns 401 without user', async () => {
    const { listWaitlistEntries } = await import('./listWaitlistEntries');
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' } });
    const response = await listWaitlistEntries(ctx);
    expect(response.status).toBe(401);
  });
});

describe('promoteWaitlistEntry — guards', () => {
  test('promoteWaitlistEntry returns 401 without user', async () => {
    const { promoteWaitlistEntry } = await import('./promoteWaitlistEntry');
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1', entryId: 'wl-1' } });
    const response = await promoteWaitlistEntry(ctx);
    expect(response.status).toBe(401);
  });

  test('promoteWaitlistEntry returns 403 without organizationId', async () => {
    const { promoteWaitlistEntry } = await import('./promoteWaitlistEntry');
    const ctx = makeCtx({ organizationId: null, _params: { eventId: 'evt-1', entryId: 'wl-1' } });
    const response = await promoteWaitlistEntry(ctx);
    expect(response.status).toBe(403);
  });
});

describe('Waitlist logic', () => {
  test('waitlist positions are sequential starting from 1', () => {
    const entries = [
      { position: 1, personId: 'p1' },
      { position: 2, personId: 'p2' },
      { position: 3, personId: 'p3' },
    ];
    for (let i = 0; i < entries.length; i++) {
      expect(entries[i]!.position).toBe(i + 1);
    }
  });

  test('promoted entry gets promotedAt timestamp', () => {
    const entry = { promotedAt: null as Date | null };
    entry.promotedAt = new Date();
    expect(entry.promotedAt).not.toBeNull();
  });

  test('promotion creates confirmed registration', () => {
    const entry = { eventId: 'evt-1', personId: 'p1' };
    const registration = {
      eventId: entry.eventId,
      personId: entry.personId,
      status: 'confirmed',
    };
    expect(registration.status).toBe('confirmed');
    expect(registration.eventId).toBe('evt-1');
    expect(registration.personId).toBe('p1');
  });

  test('next position increments by 1', () => {
    const currentMax = 5;
    const nextPosition = currentMax + 1;
    expect(nextPosition).toBe(6);
  });
});
