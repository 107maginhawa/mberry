/**
 * Dues repos — buildWhereConditions (Config/Invoice/AgingBucket), findOverdue,
 * markPaid success + NotFound path. The FSM-guard ConflictError cases live in
 * dues.repo.test.ts; this file covers the remaining branches with a recording
 * fake DB.
 */

import { describe, test, expect } from 'bun:test';
import {
  DuesConfigRepository,
  DuesInvoiceRepository,
  AgingBucketRepository,
} from './dues.repo';
import { NotFoundError, ConflictError } from '@/core/errors';
import { makeFakeDb } from './__testkit__/fake-db';

const hasWhere = (db: ReturnType<typeof makeFakeDb>) =>
  db.ops.select[0]!.some((c) => c.method === 'where');

describe('DuesConfigRepository.buildWhereConditions', () => {
  test('none / org+tier+status', async () => {
    const none = makeFakeDb({ selectResults: [[]] });
    await new DuesConfigRepository(none as any).findMany();
    expect(hasWhere(none)).toBe(false);

    const full = makeFakeDb({ selectResults: [[{ id: 'dc-1' }]] });
    await new DuesConfigRepository(full as any).findMany({ organizationId: 'org-1', tierId: 't-1', status: 'active' });
    expect(hasWhere(full)).toBe(true);
  });
});

describe('DuesInvoiceRepository.buildWhereConditions', () => {
  test('none / org+membership+person+status', async () => {
    const none = makeFakeDb({ selectResults: [[]] });
    await new DuesInvoiceRepository(none as any).findMany();
    expect(hasWhere(none)).toBe(false);

    const full = makeFakeDb({ selectResults: [[{ id: 'inv-1' }]] });
    await new DuesInvoiceRepository(full as any).findMany({ organizationId: 'org-1', membershipId: 'm-1', personId: 'p-1', status: 'paid' });
    expect(hasWhere(full)).toBe(true);
  });
});

describe('DuesInvoiceRepository.findOverdue', () => {
  test('returns overdue rows', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'inv-1' }, { id: 'inv-2' }]] });
    const r = await new DuesInvoiceRepository(db as any).findOverdue('org-1');
    expect(r).toHaveLength(2);
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(true);
  });
});

describe('DuesInvoiceRepository.markPaid', () => {
  test('success: valid transition + optimistic-lock update returns row', async () => {
    // findOneById(select) → sent (a valid pre-paid state); update returns paid row
    const db = makeFakeDb({
      selectResults: [[{ id: 'inv-1', status: 'sent', version: 0 }]],
      updateResults: [[{ id: 'inv-1', status: 'paid', version: 1 }]],
    });
    const r = await new DuesInvoiceRepository(db as any).markPaid('inv-1', 0, 'pay-1');
    expect(r).toMatchObject({ status: 'paid', version: 1 });
    const setArg = db.ops.update[0]!.find((c) => c.method === 'set')!.args[0] as any;
    expect(setArg.status).toBe('paid');
    expect(setArg.paymentId).toBe('pay-1');
    expect(setArg.version).toBe(1);
  });

  test('honors explicit paidAt', async () => {
    const paidAt = new Date('2026-05-05T00:00:00Z');
    const db = makeFakeDb({
      selectResults: [[{ id: 'inv-1', status: 'sent', version: 2 }]],
      updateResults: [[{ id: 'inv-1', status: 'paid' }]],
    });
    await new DuesInvoiceRepository(db as any).markPaid('inv-1', 2, 'pay-2', paidAt);
    const setArg = db.ops.update[0]!.find((c) => c.method === 'set')!.args[0] as any;
    expect(setArg.paidAt).toBe(paidAt);
  });

  test('throws NotFoundError when invoice missing', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    await expect(new DuesInvoiceRepository(db as any).markPaid('x', 0, 'pay')).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ConflictError on optimistic-lock miss (valid state, 0 rows)', async () => {
    const db = makeFakeDb({
      selectResults: [[{ id: 'inv-1', status: 'sent', version: 0 }]],
      updateResults: [[]], // concurrent modification → 0 rows
    });
    await expect(new DuesInvoiceRepository(db as any).markPaid('inv-1', 0, 'pay')).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('AgingBucketRepository.buildWhereConditions', () => {
  test('none / org', async () => {
    const none = makeFakeDb({ selectResults: [[]] });
    await new AgingBucketRepository(none as any).findMany();
    expect(hasWhere(none)).toBe(false);

    const org = makeFakeDb({ selectResults: [[{ id: 'ab-1' }]] });
    await new AgingBucketRepository(org as any).findMany({ organizationId: 'org-1' });
    expect(hasWhere(org)).toBe(true);
  });
});
