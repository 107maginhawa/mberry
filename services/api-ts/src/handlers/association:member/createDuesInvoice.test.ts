// [EM-M06] Wave 26 — dues.invoice.generated emission
import { describe, test, expect, afterEach, beforeEach, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createDuesInvoice } from './createDuesInvoice';
import { DuesInvoiceRepository } from './repos/dues.repo';
import { OfficerTermRepository } from './repos/governance.repo';
import { domainEvents } from '@/core/domain-events';

function stubOfficerAccess() {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
  });
}

const invoiceBody = {
  membershipId: 'mem-1',
  periodStart: '2026-01-01',
  periodEnd: '2026-12-31',
  totalAmount: 5000,
  fundAllocations: [],
};

describe('createDuesInvoice — dues.invoice.generated', () => {
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
    officerMocks = stubOfficerAccess();
    stubRepo(DuesInvoiceRepository, {
      createOne: async (data: any) => ({ id: 'inv-1', ...data }),
    });
  });

  afterEach(() => {
    Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
  });

  test('returns 201 and emits dues.invoice.generated', async () => {
    const emitSpy = spyOn(domainEvents, 'emit');
    const ctx = makeCtx({ _body: { ...invoiceBody } });

    const res = await createDuesInvoice(ctx);
    expect(res.status).toBe(201);

    const call = emitSpy.mock.calls.find((c) => c[0] === 'dues.invoice.generated');
    expect(call).toBeDefined();
    expect(call?.[1]).toMatchObject({
      invoiceId: 'inv-1',
      organizationId: 'tenant-1',
      personId: 'user-1',
      amount: 5000,
      dueDate: '2026-12-31',
    });
    emitSpy.mockRestore();
  });
});
