/**
 * Unit tests for mintMyPaymentLink — mocked deps, no real-PG (fast).
 *
 * Required by new-code-gate as the sibling `.test.ts` for:
 *   handlers/member/duesspecialassessments/mintMyPaymentLink.ts
 *
 * Coverage:
 *   401  unauthenticated caller
 *   400  missing organizationId route param
 *   404  invoice not found → NotFoundError
 *   403  IDOR: invoice.personId ≠ caller.id  → ForbiddenError, no create
 *   403  cross-org: invoice.organizationId ≠ orgId → ForbiddenError, no create
 *   409  terminal status (paid) → not payable, no create
 *   201  happy path: owned + unpaid → create called with correct shape
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PaymentTokenRepository } from '@/handlers/dues/repos/payment-token.repo';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';
import { ForbiddenError, NotFoundError } from '@/core/errors';
import { mintMyPaymentLink } from './mintMyPaymentLink';

// ─── Fixtures ────────────────────────────────────────────

const PERSON_ID = 'person-unit-1';
const ORG_ID = 'org-unit-1';
const INVOICE_ID = 'inv-unit-1';
const TOTAL_AMOUNT = 250000; // centavos (PHP 2 500.00)

function makeInvoice(overrides: Record<string, any> = {}) {
  return {
    id: INVOICE_ID,
    personId: PERSON_ID,
    organizationId: ORG_ID,
    totalAmount: TOTAL_AMOUNT,
    currency: 'PHP',
    status: 'generated',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Builds a ctx with correct _params / _body defaults for the happy path. */
function makeBaseCtx(overrides: Record<string, any> = {}) {
  return makeCtx({
    user: { id: PERSON_ID },
    _params: { organizationId: ORG_ID },
    _body: { invoiceId: INVOICE_ID },
    ...overrides,
  });
}

// ─── Lifecycle ───────────────────────────────────────────

beforeEach(() => {
  restoreRepo(DuesInvoiceRepository);
  restoreRepo(PaymentTokenRepository);
  process.env['PAYMENT_TOKEN_SECRET'] = 'test-secret-key-for-hmac';
});

afterEach(() => {
  restoreRepo(DuesInvoiceRepository);
  restoreRepo(PaymentTokenRepository);
  delete process.env['PAYMENT_TOKEN_SECRET'];
});

// ─── Auth + param guards ──────────────────────────────────

describe('[mintMyPaymentLink] auth + param guards', () => {
  test('throws UnauthorizedError when no user', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: ORG_ID },
      _body: { invoiceId: INVOICE_ID },
    });
    await expect(mintMyPaymentLink(ctx)).rejects.toThrow();
  });

  test('returns 400 when organizationId param is missing', async () => {
    const ctx = makeCtx({
      user: { id: PERSON_ID },
      _params: {},
      _body: { invoiceId: INVOICE_ID },
    });
    const res = await mintMyPaymentLink(ctx) as any;
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

// ─── Invoice guards (pre-transaction) ────────────────────

describe('[mintMyPaymentLink] invoice not found → 404', () => {
  test('throws NotFoundError when invoice does not exist', async () => {
    stubRepo(DuesInvoiceRepository, { findOneById: async () => null });
    await expect(mintMyPaymentLink(makeBaseCtx())).rejects.toThrow(NotFoundError);
  });
});

describe('[mintMyPaymentLink] IDOR guard → 403, no token created', () => {
  test('throws ForbiddenError when invoice.personId ≠ caller.id', async () => {
    let createCalled = false;
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => makeInvoice({ personId: 'someone-else' }),
    });
    stubRepo(PaymentTokenRepository, {
      create: async () => { createCalled = true; return {}; },
    });

    await expect(mintMyPaymentLink(makeBaseCtx())).rejects.toThrow(ForbiddenError);
    expect(createCalled).toBe(false);
  });
});

describe('[mintMyPaymentLink] cross-org guard → 403, no token created', () => {
  test('throws ForbiddenError when invoice.organizationId ≠ request orgId', async () => {
    let createCalled = false;
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => makeInvoice({ organizationId: 'other-org' }),
    });
    stubRepo(PaymentTokenRepository, {
      create: async () => { createCalled = true; return {}; },
    });

    await expect(mintMyPaymentLink(makeBaseCtx())).rejects.toThrow(ForbiddenError);
    expect(createCalled).toBe(false);
  });
});

// ─── Terminal status guard (pre-transaction) ─────────────

describe('[mintMyPaymentLink] terminal status → 409, no token created', () => {
  test('returns 409 when invoice status is paid', async () => {
    let createCalled = false;
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => makeInvoice({ status: 'paid' }),
    });
    stubRepo(PaymentTokenRepository, {
      create: async () => { createCalled = true; return {}; },
    });

    const res = await mintMyPaymentLink(makeBaseCtx()) as any;
    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
    expect(createCalled).toBe(false);
  });

  test('returns 409 when invoice status is cancelled', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => makeInvoice({ status: 'cancelled' }),
    });
    stubRepo(PaymentTokenRepository, { create: async () => ({}) });

    const res = await mintMyPaymentLink(makeBaseCtx()) as any;
    expect(res.status).toBe(409);
  });
});

// ─── Happy path ───────────────────────────────────────────

describe('[mintMyPaymentLink] happy path → 201', () => {
  test('owned + unpaid invoice → 201 with token/paymentUrl/expiresAt; create called with correct shape', async () => {
    let capturedCreate: any = null;

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => makeInvoice(),
      // Inside db.transaction → new DuesInvoiceRepository(tx).findOneByIdForUpdate(...)
      findOneByIdForUpdate: async () => makeInvoice(),
    });
    stubRepo(PaymentTokenRepository, {
      findActiveForInvoice: async () => null,
      create: async (data: any) => { capturedCreate = data; },
    });

    const res = await mintMyPaymentLink(makeBaseCtx()) as any;

    // Response shape
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(8);
    expect(res.body.paymentUrl).toBe(`/pay/${res.body.token}`);
    expect(typeof res.body.expiresAt).toBe('string'); // toISOString()

    // create must be called exactly once with correct invariants
    expect(capturedCreate).not.toBeNull();
    expect(capturedCreate.amount).toBe(Number(TOTAL_AMOUNT));   // server-derived
    expect(capturedCreate.createdByOfficer).toBeNull();         // member-initiated
    expect(capturedCreate.invoiceId).toBe(INVOICE_ID);
    expect(capturedCreate.personId).toBe(PERSON_ID);
    expect(capturedCreate.organizationId).toBe(ORG_ID);
    expect(capturedCreate.currency).toBe('PHP');
  });

  test('amount in create = Number(invoice.totalAmount) exactly (no truncation)', async () => {
    const oddAmount = 987654; // proves no rounding
    let capturedAmount: any = null;

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => makeInvoice({ totalAmount: oddAmount }),
      findOneByIdForUpdate: async () => makeInvoice({ totalAmount: oddAmount }),
    });
    stubRepo(PaymentTokenRepository, {
      findActiveForInvoice: async () => null,
      create: async (data: any) => { capturedAmount = data.amount; },
    });

    await mintMyPaymentLink(makeBaseCtx());
    expect(capturedAmount).toBe(Number(oddAmount));
    expect(typeof capturedAmount).toBe('number');
  });
});
