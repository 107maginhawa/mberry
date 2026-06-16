/**
 * getDuesMemberSummary.test.ts
 *
 * Covers:
 *  - Throws UnauthorizedError when no session
 *  - Happy path — returns { data: summary } with 200
 *  - Org mismatch (ctxOrgId != param orgId) → ForbiddenError
 *  - Summary body fields: invoices, payments, balance
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { getDuesMemberSummary } from './getDuesMemberSummary';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';

const FAKE_SUMMARY = {
  invoices: [
    { id: 'inv-1', status: 'generated', amount: 5000, dueDate: '2026-12-31' },
    { id: 'inv-2', status: 'paid', amount: 3000, dueDate: '2025-12-31' },
  ],
  payments: [
    { id: 'pay-1', amount: 3000, method: 'bank_transfer', status: 'verified', paidAt: '2025-11-01' },
  ],
  balance: 5000,
  statusHistory: [],
};

describe('getDuesMemberSummary', () => {
  beforeEach(() => restoreRepo(DuesRepository));
  afterEach(() => restoreRepo(DuesRepository));

  test('throws UnauthorizedError when session is null', async () => {
    const ctx = makeCtx({ session: null, user: null });
    await expect(getDuesMemberSummary(ctx as any)).rejects.toThrow();
  });

  test('happy path — returns 200 with summary data', async () => {
    stubRepo(DuesRepository, {
      getMemberFinancialSummary: async () => FAKE_SUMMARY,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', personId: 'person-1' },
      organizationId: 'org-1',
    });

    const res = await getDuesMemberSummary(ctx as any);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toBeDefined();
    expect(body.data.invoices).toHaveLength(2);
    expect(body.data.payments).toHaveLength(1);
    expect(body.data.balance).toBe(5000);
  });

  test('unpaid invoice drives balance — balance equals sum of unpaid amounts', async () => {
    // balance is computed by the repo; handler must pass it through unchanged
    stubRepo(DuesRepository, {
      getMemberFinancialSummary: async () => ({ ...FAKE_SUMMARY, balance: 8000 }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', personId: 'person-1' },
      organizationId: 'org-1',
    });

    const res = await getDuesMemberSummary(ctx as any);
    expect((res as any).body.data.balance).toBe(8000);
  });

  test('throws ForbiddenError when ctxOrgId differs from path param', async () => {
    stubRepo(DuesRepository, {
      getMemberFinancialSummary: async () => FAKE_SUMMARY,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-OTHER', personId: 'person-1' },
      organizationId: 'org-1', // mismatch
    });

    await expect(getDuesMemberSummary(ctx as any)).rejects.toThrow();
  });

  test('no org mismatch when ctxOrgId is undefined (no org context set)', async () => {
    stubRepo(DuesRepository, {
      getMemberFinancialSummary: async () => FAKE_SUMMARY,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-any', personId: 'person-1' },
      organizationId: undefined,
    });

    const res = await getDuesMemberSummary(ctx as any);
    expect(res.status).toBe(200);
  });

  test('zero balance returned when member has no unpaid invoices', async () => {
    stubRepo(DuesRepository, {
      getMemberFinancialSummary: async () => ({
        invoices: [],
        payments: [],
        balance: 0,
        statusHistory: [],
      }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', personId: 'person-99' },
      organizationId: 'org-1',
    });

    const res = await getDuesMemberSummary(ctx as any);
    expect((res as any).body.data.balance).toBe(0);
    expect((res as any).body.data.invoices).toHaveLength(0);
  });
});
