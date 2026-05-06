import { describe, test, expect } from 'vitest';
import {
  getStatusLabel,
  getStatusColor,
  isRenewable,
  isReinstatable,
  formatMemberNumber,
} from './membership-status';

describe('[BR-01] getStatusLabel', () => {
  test('maps all membership statuses to human labels', () => {
    expect(getStatusLabel('active')).toBe('Active');
    expect(getStatusLabel('pendingPayment')).toBe('Pending Payment');
    expect(getStatusLabel('gracePeriod')).toBe('Grace Period');
    expect(getStatusLabel('lapsed')).toBe('Lapsed');
    expect(getStatusLabel('expired')).toBe('Expired');
    expect(getStatusLabel('suspended')).toBe('Suspended');
    expect(getStatusLabel('terminated')).toBe('Terminated');
  });

  test('returns raw value for unknown status', () => {
    expect(getStatusLabel('unknown' as any)).toBe('unknown');
  });
});

describe('[BR-01] getStatusColor', () => {
  test('active is green', () => {
    expect(getStatusColor('active')).toBe('green');
  });

  test('grace period is yellow', () => {
    expect(getStatusColor('gracePeriod')).toBe('yellow');
  });

  test('terminated/suspended are red', () => {
    expect(getStatusColor('terminated')).toBe('red');
    expect(getStatusColor('suspended')).toBe('red');
  });

  test('pending is blue', () => {
    expect(getStatusColor('pendingPayment')).toBe('blue');
  });

  test('lapsed/expired are orange', () => {
    expect(getStatusColor('lapsed')).toBe('orange');
    expect(getStatusColor('expired')).toBe('orange');
  });
});

describe('[BR-01] isRenewable', () => {
  test('active, gracePeriod, lapsed are renewable', () => {
    expect(isRenewable('active')).toBe(true);
    expect(isRenewable('gracePeriod')).toBe(true);
    expect(isRenewable('lapsed')).toBe(true);
  });

  test('other statuses are not renewable', () => {
    expect(isRenewable('pendingPayment')).toBe(false);
    expect(isRenewable('expired')).toBe(false);
    expect(isRenewable('suspended')).toBe(false);
    expect(isRenewable('terminated')).toBe(false);
  });
});

describe('[BR-01] isReinstatable', () => {
  test('terminated and suspended are reinstatable', () => {
    expect(isReinstatable('terminated')).toBe(true);
    expect(isReinstatable('suspended')).toBe(true);
  });

  test('other statuses are not reinstatable', () => {
    expect(isReinstatable('active')).toBe(false);
    expect(isReinstatable('gracePeriod')).toBe(false);
    expect(isReinstatable('lapsed')).toBe(false);
  });
});

describe('formatMemberNumber', () => {
  test('formats member number with prefix', () => {
    expect(formatMemberNumber('12345')).toBe('MEM-12345');
  });

  test('returns dash for null/undefined', () => {
    expect(formatMemberNumber(null)).toBe('—');
    expect(formatMemberNumber(undefined)).toBe('—');
  });
});
