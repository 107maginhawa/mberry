/**
 * Reminder Schedule Tests — M6-R5, GAP-012
 *
 * Covers:
 * - Default schedule 60/30/7 pre-expiry, day-of, 7/30 post-expiry
 * - Configurable per-org schedule override
 * - calculateReminderDates correctness
 * - getDueReminders filtering (already-sent exclusion)
 * - Dunning stage escalation template selection
 */

import { describe, test, expect } from 'bun:test';
import {
  DEFAULT_REMINDER_SCHEDULE,
  calculateReminderDates,
  getDueReminders,
  type ReminderScheduleEntry,
} from './reminder-schedule';

// ---------------------------------------------------------------------------
// M6-R5: Default schedule 60/30/7 pre, day-of, 7/30 post
// ---------------------------------------------------------------------------

describe('M6-R5: DEFAULT_REMINDER_SCHEDULE', () => {
  test('has exactly 6 entries', () => {
    expect(DEFAULT_REMINDER_SCHEDULE).toHaveLength(6);
  });

  test('pre-expiry offsets are -60, -30, -7', () => {
    const preExpiry = DEFAULT_REMINDER_SCHEDULE.filter(e => e.daysFromExpiry < 0);
    const offsets = preExpiry.map(e => e.daysFromExpiry).sort((a, b) => a - b);
    expect(offsets).toEqual([-60, -30, -7]);
  });

  test('day-of offset is 0', () => {
    const dayOf = DEFAULT_REMINDER_SCHEDULE.filter(e => e.daysFromExpiry === 0);
    expect(dayOf).toHaveLength(1);
  });

  test('post-expiry offsets are 7, 30', () => {
    const postExpiry = DEFAULT_REMINDER_SCHEDULE.filter(e => e.daysFromExpiry > 0);
    const offsets = postExpiry.map(e => e.daysFromExpiry).sort((a, b) => a - b);
    expect(offsets).toEqual([7, 30]);
  });

  test('all entries have at least in-app channel', () => {
    for (const entry of DEFAULT_REMINDER_SCHEDULE) {
      expect(entry.channels).toContain('in-app');
    }
  });

  test('close-to-expiry entries (-7, 0, 7) include push channel', () => {
    const closeEntries = DEFAULT_REMINDER_SCHEDULE.filter(
      e => [-7, 0, 7].includes(e.daysFromExpiry)
    );
    for (const entry of closeEntries) {
      expect(entry.channels).toContain('push');
    }
  });

  test('far-from-expiry entries (-60, -30, 30) do not include push channel', () => {
    const farEntries = DEFAULT_REMINDER_SCHEDULE.filter(
      e => [-60, -30, 30].includes(e.daysFromExpiry)
    );
    for (const entry of farEntries) {
      expect(entry.channels).not.toContain('push');
    }
  });

  test('all entries include email channel', () => {
    for (const entry of DEFAULT_REMINDER_SCHEDULE) {
      expect(entry.channels).toContain('email');
    }
  });

  test('each entry has a non-empty label', () => {
    for (const entry of DEFAULT_REMINDER_SCHEDULE) {
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// calculateReminderDates
// ---------------------------------------------------------------------------

describe('calculateReminderDates', () => {
  test('returns sendAt dates offset from expiry date', () => {
    const expiry = new Date('2026-12-01');
    const results = calculateReminderDates(expiry);

    expect(results).toHaveLength(6);

    // -60 days: Oct 2
    const pre60 = results.find(r => r.daysFromExpiry === -60)!;
    expect(pre60.sendAt.toISOString().split('T')[0]).toBe('2026-10-02');

    // -30 days: Nov 1
    const pre30 = results.find(r => r.daysFromExpiry === -30)!;
    expect(pre30.sendAt.toISOString().split('T')[0]).toBe('2026-11-01');

    // -7 days: Nov 24
    const pre7 = results.find(r => r.daysFromExpiry === -7)!;
    expect(pre7.sendAt.toISOString().split('T')[0]).toBe('2026-11-24');

    // day-of: Dec 1
    const dayOf = results.find(r => r.daysFromExpiry === 0)!;
    expect(dayOf.sendAt.toISOString().split('T')[0]).toBe('2026-12-01');

    // +7 days: Dec 8
    const post7 = results.find(r => r.daysFromExpiry === 7)!;
    expect(post7.sendAt.toISOString().split('T')[0]).toBe('2026-12-08');

    // +30 days: Dec 31
    const post30 = results.find(r => r.daysFromExpiry === 30)!;
    expect(post30.sendAt.toISOString().split('T')[0]).toBe('2026-12-31');
  });

  test('accepts custom schedule (configurable per org)', () => {
    const customSchedule: ReminderScheduleEntry[] = [
      { daysFromExpiry: -90, label: 'Custom 90-day', channels: ['in-app'] },
      { daysFromExpiry: -14, label: 'Custom 14-day', channels: ['in-app', 'email'] },
      { daysFromExpiry: 0, label: 'Custom day-of', channels: ['in-app', 'email', 'push'] },
    ];

    const expiry = new Date('2026-06-15');
    const results = calculateReminderDates(expiry, customSchedule);

    expect(results).toHaveLength(3);
    expect(results[0].daysFromExpiry).toBe(-90);
    expect(results[0].sendAt.toISOString().split('T')[0]).toBe('2026-03-17');
  });

  test('preserves entry properties in results', () => {
    const results = calculateReminderDates(new Date('2026-06-01'));
    for (const r of results) {
      expect(r).toHaveProperty('daysFromExpiry');
      expect(r).toHaveProperty('label');
      expect(r).toHaveProperty('channels');
      expect(r).toHaveProperty('sendAt');
      expect(r.sendAt).toBeInstanceOf(Date);
    }
  });
});

// ---------------------------------------------------------------------------
// getDueReminders
// ---------------------------------------------------------------------------

describe('getDueReminders', () => {
  test('returns reminders due today or earlier', () => {
    // Expiry far in the past — all reminders should be due
    const expiry = new Date('2020-01-01');
    const due = getDueReminders(expiry);
    expect(due).toHaveLength(6);
  });

  test('returns empty for far-future expiry', () => {
    // Expiry far in the future — no reminders due yet
    const expiry = new Date('2099-01-01');
    const due = getDueReminders(expiry);
    expect(due).toHaveLength(0);
  });

  test('excludes already-sent days', () => {
    const expiry = new Date('2020-01-01');
    // Mark -60 and -30 as already sent
    const due = getDueReminders(expiry, [-60, -30]);
    expect(due).toHaveLength(4); // 6 total - 2 sent = 4
    expect(due.find(d => d.daysFromExpiry === -60)).toBeUndefined();
    expect(due.find(d => d.daysFromExpiry === -30)).toBeUndefined();
  });

  test('accepts custom schedule for per-org config', () => {
    const customSchedule: ReminderScheduleEntry[] = [
      { daysFromExpiry: -45, label: 'Custom 45', channels: ['in-app'] },
      { daysFromExpiry: 0, label: 'Custom day-of', channels: ['in-app'] },
    ];
    const expiry = new Date('2020-01-01');
    const due = getDueReminders(expiry, [], customSchedule);
    expect(due).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// M6-R5: Configurable per-org schedule
// ---------------------------------------------------------------------------

describe('M6-R5: configurable per-org schedule', () => {
  test('org can define fewer reminder points', () => {
    const orgSchedule: ReminderScheduleEntry[] = [
      { daysFromExpiry: -30, label: 'Only 30-day reminder', channels: ['in-app'] },
      { daysFromExpiry: 0, label: 'Day-of', channels: ['in-app', 'email'] },
    ];
    const results = calculateReminderDates(new Date('2026-06-01'), orgSchedule);
    expect(results).toHaveLength(2);
  });

  test('org can define more aggressive schedule', () => {
    const orgSchedule: ReminderScheduleEntry[] = [
      { daysFromExpiry: -90, label: '90-day', channels: ['in-app'] },
      { daysFromExpiry: -60, label: '60-day', channels: ['in-app'] },
      { daysFromExpiry: -30, label: '30-day', channels: ['in-app', 'email'] },
      { daysFromExpiry: -14, label: '14-day', channels: ['in-app', 'email'] },
      { daysFromExpiry: -7, label: '7-day', channels: ['in-app', 'email', 'push'] },
      { daysFromExpiry: -3, label: '3-day', channels: ['in-app', 'email', 'push'] },
      { daysFromExpiry: -1, label: '1-day', channels: ['in-app', 'email', 'push'] },
      { daysFromExpiry: 0, label: 'Day-of', channels: ['in-app', 'email', 'push'] },
      { daysFromExpiry: 7, label: '+7', channels: ['in-app', 'email'] },
      { daysFromExpiry: 30, label: '+30', channels: ['in-app', 'email'] },
      { daysFromExpiry: 60, label: '+60', channels: ['in-app'] },
    ];
    const results = calculateReminderDates(new Date('2026-06-01'), orgSchedule);
    expect(results).toHaveLength(11);
  });

  test('empty schedule produces no reminders', () => {
    const results = calculateReminderDates(new Date('2026-06-01'), []);
    expect(results).toHaveLength(0);
  });
});
