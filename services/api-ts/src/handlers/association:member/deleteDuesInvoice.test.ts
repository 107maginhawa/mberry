/**
 * deleteDuesInvoice — INVOICE_VALID_TRANSITIONS guard test
 * S-G1-03 / IC-04: cancelling an already-paid (or otherwise terminal)
 * invoice must throw ConflictError. The DB filter alone is not enough —
 * the handler reads via findOneById and then writes; without the FSM
 * guard, a paid invoice could be silently transitioned to cancelled.
 */

import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { ConflictError } from '@/core/errors';
import { deleteDuesInvoice } from './deleteDuesInvoice';
import { DuesInvoiceRepository } from './repos/dues.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

describe('deleteDuesInvoice — INVOICE_VALID_TRANSITIONS guard', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
  });

  test('rejects delete (cancel) on already-paid invoice with ConflictError', async () => {
    // Bypass requirePosition by stubbing officer-term lookup with President.
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'tenant-1', status: 'paid' }) as any,
      updateOneById: async () => ({}) as any,
    });

    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      organizationId: 'tenant-1',
    });

    await expect(deleteDuesInvoice(ctx as any)).rejects.toBeInstanceOf(ConflictError);
  });

  test('rejects delete on already-cancelled invoice with ConflictError', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'tenant-1', status: 'cancelled' }) as any,
      updateOneById: async () => ({}) as any,
    });

    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      organizationId: 'tenant-1',
    });

    await expect(deleteDuesInvoice(ctx as any)).rejects.toBeInstanceOf(ConflictError);
  });

  test('rejects delete on writtenOff invoice with ConflictError', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'tenant-1', status: 'writtenOff' }) as any,
      updateOneById: async () => ({}) as any,
    });

    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      organizationId: 'tenant-1',
    });

    await expect(deleteDuesInvoice(ctx as any)).rejects.toBeInstanceOf(ConflictError);
  });

  test('allows delete on sent invoice (sent → cancelled is valid)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    let captured: any = null;
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'tenant-1', status: 'sent' }) as any,
      updateOneById: async (_id: string, data: any) => {
        captured = data;
        return data as any;
      },
    });

    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      organizationId: 'tenant-1',
    });

    const res = await deleteDuesInvoice(ctx as any);
    expect(res.status).toBe(204);
    expect(captured?.status).toBe('cancelled');
  });
});
