/**
 * mintMyPaymentLink — real-PG integration test (Task 3, B2 Wave).
 *
 * Tests the COMPLETE security + idempotency contract of the member
 * self-serve pay-link minting endpoint against a real Postgres scratch schema.
 *
 * Coverage:
 *   1. owned + unpaid (generated/sent/overdue) → 201; token row verifies all fields
 *   2. amount comes from invoice.totalAmount (not request body)
 *   3. lapsed member with overdue invoice → 201 (no membership gate)
 *   4. IDOR: another person's invoice → ForbiddenError, no token row
 *   5. cross-org: invoice in a different org → ForbiddenError, no token row
 *   6. paid → 409, no token row
 *   7. cancelled → 409, no token row
 *   8. writtenOff → 409, no token row
 *   9. missing invoiceId → NotFoundError (404)
 *  10. DOUBLE-CHARGE guard: second mint while first token active → 409, exactly one token
 *
 * Run (expected RED against the 501 stub, GREEN after implementation):
 *   cd services/api-ts && bun test mintMyPaymentLink.integration
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { mintMyPaymentLink } from './mintMyPaymentLink';
import { ForbiddenError, NotFoundError } from '@/core/errors';
import { PaymentTokenRepository } from '@/handlers/dues/repos/payment-token.repo';

// Deterministic secret — handler reads PAYMENT_TOKEN_SECRET
const TOKEN_SECRET = 'mint-my-payment-link-suite-secret-deterministic';
process.env['PAYMENT_TOKEN_SECRET'] = TOKEN_SECRET;

const noopLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() { return noopLogger; },
} as any;

function freshId(): string {
  return crypto.randomUUID();
}

// ── real-PG harness ────────────────────────────────────────────────────────

let H: ScratchDb;

beforeAll(async () => {
  // Only dues_invoice and payment_token are touched by this handler.
  // FKs are NOT copied by createScratch (LIKE … INCLUDING ALL), so we can
  // insert directly without seeding person / organization parent rows.
  H = await createScratch(['dues_invoice', 'payment_token']);
});

afterAll(async () => {
  await H?.teardown();
});

// ── Raw seeders ────────────────────────────────────────────────────────────
// Insert dues_invoice rows directly so we can seed arbitrary status values
// without going through the handler write path.
// dues_invoice.person_id / organization_id are varchar(255) — UUIDs are valid.
// dues_invoice.id is uuid (baseEntityFields.id defaultRandom) so we supply one.

async function insertInvoice(opts: {
  id?: string;
  personId?: string;
  organizationId?: string;
  totalAmount?: number;
  currency?: string;
  status?: 'generated' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'writtenOff' | null;
  membershipId?: string;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".dues_invoice
       (id, membership_id, person_id, organization_id, invoice_number,
        period_start, period_end, total_amount, fund_allocations, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,
             COALESCE($10::dues_invoice_status,'generated'))`,
    [
      id,
      opts.membershipId ?? freshId(),
      opts.personId ?? freshId(),
      opts.organizationId ?? freshId(),
      `INV-${id.slice(0, 8)}`,
      '2026-01-01',
      '2026-12-31',
      opts.totalAmount ?? 250000,
      JSON.stringify([{ fundName: 'General', amount: opts.totalAmount ?? 250000 }]),
      opts.status ?? null,
    ],
  );
  return id;
}

// ── Context factory ────────────────────────────────────────────────────────

function mintCtx(overrides: {
  user?: any;
  orgId?: string;
  invoiceId?: string;
  db?: any;
} = {}): any {
  return makeCtx({
    user: overrides.user !== undefined ? overrides.user : { id: freshId() },
    database: overrides.db ?? H.db,
    logger: noopLogger,
    _params: { organizationId: overrides.orgId ?? freshId() },
    _body: { invoiceId: overrides.invoiceId ?? freshId() },
  });
}

// ══════════════════════════════════════════════════════════════════════════
// 1. Owned + unpaid invoice → 201 + correct token row
// ══════════════════════════════════════════════════════════════════════════

describe('mintMyPaymentLink — owned unpaid invoice → 201 + token row', () => {
  test('generated status → 201, token row has correct fields and createdByOfficer=null', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    const invoiceId = await insertInvoice({
      personId,
      organizationId: orgId,
      totalAmount: 250000,
      status: 'generated',
    });

    const ctx = mintCtx({ user: { id: personId }, orgId, invoiceId });
    const res = await mintMyPaymentLink(ctx) as any;

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(10);
    expect(res.body.paymentUrl).toBe(`/pay/${res.body.token}`);
    expect(res.body.expiresAt).toBeDefined();

    // Verify the token row persisted to the DB with correct shape
    const tokenRepo = new PaymentTokenRepository(H.db as any);
    const token = await tokenRepo.findActiveForInvoice(invoiceId, personId);
    expect(token).not.toBeNull();
    expect(token!.personId).toBe(personId);
    expect(token!.organizationId).toBe(orgId);
    expect(token!.invoiceId).toBe(invoiceId);
    expect(token!.amount).toBe(250000); // from invoice.totalAmount
    expect(token!.createdByOfficer).toBeNull(); // member-initiated, not officer
    expect(token!.usedAt).toBeNull();
    expect(token!.revokedAt).toBeNull();
  });

  test('sent status → 201', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    const invoiceId = await insertInvoice({ personId, organizationId: orgId, status: 'sent' });
    const ctx = mintCtx({ user: { id: personId }, orgId, invoiceId });
    const res = await mintMyPaymentLink(ctx) as any;
    expect(res.status).toBe(201);
  });

  test('overdue status → 201', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    const invoiceId = await insertInvoice({ personId, organizationId: orgId, status: 'overdue' });
    const ctx = mintCtx({ user: { id: personId }, orgId, invoiceId });
    const res = await mintMyPaymentLink(ctx) as any;
    expect(res.status).toBe(201);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 2. Amount from invoice.totalAmount (not request body)
// ══════════════════════════════════════════════════════════════════════════

describe('mintMyPaymentLink — amount is server-derived from invoice.totalAmount', () => {
  test('amount on token = invoice.totalAmount exactly (no rounding or body override)', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    const totalAmount = 987654; // odd number — proves no truncation
    const invoiceId = await insertInvoice({ personId, organizationId: orgId, totalAmount, status: 'generated' });

    const ctx = mintCtx({ user: { id: personId }, orgId, invoiceId });
    await mintMyPaymentLink(ctx);

    const tokenRepo = new PaymentTokenRepository(H.db as any);
    const token = await tokenRepo.findActiveForInvoice(invoiceId, personId);
    expect(token!.amount).toBe(totalAmount);
    expect(typeof token!.amount).toBe('number');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 3. Lapsed member with overdue invoice → 201 (no membership gate)
// ══════════════════════════════════════════════════════════════════════════

describe('mintMyPaymentLink — no membership/officer-term check', () => {
  test('lapsed member with overdue invoice → 201 (no membership check blocks them)', async () => {
    if (!H.dbReachable) return;
    // "lapsed" here means no active membership row — but the handler must NOT
    // query or gate on membership status. The dues are still owed.
    const personId = freshId();
    const orgId = freshId();
    const invoiceId = await insertInvoice({
      personId,
      organizationId: orgId,
      status: 'overdue',
      totalAmount: 100000,
    });

    const ctx = mintCtx({ user: { id: personId }, orgId, invoiceId });
    const res = await mintMyPaymentLink(ctx) as any;
    expect(res.status).toBe(201);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 4. IDOR guard: another person's invoice → 403
// ══════════════════════════════════════════════════════════════════════════

describe("mintMyPaymentLink — IDOR guard (another person's invoice)", () => {
  test('caller is not the invoice owner → ForbiddenError, no token row', async () => {
    if (!H.dbReachable) return;
    const invoiceOwner = freshId();
    const attacker = freshId();
    const orgId = freshId();
    const invoiceId = await insertInvoice({
      personId: invoiceOwner,
      organizationId: orgId,
      status: 'generated',
    });

    const ctx = mintCtx({ user: { id: attacker }, orgId, invoiceId });
    await expect(mintMyPaymentLink(ctx)).rejects.toThrow(ForbiddenError);

    // No token row must have been created for the attacker OR the owner
    const tokenRepo = new PaymentTokenRepository(H.db as any);
    const attackerToken = await tokenRepo.findActiveForInvoice(invoiceId, attacker);
    expect(attackerToken).toBeNull();
    const ownerToken = await tokenRepo.findActiveForInvoice(invoiceId, invoiceOwner);
    expect(ownerToken).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 5. Cross-org guard: invoice in a different org → 403
// ══════════════════════════════════════════════════════════════════════════

describe('mintMyPaymentLink — cross-org guard', () => {
  test('invoice org ≠ request org → ForbiddenError, no token row', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const realOrgId = freshId();
    const fakeOrgId = freshId();
    const invoiceId = await insertInvoice({
      personId,
      organizationId: realOrgId,
      status: 'generated',
    });

    // Request routed through the WRONG org
    const ctx = mintCtx({ user: { id: personId }, orgId: fakeOrgId, invoiceId });
    await expect(mintMyPaymentLink(ctx)).rejects.toThrow(ForbiddenError);

    // No token row in either org context
    const tokenRepo = new PaymentTokenRepository(H.db as any);
    const token = await tokenRepo.findActiveForInvoice(invoiceId, personId);
    expect(token).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 6–8. Terminal status → 409, no token row
// ══════════════════════════════════════════════════════════════════════════

describe('mintMyPaymentLink — terminal invoice status → 409', () => {
  for (const status of ['paid', 'cancelled', 'writtenOff'] as const) {
    test(`${status} → 409, no token row created`, async () => {
      if (!H.dbReachable) return;
      const personId = freshId();
      const orgId = freshId();
      const invoiceId = await insertInvoice({ personId, organizationId: orgId, status });

      const ctx = mintCtx({ user: { id: personId }, orgId, invoiceId });
      const res = await mintMyPaymentLink(ctx) as any;
      expect(res.status).toBe(409);

      const tokenRepo = new PaymentTokenRepository(H.db as any);
      const token = await tokenRepo.findActiveForInvoice(invoiceId, personId);
      expect(token).toBeNull();
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// 9. Missing invoice → NotFoundError
// ══════════════════════════════════════════════════════════════════════════

describe('mintMyPaymentLink — missing invoice → NotFoundError', () => {
  test('non-existent invoiceId → NotFoundError (not a stale 501)', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    const ctx = mintCtx({ user: { id: personId }, orgId, invoiceId: freshId() });
    await expect(mintMyPaymentLink(ctx)).rejects.toThrow(NotFoundError);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 10. DOUBLE-CHARGE guard: second mint → 409, exactly one active token
// ══════════════════════════════════════════════════════════════════════════

describe('mintMyPaymentLink — DOUBLE-CHARGE guard', () => {
  test('second mint while first token active → 409 + exactly one active token persisted', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    const invoiceId = await insertInvoice({
      personId,
      organizationId: orgId,
      status: 'generated',
    });

    // First mint succeeds
    const ctx1 = mintCtx({ user: { id: personId }, orgId, invoiceId });
    const res1 = await mintMyPaymentLink(ctx1) as any;
    expect(res1.status).toBe(201);

    // Second mint (same invoice, same person) must be blocked
    const ctx2 = mintCtx({ user: { id: personId }, orgId, invoiceId });
    const res2 = await mintMyPaymentLink(ctx2) as any;
    expect(res2.status).toBe(409);
    expect((res2.body.error as string).toLowerCase()).toContain('already in progress');

    // Assert exactly ONE active token for this invoice (no second settleable token)
    const { rows } = await H.scopedPool.query(
      `SELECT COUNT(*) AS cnt
       FROM "${H.schema}".payment_token
       WHERE invoice_id = $1
         AND person_id = $2
         AND used_at IS NULL
         AND revoked_at IS NULL
         AND expires_at > NOW()`,
      [invoiceId, personId],
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});
