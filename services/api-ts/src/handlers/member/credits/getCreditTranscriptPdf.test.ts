/**
 * Tests for getCreditTranscriptPdf handler (Slice 043)
 *
 * Covers:
 * - Auth guard (401)
 * - Transcript accuracy with cycle boundaries
 * - Cycle-aware formatting (registration-based and association-level)
 * - Cross-org aggregation in PDF
 * - HTML content structure
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { getCreditTranscriptPdf } from './getCreditTranscriptPdf';

// ─── Fixtures ───────────────────────────────────────────

const orgCredits = [
  { organizationId: 'org-dental', organizationName: 'Dental Association', total: 20 },
  { organizationId: 'org-medical', organizationName: 'Medical Board', total: 13 },
];

const creditEntries = [
  {
    id: 'ce-1',
    activityName: 'Dental Implants Workshop',
    activityDate: new Date('2025-09-15'),
    creditAmount: 8,
    category: 'Major',
    type: 'auto',
    organizationName: 'Dental Association',
  },
  {
    id: 'ce-2',
    activityName: 'Oral Surgery Seminar',
    activityDate: new Date('2025-11-01'),
    creditAmount: 12,
    category: 'Major',
    type: 'auto',
    organizationName: 'Dental Association',
  },
  {
    id: 'ce-3',
    activityName: 'Self-Study Module',
    activityDate: new Date('2026-01-15'),
    creditAmount: 13,
    category: 'Self-Directed',
    type: 'manual',
    organizationName: 'Medical Board',
  },
];

function makeTranscriptCtx(queryOverrides: Record<string, string> = {}) {
  return makeCtx({
    _query: {
      registrationDate: '2024-01-01',
      cyclePeriodYears: '2',
      requiredCredits: '40',
      carryoverEnabled: 'true',
      previousCycleEarned: '50',
      personName: 'Dr. Maria Santos',
      ...queryOverrides,
    },
  });
}

function defaultStubs() {
  return stubRepo(CreditEntryRepository, {
    sumCreditsByOrg: async () => orgCredits,
    listForPerson: async () => creditEntries,
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[043] getCreditTranscriptPdf', () => {
  beforeEach(() => {
    restoreRepo(CreditEntryRepository);
  });

  afterEach(() => {
    restoreRepo(CreditEntryRepository);
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _query: { registrationDate: '2024-01-01' } });
    const res = await getCreditTranscriptPdf(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 with transcript HTML', async () => {
    defaultStubs();
    const ctx = makeTranscriptCtx();
    const res = await getCreditTranscriptPdf(ctx);

    expect(res.status).toBe(200);
    expect(res.body.html).toBeDefined();
    expect(res.body.contentType).toBe('text/html');
    expect(res.body.personId).toBe('user-1');
  });

  test('transcript HTML contains person name', async () => {
    defaultStubs();
    const ctx = makeTranscriptCtx();
    const res = await getCreditTranscriptPdf(ctx);

    expect(res.body.html).toContain('Dr. Maria Santos');
  });

  test('transcript HTML contains cycle boundary dates', async () => {
    defaultStubs();
    const ctx = makeTranscriptCtx();
    const res = await getCreditTranscriptPdf(ctx);

    // Cycle info should be present
    expect(res.body.cycle.cycleStart).toBeDefined();
    expect(res.body.cycle.cycleEnd).toBeDefined();
    expect(res.body.cycle.cycleNumber).toBeDefined();
  });

  test('summary includes carryover from previous cycle', async () => {
    defaultStubs();
    // previousCycleEarned=50, required=40, carryover = min(10, 20) = 10
    const ctx = makeTranscriptCtx({ previousCycleEarned: '50' });
    const res = await getCreditTranscriptPdf(ctx);

    expect(res.body.summary.carryoverFromPrevious).toBe(10);
    expect(res.body.summary.earned).toBe(33); // 20 + 13
    expect(res.body.summary.total).toBe(43); // 33 + 10
    expect(res.body.summary.compliant).toBe(true);
  });

  test('transcript accuracy: earned matches sum of org credits', async () => {
    defaultStubs();
    const ctx = makeTranscriptCtx();
    const res = await getCreditTranscriptPdf(ctx);

    expect(res.body.summary.earned).toBe(33); // 20 + 13
  });

  test('non-compliant when insufficient credits', async () => {
    stubRepo(CreditEntryRepository, {
      sumCreditsByOrg: async () => [{ organizationId: 'org-1', organizationName: 'Org', total: 10 }],
      listForPerson: async () => [],
    });
    const ctx = makeTranscriptCtx({ previousCycleEarned: '0', carryoverEnabled: 'false' });
    const res = await getCreditTranscriptPdf(ctx);

    expect(res.body.summary.compliant).toBe(false);
    expect(res.body.summary.remaining).toBe(30); // 40 - 10
  });

  test('HTML contains organization names from cross-org aggregation', async () => {
    defaultStubs();
    const ctx = makeTranscriptCtx();
    const res = await getCreditTranscriptPdf(ctx);

    expect(res.body.html).toContain('Dental Association');
    expect(res.body.html).toContain('Medical Board');
  });

  test('supports association-level cycle config (BR-11)', async () => {
    defaultStubs();
    const ctx = makeTranscriptCtx({
      cycleStartMonth: '7',
      cycleStartDay: '1',
      cyclePeriodYears: '1',
    });
    const res = await getCreditTranscriptPdf(ctx);

    expect(res.status).toBe(200);
    expect(res.body.html).toBeDefined();
  });

  test('empty entries renders gracefully', async () => {
    stubRepo(CreditEntryRepository, {
      sumCreditsByOrg: async () => [],
      listForPerson: async () => [],
    });
    const ctx = makeTranscriptCtx();
    const res = await getCreditTranscriptPdf(ctx);

    expect(res.status).toBe(200);
    expect(res.body.html).toContain('No credit entries recorded');
    expect(res.body.summary.earned).toBe(0);
  });
});
