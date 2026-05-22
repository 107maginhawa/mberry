/**
 * Tests for credit transcript template rendering (Slice 043)
 *
 * Covers:
 * - Transcript HTML rendering with cycle-aware formatting
 * - Multi-org grouping and subtotals
 * - Compliance status display
 * - Cycle boundary formatting
 * - Carryover display
 * - Validation
 */

import { describe, test, expect } from 'bun:test';
import {
  renderTranscriptHtml,
  validateTranscriptData,
  type TranscriptData,
  type TranscriptCreditEntry,
} from './transcript-template';
import { summarizeCycle, type CreditCycle } from './credit-cycle';
// Factory N/A: utility function test — primitive inputs/outputs, no domain entities

// ─── Fixtures ───────────────────────────────────────────

function makeCycle(overrides: Partial<CreditCycle> = {}): CreditCycle {
  return {
    cycleStart: new Date('2025-07-01'),
    cycleEnd: new Date('2026-06-30T23:59:59.999Z'),
    cycleNumber: 1,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<TranscriptCreditEntry> = {}): TranscriptCreditEntry {
  return {
    activityName: 'Dental Implants Workshop',
    activityDate: new Date('2025-09-15'),
    creditAmount: 8,
    category: 'Major',
    type: 'auto',
    organizationName: 'Philippine Dental Association',
    ...overrides,
  };
}

function makeTranscriptData(overrides: Partial<TranscriptData> = {}): TranscriptData {
  const cycle = makeCycle();
  const summary = summarizeCycle(cycle, 33, 40, 10);

  return {
    personName: 'Dr. Maria Santos',
    personId: 'person-1',
    generatedAt: new Date('2026-05-20'),
    cycle,
    summary,
    entries: [
      makeEntry(),
      makeEntry({ activityName: 'Oral Surgery Seminar', creditAmount: 15, activityDate: new Date('2025-11-01') }),
      makeEntry({ activityName: 'Self-Study Module', creditAmount: 10, type: 'manual', organizationName: 'Medical Board', category: 'Self-Directed', activityDate: new Date('2026-01-15') }),
    ],
    organizations: [
      { organizationId: 'org-1', name: 'Philippine Dental Association', credits: 23 },
      { organizationId: 'org-2', name: 'Medical Board', credits: 10 },
    ],
    ...overrides,
  };
}

// ─── Transcript Rendering ───────────────────────────────

describe('[043] Credit Transcript Rendering', () => {
  test('renders transcript with person info', () => {
    const data = makeTranscriptData();
    const html = renderTranscriptHtml(data);

    expect(html).toContain('Dr. Maria Santos');
    expect(html).toContain('person-1');
    expect(html).toContain('Continuing Professional Development Transcript');
  });

  test('displays cycle boundaries correctly', () => {
    const data = makeTranscriptData();
    const html = renderTranscriptHtml(data);

    expect(html).toContain('Jul 1, 2025');
    expect(html).toContain('Jun 30, 2026');
    expect(html).toContain('Compliance Cycle 1');
  });

  test('shows compliant status when total >= required', () => {
    const cycle = makeCycle();
    const summary = summarizeCycle(cycle, 35, 40, 10); // total=45 >= 40
    const data = makeTranscriptData({ summary });
    const html = renderTranscriptHtml(data);

    expect(html).toContain('COMPLIANT');
    expect(html).toContain('compliant');
  });

  test('shows non-compliant status when total < required', () => {
    const cycle = makeCycle();
    const summary = summarizeCycle(cycle, 20, 40, 0); // total=20 < 40
    const data = makeTranscriptData({ summary });
    const html = renderTranscriptHtml(data);

    expect(html).toContain('NON-COMPLIANT');
    expect(html).toContain('non-compliant');
  });

  test('displays carryover information', () => {
    const cycle = makeCycle();
    const summary = summarizeCycle(cycle, 30, 40, 15);
    const data = makeTranscriptData({ summary });
    const html = renderTranscriptHtml(data);

    expect(html).toContain('Carryover');
    expect(html).toContain('15');
  });

  test('displays remaining credits', () => {
    const cycle = makeCycle();
    const summary = summarizeCycle(cycle, 25, 40, 0); // remaining = 15
    const data = makeTranscriptData({ summary });
    const html = renderTranscriptHtml(data);

    expect(html).toContain('Remaining');
    expect(html).toContain('15');
  });
});

// ─── Multi-Org Grouping ─────────────────────────────────

describe('[043] Multi-Org Credit Grouping', () => {
  test('groups entries by organization', () => {
    const data = makeTranscriptData();
    const html = renderTranscriptHtml(data);

    expect(html).toContain('Philippine Dental Association');
    expect(html).toContain('Medical Board');
  });

  test('shows organization summary table', () => {
    const data = makeTranscriptData();
    const html = renderTranscriptHtml(data);

    // Org summary rows
    expect(html).toContain('23'); // PDA credits
    expect(html).toContain('10'); // Medical Board credits
  });

  test('renders empty state when no entries', () => {
    const data = makeTranscriptData({ entries: [] });
    const html = renderTranscriptHtml(data);

    expect(html).toContain('No credit entries recorded');
  });

  test('entries sorted by date within each org group', () => {
    const entries = [
      makeEntry({ activityName: 'Late Event', activityDate: new Date('2026-03-01'), organizationName: 'Org A' }),
      makeEntry({ activityName: 'Early Event', activityDate: new Date('2025-08-01'), organizationName: 'Org A' }),
    ];
    const data = makeTranscriptData({ entries });
    const html = renderTranscriptHtml(data);

    const earlyIdx = html.indexOf('Early Event');
    const lateIdx = html.indexOf('Late Event');
    expect(earlyIdx).toBeLessThan(lateIdx);
  });
});

// ─── Entry Type Display ─────────────────────────────────

describe('[043] Credit Entry Type Display', () => {
  test('shows auto badge for auto credits', () => {
    const data = makeTranscriptData({
      entries: [makeEntry({ type: 'auto' })],
    });
    const html = renderTranscriptHtml(data);

    expect(html).toContain('type-auto');
  });

  test('shows manual badge for manual credits', () => {
    const data = makeTranscriptData({
      entries: [makeEntry({ type: 'manual' })],
    });
    const html = renderTranscriptHtml(data);

    expect(html).toContain('type-manual');
  });

  test('shows category or dash when missing', () => {
    const data = makeTranscriptData({
      entries: [makeEntry({ category: undefined })],
    });
    const html = renderTranscriptHtml(data);

    // Uses em-dash for missing category
    expect(html).toContain('—');
  });
});

// ─── Validation ─────────────────────────────────────────

describe('[043] Transcript Data Validation', () => {
  test('valid data returns no errors', () => {
    const data = makeTranscriptData();
    const errors = validateTranscriptData(data);
    expect(errors).toHaveLength(0);
  });

  test('missing personName', () => {
    const errors = validateTranscriptData({ personId: 'p1' });
    expect(errors).toContain('personName is required');
  });

  test('missing cycle', () => {
    const errors = validateTranscriptData({ personName: 'Test', personId: 'p1' });
    expect(errors).toContain('cycle is required');
  });

  test('missing all fields', () => {
    const errors = validateTranscriptData({});
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});
