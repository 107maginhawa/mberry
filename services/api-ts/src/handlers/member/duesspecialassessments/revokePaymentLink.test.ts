/**
 * Tests for revokePaymentLink (Task 9) — officer revoke payment link.
 *
 * Unit tests: handler control-flow via stubbed repo (no DB):
 *   - 200 happy path
 *   - 404 when token not found
 *   - 404 when token belongs to different org (org-scope, no existence leak)
 *   - 404 when revoke CAS returns false (already used/revoked)
 *
 * Integration tests (real-PG, port 5433):
 *   - revokes unused token → 200, then claimForCheckout returns null (truly revoked)
 *   - token from another org → 404 (org scoping)
 *   - already-used token → 404 (revoke CAS false)
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PaymentTokenRepository } from '@/handlers/dues/repos/payment-token.repo';
import { paymentTokens } from '@/handlers/dues/repos/payment-token.schema';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { revokePaymentLink } from './revokePaymentLink';

// ─── Unit Tests (stubbed repo) ───────────────────────────

const TOKEN_ID = 'pt-unit-1';
const ORG_ID = 'org-unit-1';

const activeTokenRow = {
  id: TOKEN_ID,
  organizationId: ORG_ID,
  tokenHash: 'hash-unit',
  personId: 'person-unit-1',
  invoiceId: null,
  amount: 5000,
  currency: 'PHP',
  expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
  usedAt: null,
  revokedAt: null,
  paymongoSessionId: null,
  checkoutStartedAt: null,
  idempotencyKey: null,
  createdByOfficer: 'officer-unit-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: null,
  updatedBy: null,
};

function makeRevokeCtx(overrides: { organizationId?: string; tokenId?: string; db?: any } = {}) {
  return makeCtx({
    _params: {
      organizationId: overrides.organizationId ?? ORG_ID,
      tokenId: overrides.tokenId ?? TOKEN_ID,
    },
    ...(overrides.db !== undefined ? { database: overrides.db } : {}),
  });
}

describe('[Task 9] revokePaymentLink — unit', () => {
  beforeEach(() => { restoreRepo(PaymentTokenRepository); });
  afterEach(() => { restoreRepo(PaymentTokenRepository); });

  test('200 — revokes an active token', async () => {
    stubRepo(PaymentTokenRepository, {
      findById: async () => activeTokenRow,
      revoke: async () => true,
    });
    const res = (await revokePaymentLink(makeRevokeCtx() as any)) as any;
    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(true);
  });

  test('404 — token not found (findById returns undefined)', async () => {
    stubRepo(PaymentTokenRepository, {
      findById: async () => undefined,
    });
    const res = (await revokePaymentLink(makeRevokeCtx() as any)) as any;
    expect(res.status).toBe(404);
  });

  test('404 — token belongs to a different org (org scoping, no existence leak)', async () => {
    stubRepo(PaymentTokenRepository, {
      findById: async () => ({ ...activeTokenRow, organizationId: 'org-other' }),
    });
    const res = (await revokePaymentLink(makeRevokeCtx() as any)) as any;
    expect(res.status).toBe(404);
  });

  test('404 — revoke CAS returns false (already used or revoked)', async () => {
    stubRepo(PaymentTokenRepository, {
      findById: async () => activeTokenRow,
      revoke: async () => false,
    });
    const res = (await revokePaymentLink(makeRevokeCtx() as any)) as any;
    expect(res.status).toBe(404);
  });
});

// ─── Real-PG Integration Tests ───────────────────────────

const PERSON = '00000000-0000-4000-8000-0000000000c1';
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000a2';
const OFFICER = '00000000-0000-4000-8000-0000000000d1';

/**
 * Insert an active, unused, unexpired payment_token and return its id.
 * Mirrors the seedActiveToken in payment-token.repo.test.ts.
 */
async function seedActiveToken(
  db: ScratchDb['db'],
  overrides: Partial<typeof paymentTokens.$inferInsert> = {},
): Promise<string> {
  const [row] = await db
    .insert(paymentTokens)
    .values({
      tokenHash: `hash-${crypto.randomUUID()}`,
      personId: PERSON,
      organizationId: ORG_A,
      amount: 5000,
      currency: 'PHP',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      createdByOfficer: OFFICER,
      ...overrides,
    })
    .returning({ id: paymentTokens.id });
  return row!.id;
}

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(['payment_token']);
});

afterAll(async () => {
  await H?.teardown();
});

describe('[Task 9] revokePaymentLink — real-PG integration', () => {
  test('revokes an unused token (200) and token is then unclaimable', async () => {
    if (!H.dbReachable) return;
    const tokenId = await seedActiveToken(H.db);
    const ctx = makeCtx({
      _params: { organizationId: ORG_A, tokenId },
      database: H.db as any,
    });
    const res = (await revokePaymentLink(ctx as any)) as any;
    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(true);
    // Prove token is truly revoked — claim must return null.
    const claimed = await new PaymentTokenRepository(H.db as any).claimForCheckout(tokenId, 'idem-probe');
    expect(claimed).toBeNull();
  });

  test('404 — token from another org (org scoping)', async () => {
    if (!H.dbReachable) return;
    // Token seeded under ORG_B; officer from ORG_A tries to revoke it.
    const tokenId = await seedActiveToken(H.db, { organizationId: ORG_B });
    const ctx = makeCtx({
      _params: { organizationId: ORG_A, tokenId },
      database: H.db as any,
    });
    const res = (await revokePaymentLink(ctx as any)) as any;
    expect(res.status).toBe(404);
  });

  test('404 — revoking an already-used token (revoke CAS returns false)', async () => {
    if (!H.dbReachable) return;
    const tokenId = await seedActiveToken(H.db);
    // Simulate payment settled: stamp used_at.
    await new PaymentTokenRepository(H.db as any).markUsedCas(tokenId);
    const ctx = makeCtx({
      _params: { organizationId: ORG_A, tokenId },
      database: H.db as any,
    });
    const res = (await revokePaymentLink(ctx as any)) as any;
    expect(res.status).toBe(404);
  });
});
