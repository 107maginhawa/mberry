import { describe, test, expect } from 'bun:test';
import { PayMongoAdapter } from './paymongo.adapter';
import { createHmac } from 'crypto';
import {
  DEFAULT_REMINDER_SCHEDULE,
  calculateReminderDates,
  getDueReminders,
} from './reminder-schedule';
// Factory N/A: utility function test — primitive inputs/outputs, no domain entities

describe('PayMongoAdapter', () => {
  const adapter = new PayMongoAdapter('sk_test_key', 'whsec_test');

  test('has correct name and methods', () => {
    expect(adapter.name).toBe('paymongo');
    expect(adapter.supportedMethods).toContain('gcash');
    expect(adapter.supportedMethods).toContain('maya');
    expect(adapter.supportedMethods).toContain('card');
  });

  test('verifyWebhook returns null for invalid signature', () => {
    const result = adapter.verifyWebhook('{"data":{}}', 't=123,li=invalid');
    expect(result).toBeNull();
  });

  test('verifyWebhook returns null for missing signature parts', () => {
    expect(adapter.verifyWebhook('body', '')).toBeNull();
    expect(adapter.verifyWebhook('body', 'invalid')).toBeNull();
  });

  test('verifyWebhook validates correct signature', () => {
    const body = '{"data":{"id":"evt_123","attributes":{"type":"payment.paid","data":{"id":"pay_1","attributes":{"status":"paid","amount":10000,"currency":"PHP","checkout_session_id":"cs_1","metadata":{}}}}}}';
    const timestamp = '1234567890';
    const payload = `${timestamp}.${body}`;
    const sig = createHmac('sha256', 'whsec_test').update(payload).digest('hex');

    const result = adapter.verifyWebhook(body, `t=${timestamp},li=${sig}`);
    expect(result).not.toBeNull();
    expect(result!.gatewayEventId).toBe('evt_123');
    expect(result!.status).toBe('paid');
    expect(result!.amount).toBe(10000);
  });
});

describe('reminder schedule', () => {
  test('default schedule has 6 entries', () => {
    expect(DEFAULT_REMINDER_SCHEDULE).toHaveLength(6);
  });

  test('calculateReminderDates returns dates for each entry', () => {
    const expiry = new Date('2026-06-15');
    const dates = calculateReminderDates(expiry);
    expect(dates).toHaveLength(6);

    // Pre-60 should be April 16
    expect(dates[0]!.sendAt.toISOString().slice(0, 10)).toBe('2026-04-16');
    // Day-of should be June 15
    expect(dates[3]!.sendAt.toISOString().slice(0, 10)).toBe('2026-06-15');
    // Post-30 should be July 15
    expect(dates[5]!.sendAt.toISOString().slice(0, 10)).toBe('2026-07-15');
  });

  test('getDueReminders filters by today and already sent', () => {
    // Set expiry 5 days from now — pre-60, pre-30, pre-7 should all be due
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 5);

    const due = getDueReminders(expiry, []);
    // -60 and -30 are in the past, -7 is 2 days from now (not due yet)
    const dueLabels = due.map(d => d.daysFromExpiry);
    expect(dueLabels).toContain(-60);
    expect(dueLabels).toContain(-30);
    expect(dueLabels).not.toContain(0); // Not expired yet
  });

  test('getDueReminders excludes already sent', () => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 5);

    const due = getDueReminders(expiry, [-60]); // Already sent -60
    const dueLabels = due.map(d => d.daysFromExpiry);
    expect(dueLabels).not.toContain(-60);
    expect(dueLabels).toContain(-30);
  });

  test('all entries have in-app channel', () => {
    for (const entry of DEFAULT_REMINDER_SCHEDULE) {
      expect(entry.channels).toContain('in-app');
    }
  });
});
