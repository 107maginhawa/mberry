import { describe, test, expect } from 'bun:test';

// Test the nominee state machine logic inline (same transitions as handler)
const VALID_NOMINEE_TRANSITIONS: Record<string, string[]> = {
  nominated: ['accepted', 'declined'],
  accepted: ['declined'],
  declined: [],
  elected: [],
};

function isValidNomineeTransition(from: string, to: string): boolean {
  return VALID_NOMINEE_TRANSITIONS[from]?.includes(to) ?? false;
}

describe('Nominee VALID_TRANSITIONS state machine', () => {
  test('nominated can transition to accepted or declined', () => {
    expect(isValidNomineeTransition('nominated', 'accepted')).toBe(true);
    expect(isValidNomineeTransition('nominated', 'declined')).toBe(true);
  });

  test('accepted can transition to declined (withdraw)', () => {
    expect(isValidNomineeTransition('accepted', 'declined')).toBe(true);
  });

  test('accepted cannot transition to nominated', () => {
    expect(isValidNomineeTransition('accepted', 'nominated')).toBe(false);
  });

  test('declined is terminal', () => {
    expect(isValidNomineeTransition('declined', 'accepted')).toBe(false);
    expect(isValidNomineeTransition('declined', 'nominated')).toBe(false);
  });

  test('elected is terminal', () => {
    expect(isValidNomineeTransition('elected', 'nominated')).toBe(false);
    expect(isValidNomineeTransition('elected', 'declined')).toBe(false);
  });

  test('nominated cannot directly become elected (only via certifyElection)', () => {
    expect(isValidNomineeTransition('nominated', 'elected')).toBe(false);
  });

  test('unknown status returns false', () => {
    expect(isValidNomineeTransition('unknown', 'accepted')).toBe(false);
  });
});
