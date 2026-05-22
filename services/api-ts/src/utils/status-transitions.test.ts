import { describe, it, expect } from 'bun:test';
import {
  BOOKING_EVENT_VALID_TRANSITIONS,
  EMAIL_QUEUE_VALID_TRANSITIONS,
  FEED_POST_VALID_TRANSITIONS,
  isValidTransition,
} from './status-transitions';
// Factory N/A: utility function test — primitive inputs/outputs, no domain entities

describe('isValidTransition', () => {
  it('returns true for a known valid transition', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'draft', 'active')).toBe(true);
  });

  it('returns false for an invalid transition', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'archived', 'draft')).toBe(false);
  });

  it('returns false for unknown from-status', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'nonexistent', 'active')).toBe(false);
  });
});

describe('BOOKING_EVENT_VALID_TRANSITIONS', () => {
  it('draft → active is valid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'draft', 'active')).toBe(true);
  });

  it('draft → archived is valid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'draft', 'archived')).toBe(true);
  });

  it('active → paused is valid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'active', 'paused')).toBe(true);
  });

  it('active → archived is valid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'active', 'archived')).toBe(true);
  });

  it('paused → active is valid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'paused', 'active')).toBe(true);
  });

  it('paused → archived is valid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'paused', 'archived')).toBe(true);
  });

  it('archived has no valid transitions (terminal)', () => {
    expect(BOOKING_EVENT_VALID_TRANSITIONS['archived']).toEqual([]);
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'archived', 'draft')).toBe(false);
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'archived', 'active')).toBe(false);
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'archived', 'paused')).toBe(false);
  });

  it('draft → paused is invalid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'draft', 'paused')).toBe(false);
  });

  it('active → draft is invalid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'active', 'draft')).toBe(false);
  });

  it('unknown status returns false', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'unknown', 'active')).toBe(false);
  });
});

describe('EMAIL_QUEUE_VALID_TRANSITIONS', () => {
  it('pending → processing is valid', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'pending', 'processing')).toBe(true);
  });

  it('pending → cancelled is valid', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'pending', 'cancelled')).toBe(true);
  });

  it('processing → sent is valid', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'processing', 'sent')).toBe(true);
  });

  it('processing → failed is valid', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'processing', 'failed')).toBe(true);
  });

  it('failed → pending is valid (retry)', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'failed', 'pending')).toBe(true);
  });

  it('sent has no valid transitions (terminal)', () => {
    expect(EMAIL_QUEUE_VALID_TRANSITIONS['sent']).toEqual([]);
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'sent', 'pending')).toBe(false);
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'sent', 'failed')).toBe(false);
  });

  it('cancelled has no valid transitions (terminal)', () => {
    expect(EMAIL_QUEUE_VALID_TRANSITIONS['cancelled']).toEqual([]);
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'cancelled', 'pending')).toBe(false);
  });

  it('pending → sent is invalid (must go through processing)', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'pending', 'sent')).toBe(false);
  });

  it('failed → sent is invalid (must retry via pending)', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'failed', 'sent')).toBe(false);
  });

  it('unknown status returns false', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'bounced', 'pending')).toBe(false);
  });
});

describe('FEED_POST_VALID_TRANSITIONS', () => {
  it('draft → published is valid', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'draft', 'published')).toBe(true);
  });

  it('published → flagged is valid', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'published', 'flagged')).toBe(true);
  });

  it('published → removed is valid', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'published', 'removed')).toBe(true);
  });

  it('flagged → published is valid (officer restore)', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'flagged', 'published')).toBe(true);
  });

  it('flagged → removed is valid', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'flagged', 'removed')).toBe(true);
  });

  it('removed has no valid transitions (terminal)', () => {
    expect(FEED_POST_VALID_TRANSITIONS['removed']).toEqual([]);
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'removed', 'draft')).toBe(false);
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'removed', 'published')).toBe(false);
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'removed', 'flagged')).toBe(false);
  });

  it('draft → flagged is invalid', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'draft', 'flagged')).toBe(false);
  });

  it('draft → removed is invalid', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'draft', 'removed')).toBe(false);
  });

  it('published → draft is invalid', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'published', 'draft')).toBe(false);
  });

  it('unknown status returns false', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'hidden', 'published')).toBe(false);
  });
});
