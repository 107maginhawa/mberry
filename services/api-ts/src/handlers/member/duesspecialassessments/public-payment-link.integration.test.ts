/**
 * BR-PUBLIC-PAYMENT-LINK — the one-tap dues public payment link, end to end.
 *
 * This is the "HMAC token core has NO test" gap. The wired flow is:
 *   officer → sendPaymentLink (mints a raw token, stores only its HMAC-SHA256
 *             hash on a payment_token row) → member clicks /pay/:token →
 *   validatePaymentToken (UNAUTHENTICATED — recomputes the hash, looks up the
 *             real invoice/token row, returns the pay-page details).
 *
 * The token model here is a HASH-LOOKUP token (NOT a self-describing JWT-style
 * payload): the raw token is random bytes, the server keeps only
 * HMAC-SHA256(raw, secret); on validate it recomputes that hash and reads the
 * row back from Postgres. So the "round-trip (sign→verify returns the invoice
 * id)" is: generatePaymentToken → store hash → hashPaymentToken(raw) recomputes
 * the SAME hash → the repo lookup returns the token row carrying invoiceId.
 * A forged/tampered raw token hashes to something that isn't in the table, so
 * the lookup misses and the public endpoint refuses to leak any invoice.
 *
 * Coverage:
 *   A. Token crypto core (pure, no DB) — round-trip, tamper, forgery via wrong
 *      secret, determinism, secret resolution/fallback, expiry math.
 *   B. validatePaymentToken (REAL Postgres, unauthenticated) — a real token over
 *      a real invoice returns the invoice id + money; bad/forged/expired/used
 *      tokens are each refused with the right shape, and never leak the invoice.
 *   C. checkoutPaymentToken token-gate (stubbed repos) — the same forged/expired/
 *      used guards reject before any Stripe/ledger work.
 *
 * Real-PG isolation: shared createScratch harness (LIKE public.<t> INCLUDING ALL,
 * real columns/defaults). FKs are NOT copied by LIKE, so we seed
 * person/organization/payment_token directly. validatePaymentToken's
 * findByTokenHashWithDetails inner-joins person + organization, so all three
 * tables are seeded. The handler runs against H.db (drizzle pinned to the scratch
 * search_path). If Postgres is unreachable the real-PG suite skips cleanly; the
 * crypto-core + checkout-guard suites need no DB and always run.
 *
 * Target: handlers/member/duesspecialassessments/utils/payment-token.ts
 *         + sendPaymentLink.ts, validatePaymentToken.ts, checkoutPaymentToken.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { createHmac } from 'crypto';

import {
  generatePaymentToken,
  hashPaymentToken,
  defaultPaymentTokenExpiry,
  isPaymentTokenExpired,
  getPaymentTokenSecret,
} from './utils/payment-token';
import { validatePaymentToken } from './validatePaymentToken';
import { checkoutPaymentToken } from './checkoutPaymentToken';
import { PaymentTokenRepository } from '@/handlers/dues/repos/payment-token.repo';
import { DuesRepository } from '@/handlers/dues/repos/dues-payments.repo';

// The handlers call getPaymentTokenSecret(), which reads process.env at call
// time. Pin a deterministic secret for the whole suite so the hash the seed
// helpers compute matches the hash the handlers recompute.
const TEST_SECRET = 'payment-token-suite-secret-deterministic';
process.env['PAYMENT_TOKEN_SECRET'] = TEST_SECRET;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {}, child() { return noopLogger; } } as any;

function freshId(): string {
  return crypto.randomUUID();
}

// ═══════════════════════════════════════════════════════════════════════════
// A. Token crypto core — the HMAC sign/verify round-trip (pure, no DB)
// ═══════════════════════════════════════════════════════════════════════════

describe('payment-token crypto core — HMAC round-trip + tamper resistance', () => {
  test('a minted token round-trips: hashing the raw token reproduces the stored hash exactly', () => {
    const { raw, hash } = generatePaymentToken(TEST_SECRET);

    // The raw token is opaque random material (base64url of 32 bytes), never the hash.
    expect(typeof raw).toBe('string');
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).not.toBe(hash);

    // The stored hash is HMAC-SHA256(raw, secret) in hex — this is the "sign".
    expect(hash).toBe(createHmac('sha256', TEST_SECRET).update(raw).digest('hex'));
    expect(hash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex = 64 lowercase hex chars

    // The "verify": recomputing the hash from the presented raw token yields the
    // SAME hash the server stored — this is what lets the lookup find the row.
    expect(hashPaymentToken(raw, TEST_SECRET)).toBe(hash);
  });

  test('a TAMPERED raw token hashes to a DIFFERENT value (verify fails)', () => {
    const { raw, hash } = generatePaymentToken(TEST_SECRET);

    // Flip the first character of the raw token — any mutation must diverge the hash.
    const tampered = (raw[0] === 'A' ? 'B' : 'A') + raw.slice(1);
    expect(tampered).not.toBe(raw);
    expect(hashPaymentToken(tampered, TEST_SECRET)).not.toBe(hash);
  });

  test('a token FORGED under the wrong secret does not match the legitimate hash', () => {
    const { raw, hash } = generatePaymentToken(TEST_SECRET);

    // An attacker who knows the raw token but not the server secret cannot
    // reproduce the stored hash — HMAC binds the hash to the secret.
    expect(hashPaymentToken(raw, 'attacker-guessed-secret')).not.toBe(hash);
  });

  test('hashing is deterministic for the same (raw, secret) and distinct across tokens', () => {
    const a = generatePaymentToken(TEST_SECRET);
    const b = generatePaymentToken(TEST_SECRET);

    // Deterministic: same input → same hash.
    expect(hashPaymentToken(a.raw, TEST_SECRET)).toBe(hashPaymentToken(a.raw, TEST_SECRET));
    // Two independently minted tokens must not collide.
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });

  test('getPaymentTokenSecret prefers PAYMENT_TOKEN_SECRET, falls back to INVITE_TOKEN_SECRET, else throws', () => {
    const savedPayment = process.env['PAYMENT_TOKEN_SECRET'];
    const savedInvite = process.env['INVITE_TOKEN_SECRET'];
    try {
      process.env['PAYMENT_TOKEN_SECRET'] = 'primary-secret';
      process.env['INVITE_TOKEN_SECRET'] = 'fallback-secret';
      expect(getPaymentTokenSecret()).toBe('primary-secret');

      // Falls back to INVITE_TOKEN_SECRET when the dedicated secret is unset.
      delete process.env['PAYMENT_TOKEN_SECRET'];
      expect(getPaymentTokenSecret()).toBe('fallback-secret');

      // Neither configured → hard configuration error (never a silent empty secret).
      delete process.env['INVITE_TOKEN_SECRET'];
      expect(() => getPaymentTokenSecret()).toThrow(/secret not configured/i);
    } finally {
      if (savedPayment === undefined) delete process.env['PAYMENT_TOKEN_SECRET'];
      else process.env['PAYMENT_TOKEN_SECRET'] = savedPayment;
      if (savedInvite === undefined) delete process.env['INVITE_TOKEN_SECRET'];
      else process.env['INVITE_TOKEN_SECRET'] = savedInvite;
    }
  });

  test('expiry math: defaultPaymentTokenExpiry is ~72h out and isPaymentTokenExpired gates on it', () => {
    const expiry = defaultPaymentTokenExpiry();
    const hoursOut = (expiry.getTime() - Date.now()) / (60 * 60 * 1000);
    // The wired link uses a 72-hour window (NOT the 30-day figure that lives on
    // the UNWIRED sibling util — see NOTE in the agent report).
    expect(hoursOut).toBeGreaterThan(71.9);
    expect(hoursOut).toBeLessThan(72.1);

    // A future expiry is live; a past expiry is expired.
    expect(isPaymentTokenExpired(new Date(Date.now() + 60_000))).toBe(false);
    expect(isPaymentTokenExpired(new Date(Date.now() - 60_000))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B. validatePaymentToken — UNAUTHENTICATED public pay page over REAL rows
// ═══════════════════════════════════════════════════════════════════════════

let H: ScratchDb;

/** Seed a person; only first_name is NOT NULL without a default. */
async function insertPerson(opts: { id?: string; firstName?: string; lastName?: string } = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".person (id, first_name, last_name) VALUES ($1, $2, $3)`,
    [id, opts.firstName ?? 'Maria', 'lastName' in opts ? opts.lastName : 'Cruz'],
  );
  return id;
}

