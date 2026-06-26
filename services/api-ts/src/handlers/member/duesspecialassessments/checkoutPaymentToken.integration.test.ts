/**
 * checkoutPaymentToken — PayMongo re-point, claim-then-call idempotency (Task 7).
 *
 * The login-free pay-link checkout is the core money path: a member taps
 * `POST /pay/:token/checkout` and we must create EXACTLY ONE PayMongo checkout
 * session per token even under a concurrent double-tap, never double-charge,
 * and stay retryable when PayMongo fails.
 *
 * These are REAL-Postgres tests (createScratch harness). The atomic claim mutex
 * (`claimForCheckout`) only behaves correctly against a real row lock, so a mock
 * DB would prove nothing. The PayMongo HTTP boundary is the only thing stubbed —
 * via global `fetch`, which also lets us COUNT how many checkout sessions were
 * actually created (the money-critical invariant).
 *
 * Coverage (the six behaviours from the task brief):
 *   1. concurrent double-tap → createCheckout called exactly once, both taps
 *      land on the SAME checkout_url (no second session, no double charge)
 *   2. expired token        → 410
 *   3. revoked token        → 410
 *   4. used token           → 409
 *   5. stored session expired at PayMongo → remint a fresh session
 *   6. PayMongo 502         → token stays claimable (retryable), next tap succeeds
 *
 * Run (REQUIRED — a skipped run is a false green):
 *   DATABASE_URL=postgres://postgres:password@localhost:5433/monobase \
 *     bun test src/handlers/member/duesspecialassessments/checkoutPaymentToken.integration.test.ts
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { encryptCredential } from '@/core/gateway';
import { generatePaymentToken, defaultPaymentTokenExpiry } from './utils/payment-token';
import { checkoutPaymentToken } from './checkoutPaymentToken';
import { PaymentTokenRepository } from '@/handlers/dues/repos/payment-token.repo';

// Deterministic secrets pinned for the whole suite. The handler recomputes the
// token hash with PAYMENT_TOKEN_SECRET, and resolveCheckoutAdapter decrypts the
// org's PayMongo key with config.auth.secret — both must match what we seed.
const TOKEN_SECRET = 'checkout-suite-token-secret-deterministic';
const AUTH_SECRET = 'checkout-suite-auth-secret-deterministic';
process.env['PAYMENT_TOKEN_SECRET'] = TOKEN_SECRET;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {}, child() { return noopLogger; } } as any;

function freshId(): string {
  return crypto.randomUUID();
}

// ── PayMongo HTTP boundary stub ────────────────────────────────────────────
// The adapter talks to api.paymongo.com via global fetch. We intercept it,
// COUNT createCheckout (POST) calls — the single-session invariant — and serve
// session GETs for the reuse/remint paths.
interface FetchState {
  createCalls: number;
  failPost: boolean;          // simulate a PayMongo 502 on createCheckout
  getStatus: string;          // PayMongo status returned by GET checkout_sessions/:id
  sessionIds: string[];       // every session id minted (to prove remint differs)
}

function mkResp(ok: boolean, status: number, bodyText: string): any {
  return {
    ok,
    status,
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText),
  };
}

let fetchState: FetchState;
const origFetch = globalThis.fetch;

function installFetch(state: FetchState): void {
  fetchState = state;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    if (method === 'POST' && url.includes('/checkout_sessions')) {
      state.createCalls++;
      if (state.failPost) return mkResp(false, 502, 'PayMongo upstream error');
      const id = `cs_${state.createCalls}_${Math.floor(Math.random() * 1e6)}`;
      state.sessionIds.push(id);
      return mkResp(true, 200, JSON.stringify({
        data: { id, attributes: { checkout_url: `https://checkout.paymongo.com/${id}` } },
      }));
    }

    // GET /checkout_sessions/:id — status + checkout_url for reuse/remint.
    const id = url.split('/checkout_sessions/')[1] ?? 'cs_unknown';
    return mkResp(true, 200, JSON.stringify({
      data: { attributes: {
        status: state.getStatus,
        checkout_url: `https://checkout.paymongo.com/${id}`,
        line_items: [{ amount: 250000, currency: 'PHP' }],
      } },
    }));
  }) as any;
}

afterEach(() => {
  globalThis.fetch = origFetch;
});

// ── real-PG harness ─────────────────────────────────────────────────────────
let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch([
    'person',
    'organization',
    'payment_token',
    'dues_gateway_config',
    'dues_payment',
    'dues_receipt_counter',
  ]);
});

afterAll(async () => {
  await H?.teardown();
});

async function insertPerson(opts: { email?: string } = {}): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".person (id, first_name, last_name, contact_info)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [id, 'Maria', 'Cruz', JSON.stringify({ email: opts.email ?? 'maria@example.com' })],
  );
  return id;
}

async function insertOrg(): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".organization (id, association_id, name, slug, org_type)
     VALUES ($1, $2, $3, $4, $5::org_type)`,
    [id, freshId(), 'Manila Dental Society', `mds-${id.slice(0, 8)}`, 'society'],
  );
  return id;
}

/** Seed a PayMongo-connected gateway config for the org (secret encrypted with AUTH_SECRET). */
async function insertGatewayConfig(orgId: string): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".dues_gateway_config
       (id, organization_id, provider, public_key, encrypted_secret, connected)
     VALUES ($1, $2, $3::gateway_provider, $4, $5, $6)`,
    [freshId(), orgId, 'paymongo', 'pk_test_public', encryptCredential('sk_test_secret', AUTH_SECRET), true],
  );
}

async function insertToken(opts: {
  personId: string;
  organizationId: string;
  officerId: string;
  expiresAt?: Date;
  usedAt?: Date | null;
  revokedAt?: Date | null;
  paymongoSessionId?: string | null;
  checkoutStartedAt?: Date | null;
}): Promise<{ raw: string; id: string }> {
  const { raw, hash } = generatePaymentToken(TOKEN_SECRET);
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".payment_token
       (id, token_hash, person_id, organization_id, invoice_id, amount, currency,
        expires_at, used_at, revoked_at, paymongo_session_id, checkout_started_at, created_by_officer)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id, hash, opts.personId, opts.organizationId, null, 250000, 'PHP',
      opts.expiresAt ?? defaultPaymentTokenExpiry(),
      opts.usedAt ?? null,
      opts.revokedAt ?? null,
      opts.paymongoSessionId ?? null,
      opts.checkoutStartedAt ?? null,
      opts.officerId,
    ],
  );
  return { raw, id };
}

function checkoutCtx(rawToken: string): any {
  return makeCtx({
    user: null,
    session: null,
    database: H.db,
    logger: noopLogger,
    config: { auth: { secret: AUTH_SECRET } },
    _params: { token: rawToken },
  });
}

async function seedConnectedToken(extra: Partial<Parameters<typeof insertToken>[0]> = {}) {
  const personId = await insertPerson();
  const organizationId = await insertOrg();
  const officerId = await insertPerson();
  await insertGatewayConfig(organizationId);
  const tok = await insertToken({ personId, organizationId, officerId, ...extra });
  return { personId, organizationId, officerId, ...tok };
}

describe('POST /pay/:token/checkout (PayMongo, claim-then-call idempotency)', () => {
  test('creates EXACTLY ONE PayMongo session under a concurrent double-tap; both taps share the checkout_url', async () => {
    if (!H.dbReachable) return;
    installFetch({ createCalls: 0, failPost: false, getStatus: 'awaiting_payment_method', sessionIds: [] });

    const seeded = await seedConnectedToken();

    // Two truly-concurrent taps (separate ctx ⇒ separate pool connection).
    const [a, b] = await Promise.all([
      checkoutPaymentToken(checkoutCtx(seeded.raw)),
      checkoutPaymentToken(checkoutCtx(seeded.raw)),
    ]) as any[];

    // THE money invariant: only one checkout session was created at PayMongo.
    expect(fetchState.createCalls).toBe(1);
    expect(fetchState.sessionIds.length).toBe(1);

    // Both taps succeed (200) and resolve to the SAME checkout_url — no second session.
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 200]);
    const urlA = a.body.checkoutUrl;
    const urlB = b.body.checkoutUrl;
    expect(urlA).toBeTruthy();
    expect(urlA).toBe(urlB);
    expect(urlA).toContain('https://checkout.paymongo.com/');

    // Exactly one session id is attached to the token row.
    const repo = new PaymentTokenRepository(H.db as any);
    const fresh = await repo.findByTokenHash((await import('./utils/payment-token')).hashPaymentToken(seeded.raw, TOKEN_SECRET));
    expect(fresh?.paymongoSessionId).toBe(fetchState.sessionIds[0]);

    // Exactly one pending dues_payment ledger row was written (one charge intent).
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".dues_payment WHERE person_id = $1`,
      [seeded.personId],
    );
    expect(rows[0].n).toBe(1);
  });

  test('returns 410 for an EXPIRED token (no PayMongo call, no ledger row)', async () => {
    if (!H.dbReachable) return;
    installFetch({ createCalls: 0, failPost: false, getStatus: 'awaiting_payment_method', sessionIds: [] });
    const seeded = await seedConnectedToken({ expiresAt: new Date(Date.now() - 60_000) });

    const res = (await checkoutPaymentToken(checkoutCtx(seeded.raw))) as any;
    expect(res.status).toBe(410);
    expect(res.body.error).toMatch(/expired/i);
    expect(fetchState.createCalls).toBe(0);
  });

  test('returns 410 for a REVOKED token (no PayMongo call)', async () => {
    if (!H.dbReachable) return;
    installFetch({ createCalls: 0, failPost: false, getStatus: 'awaiting_payment_method', sessionIds: [] });
    const seeded = await seedConnectedToken({ revokedAt: new Date() });

    const res = (await checkoutPaymentToken(checkoutCtx(seeded.raw))) as any;
    expect(res.status).toBe(410);
    expect(res.body.error).toMatch(/revoked/i);
    expect(fetchState.createCalls).toBe(0);
  });

  test('returns 409 for an already-USED token (double-pay prevention)', async () => {
    if (!H.dbReachable) return;
    installFetch({ createCalls: 0, failPost: false, getStatus: 'awaiting_payment_method', sessionIds: [] });
    const seeded = await seedConnectedToken({ usedAt: new Date() });

    const res = (await checkoutPaymentToken(checkoutCtx(seeded.raw))) as any;
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already been processed/i);
    expect(fetchState.createCalls).toBe(0);
  });

  test('remints a fresh session when the stored session is EXPIRED at PayMongo', async () => {
    if (!H.dbReachable) return;
    installFetch({ createCalls: 0, failPost: false, getStatus: 'expired', sessionIds: [] });
    // Token already carries a (now-expired) session from a prior attempt.
    const seeded = await seedConnectedToken({
      paymongoSessionId: 'cs_stale_old',
      checkoutStartedAt: new Date(Date.now() - 10 * 60_000), // stale lease
    });

    const res = (await checkoutPaymentToken(checkoutCtx(seeded.raw))) as any;
    expect(res.status).toBe(200);
    // A brand-new session was created (the stale one released, not reused).
    expect(fetchState.createCalls).toBe(1);
    const newSession = fetchState.sessionIds[0]!;
    expect(newSession).not.toBe('cs_stale_old');
    expect(res.body.checkoutUrl).toContain(newSession);

    const repo = new PaymentTokenRepository(H.db as any);
    const fresh = await repo.findByTokenHash((await import('./utils/payment-token')).hashPaymentToken(seeded.raw, TOKEN_SECRET));
    expect(fresh?.paymongoSessionId).toBe(newSession);
  });

  test('keeps the token claimable (retryable) after a PayMongo 502, and a later tap succeeds', async () => {
    if (!H.dbReachable) return;
    // First tap: PayMongo returns 502.
    installFetch({ createCalls: 0, failPost: true, getStatus: 'awaiting_payment_method', sessionIds: [] });
    const seeded = await seedConnectedToken();

    const fail = (await checkoutPaymentToken(checkoutCtx(seeded.raw))) as any;
    expect(fail.status).toBe(502);
    expect(fetchState.createCalls).toBe(1);

    // The lease was released: no session attached, claim cleared → reclaimable.
    const repo = new PaymentTokenRepository(H.db as any);
    const hashOf = (await import('./utils/payment-token')).hashPaymentToken(seeded.raw, TOKEN_SECRET);
    const afterFail = await repo.findByTokenHash(hashOf);
    expect(afterFail?.paymongoSessionId).toBeNull();
    expect(afterFail?.checkoutStartedAt).toBeNull();
    expect(afterFail?.usedAt).toBeNull();

    // Second tap: PayMongo healthy → a session is created and the token settles into one.
    installFetch({ createCalls: 0, failPost: false, getStatus: 'awaiting_payment_method', sessionIds: [] });
    const ok = (await checkoutPaymentToken(checkoutCtx(seeded.raw))) as any;
    expect(ok.status).toBe(200);
    expect(fetchState.createCalls).toBe(1);
    expect(ok.body.checkoutUrl).toContain('https://checkout.paymongo.com/');

    const settled = await repo.findByTokenHash(hashOf);
    expect(settled?.paymongoSessionId).toBe(fetchState.sessionIds[0]);
  });
});
