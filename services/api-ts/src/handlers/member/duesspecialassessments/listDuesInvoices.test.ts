/**
 * listDuesInvoices.test.ts
 *
 * [FIX-006 Batch B] Self-scope listDuesInvoices for non-officers.
 *
 * RED phase: listDuesInvoices currently returns ALL org invoices (with member
 * names + amounts) to ANY member — a financial-privacy leak. It must mirror the
 * PAY-02 self-scope pattern that listDuesPayments already uses: officers see all
 * org invoices; non-officers are constrained to their OWN invoices.
 *
 * Invoices carry a `personId` column (duesInvoices.person_id), so self-scoping
 * filters by personId = session.user.id — consistent with listDuesPayments
 * [PAY-02]. (Resolved [NEEDS CONFIRMATION] in fix-ready plan §5.)
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { listDuesInvoices } from './listDuesInvoices';

describe('[FIX-006] listDuesInvoices — non-officer self-scope (PAY-02 mirror)', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
  });

  test('non-officer is forced to their own personId regardless of query [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] }); // non-officer

    let capturedFilter: any;
    stubRepo(DuesInvoiceRepository, {
      findManyWithPagination: async (filter: any) => {
        capturedFilter = filter;
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({
      _query: { membershipId: 'someone-elses-membership', offset: 0, limit: 20 },
      organizationId: 'org-1',
    });
    // session.user.id defaults to 'user-1' via makeCtx

    await listDuesInvoices(ctx as any);

    // RED: handler currently never self-scopes — capturedFilter.personId is undefined.
    expect(capturedFilter.personId).toBe('user-1');
    // Self-scoping must NOT drop the membershipId filter — both AND together so an
    // attacker-supplied membershipId resolves to zero rows (defense in depth).
    expect(capturedFilter.membershipId).toBe('someone-elses-membership');
  });

  test('officer sees all org invoices (personId undefined)', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }] });

    let capturedFilter: any;
    stubRepo(DuesInvoiceRepository, {
      findManyWithPagination: async (filter: any) => {
        capturedFilter = filter;
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({
      _query: { offset: 0, limit: 20 },
      organizationId: 'org-1',
    });

    await listDuesInvoices(ctx as any);

    expect(capturedFilter.personId).toBeUndefined();
    expect(capturedFilter.organizationId).toBe('org-1');
  });

  test('non-officer with no query still scoped to own personId [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });

    let capturedFilter: any;
    stubRepo(DuesInvoiceRepository, {
      findManyWithPagination: async (filter: any) => {
        capturedFilter = filter;
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({
      _query: { offset: 0, limit: 20 },
      organizationId: 'org-1',
    });

    await listDuesInvoices(ctx as any);

    expect(capturedFilter.personId).toBe('user-1');
  });
});
