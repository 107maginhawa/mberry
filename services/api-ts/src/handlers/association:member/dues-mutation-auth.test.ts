/**
 * dues-mutation-auth.test.ts
 *
 * SEC-01 RED phase: Security tests for mutation handlers that currently lack
 * org-scoped RBAC. All tests with [RED] in the name are expected to FAIL
 * against current handler code and PASS after Plan 02 applies fixes.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { mock } from 'bun:test';
import { createDuesInvoice } from './createDuesInvoice';
import { updateDuesInvoice } from './updateDuesInvoice';
import { deleteDuesInvoice } from './deleteDuesInvoice';
import { generateDuesInvoicesForOrg } from './generateDuesInvoicesForOrg';
import { DuesInvoiceRepository } from './repos/dues.repo';

describe('[SEC-01] createDuesInvoice — position-based auth', () => {
  afterEach(() => {
    restoreRepo(DuesInvoiceRepository);
  });

  test('returns 403 when requirePosition denies (member role) [RED]', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    }));
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
  afterEach(() => {
    restoreRepo(DuesInvoiceRepository);
  });

  test('returns 403 when requirePosition denies (member role) [RED]', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    }));
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
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-B', status: 'generated', membershipId: 'm-1' }),
    });
    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      _body: { totalAmount: 9999 },
      organizationId: 'org-A',
    });
    // RED: updateDuesInvoice currently has no cross-org check — will return 200 not 403
    const res = await updateDuesInvoice(ctx as any);
    expect(res.status).toBe(403);
  });
});

describe('[SEC-01] deleteDuesInvoice — position-based auth + cross-org', () => {
  afterEach(() => {
    restoreRepo(DuesInvoiceRepository);
  });

  test('returns 403 when requirePosition denies (member role) [RED]', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    }));
    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      organizationId: 'org-1',
    });
    // RED: deleteDuesInvoice currently has no requirePosition call
    const res = await deleteDuesInvoice(ctx as any);
    expect(res.status).toBe(403);
  });

  test('returns 403 when invoice belongs to different org (cross-org) [RED]', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-B', status: 'generated', membershipId: 'm-1' }),
    });
    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      organizationId: 'org-A',
    });
    // RED: deleteDuesInvoice currently has no cross-org check
    const res = await deleteDuesInvoice(ctx as any);
    expect(res.status).toBe(403);
  });
});

describe('[SEC-01] generateDuesInvoicesForOrg — cross-org body param enforcement', () => {
  test('returns 403 when body.organizationId !== ctx.get("organizationId") [RED]', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    const ctx = makeCtx({
      _body: {
        organizationId: 'attacker-org',  // attacker supplies their own org
        periodStart: '2025-01-01',
        periodEnd: '2025-12-31',
      },
      organizationId: 'org-1',  // middleware-set org from JWT
    });
    // RED: handler uses body.organizationId without comparing to ctx orgId
    const res = await generateDuesInvoicesForOrg(ctx as any);
    expect(res.status).toBe(403);
  });
});
