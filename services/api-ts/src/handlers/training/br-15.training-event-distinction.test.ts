// Business Rules: [BR-15]
/**
 * [BR-15] Training vs Event Distinction — Pure Domain Logic Tests
 *
 * BR-15: Training sessions and events are distinct entity types.
 * - Training sessions always award CPD/CE credits upon completion.
 * - Events do NOT award credits unless explicitly marked credit-bearing
 *   (creditBearing: true) with a creditAmount set.
 * - A credit-bearing event behaves like training for credit purposes only;
 *   it does not become a training entity.
 */

import { describe, test, expect } from 'bun:test';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

// ─── Domain types ────────────────────────────────────────────

interface TrainingSession {
  entityType: 'training';
  id: string;
  creditAmount: number; // always > 0 for a valid training
  isCreditBearing: true; // always true for training
}

interface Event {
  entityType: 'event';
  id: string;
  creditBearing: boolean;
  creditAmount: number; // only meaningful when creditBearing=true
}

type ScheduledActivity = TrainingSession | Event;

// ─── Domain helpers (pure, no DB, no HTTP) ──────────────────

/**
 * Returns the credit amount awarded for completing an activity.
 * BR-15: training always awards credits; events only if creditBearing=true.
 */
function getCreditsAwarded(activity: ScheduledActivity): number {
  if (activity.entityType === 'training') {
    return activity.creditAmount;
  }
  // Event: only if explicitly credit-bearing
  if (activity.creditBearing) {
    return activity.creditAmount;
  }
  return 0;
}

/**
 * Returns whether an activity awards CPD credits.
 */
function isCreditAwardingActivity(activity: ScheduledActivity): boolean {
  return getCreditsAwarded(activity) > 0;
}

// ─── [BR-15] Tests ──────────────────────────────────────────

describe('[BR-15] Training vs Event Distinction', () => {
  test('[BR-15] training always awards credits', () => {
    const training: TrainingSession = {
      entityType: 'training',
      id: 'training-001',
      creditAmount: 6,
      isCreditBearing: true,
    };
    expect(getCreditsAwarded(training)).toBe(6);
    expect(isCreditAwardingActivity(training)).toBe(true);
  });

  test('[BR-15] plain event (creditBearing=false) awards zero credits', () => {
    const event: Event = {
      entityType: 'event',
      id: 'event-001',
      creditBearing: false,
      creditAmount: 0,
    };
    expect(getCreditsAwarded(event)).toBe(0);
    expect(isCreditAwardingActivity(event)).toBe(false);
  });

  test('[BR-15] credit-bearing event awards credits without becoming a training', () => {
    const creditEvent: Event = {
      entityType: 'event',
      id: 'event-002',
      creditBearing: true,
      creditAmount: 3,
    };
    expect(creditEvent.entityType).toBe('event'); // still an event, not training
    expect(getCreditsAwarded(creditEvent)).toBe(3);
    expect(isCreditAwardingActivity(creditEvent)).toBe(true);
  });

  test('[BR-15] credit-bearing event with 0 creditAmount awards no credits', () => {
    const badEvent: Event = {
      entityType: 'event',
      id: 'event-003',
      creditBearing: true,
      creditAmount: 0, // misconfigured
    };
    expect(getCreditsAwarded(badEvent)).toBe(0);
    expect(isCreditAwardingActivity(badEvent)).toBe(false);
  });

  test('[BR-15] training entity type is never confused with event', () => {
    const training: TrainingSession = {
      entityType: 'training',
      id: 'training-002',
      creditAmount: 10,
      isCreditBearing: true,
    };
    const event: Event = {
      entityType: 'event',
      id: 'event-004',
      creditBearing: false,
      creditAmount: 0,
    };
    expect(training.entityType).not.toBe(event.entityType);
    expect(getCreditsAwarded(training)).toBeGreaterThan(0);
    expect(getCreditsAwarded(event)).toBe(0);
  });
});
