/**
 * submitPaymentProof.test.ts
 *
 * Money handler — thorough coverage of:
 *   - Unauthorized (no session)
 *   - Invalid MIME type → BusinessLogicError
 *   - Invoice not found → BusinessLogicError
 *   - Invoice owned by different member → BusinessLogicError
 *   - Invoice already paid / cancelled → BusinessLogicError
 *   - Happy path → 201, proof envelope, receiptNumber built
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, makeMockDb, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDuesInvoice, fakeDuesPayment } from '@/test-utils/factories';
import { submitPaymentProof } from './submitPaymentProof';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';

const VALID_BODY = {
  invoiceId: 'dues-inv-1',
  amount: 2500,
  currency: 'PHP',
  paymentMethod: 'gcash',
  referenceNumber: 'REF-001',
  proofStorageKey: 'uploads/proof-001.jpg',
  proofFileName: 'proof.jpg',
  proofMimeType: 'image/jpeg',
};

const FAKE_INVOICE = fakeDuesInvoice({
  id: 'dues-inv-1',
  organizationId: 'tenant-1',
  personId: 'user-1',
  status: 'generated',
});

const FAKE_PAYMENT = fakeDuesPayment({
  id: 'pay-created-1',
  organizationId: 'tenant-1',
  personId: 'user-1',
  amount: 2500,
  status: 'submitted',
  proofStorageKey: 'uploads/proof-001.jpg',
  proofFileName: 'proof.jpg',
  proofMimeType: 'image/jpeg',
});

function stubSuccess() {
  stubRepo(DuesInvoiceRepository, {
    findOneById: async () => ({ ...FAKE_INVOICE }),
  });
  stubRepo(DuesRepository, {
    getOrgReceiptPrefix: async () => 'ORG',
    getNextReceiptSequence: async () => 1,
    createPayment: async () => ({ ...FAKE_PAYMENT }),
  });
}

describe('submitPaymentProof', () => {
  beforeEach(() => {
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(DuesRepository);
  });

  afterEach(() => {
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(DuesRepository);
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({ session: null, user: null, _body: VALID_BODY });
    await expect(submitPaymentProof(ctx as any)).rejects.toThrow();
  });

  test('throws BusinessLogicError for disallowed MIME type (video/mp4)', async () => {
    const ctx = makeCtx({
      database: makeMockDb(),
      _body: { ...VALID_BODY, proofMimeType: 'video/mp4' },
    });
    await expect(submitPaymentProof(ctx as any)).rejects.toMatchObject({
      code: 'INVALID_PROOF_TYPE',
    });
  });

  test('throws BusinessLogicError for image/gif MIME type', async () => {
    const ctx = makeCtx({
      database: makeMockDb(),
      _body: { ...VALID_BODY, proofMimeType: 'image/gif' },
    });
    await expect(submitPaymentProof(ctx as any)).rejects.toMatchObject({
      code: 'INVALID_PROOF_TYPE',
    });
  });

  test('throws BusinessLogicError when invoice not found', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => undefined,
    });
    const ctx = makeCtx({
      database: makeMockDb(),
      _body: VALID_BODY,
    });
    await expect(submitPaymentProof(ctx as any)).rejects.toMatchObject({
      code: 'INVOICE_NOT_FOUND',
    });
  });

  test('throws BusinessLogicError when invoice belongs to different member', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...FAKE_INVOICE, personId: 'other-user-99' }),
    });
    const ctx = makeCtx({
      database: makeMockDb(),
      _body: VALID_BODY,
      // session.user.id is 'user-1' by default
    });
    await expect(submitPaymentProof(ctx as any)).rejects.toMatchObject({
      code: 'INVOICE_NOT_OWNED',
    });
  });

  test('throws BusinessLogicError when invoice already paid', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...FAKE_INVOICE, status: 'paid' }),
    });
    const ctx = makeCtx({
      database: makeMockDb(),
      _body: VALID_BODY,
    });
    await expect(submitPaymentProof(ctx as any)).rejects.toMatchObject({
      code: 'INVOICE_NOT_PAYABLE',
    });
  });

  test('throws BusinessLogicError when invoice is cancelled', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...FAKE_INVOICE, status: 'cancelled' }),
    });
    const ctx = makeCtx({
      database: makeMockDb(),
      _body: VALID_BODY,
    });
    await expect(submitPaymentProof(ctx as any)).rejects.toMatchObject({
      code: 'INVOICE_NOT_PAYABLE',
    });
  });

  test('throws BusinessLogicError when invoice is writtenOff', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...FAKE_INVOICE, status: 'writtenOff' }),
    });
    const ctx = makeCtx({
      database: makeMockDb(),
      _body: VALID_BODY,
    });
    await expect(submitPaymentProof(ctx as any)).rejects.toMatchObject({
      code: 'INVOICE_NOT_PAYABLE',
    });
  });

  test('happy path — returns 201 with payment and proof envelope', async () => {
    stubSuccess();
    const ctx = makeCtx({
      database: makeMockDb(),
      _body: VALID_BODY,
      organizationId: 'tenant-1',
    });
    const res = await submitPaymentProof(ctx as any);
    expect(res.status).toBe(201);
    const body = (res as any).body;
    expect(body.status).toBe('submitted');
    expect(body.proof).toBeDefined();
    expect(body.proof.paymentId).toBe('pay-created-1');
    expect(body.proof.storageKey).toBe('uploads/proof-001.jpg');
    expect(body.proof.fileName).toBe('proof.jpg');
    expect(body.proof.mimeType).toBe('image/jpeg');
    expect(body.proof.uploadedAt).toBeDefined();
  });

  test('happy path — accepts image/png MIME type', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...FAKE_INVOICE }),
    });
    stubRepo(DuesRepository, {
      getOrgReceiptPrefix: async () => 'ORG',
      getNextReceiptSequence: async () => 2,
      createPayment: async () => ({ ...FAKE_PAYMENT, proofMimeType: 'image/png' }),
    });
    const ctx = makeCtx({
      database: makeMockDb(),
      _body: { ...VALID_BODY, proofMimeType: 'image/png' },
    });
    const res = await submitPaymentProof(ctx as any);
    expect(res.status).toBe(201);
  });

  test('happy path — accepts application/pdf MIME type', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...FAKE_INVOICE }),
    });
    stubRepo(DuesRepository, {
      getOrgReceiptPrefix: async () => 'ORG',
      getNextReceiptSequence: async () => 3,
      createPayment: async () => ({ ...FAKE_PAYMENT, proofMimeType: 'application/pdf' }),
    });
    const ctx = makeCtx({
      database: makeMockDb(),
      _body: { ...VALID_BODY, proofMimeType: 'application/pdf' },
    });
    const res = await submitPaymentProof(ctx as any);
    expect(res.status).toBe(201);
  });

  test('invoice with status "sent" is payable', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...FAKE_INVOICE, status: 'sent' }),
    });
    stubRepo(DuesRepository, {
      getOrgReceiptPrefix: async () => 'ORG',
      getNextReceiptSequence: async () => 4,
      createPayment: async () => ({ ...FAKE_PAYMENT }),
    });
    const ctx = makeCtx({
      database: makeMockDb(),
      _body: VALID_BODY,
    });
    const res = await submitPaymentProof(ctx as any);
    expect(res.status).toBe(201);
  });

  test('invoice with status "overdue" is payable', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...FAKE_INVOICE, status: 'overdue' }),
    });
    stubRepo(DuesRepository, {
      getOrgReceiptPrefix: async () => 'ORG',
      getNextReceiptSequence: async () => 5,
      createPayment: async () => ({ ...FAKE_PAYMENT }),
    });
    const ctx = makeCtx({
      database: makeMockDb(),
      _body: VALID_BODY,
    });
    const res = await submitPaymentProof(ctx as any);
    expect(res.status).toBe(201);
  });

  test('sets auditResourceId and auditDescription on ctx', async () => {
    stubSuccess();
    const vars: Record<string, any> = {};
    const ctx = makeCtx({
      database: makeMockDb(),
      _body: VALID_BODY,
      organizationId: 'tenant-1',
    });
    // Capture ctx.set side effects
    const originalSet = ctx.set.bind(ctx);
    const captured: Record<string, any> = {};
    ctx.set = (k: string, v: any) => { captured[k] = v; return originalSet(k, v); };

    await submitPaymentProof(ctx as any);
    expect(captured['auditResourceId']).toBe('pay-created-1');
    expect(captured['auditDescription']).toBe('Payment proof submitted for review');
  });
});
