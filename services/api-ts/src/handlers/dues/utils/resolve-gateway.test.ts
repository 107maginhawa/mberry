/**
 * Real-PG integration suite for resolveCheckoutAdapter / resolveWebhookAdapter.
 *
 * Proves the org-specific decrypted secret is used — not a platform key — by
 * stubbing globalThis.fetch and asserting the Authorization header contains
 * btoa(ORG_SECRET + ':') after calling adapter.createCheckout().
 *
 * Guards `if (!H.dbReachable) return` and tears down in afterAll. Runs in the
 * DB-backed ci-migrate lane (set DATABASE_URL to port 5433 locally).
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { duesGatewayConfigs } from '@/handlers/dues/repos/dues-payments.schema';
import { encryptCredential } from '@/core/gateway';
import { resolveCheckoutAdapter, resolveWebhookAdapter, GatewayNotConfiguredError } from './resolve-gateway';

// Fixed test org — FK not enforced in scratch (LIKE omits FK constraints)
const ORG_ID = '00000000-0000-4000-8000-000000000a01';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000a02';

// Use the dev AUTH_SECRET (present in local .env and CI)
const ENC_KEY = process.env['AUTH_SECRET'] ?? 'memberry-dev-secret-at-least-32-characters-long';
const ORG_SECRET = 'sk_test_ORGSECRET';
const ORG_WEBHOOK = 'whsec_org_test';

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(['dues_gateway_config']);
});

afterAll(async () => {
  await H?.teardown();
});

describe('resolveCheckoutAdapter', () => {
  it('builds a PayMongo adapter using the org-specific decrypted secret', async () => {
    if (!H.dbReachable) return;

    await (H.db as any).insert(duesGatewayConfigs).values({
      organizationId: ORG_ID,
      provider: 'paymongo',
      publicKey: 'pk_test_x',
      encryptedSecret: encryptCredential(ORG_SECRET, ENC_KEY),
      encryptedWebhookSecret: encryptCredential(ORG_WEBHOOK, ENC_KEY),
      connected: true,
    });

    const adapter = await resolveCheckoutAdapter(H.db as any, ORG_ID, ENC_KEY);
    expect(adapter.name).toBe('paymongo');

    // Prove org secret (not a platform key) was used:
    // stub fetch, call createCheckout, assert Authorization header = Basic btoa(ORG_SECRET + ':')
    const capturedHeaders: Record<string, string>[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url: string | URL | Request, opts?: RequestInit): Promise<Response> => {
      capturedHeaders.push((opts?.headers ?? {}) as Record<string, string>);
      return new Response(
        JSON.stringify({
          data: { id: 'cs_test_1', attributes: { checkout_url: 'https://checkout.paymongo.com/test' } },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      await adapter.createCheckout({
        amount: 50000,
        currency: 'PHP',
        description: 'Dues 2025',
        email: 'member@example.com',
        metadata: { duesInvoiceId: 'inv_1' },
        successUrl: 'https://example.com/ok',
        cancelUrl: 'https://example.com/cancel',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(capturedHeaders.length).toBeGreaterThan(0);
    const authHeader = capturedHeaders[0]?.['Authorization'] ?? '';
    const expectedAuth = `Basic ${btoa(ORG_SECRET + ':')}`;
    expect(authHeader).toBe(expectedAuth);
  });

  it('throws GatewayNotConfiguredError when org has no gateway config', async () => {
    if (!H.dbReachable) return;
    await expect(
      resolveCheckoutAdapter(H.db as any, OTHER_ORG_ID, ENC_KEY)
    ).rejects.toThrow(/not configured/i);
  });

  it('throws GatewayNotConfiguredError when org config is not connected', async () => {
    if (!H.dbReachable) return;
    const disconnectedOrg = '00000000-0000-4000-8000-000000000a03';
    await (H.db as any).insert(duesGatewayConfigs).values({
      organizationId: disconnectedOrg,
      provider: 'paymongo',
      publicKey: 'pk_test_y',
      encryptedSecret: encryptCredential('sk_test_OTHER', ENC_KEY),
      connected: false,
    });
    await expect(
      resolveCheckoutAdapter(H.db as any, disconnectedOrg, ENC_KEY)
    ).rejects.toThrow(/not configured/i);
  });
});

describe('resolveWebhookAdapter', () => {
  it('returns null when org has no gateway config', async () => {
    if (!H.dbReachable) return;
    const missingOrg = '00000000-0000-4000-8000-000000000a04';
    const adapter = await resolveWebhookAdapter(H.db as any, missingOrg, ENC_KEY);
    expect(adapter).toBeNull();
  });

  it('returns null when org config has no encryptedWebhookSecret', async () => {
    if (!H.dbReachable) return;
    const noWebhookOrg = '00000000-0000-4000-8000-000000000a05';
    await (H.db as any).insert(duesGatewayConfigs).values({
      organizationId: noWebhookOrg,
      provider: 'paymongo',
      publicKey: 'pk_test_z',
      encryptedSecret: encryptCredential('sk_test_NW', ENC_KEY),
      connected: true,
    });
    const adapter = await resolveWebhookAdapter(H.db as any, noWebhookOrg, ENC_KEY);
    expect(adapter).toBeNull();
  });
});
