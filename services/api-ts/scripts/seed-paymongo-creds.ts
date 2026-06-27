#!/usr/bin/env bun
/**
 * seed-paymongo-creds.ts — upsert encrypted PayMongo credentials into
 * dues_gateway_config for a given org. Idempotent: safe to re-run.
 *
 * USE CASE: G2 per-org onboarding. There is no officer UI to enter connected-
 * account PayMongo keys, so the platform founder runs this script once per org
 * after receiving the org's PayMongo secret + webhook secret.
 *
 * ─── Required env vars ────────────────────────────────────────────────────────
 *
 *   ORG_ID                 UUID of the organization row in `organizations`
 *   PAYMONGO_PUBLIC_KEY    pk_live_… or pk_test_…
 *   PAYMONGO_SECRET_KEY    sk_live_… or sk_test_…
 *   PAYMONGO_WEBHOOK_SECRET  whsec_…  (from PayMongo webhook settings)
 *   DATABASE_URL           postgres connection string
 *   AUTH_SECRET            MUST be identical to the value the API was started
 *                          with — it is the encryption key for gateway secrets
 *
 * ─── Run ──────────────────────────────────────────────────────────────────────
 *
 *   export ORG_ID="<uuid>"
 *   export PAYMONGO_PUBLIC_KEY="pk_live_…"
 *   export PAYMONGO_SECRET_KEY="sk_live_…"
 *   export PAYMONGO_WEBHOOK_SECRET="whsec_…"
 *   export DATABASE_URL="postgres://postgres:postgres@localhost:5432/memberry_dev"
 *   export AUTH_SECRET="<same-value-as-api>"
 *   cd services/api-ts && bun scripts/seed-paymongo-creds.ts
 *
 * ─── After running ────────────────────────────────────────────────────────────
 *   Register the webhook URL printed below in the PayMongo dashboard under
 *   the org's connected account → Webhooks → Add Endpoint.
 *   Event types to subscribe: payment.paid  payment.failed
 */

import { createDatabase, closeDatabaseConnection } from '@/core/database';
import { encryptCredential } from '@/core/gateway';
import { duesGatewayConfigs } from '@/handlers/dues/repos/dues-payments.schema';

// ─── Validate env ─────────────────────────────────────────────────────────────

const required = {
  ORG_ID: process.env['ORG_ID'],
  PAYMONGO_PUBLIC_KEY: process.env['PAYMONGO_PUBLIC_KEY'],
  PAYMONGO_SECRET_KEY: process.env['PAYMONGO_SECRET_KEY'],
  PAYMONGO_WEBHOOK_SECRET: process.env['PAYMONGO_WEBHOOK_SECRET'],
  DATABASE_URL: process.env['DATABASE_URL'],
  AUTH_SECRET: process.env['AUTH_SECRET'],
};

const missing = Object.entries(required)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length > 0) {
  console.error('seed-paymongo-creds: missing required env vars:');
  for (const key of missing) {
    console.error(`  - ${key}`);
  }
  process.exit(1);
}

// All required values are non-null from here on (TypeScript needs the cast).
const ORG_ID = required.ORG_ID as string;
const PAYMONGO_PUBLIC_KEY = required.PAYMONGO_PUBLIC_KEY as string;
const PAYMONGO_SECRET_KEY = required.PAYMONGO_SECRET_KEY as string;
const PAYMONGO_WEBHOOK_SECRET = required.PAYMONGO_WEBHOOK_SECRET as string;
const DATABASE_URL = required.DATABASE_URL as string;
const AUTH_SECRET = required.AUTH_SECRET as string;

// ─── Test-key warning ─────────────────────────────────────────────────────────

const isTestMode =
  PAYMONGO_PUBLIC_KEY.startsWith('pk_test_') ||
  PAYMONGO_SECRET_KEY.startsWith('sk_test_');

if (isTestMode) {
  console.warn('');
  console.warn('⚠  WARNING: test-mode keys detected (pk_test_/sk_test_).');
  console.warn('   These keys will NOT collect real money from GCash / bank.');
  console.warn('   Replace with live keys (pk_live_/sk_live_) before going live.');
  console.warn('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const db = createDatabase({ url: DATABASE_URL });

try {
  console.log('seed-paymongo-creds: starting…');
  console.log(`  org id  : ${ORG_ID}`);
  console.log(`  provider: paymongo`);
  console.log(`  mode    : ${isTestMode ? 'TEST' : 'LIVE'}`);

  // Encrypt secrets using the same AUTH_SECRET the API uses.
  // decryptCredential(encryptedSecret, AUTH_SECRET) inside checkout MUST match.
  const encryptedSecret = encryptCredential(PAYMONGO_SECRET_KEY, AUTH_SECRET);
  const encryptedWebhookSecret = encryptCredential(PAYMONGO_WEBHOOK_SECRET, AUTH_SECRET);

  await db
    .insert(duesGatewayConfigs)
    .values({
      organizationId: ORG_ID,
      provider: 'paymongo',
      publicKey: PAYMONGO_PUBLIC_KEY,
      encryptedSecret,
      encryptedWebhookSecret,
      connected: true,
    })
    .onConflictDoUpdate({
      target: duesGatewayConfigs.organizationId,
      set: {
        provider: 'paymongo',
        publicKey: PAYMONGO_PUBLIC_KEY,
        encryptedSecret,
        encryptedWebhookSecret,
        connected: true,
        updatedAt: new Date(),
      },
    });

  console.log('');
  console.log('─'.repeat(64));
  console.log('  ✓ dues_gateway_config upserted (connected=true)');
  console.log('');
  console.log('  Register this webhook URL in the PayMongo dashboard');
  console.log('  (org connected account → Webhooks → Add Endpoint):');
  console.log('');
  console.log(`  https://<your-api-domain>/webhooks/paymongo/${ORG_ID}`);
  console.log('');
  console.log('  Subscribe to events: payment.paid  payment.failed');
  console.log('─'.repeat(64));

  process.exit(0);
} catch (err) {
  console.error('seed-paymongo-creds: FAILED');
  console.error(err);
  process.exit(1);
} finally {
  await closeDatabaseConnection(db);
}
