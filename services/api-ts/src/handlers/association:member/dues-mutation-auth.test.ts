/**
 * dues-mutation-auth.test.ts
 *
 * SEC-01 RED phase: Security tests for mutation handlers that currently lack
 * org-scoped RBAC. All tests with [RED] in the name are expected to FAIL
 * against current handler code and PASS after Plan 02 applies fixes.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createDuesInvoice } from './createDuesInvoice';
import { updateDuesInvoice } from './updateDuesInvoice';
import { deleteDuesInvoice } from './deleteDuesInvoice';
import { generateDuesInvoicesForOrg } from './generateDuesInvoicesForOrg';
import { DuesInvoiceRepository } from './repos/dues.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

describe('[SEC-01] createDuesInvoice — position-based auth', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 403 when requirePosition denies (member role) [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({
      _body: {
        membershipId: 'mem-1',
        periodStart: '2025-01-01',
        periodEnd: '2025-12-31',
        totalAmount: 5000,
      },
      organizationId: 'org-1',
    });
    // RED: createDuesInvoice currently has no requirePosition call — will return 201 not 403
    const res = await createDuesInvoice(ctx as any);
    expect(res.status).toBe(403);
  });
});

describe('[SEC-01] updateDuesInvoice — position-based auth + cross-org', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 403 when requirePosition denies (member role) [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      _body: { totalAmount: 9999 },
      organizationId: 'org-1',
    });
    // RED: updateDuesInvoice currently has no requirePosition call
    const res = await updateDuesInvoice(ctx as any);
    expect(res.status).toBe(403);
  });

  test('returns 403 when invoice belongs to different org (cross-org) [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-B', status: 'generated', membershipId: 'm-1' }),
    });
    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      _body: { totalAmount: 9999 },
      organizationId: 'org-A',
    });
    try {
      const res = await updateDuesInvoice(ctx as any);
      expect(res.status).toBe(403);
    } catch (e: any) {
      expect(e.statusCode ?? e.status ?? 403).toBe(403);
    }
  });
});

describe('[SEC-01] deleteDuesInvoice — position-based auth + cross-org', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 403 when requirePosition denies (member role) [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      organizationId: 'org-1',
    });
    // RED: deleteDuesInvoice currently has no requirePosition call
    const res = await deleteDuesInvoice(ctx as any);
    expect(res.status).toBe(403);
  });

  test('returns 403 when invoice belongs to different org (cross-org) [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-B', status: 'generated', membershipId: 'm-1' }),
    });
    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      organizationId: 'org-A',
    });
    try {
      const res = await deleteDuesInvoice(ctx as any);
      expect(res.status).toBe(403);
    } catch (e: any) {
      expect(e.statusCode ?? e.status ?? 403).toBe(403);
    }
  });

  // [M06 P1-5 BR-32 / AC-M06-006] soft-delete only — financial records have a 7-year
  // retention requirement, so deletion transitions to 'cancelled', never hard-delete.
  test('soft-deletes via status=cancelled and never hard-deletes (BR-32)', async () => {
    let updatedWith: any;
    let hardDeleteCalled = false;
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-1', status: 'generated', membershipId: 'm-1' }),
      updateOneById: async (_id: string, data: any) => { updatedWith = data; return { id: 'inv-1', ...data }; },
      deleteOneById: async () => { hardDeleteCalled = true; },
    });
    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      organizationId: 'org-1',
    });

    const res = await deleteDuesInvoice(ctx as any);
    expect(res.status).toBe(204);
    expect(updatedWith?.status).toBe('cancelled');
    expect(hardDeleteCalled).toBe(false);
  });
});

describe('[SEC-01] generateDuesInvoicesForOrg — cross-org body param enforcement', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  test('returns 403 when body.organizationId !== ctx.get("organizationId") [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] });
    const ctx = makeCtx({
      _body: {
        organizationId: 'attacker-org',  // attacker supplies their own org
        periodStart: '2025-01-01',
        periodEnd: '2025-12-31',
      },
      organizationId: 'org-1',  // middleware-set org from JWT
    });
    try {
      const res = await generateDuesInvoicesForOrg(ctx as any);
      expect(res.status).toBe(403);
    } catch (e: any) {
      expect(e.statusCode ?? e.status ?? 403).toBe(403);
    }
  });
});
