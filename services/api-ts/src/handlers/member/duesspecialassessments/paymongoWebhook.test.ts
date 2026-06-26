/**
 * paymongoWebhook unit tests — pre-transaction rejection branches only.
 *
 * The full settle / idempotency / tamper behaviour is covered by
 * paymongoWebhook.integration.test.ts (real-PG). This file covers only the
 * two pre-tx guard branches that reject without touching the database:
 *   1. No gateway configured  → 400 { error: 'Payment gateway not configured' }
 *   2. Bad webhook signature  → 400 { error: 'Invalid webhook signature' }
 *
 * new-code-gate sibling required by CI for every handler file.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DuesRepository } from '@/handlers/dues/repos/dues-payments.repo';
import { encryptCredential } from '@/core/gateway';
import { paymongoWebhook } from './paymongoWebhook';

// ─── Fixtures ───────────────────────────────────────────

const AUTH_SECRET = 'unit-auth-secret-webhook';
const ORG_ID = 'org-webhook-unit-1';

/**
 * A gateway config whose webhook secret decrypts under AUTH_SECRET.
 * resolveWebhookAdapter will build a real PayMongoAdapter from this.
 */
const gatewayConfigWithWebhookSecret = {
  id: 'gw-wh-1',
  organizationId: ORG_ID,
  provider: 'paymongo',
  connected: true,
  publicKey: 'pk_test_unit',
  encryptedSecret: encryptCredential('sk_test_unit', AUTH_SECRET),
  encryptedWebhookSecret: encryptCredential('whsec_unit_test', AUTH_SECRET),
};

/**
 * Build a minimal handler context for the webhook endpoint.
 *
 * makeCtx's req.header() always returns null and has no text() method —
 * both are needed by paymongoWebhook. We spread base.req and override them.
 */
function ctxForWebhook(opts: {
  orgId?: string;
  rawBody?: string;
  signature?: string | null;
}) {
  const orgId = opts.orgId ?? ORG_ID;
  const rawBody = opts.rawBody ?? '';
  const signatureHeader = opts.signature !== undefined ? opts.signature : null;

  const base = makeCtx({
    user: null,
    session: null,
    config: { auth: { secret: AUTH_SECRET } },
    logger: { warn: () => {}, info: () => {}, error: () => {}, debug: () => {} },
  });

  return {
    ...base,
    req: {
      ...base.req,
      param: (key: string) => (key === 'organizationId' ? orgId : ''),
      text: () => Promise.resolve(rawBody),
      header: (name: string) => (name === 'paymongo-signature' ? signatureHeader : null),
    },
  } as any;
}

// ─── Tests ──────────────────────────────────────────────

describe('[VS-W0B-008] paymongoWebhook — pre-tx rejection branches', () => {
  beforeEach(() => {
    restoreRepo(DuesRepository);
  });

  afterEach(() => {
    restoreRepo(DuesRepository);
  });

  // ── Branch 1: no gateway configured → 400 ───────────

  test('returns 400 when org has no gateway config row', async () => {
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => undefined,
    });

    const res = (await paymongoWebhook(ctxForWebhook({}))) as any;
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Payment gateway not configured');
  });

  test('returns 400 when org gateway config has no webhook secret', async () => {
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => ({
        ...gatewayConfigWithWebhookSecret,
        encryptedWebhookSecret: null,
      }),
    });

    const res = (await paymongoWebhook(ctxForWebhook({}))) as any;
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Payment gateway not configured');
  });

  // ── Branch 2: bad signature → 400 ───────────────────
  // resolveWebhookAdapter builds a real PayMongoAdapter; verifyWebhook does a
  // real HMAC check — no stub needed on the adapter itself.

  test('returns 400 when paymongo-signature header is absent', async () => {
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => gatewayConfigWithWebhookSecret,
    });

    // null header → signature falls back to '' → verifyWebhook returns null
    const res = (await paymongoWebhook(ctxForWebhook({ rawBody: '{}' }))) as any;
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid webhook signature');
  });

  test('returns 400 for a malformed paymongo-signature header', async () => {
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => gatewayConfigWithWebhookSecret,
    });

    const res = (await paymongoWebhook(ctxForWebhook({
      rawBody: '{"data":{"id":"evt-bogus"}}',
      signature: 'not-a-valid-paymongo-sig',
    }))) as any;
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid webhook signature');
  });

  test('returns 400 for a structurally-valid but wrong HMAC signature', async () => {
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => gatewayConfigWithWebhookSecret,
    });

    // Correct format (t=...,te=<64-hex>) but computed with wrong secret → HMAC fails
    const fakeTimestamp = Math.floor(Date.now() / 1000).toString();
    const wrongSig = 'a'.repeat(64); // 64 hex chars, wrong value
    const signature = `t=${fakeTimestamp},te=${wrongSig}`;

    const res = (await paymongoWebhook(ctxForWebhook({
      rawBody: '{"data":{"id":"evt-tampered"}}',
      signature,
    }))) as any;
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid webhook signature');
  });
});
