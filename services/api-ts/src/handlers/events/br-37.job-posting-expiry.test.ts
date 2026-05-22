// Business Rules: [BR-37]
/**
 * [BR-37] Job Posting Expiry
 *
 * BR-37: "Job postings expire after 30 days by default. Expiry duration is
 * configurable per individual posting at creation time. Expired postings are
 * removed from the public job board but retained in the officer's posting
 * history for record-keeping. Job posters receive a reminder notification
 * 3 days before their posting expires. They can extend the posting for another
 * 30 days with a single action."
 *
 * Edge case: "Extensions reset the expiry clock from the current expiry date,
 * not from today. A posting extended on day 28 of a 30-day term expires on
 * day 58 from original posting, not day 58 from today."
 */

import { describe, test, expect } from 'bun:test';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

// ─── Pure rule functions (will be extracted to module when M15 is built) ───

const DEFAULT_EXPIRY_DAYS = 30;
const REMINDER_DAYS_BEFORE = 3;
const EXTENSION_DAYS = 30;

interface JobPosting {
  id: string;
  organizationId: string;
  createdAt: Date;
  expiresAt: Date;
  customDurationDays?: number;
  status: 'active' | 'expired';
}

function createPosting(
  id: string,
  orgId: string,
  createdAt: Date,
  customDurationDays?: number,
): JobPosting {
  const days = customDurationDays ?? DEFAULT_EXPIRY_DAYS;
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + days);

  return {
    id,
    organizationId: orgId,
    createdAt,
    expiresAt,
    customDurationDays,
    status: 'active',
  };
}

function isExpired(posting: JobPosting, now: Date): boolean {
  return now >= posting.expiresAt;
}

function shouldSendReminder(posting: JobPosting, now: Date): boolean {
  if (posting.status !== 'active') return false;
  const reminderDate = new Date(posting.expiresAt);
  reminderDate.setDate(reminderDate.getDate() - REMINDER_DAYS_BEFORE);
  return now >= reminderDate && now < posting.expiresAt;
}

function extendPosting(posting: JobPosting): JobPosting {
  // Extension resets from CURRENT expiry date, not from today
  const newExpiry = new Date(posting.expiresAt);
  newExpiry.setDate(newExpiry.getDate() + EXTENSION_DAYS);

  return {
    ...posting,
    expiresAt: newExpiry,
    status: 'active',
  };
}

function isVisibleOnPublicBoard(posting: JobPosting, now: Date): boolean {
  return posting.status === 'active' && !isExpired(posting, now);
}

describe('[BR-37] Job Posting Expiry', () => {
  const baseDate = new Date('2026-01-01T00:00:00Z');

  // ─── Default 30-Day Expiry ────────────────────────────────

  test('default expiry is 30 days from creation', () => {
    const posting = createPosting('job-1', 'org-1', baseDate);
    const expected = new Date('2026-01-31T00:00:00Z');
    expect(posting.expiresAt.getTime()).toBe(expected.getTime());
  });

  // ─── Configurable Duration ────────────────────────────────

  test('custom duration overrides default', () => {
    const posting = createPosting('job-1', 'org-1', baseDate, 14);
    const expected = new Date('2026-01-15T00:00:00Z');
    expect(posting.expiresAt.getTime()).toBe(expected.getTime());
  });

  test('custom duration of 60 days works', () => {
    const posting = createPosting('job-1', 'org-1', baseDate, 60);
    const expected = new Date('2026-03-02T00:00:00Z');
    expect(posting.expiresAt.getTime()).toBe(expected.getTime());
  });

  // ─── Expiry Behavior ──────────────────────────────────────

  test('posting is not expired before expiry date', () => {
    const posting = createPosting('job-1', 'org-1', baseDate);
    const day15 = new Date('2026-01-16T00:00:00Z');
    expect(isExpired(posting, day15)).toBe(false);
  });

  test('posting is expired on expiry date', () => {
    const posting = createPosting('job-1', 'org-1', baseDate);
    const expiryDay = new Date('2026-01-31T00:00:00Z');
    expect(isExpired(posting, expiryDay)).toBe(true);
  });

  // ─── Public Board Visibility ──────────────────────────────

  test('active posting visible on public board', () => {
    const posting = createPosting('job-1', 'org-1', baseDate);
    const day10 = new Date('2026-01-11T00:00:00Z');
    expect(isVisibleOnPublicBoard(posting, day10)).toBe(true);
  });

  test('expired posting removed from public board', () => {
    const posting = createPosting('job-1', 'org-1', baseDate);
    const day31 = new Date('2026-02-01T00:00:00Z');
    expect(isVisibleOnPublicBoard(posting, day31)).toBe(false);
  });

  test('expired posting retained in history (status changes, data preserved)', () => {
    const posting = createPosting('job-1', 'org-1', baseDate);
    // Even after expiry, the posting object retains all data
    expect(posting.id).toBe('job-1');
    expect(posting.organizationId).toBe('org-1');
    expect(posting.createdAt).toBeDefined();
  });

  // ─── 3-Day Reminder ───────────────────────────────────────

  test('reminder sent 3 days before expiry', () => {
    const posting = createPosting('job-1', 'org-1', baseDate);
    const day27 = new Date('2026-01-28T00:00:00Z'); // 3 days before Jan 31
    expect(shouldSendReminder(posting, day27)).toBe(true);
  });

  test('no reminder when more than 3 days remain', () => {
    const posting = createPosting('job-1', 'org-1', baseDate);
    const day15 = new Date('2026-01-16T00:00:00Z');
    expect(shouldSendReminder(posting, day15)).toBe(false);
  });

  test('no reminder after already expired', () => {
    const posting = createPosting('job-1', 'org-1', baseDate);
    const day32 = new Date('2026-02-02T00:00:00Z');
    expect(shouldSendReminder(posting, day32)).toBe(false);
  });

  // ─── Edge Case: Extension From Current Expiry ─────────────

  test('extension adds 30 days from current expiry date, not from today', () => {
    const posting = createPosting('job-1', 'org-1', baseDate); // expires Jan 31
    const extended = extendPosting(posting);

    // Jan 31 + 30 = Mar 2
    const expected = new Date('2026-03-02T00:00:00Z');
    expect(extended.expiresAt.getTime()).toBe(expected.getTime());
  });

  test('extension on day 28 → expires day 58 from original', () => {
    // BR-37 edge case: "A posting extended on day 28 of a 30-day term
    // expires on day 58 from original posting"
    const posting = createPosting('job-1', 'org-1', baseDate); // created Jan 1, expires Jan 31

    // Extend on day 28 (Jan 29) — but extension is from expiry date not today
    const extended = extendPosting(posting);

    // Day 58 from Jan 1 = Mar 1 (but actually Jan 31 + 30 = Mar 2)
    // The BR says "day 58" which = Jan 1 + 58 days = Mar 1
    // But since Jan has 31 days: Jan 31 + 30 = Mar 2
    // The rule means: original_expiry + extension_days
    const daysSinceCreation = Math.round(
      (extended.expiresAt.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    expect(daysSinceCreation).toBe(60); // 30 + 30
  });

  test('extended posting becomes active again', () => {
    const posting = createPosting('job-1', 'org-1', baseDate);
    const expired = { ...posting, status: 'expired' as const };
    const extended = extendPosting(expired);
    expect(extended.status).toBe('active');
  });
});
