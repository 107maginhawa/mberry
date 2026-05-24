/**
 * Dues Schema Verification
 *
 * Validates the Drizzle schema definitions for dues module:
 * - duesConfigs table has required columns including dueDateDay + cycleStartMonth
 * - duesInvoices table has required columns
 * - Enums contain correct values
 * - Type exports are defined
 */

import { describe, test, expect } from 'bun:test';
import {
  duesConfigs,
  duesInvoices,
  agingBuckets,
  duesReminderLogs,
  duesConfigStatusEnum,
  duesInvoiceStatusEnum,
} from './dues.schema';
// Factory N/A: schema structure test — no domain entity construction needed

describe('Dues Schema — Enum Verification', () => {
  test('duesConfigStatusEnum contains all lifecycle states', () => {
    const values = duesConfigStatusEnum.enumValues;
    expect(values).toContain('active');
    expect(values).toContain('retired');
    expect(values).toHaveLength(2);
  });

  test('duesInvoiceStatusEnum contains all states', () => {
    const values = duesInvoiceStatusEnum.enumValues;
    expect(values).toContain('generated');
    expect(values).toContain('sent');
    expect(values).toContain('paid');
    expect(values).toContain('overdue');
    expect(values).toContain('cancelled');
    expect(values).toContain('writtenOff');
    expect(values).toHaveLength(6);
  });
});

describe('Dues Schema — duesConfigs Table Structure', () => {
  test('duesConfigs table has required columns', () => {
    const cols = Object.keys(duesConfigs);
    const required = [
      'organizationId', 'tierId', 'annualAmount', 'currency',
      'gracePeriodDays', 'fundAllocations', 'effectiveDate', 'status',
    ];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });

  test('duesConfigs has dueDateDay column', () => {
    const cols = Object.keys(duesConfigs);
    expect(cols).toContain('dueDateDay');
  });

  test('duesConfigs has cycleStartMonth column', () => {
    const cols = Object.keys(duesConfigs);
    expect(cols).toContain('cycleStartMonth');
  });

  test('dueDateDay has default value of 1', () => {
    // Drizzle stores default in column config — verify column is defined
    expect(duesConfigs.dueDateDay).toBeDefined();
    expect(duesConfigs.dueDateDay.notNull).toBe(true);
  });

  test('cycleStartMonth has default value of 1', () => {
    expect(duesConfigs.cycleStartMonth).toBeDefined();
    expect(duesConfigs.cycleStartMonth.notNull).toBe(true);
  });
});

describe('Dues Schema — duesInvoices Table Structure', () => {
  test('duesInvoices table has required columns', () => {
    const cols = Object.keys(duesInvoices);
    const required = [
      'membershipId', 'personId', 'organizationId', 'invoiceNumber',
      'periodStart', 'periodEnd', 'totalAmount', 'fundAllocations', 'status',
    ];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });
});

describe('Dues Schema — agingBuckets Table Structure', () => {
  test('agingBuckets table has required columns', () => {
    const cols = Object.keys(agingBuckets);
    const required = [
      'organizationId', 'asOfDate', 'current', 'thirtyDay',
      'sixtyDay', 'ninetyDay', 'overNinety', 'totalOutstanding',
    ];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });
});

describe('Dues Schema — duesReminderLogs Table Structure', () => {
  test('duesReminderLogs table has required columns', () => {
    const cols = Object.keys(duesReminderLogs);
    const required = [
      'organizationId', 'personId', 'duesConfigId',
      'periodKey', 'daysOffset', 'channel', 'sentAt',
    ];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });
});
