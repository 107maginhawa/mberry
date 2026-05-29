/**
 * DuesInvoiceRepository — FSM guard tests for INVOICE_VALID_TRANSITIONS.
 *
 * Covers S-G1-03 / IC-04: markPaid must reject invalid current → 'paid'
 * transitions with ConflictError BEFORE attempting the optimistic-lock
 * update. The pre-existing optimistic-lock error path stays untouched
 * for the legitimate race-condition case.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ConflictError } from '@/core/errors';
import { DuesInvoiceRepository } from './dues.repo';
import { restoreRepo, stubRepo } from '@/test-utils/make-ctx';

describe('DuesInvoiceRepository.markPaid — INVOICE_VALID_TRANSITIONS guard', () => {
  beforeEach(() => {
    restoreRepo(DuesInvoiceRepository);
  });

  it('rejects markPaid on already-cancelled invoice with ConflictError', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'i-1', status: 'cancelled', version: 0 }) as any,
    });
    const repo = new DuesInvoiceRepository({} as any, undefined);
    await expect(repo.markPaid('i-1', 0, 'p-1')).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects markPaid on already-paid invoice with ConflictError (not optimistic-lock error)', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'i-1', status: 'paid', version: 0 }) as any,
    });
    const repo = new DuesInvoiceRepository({} as any, undefined);
    await expect(repo.markPaid('i-1', 0, 'p-1')).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects markPaid on writtenOff invoice with ConflictError', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'i-1', status: 'writtenOff', version: 0 }) as any,
    });
    const repo = new DuesInvoiceRepository({} as any, undefined);
    await expect(repo.markPaid('i-1', 0, 'p-1')).rejects.toBeInstanceOf(ConflictError);
  });
});
