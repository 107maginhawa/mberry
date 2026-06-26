/**
 * online-payment-ledger.integration.test.ts
 *
 * [FIX-001] Online payment must land a COMPLETE ledger record.
 *
 * Root cause (pre-fix): structural metadata-contract mismatch.
 *   - checkoutPaymentToken created NO DuesPayment row and put
 *     `{ paymentTokenId, personId, organizationId, invoiceId }` in Stripe
 *     metadata — no `paymentId`.
 *   - The webhook callback (createProcessPayment) read `metadata.paymentId`
 *     and fell back to the Stripe `pi_...` intent id (a non-UUID), then called
 *     settlePayment with that fallback → fund-allocation FK insert fails →
 *     webhook dead-letters. Net result: real money charged, NO payment row,
 *     NO receipt, invoice never marked paid, expiry never extended.
 *
 * This suite proves the SEAM (the only level the repo's mock harness supports —
 * no real DB; see make-ctx.ts):
 *   A. checkout creates a pending DuesPayment row and passes its REAL id as
 *      `metadata.paymentId` (a UUID, never the token id, never empty).
 *   B. the webhook callback settles by that real paymentId (never the pi_
 *      fallback), flips the payment to 'completed', and marks the linked
 *      invoice paid — a complete ledger record.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { checkoutPaymentToken } from './checkoutPaymentToken';
import { createProcessPayment } from './jobs/processStripePayment';
import { PaymentTokenRepository } from '@/handlers/dues/repos/payment-token.repo';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';
import { PayMongoAdapter } from '@/handlers/association:member/utils/paymongo.adapter';
import { encryptCredential } from '@/core/gateway';

const FIX001_AUTH_SECRET = 'fix001-auth-secret';

const tokenRecord = {
  id: 'pt-1',
  tokenHash: 'hashed-token',
  personId: 'member-1',
  organizationId: 'org-1',
  invoiceId: 'inv-1',
  amount: 500000,
  currency: 'PHP',
  expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
  usedAt: null,
  createdByOfficer: 'officer-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: null,
  updatedBy: null,
};

const gatewayConfig = {
  id: 'gw-1',
  organizationId: 'org-1',
  provider: 'paymongo',
  connected: true,
  publicKey: 'pk_test_xxx',
  encryptedSecret: encryptCredential('sk_test_xxx', FIX001_AUTH_SECRET),
  encryptedWebhookSecret: null,
};

// A real-looking UUID for the pending payment row the checkout must create.
const CREATED_PAYMENT_ID = '11111111-2222-4333-8444-555555555555';

describe('[FIX-001] checkout creates ledger row + correct metadata', () => {
  beforeEach(() => {
    restoreRepo(PaymentTokenRepository);
    restoreRepo(DuesRepository);
    restoreRepo(PayMongoAdapter);
    process.env['PAYMENT_TOKEN_SECRET'] = 'test-secret-key-for-hmac';
  });
  afterEach(() => {
    restoreRepo(PaymentTokenRepository);
    restoreRepo(DuesRepository);
    restoreRepo(PayMongoAdapter);
    delete process.env['PAYMENT_TOKEN_SECRET'];
  });

  test('creates a pending DuesPayment row and passes its real id as metadata.paymentId [RED]', async () => {
    let createdPaymentArg: any = null;
    let metadataSeenByGateway: Record<string, string> | undefined;

    stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => tokenRecord,
      claimForCheckout: async () => ({ ...tokenRecord, idempotencyKey: 'idem-1' }),
      attachSession: async () => {},
    });
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => gatewayConfig,
      getOrgReceiptPrefix: async () => 'ORG',
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => {
        createdPaymentArg = data;
        return { id: CREATED_PAYMENT_ID, ...data };
      },
    });
    // The per-org PayMongo adapter is the new checkout seam. Capture the metadata
    // it receives — the webhook settles by `metadata.paymentId`.
    stubRepo(PayMongoAdapter, {
      createCheckout: async (opts: any) => {
        metadataSeenByGateway = opts.metadata;
        return { checkoutUrl: 'https://checkout.paymongo.com/cs_test_session', sessionId: 'cs_test_session' };
      },
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { token: 'raw-token-value' },
      config: { auth: { secret: FIX001_AUTH_SECRET } },
    });

    const res: any = await checkoutPaymentToken(ctx);
    expect(res.status).toBe(200);

    // A pending payment row must have been created for this online payment.
    expect(createdPaymentArg).not.toBeNull();
    expect(createdPaymentArg.status).toBe('pending');
    expect(createdPaymentArg.organizationId).toBe('org-1');
    expect(createdPaymentArg.personId).toBe('member-1');
    expect(createdPaymentArg.invoiceId).toBe('inv-1');

    // The PayMongo metadata must carry the REAL payment row id (so the webhook
    // can settle the exact row), never the token id, never empty.
    expect(metadataSeenByGateway).toBeDefined();
    expect(metadataSeenByGateway!['paymentId']).toBe(CREATED_PAYMENT_ID);
    expect(metadataSeenByGateway!['paymentId']).not.toBe('pt-1');
    expect(metadataSeenByGateway!['paymentId']).not.toBe('');
  });
});

describe('[FIX-001] webhook settles the real payment row + marks invoice paid', () => {
  beforeEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(DuesInvoiceRepository);
  });
  afterEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(DuesInvoiceRepository);
  });

  function makeLogger() {
    const l: any = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => l };
    return l;
  }

  test('settles by metadata.paymentId (UUID), flips payment to completed, marks invoice paid [RED]', async () => {
    let settledWith: any = null;
    let statusUpdate: { id: string; status: string } | null = null;
    let invoiceMarkedPaidFor: string | null = null;

    stubRepo(DuesRepository, {
      getPayment: async (id: string) => ({
        id,
        organizationId: 'org-1',
        personId: 'member-1',
        invoiceId: 'inv-1',
        amount: 500000,
        status: 'pending',
      }),
      updatePaymentStatus: async (id: string, _cur: string, status: string) => {
        statusUpdate = { id, status };
        return { id, status };
      },
    });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-1', status: 'sent', version: 1 }),
      markPaid: async (invoiceId: string) => {
        invoiceMarkedPaidFor = invoiceId;
        return { id: invoiceId, status: 'paid' };
      },
    });

    const fakeSettle: any = async (input: any) => {
      settledWith = input;
      return { fundAllocations: [], membershipExtendedFrom: null, membershipExtendedTo: '2027-06-30' };
    };

    const processPayment = createProcessPayment(
      {} as any,            // billing — not used for succeeded path
      {} as any,            // db
      makeLogger(),
      fakeSettle,
    );

    const result = await processPayment({
      id: 'pi_real_intent_999',           // Stripe intent id (the OLD wrong fallback)
      status: 'succeeded',
      amount: 500000,
      metadata: {
        paymentId: CREATED_PAYMENT_ID,     // the real DuesPayment row id
        orgId: 'org-1',
        personId: 'member-1',
      },
    });

    expect(result.success).toBe(true);

    // Must settle by the REAL payment id, never the pi_ fallback.
    expect(settledWith).not.toBeNull();
    expect(settledWith.paymentId).toBe(CREATED_PAYMENT_ID);
    expect(settledWith.paymentId).not.toBe('pi_real_intent_999');

    // The pending row must be flipped to a settled state.
    expect(statusUpdate).not.toBeNull();
    expect(statusUpdate!.id).toBe(CREATED_PAYMENT_ID);
    expect(['completed', 'confirmed']).toContain(statusUpdate!.status);

    // The linked invoice must be marked paid — a complete ledger record.
    expect(invoiceMarkedPaidFor).toBe('inv-1');
  });
});