/** Seed an organization with its NOT-NULL columns (association_id, name, slug, org_type). */
async function insertOrg(opts: { id?: string; name?: string } = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".organization (id, association_id, name, slug, org_type)
     VALUES ($1, $2, $3, $4, $5::org_type)`,
    [id, freshId(), opts.name ?? 'Manila Dental Society', `org-${id.slice(0, 8)}`, 'society'],
  );
  return id;
}

/**
 * Seed a payment_token row directly, mirroring exactly what sendPaymentLink
 * would persist: tokenHash = HMAC(raw, secret). Returns the RAW token (what the
 * member presents) plus the row id, so the validate path must recompute the hash
 * from the raw token to find it.
 */
async function insertPaymentToken(opts: {
  personId: string;
  organizationId: string;
  officerId: string;
  invoiceId?: string | null;
  amount?: number;
  currency?: string;
  expiresAt?: Date;
  usedAt?: Date | null;
}): Promise<{ raw: string; id: string; invoiceId: string | null; amount: number; currency: string }> {
  const { raw, hash } = generatePaymentToken(TEST_SECRET);
  const id = freshId();
  const invoiceId = opts.invoiceId === undefined ? freshId() : opts.invoiceId;
  const amount = opts.amount ?? 250000; // ₱2,500.00 in cents
  const currency = opts.currency ?? 'PHP';
  const expiresAt = opts.expiresAt ?? defaultPaymentTokenExpiry();

  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".payment_token
       (id, token_hash, person_id, organization_id, invoice_id, amount, currency, expires_at, used_at, created_by_officer)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      hash,
      opts.personId,
      opts.organizationId,
      invoiceId,
      amount,
      currency,
      expiresAt,
      'usedAt' in opts ? opts.usedAt : null,
      opts.officerId,
    ],
  );
  return { raw, id, invoiceId, amount, currency };
}

/** A ctx for the UNAUTHENTICATED public endpoint: no user/session, real scratch db. */
function publicCtx(rawToken: string): any {
  return makeCtx({
    user: null,
    session: null,
    database: H.db,
    logger: noopLogger,
    _params: { token: rawToken },
  });
}

beforeAll(async () => {
  H = await createScratch(['person', 'organization', 'payment_token']);
});

afterAll(async () => {
  await H?.teardown();
});

describe('validatePaymentToken — public pay page returns the real invoice (real DB)', () => {
  test('a valid signed token round-trips to its REAL invoice id, amount, currency, member + org name', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({ firstName: 'Maria', lastName: 'Cruz' });
    const orgId = await insertOrg({ name: 'Cebu Dental Chapter' });
    const officerId = await insertPerson({ firstName: 'Officer' });
    const seeded = await insertPaymentToken({
      personId,
      organizationId: orgId,
      officerId,
      amount: 250000,
      currency: 'PHP',
    });

    // No-user, public request — the raw token is the only credential.
    const res = (await validatePaymentToken(publicCtx(seeded.raw))) as any;
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    // The load-bearing assertion: verify resolved the token back to ITS invoice.
    expect(res.body.invoiceId).toBe(seeded.invoiceId);
    expect(res.body.amount).toBe(250000);
    expect(res.body.currency).toBe('PHP');
    expect(res.body.memberName).toBe('Maria Cruz');
    expect(res.body.orgName).toBe('Cebu Dental Chapter');
    // dueDate is the token's own expiry, serialized.
    expect(Number.isNaN(Date.parse(res.body.dueDate))).toBe(false);
  });

  test('an UNKNOWN/forged token is refused without leaking any invoice', async () => {
    if (!H.dbReachable) return;
    // A freshly minted raw token that was never stored — its hash is in no row.
    const { raw } = generatePaymentToken(TEST_SECRET);

    const res = (await validatePaymentToken(publicCtx(raw))) as any;
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.error).toMatch(/invalid or has been revoked/i);
    // It must NOT echo an invoiceId/amount for a token it could not resolve.
    expect(res.body.invoiceId).toBeUndefined();
    expect(res.body.amount).toBeUndefined();
  });

  test('a TAMPERED raw token (one char changed on a real token) does not resolve the invoice', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({});
    const orgId = await insertOrg({});
    const officerId = await insertPerson({ firstName: 'Officer' });
    const seeded = await insertPaymentToken({ personId, organizationId: orgId, officerId });

    // Mutate one character of the legitimate token → hash diverges → lookup misses.
    const tampered = (seeded.raw[0] === 'A' ? 'B' : 'A') + seeded.raw.slice(1);
    const res = (await validatePaymentToken(publicCtx(tampered))) as any;
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.invoiceId).toBeUndefined();
  });

  test('an EXPIRED token (real row past expires_at) is refused as expired', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({});
    const orgId = await insertOrg({});
    const officerId = await insertPerson({ firstName: 'Officer' });
    // expires_at one minute in the PAST.
    const seeded = await insertPaymentToken({
      personId,
      organizationId: orgId,
      officerId,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const res = (await validatePaymentToken(publicCtx(seeded.raw))) as any;
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.error).toMatch(/expired/i);
    // Expired must NOT surface the invoice/amount.
    expect(res.body.invoiceId).toBeUndefined();
  });

  test('an ALREADY-USED token is refused with status already_paid', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({});
    const orgId = await insertOrg({});
    const officerId = await insertPerson({ firstName: 'Officer' });
    const seeded = await insertPaymentToken({
      personId,
      organizationId: orgId,
      officerId,
      usedAt: new Date(), // already consumed by a prior checkout
    });

    const res = (await validatePaymentToken(publicCtx(seeded.raw))) as any;
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.status).toBe('already_paid');
  });

  test('a still-live token (future expiry, unused) past the 72h-style boundary check still validates', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({ firstName: 'Liwayway', lastName: 'Reyes' });
    const orgId = await insertOrg({ name: 'National Society' });
    const officerId = await insertPerson({ firstName: 'Officer' });
    // expires_at comfortably in the future (within the 72h window).
    const seeded = await insertPaymentToken({
      personId,
      organizationId: orgId,
      officerId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      invoiceId: null, // amount-only link (no invoice attached) is still a valid pay page
    });

    const res = (await validatePaymentToken(publicCtx(seeded.raw))) as any;
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.invoiceId).toBeNull();
    expect(res.body.memberName).toBe('Liwayway Reyes');
  });

  test('a missing token param is refused (no DB read, no leak)', async () => {
    if (!H.dbReachable) return;
    const res = (await validatePaymentToken(publicCtx(''))) as any;
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.error).toMatch(/required/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C. checkoutPaymentToken — the token gate rejects bad tokens before any
//    Stripe / ledger work (stubbed repos; the gate is the unit under test).
// ═══════════════════════════════════════════════════════════════════════════

describe('checkoutPaymentToken — token gate rejects forged/expired/used tokens before any PayMongo work', () => {
  test('a forged token (no matching row) is rejected 400 and never reaches billing', () => {
    const { raw } = generatePaymentToken(TEST_SECRET);
    const mocks = stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => undefined,
    });
    try {
      const billing = { createPaymentIntent: async () => { throw new Error('billing must not be called'); } };
      return checkoutPaymentToken(
        makeCtx({ user: null, session: null, _params: { token: raw }, billing }) as any,
      ).then((res: any) => {
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/invalid or has been revoked/i);
      });
    } finally {
      mocks.findByTokenHash.mockRestore();
    }
  });

  test('an already-used token is rejected 409 (double-pay prevention) before any checkout', () => {
    const { raw } = generatePaymentToken(TEST_SECRET);
    const mocks = stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => ({
        id: freshId(),
        organizationId: freshId(),
        personId: freshId(),
        invoiceId: null,
        amount: 100000,
        currency: 'PHP',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: new Date(), // already consumed
      }),
    });
    try {
      const billing = { createPaymentIntent: async () => { throw new Error('billing must not be called'); } };
      return checkoutPaymentToken(
        makeCtx({ user: null, session: null, _params: { token: raw }, billing }) as any,
      ).then((res: any) => {
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/already been processed/i);
      });
    } finally {
      mocks.findByTokenHash.mockRestore();
    }
  });

  test('an expired token is rejected 410 before any checkout', () => {
    const { raw } = generatePaymentToken(TEST_SECRET);
    const mocks = stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => ({
        id: freshId(),
        organizationId: freshId(),
        personId: freshId(),
        invoiceId: null,
        amount: 100000,
        currency: 'PHP',
        expiresAt: new Date(Date.now() - 60_000), // expired
        usedAt: null,
      }),
    });
    try {
      const billing = { createPaymentIntent: async () => { throw new Error('billing must not be called'); } };
      return checkoutPaymentToken(
        makeCtx({ user: null, session: null, _params: { token: raw }, billing }) as any,
      ).then((res: any) => {
        expect(res.status).toBe(410);
        expect(res.body.error).toMatch(/expired/i);
      });
    } finally {
      mocks.findByTokenHash.mockRestore();
    }
  });

  test('a revoked token is rejected 410 before any checkout', () => {
    const { raw } = generatePaymentToken(TEST_SECRET);
    const mocks = stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => ({
        id: freshId(),
        organizationId: freshId(),
        personId: freshId(),
        invoiceId: null,
        amount: 100000,
        currency: 'PHP',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        revokedAt: new Date(), // officer revoked
      }),
    });
    try {
      const billing = { createPaymentIntent: async () => { throw new Error('billing must not be called'); } };
      return checkoutPaymentToken(
        makeCtx({ user: null, session: null, _params: { token: raw }, billing }) as any,
      ).then((res: any) => {
        expect(res.status).toBe(410);
        expect(res.body.error).toMatch(/revoked/i);
      });
    } finally {
      mocks.findByTokenHash.mockRestore();
    }
  });

  test('a valid token whose org has NO connected gateway is refused (GatewayNotConfiguredError → 400 via middleware), no PayMongo call', async () => {
    const { raw } = generatePaymentToken(TEST_SECRET);
    const orgId = freshId();
    const tokMocks = stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => ({
        id: freshId(),
        organizationId: orgId,
        personId: freshId(),
        invoiceId: null,
        amount: 100000,
        currency: 'PHP',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
      }),
    });
    const duesMocks = stubRepo(DuesRepository, {
      // Gateway not connected → resolveCheckoutAdapter throws GatewayNotConfiguredError
      // (AppError 400) which the route's error middleware renders as a 400 — the
      // handler itself never creates a payment or calls PayMongo.
      getGatewayConfig: async () => ({ connected: false }),
    });
    try {
      const billing = { createPaymentIntent: async () => { throw new Error('billing must not be called'); } };
      await expect(
        checkoutPaymentToken(
          makeCtx({
            user: null,
            session: null,
            _params: { token: raw },
            billing,
            config: { auth: { secret: 'test-secret' } },
          }) as any,
        ),
      ).rejects.toThrow(/not configured/i);
    } finally {
      tokMocks.findByTokenHash.mockRestore();
      duesMocks.getGatewayConfig.mockRestore();
    }
  });
});
