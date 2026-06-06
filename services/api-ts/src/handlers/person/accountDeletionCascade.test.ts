/**
 * Tests for account deletion cascade — emit-only shim.
 *
 * The cascade itself no longer touches any tables. It now emits
 * `person.deleted` on the domain event bus; the actual per-module
 * cleanup lives in `core/domain-event-consumers.ts`.
 *
 * Behavioral coverage for each subscriber is owned by that consumer's
 * own test file. This file only verifies the emit contract.
 *
 * Pattern: see `cancelMyAccountDeletion.test.ts`.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { domainEvents } from '@/core/domain-events';
import { executeCascadeDeletion } from './accountDeletionCascade';

const PERSON_ID = 'person-cascade-1';

describe('executeCascadeDeletion (emit-only)', () => {
  let captured: Array<{ personId: string; scheduledAt: string }>;
  const subscriber = async (payload: { personId: string; scheduledAt: string }) => {
    captured.push(payload);
  };

  beforeEach(() => {
    domainEvents.reset();
    captured = [];
    domainEvents.on('person.deleted', subscriber);
  });

  afterEach(() => {
    domainEvents.reset();
  });

  test('emits person.deleted with { personId, scheduledAt }', async () => {
    await executeCascadeDeletion({ db: {} as any, personId: PERSON_ID });
    expect(captured).toHaveLength(1);
    expect(captured[0]!.personId).toBe(PERSON_ID);
    expect(typeof captured[0]!.scheduledAt).toBe('string');
  });

  test('scheduledAt is an ISO-8601 timestamp', async () => {
    await executeCascadeDeletion({ db: {} as any, personId: PERSON_ID });
    const { scheduledAt } = captured[0]!;
    // Round-trip through Date — invalid input yields NaN.
    const parsed = new Date(scheduledAt);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
    expect(parsed.toISOString()).toBe(scheduledAt);
  });

  test('return value matches the emitted payload', async () => {
    const res = await executeCascadeDeletion({ db: {} as any, personId: PERSON_ID });
    expect(res.emitted).toBe(true);
    expect(res.personId).toBe(PERSON_ID);
    expect(res.emittedAt).toBe(captured[0]!.scheduledAt);
  });

  test('awaits the emit before returning (caller can sequence)', async () => {
    let subscriberResolved = false;
    domainEvents.reset();
    domainEvents.on('person.deleted', async () => {
      await new Promise((r) => setTimeout(r, 10));
      subscriberResolved = true;
    });
    await executeCascadeDeletion({ db: {} as any, personId: PERSON_ID });
    expect(subscriberResolved).toBe(true);
  });

  test.skip('TODO: per-subscriber behavioral coverage — moved out from this file. Add tests under core/domain-event-consumers.test.ts for the 9 person.deleted subscribers', () => {});
});
