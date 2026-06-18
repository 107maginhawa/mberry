import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDuesInvoice } from '@/test-utils/factories';
import { updateDuesInvoice } from './updateDuesInvoice';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

const invoice = fakeDuesInvoice({ id: 'inv-1', organizationId: 'tenant-1' });

function stubOfficerAccess() {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
  });
}

describe('updateDuesInvoice', () => {
  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
  });

  test('returns 403 when caller lacks position', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({ _params: { invoiceId: 'inv-1' }, _body: { status: 'paid' } });
    const res = await updateDuesInvoice(ctx);
    expect(res.status).toBe(403);
  });

  test('throws NotFoundError when invoice missing', async () => {
    stubOfficerAccess();
    stubRepo(DuesInvoiceRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { invoiceId: 'nope' }, _body: { status: 'paid' } });
    await expect(updateDuesInvoice(ctx)).rejects.toThrow('DuesInvoice');
  });

  test('throws ForbiddenError on org mismatch', async () => {
    stubOfficerAccess();
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...invoice, organizationId: 'other-org' }),
    });
    const ctx = makeCtx({ _params: { invoiceId: 'inv-1' }, _body: { status: 'paid' } });
    await expect(updateDuesInvoice(ctx)).rejects.toThrow();
  });

  test('returns 200 and updates invoice on happy path', async () => {
    stubOfficerAccess();
    let captured: any;
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => invoice,
      updateOneById: async (_id: string, data: any) => { captured = data; return { ...invoice, ...data }; },
    });
    const ctx = makeCtx({ _params: { invoiceId: 'inv-1' }, _body: { status: 'paid' } });
    const res = await updateDuesInvoice(ctx);
    expect(res.status).toBe(200);
    expect(captured.status).toBe('paid');
    expect((res as any).body.status).toBe('paid');
  });
});
