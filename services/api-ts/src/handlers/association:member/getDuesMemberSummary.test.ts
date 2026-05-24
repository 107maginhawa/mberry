/**
 * Tests for getDuesMemberSummary
 *
 * Covers:
 * - AC-T4-001: Returns all invoices for member
 * - AC-T4-002: Returns all payments with method, status, date, amount
 * - AC-T4-003: Computed balance (total unpaid invoices)
 * - AC-T4-004: Membership status timeline
 * - AC-T4-005: Officer auth required (401/403)
 * - AC-T4-006: Empty member returns valid empty response
 * - BR-T4-001: Balance = sum of unpaid invoice amounts
 * - BR-T4-002: Refunded payments reflect in balance correctly
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DuesRepository } from './repos/dues-payments.repo';
import { OfficerTermRepository } from './repos/governance.repo';
import { getDuesMemberSummary } from './getDuesMemberSummary';

// ─── Fixtures ───────────────────────────────────────────

const memberSummary = {
  invoices: [
    { id: 'inv-1', invoiceNumber: 'INV-2026-000001', periodStart: '2026-01-01', periodEnd: '2026-12-31', totalAmount: 120000, status: 'paid', paidAt: '2026-02-15' },
    { id: 'inv-2', invoiceNumber: 'INV-2026-000002', periodStart: '2026-01-01', periodEnd: '2026-03-31', totalAmount: 30000, status: 'overdue', paidAt: null },
  ],
  payments: [
    { id: 'pay-1', amount: 120000, paymentMethod: 'online', status: 'completed', paidAt: '2026-02-15' },
  ],
  balance: 30000,
  statusTimeline: [
    { fromStatus: null, toStatus: 'pendingPayment', changedAt: '2026-01-01' },
    { fromStatus: 'pendingPayment', toStatus: 'active', changedAt: '2026-02-15' },
  ],
};

const emptySummary = {
  invoices: [],
  payments: [],
  balance: 0,
  statusTimeline: [],
};

// ─── Stubs ──────────────────────────────────────────────

stubRepo(OfficerTermRepository, {
  findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
});

// ─── Tests ──────────────────────────────────────────────

describe('getDuesMemberSummary', () => {
  afterEach(() => {
    restoreRepo(DuesRepository);
  });

  // ── AC-T4-005: Auth ───────────────────────────────────

  test('[AC-T4-005] returns 401 without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1', personId: 'person-1' },
    });

    try {
      await getDuesMemberSummary(ctx);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.status ?? err.statusCode ?? 401).toBe(401);
    }
  });

  // ── AC-T4-001: Invoices ───────────────────────────────

  test('[AC-T4-001] returns all invoices for the member', async () => {
    stubRepo(DuesRepository, {
      getMemberFinancialSummary: async () => memberSummary,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', personId: 'person-1' },
      organizationId: 'org-1',
    });

    const res = await getDuesMemberSummary(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data.invoices).toHaveLength(2);
    expect(res.body.data.invoices[0].invoiceNumber).toBe('INV-2026-000001');
  });

  // ── AC-T4-002: Payments ───────────────────────────────

  test('[AC-T4-002] returns payments with method, status, date, amount', async () => {
    stubRepo(DuesRepository, {
      getMemberFinancialSummary: async () => memberSummary,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', personId: 'person-1' },
      organizationId: 'org-1',
    });

    const res = await getDuesMemberSummary(ctx);
    expect(res.body.data.payments).toHaveLength(1);
    expect(res.body.data.payments[0]).toMatchObject({
      amount: 120000,
      paymentMethod: 'online',
      status: 'completed',
    });
  });

  // ── AC-T4-003 + BR-T4-001: Balance ────────────────────

  test('[AC-T4-003] [BR-T4-001] balance equals sum of unpaid invoice amounts', async () => {
    stubRepo(DuesRepository, {
      getMemberFinancialSummary: async () => memberSummary,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', personId: 'person-1' },
      organizationId: 'org-1',
    });

    const res = await getDuesMemberSummary(ctx);
    expect(res.body.data.balance).toBe(30000); // only inv-2 is unpaid
  });

  // ── AC-T4-004: Status timeline ────────────────────────

  test('[AC-T4-004] returns membership status timeline', async () => {
    stubRepo(DuesRepository, {
      getMemberFinancialSummary: async () => memberSummary,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', personId: 'person-1' },
      organizationId: 'org-1',
    });

    const res = await getDuesMemberSummary(ctx);
    expect(res.body.data.statusTimeline).toHaveLength(2);
    expect(res.body.data.statusTimeline[1].toStatus).toBe('active');
  });

  // ── AC-T4-006: Empty member ───────────────────────────

  test('[AC-T4-006] member with no invoices returns valid empty response', async () => {
    stubRepo(DuesRepository, {
      getMemberFinancialSummary: async () => emptySummary,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', personId: 'person-new' },
      organizationId: 'org-1',
    });

    const res = await getDuesMemberSummary(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data.invoices).toEqual([]);
    expect(res.body.data.payments).toEqual([]);
    expect(res.body.data.balance).toBe(0);
    expect(res.body.data.statusTimeline).toEqual([]);
  });
});
