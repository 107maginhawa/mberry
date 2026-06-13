/**
 * receipt-number-collision.test.ts
 *
 * [FIX-003] Cross-org receipt-number collision regression.
 *
 * Root cause (pre-fix): all three recording call sites hardcoded the literal
 * `'ORG'` prefix and the sequence came from a `count(*)`-based query. With a
 * GLOBAL-unique constraint on receipt_number, org-A and org-B both produced
 * `ORG-2026-000001` for their first payment of the year → unique violation on
 * the second org. The count-based sequence also raced within a single org.
 *
 * Fix proves:
 *  1. Receipt prefix is derived PER-ORG (distinct orgs → distinct prefixes),
 *     never the hardcoded literal 'ORG'.
 *  2. The sequence is sourced from an atomic per-org/year counter
 *     (repo.getNextReceiptSequence), not a count(*) race.
 *  3. Two orgs recording their first payment of the same year produce
 *     DISTINCT receipt numbers (no collision against a unique constraint).
 *
 * These are mock-level tests (no real DB harness exists in this repo —
 * see make-ctx.ts). DB-level atomicity/uniqueness is enforced by the
 * Batch F migration (dues_receipt_counter table + scoped unique index);
 * this suite proves the application seam produces non-colliding inputs.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { recordDuesPayment } from './recordDuesPayment';
import { buildReceiptPrefix } from '@/handlers/association:member/utils/receipt-number';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

describe('[FIX-003] buildReceiptPrefix — per-org prefix derivation', () => {
  test('derives distinct prefixes from distinct org slugs', () => {
    const a = buildReceiptPrefix('philippine-dental-association');
    const b = buildReceiptPrefix('makati-medical-society');
    expect(a).not.toBe(b);
  });

  test('never returns the hardcoded literal "ORG" for a real slug', () => {
    expect(buildReceiptPrefix('philippine-dental-association')).not.toBe('ORG');
  });

  test('produces uppercase alphanumeric prefix matching receipt format regex', () => {
    const prefix = buildReceiptPrefix('makati-medical-society');
    // formatReceiptNumber output must match /^([A-Z0-9]+)-(\d{4})-(\d{6})$/
    expect(prefix).toMatch(/^[A-Z0-9]+$/);
  });

  test('falls back to a safe default for empty/undefined slug', () => {
    expect(buildReceiptPrefix('')).toMatch(/^[A-Z0-9]+$/);
    expect(buildReceiptPrefix(undefined)).toMatch(/^[A-Z0-9]+$/);
  });
});

describe('[FIX-003] recordDuesPayment — receipt number is per-org, no collision', () => {
  function stubsForOrg(orgSlug: string, opts: { sequence: number }) {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }],
    });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => null,
    });
    stubRepo(DuesRepository, {
      // Per-org receipt prefix resolution (joins organizations.slug).
      getOrgReceiptPrefix: async () => buildReceiptPrefix(orgSlug),
      // Atomic per-org/year counter.
      getNextReceiptSequence: async () => opts.sequence,
      findRecentPaymentForPerson: async () => undefined,
      createPayment: async (data: any) => ({ id: 'pay-x', ...data }),
      updatePaymentStatus: async (_id: string, _c: string, status: string, extra: any) => ({ id: 'pay-x', status, ...extra }),
      listFunds: async () => [],
      getConfig: async () => ({ billingFrequency: 'annual' }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [], // no membership row → settlePayment is a no-op
    });
  }

  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesRepository);
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesRepository);
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(MembershipRepository);
  });

  async function recordFor(orgId: string, orgSlug: string): Promise<string> {
    stubsForOrg(orgSlug, { sequence: 1 }); // both orgs: first payment of the year
    const ctx = makeCtx({
      organizationId: orgId,
      _body: { personId: 'person-1', amount: 5000, currency: 'PHP', paymentMethod: 'cash' },
    });
    const res: any = await recordDuesPayment(ctx as any);
    expect(res.status).toBe(201);
    return res.body.receiptNumber as string;
  }

  test('two orgs recording first payment of the year get DISTINCT receipt numbers [RED]', async () => {
    const receiptA = await recordFor('org-A', 'philippine-dental-association');
    const receiptB = await recordFor('org-B', 'makati-medical-society');

    // Pre-fix both would be 'ORG-2026-000001' → collision. Must differ now.
    expect(receiptA).not.toBe(receiptB);
    expect(receiptA).not.toContain('ORG-');
    expect(receiptB).not.toContain('ORG-');
  });
});
