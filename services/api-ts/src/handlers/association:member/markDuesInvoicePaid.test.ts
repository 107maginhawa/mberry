import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { markDuesInvoicePaid } from './markDuesInvoicePaid';
import { DuesInvoiceRepository } from './repos/dues.repo';
import { MembershipRepository } from './repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeInvoice = {
  id: 'inv-1',
  membershipId: 'mem-1',
  personId: 'person-1',
  organizationId: 'org-1',
  invoiceNumber: 'INV-2025-001',
  periodStart: '2025-01-01',
  periodEnd: '2025-12-31',
  totalAmount: 5000,
  status: 'sent',
  generatedAt: new Date().toISOString(),
};

const fakeMembership = {
  id: 'mem-1',
  organizationId: 'org-1',
  personId: 'person-1',
  duesExpiryDate: '2025-06-30',
  status: 'active',
};

// ─── Tests ──────────────────────────────────────────────

describe('[BR-07] markDuesInvoicePaid expiry extension', () => {
  beforeEach(() => {
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(MembershipRepository);
  });

  test('uses computeNewExpiry — extends annual by 12 months from current expiry', async () => {
    let updatedExpiry: string | undefined;

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'sent' }),
      markPaid: async () => ({ ...fakeInvoice, status: 'paid' }),
    });
    stubRepo(MembershipRepository, {
      findOneById: async () => ({ ...fakeMembership, duesExpiryDate: '2025-12-31' }),
      updateOneById: async (_id: string, updates: any) => {
        updatedExpiry = updates.duesExpiryDate;
        return fakeMembership;
      },
    });

    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    const response = await markDuesInvoicePaid(ctx);
    expect(response.status).toBe(200);
    expect(updatedExpiry).toBeDefined();
    // From 2025-12-31 + 12 months = 2026-12-31
    expect(updatedExpiry!.startsWith('2026-12')).toBe(true);
  });

  test('handles severely lapsed member — resets from today', async () => {
    let updatedExpiry: string | undefined;
    const today = new Date();

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'overdue' }),
      markPaid: async () => ({ ...fakeInvoice, status: 'paid' }),
    });
    stubRepo(MembershipRepository, {
      // Expiry > 1 year in past = severely lapsed
      findOneById: async () => ({ ...fakeMembership, duesExpiryDate: '2023-01-01' }),
      updateOneById: async (_id: string, updates: any) => {
        updatedExpiry = updates.duesExpiryDate;
        return fakeMembership;
      },
    });

    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    await markDuesInvoicePaid(ctx);
    expect(updatedExpiry).toBeDefined();
    // Should reset from today, not from 2023-01-01
    const expiryDate = new Date(updatedExpiry!);
    const expectedYear = today.getFullYear() + 1;
    // Expiry should be roughly today + 12 months (annual default)
    expect(expiryDate.getFullYear()).toBeGreaterThanOrEqual(expectedYear);
  });

  test('handles first-time payment — no existing expiry', async () => {
    let updatedExpiry: string | undefined;
    const today = new Date();

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'sent' }),
      markPaid: async () => ({ ...fakeInvoice, status: 'paid' }),
    });
    stubRepo(MembershipRepository, {
      findOneById: async () => ({ ...fakeMembership, duesExpiryDate: null }),
      updateOneById: async (_id: string, updates: any) => {
        updatedExpiry = updates.duesExpiryDate;
        return fakeMembership;
      },
    });

    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    await markDuesInvoicePaid(ctx);
    expect(updatedExpiry).toBeDefined();
    // Should be today + 12 months
    const expiryDate = new Date(updatedExpiry!);
    const expectedYear = today.getFullYear() + 1;
    expect(expiryDate.getFullYear()).toBeGreaterThanOrEqual(expectedYear);
  });

  test('skips extension when membership not found', async () => {
    let updateCalled = false;

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'sent' }),
      markPaid: async () => ({ ...fakeInvoice, status: 'paid' }),
    });
    stubRepo(MembershipRepository, {
      findOneById: async () => undefined,
      updateOneById: async () => { updateCalled = true; return fakeMembership; },
    });

    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    const response = await markDuesInvoicePaid(ctx);
    expect(response.status).toBe(200);
    expect(updateCalled).toBe(false);
  });
});
