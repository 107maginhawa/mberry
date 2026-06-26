#!/usr/bin/env bun
/**
 * seed-paylink.ts — mint a real, openable dev pay-link for the slice-2a pay-link page.
 *
 * Idempotent: safe to re-run. Re-runs mint a fresh token each time (new 72h window).
 *
 * ─── Run commands ─────────────────────────────────────────────────────────────
 *
 *  1. Ensure Postgres is running (default: port 5432).
 *     If 5432 is taken by another project, start a parallel container:
 *       docker run --name memberry-seed-pg \
 *         -e POSTGRES_PASSWORD=postgres \
 *         -e POSTGRES_DB=memberry_dev \
 *         -p 5433:5432 -d postgres:16-alpine
 *       export DATABASE_URL="postgres://postgres:postgres@localhost:5433/memberry_dev"
 *       cd services/api-ts && bun scripts/ci-migrate.ts   # apply migrations
 *
 *  2. Export env vars (all three must match what the running API uses):
 *       export DATABASE_URL="postgres://postgres:postgres@localhost:5432/memberry_dev"
 *       export AUTH_SECRET="dev-auth-secret-32-chars-minimum!!"
 *       export PAYMENT_TOKEN_SECRET="dev-payment-token-secret-32chars!!"
 *
 *     CRITICAL: AUTH_SECRET here must be IDENTICAL to the value the API was
 *     started with. checkoutPaymentToken decrypts the gateway secret using
 *     config.auth.secret = env.AUTH_SECRET; a mismatch fails checkout decryption.
 *
 *  3. Seed and print the link:
 *       cd services/api-ts && bun scripts/seed-paylink.ts
 *
 *  4. Verify (requires the API running on :7213):
 *       curl http://localhost:7213/pay/<token>/validate
 *       # Expect: { "valid": true, "amount": 300000, "currency": "PHP", ... }
 *
 *  5. Open the pay-link page (requires apps/member running on :3004):
 *       http://localhost:3004/pay/<token>
 *
 * ─── Gateway keys ─────────────────────────────────────────────────────────────
 *  This script inserts encrypted PLACEHOLDER keys (`sk_test_placeholder`,
 *  `pk_test_placeholder`, `whsec_placeholder`). They satisfy the gateway config
 *  check but will fail actual PayMongo API calls. Replace with real PayMongo
 *  test-mode keys (G2-gated) before testing the checkout flow end-to-end.
 *
 * ─── Cleanup ──────────────────────────────────────────────────────────────────
 *  If you started the parallel Docker container above, clean it up with:
 *    docker stop memberry-seed-pg && docker rm memberry-seed-pg
 */

import { eq, and, ne, sql } from 'drizzle-orm';

import { createDatabase, closeDatabaseConnection } from '@/core/database';
import { encryptCredential } from '@/core/gateway';

import { associations, organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import {
  membershipTiers,
  memberships,
} from '@/handlers/association:member/repos/membership.schema';
import { duesInvoices } from '@/handlers/dues/repos/dues.schema';
import {
  duesOrgConfigs,
  duesGatewayConfigs,
} from '@/handlers/dues/repos/dues-payments.schema';
import { PaymentTokenRepository } from '@/handlers/dues/repos/payment-token.repo';
import {
  generatePaymentToken,
  defaultPaymentTokenExpiry,
  getPaymentTokenSecret,
} from '@/handlers/member/duesspecialassessments/utils/payment-token';

// ─── Config ───────────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:postgres@localhost:5432/memberry_dev';

const AUTH_SECRET = process.env['AUTH_SECRET'];
if (!AUTH_SECRET) {
  console.error('seed-paylink: AUTH_SECRET env var is required');
  process.exit(2);
}

// Amounts in centavos (PHP 3,000 = 300,000 centavos)
const DUES_AMOUNT_CENTAVOS = 300_000;
const CURRENCY = 'PHP';

// Fixed identifiers for idempotency (stable across re-runs)
const ORG_SLUG = 'pda-olive-test';
const PERSON_FIRST_NAME = 'Olive';
const PERSON_LAST_NAME = 'Cruz';
const PERSON_EMAIL = 'olive@test.memberry.ph';
const INVOICE_NUMBER = 'INV-OLIVE-TEST-2026';
const TIER_CODE = 'REGULAR';

// ─── Main ─────────────────────────────────────────────────────────────────────

const db = createDatabase({ url: DATABASE_URL });

try {
  console.log('seed-paylink: starting…');

  // ── 1. Association ───────────────────────────────────────────────────────────
  let [assoc] = await db
    .select()
    .from(associations)
    .where(eq(associations.name, 'Philippine Dental Association'))
    .limit(1);
  if (!assoc) {
    [assoc] = await db
      .insert(associations)
      .values({
        name: 'Philippine Dental Association',
        country: 'PH',
        currency: CURRENCY,
        locale: 'en',
        licenseFormatRegex: '^\\d{4,7}$',
        creditCyclePeriod: 36,
        requiredCreditsPerCycle: 60,
        carryoverEnabled: true,
        status: 'active',
      })
      .returning();
  }
  console.log(`  ✓ Association: ${assoc!.name} (${assoc!.id})`);

  // ── 2. Organization ──────────────────────────────────────────────────────────
  let [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, ORG_SLUG))
    .limit(1);
  if (!org) {
    [org] = await db
      .insert(organizations)
      .values({
        associationId: assoc!.id,
        name: 'Dr. Olive Test Chapter',
        slug: ORG_SLUG,
        orgType: 'chapter',
        region: 'NCR',
        contactEmail: 'olive-chapter@test.memberry.ph',
        status: 'active',
      })
      .returning();
  }
  const orgId = org!.id;
  console.log(`  ✓ Org: ${org!.name} (${orgId})`);

  // ── 3. Person (member) ───────────────────────────────────────────────────────
  // Query by JSONB email field
  let [person] = await db
    .select()
    .from(persons)
    .where(sql`${persons.contactInfo}->>'email' = ${PERSON_EMAIL}`)
    .limit(1);
  if (!person) {
    [person] = await db
      .insert(persons)
      .values({
        firstName: PERSON_FIRST_NAME,
        lastName: PERSON_LAST_NAME,
        contactInfo: { email: PERSON_EMAIL },
      })
      .returning();
  }
  const personId = person!.id;
  console.log(`  ✓ Person: ${person!.firstName} ${person!.lastName} (${personId})`);

  // ── 4. Membership tier ───────────────────────────────────────────────────────
  let [tier] = await db
    .select()
    .from(membershipTiers)
    .where(
      and(
        eq(membershipTiers.organizationId, orgId),
        eq(membershipTiers.code, TIER_CODE),
      ),
    )
    .limit(1);
  if (!tier) {
    [tier] = await db
      .insert(membershipTiers)
      .values({
        organizationId: orgId,
        name: 'Regular',
        code: TIER_CODE,
        annualFee: DUES_AMOUNT_CENTAVOS,
        currency: CURRENCY,
        benefits: ['Voting rights', 'CPD credits'],
        status: 'active',
      })
      .returning();
  }
  const tierId = tier!.id;
  console.log(`  ✓ Tier: ${tier!.name} (${tierId})`);

  // ── 5. Membership ────────────────────────────────────────────────────────────
  let [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, orgId),
        eq(memberships.personId, personId),
      ),
    )
    .limit(1);
  if (!membership) {
    [membership] = await db
      .insert(memberships)
      .values({
        organizationId: orgId,
        personId,
        tierId,
        startDate: new Date().toISOString().split('T')[0]!,
        status: 'active',
        gracePeriodDays: 30,
      })
      .returning();
  }
  const membershipId = membership!.id;
  console.log(`  ✓ Membership: ${membershipId} (status: ${membership!.status})`);

  // ── 6. Dues org config ───────────────────────────────────────────────────────
  await db
    .insert(duesOrgConfigs)
    .values({
      organizationId: orgId,
      defaultAmount: DUES_AMOUNT_CENTAVOS,
      currency: CURRENCY,
      billingFrequency: 'annual',
      dueDateDay: 1,
      gracePeriodDays: 30,
    })
    .onConflictDoUpdate({
      target: duesOrgConfigs.organizationId,
      set: {
        defaultAmount: DUES_AMOUNT_CENTAVOS,
        currency: CURRENCY,
        updatedAt: new Date(),
      },
    });
  console.log(`  ✓ Dues org config: ${DUES_AMOUNT_CENTAVOS} centavos ${CURRENCY}`);

  // ── 7. Dues invoice ──────────────────────────────────────────────────────────
  // duesInvoices uses varchar for personId/organizationId/membershipId (not uuid FK)
  let [invoice] = await db
    .select()
    .from(duesInvoices)
    .where(
      and(
        eq(duesInvoices.invoiceNumber, INVOICE_NUMBER),
        ne(duesInvoices.status, 'cancelled'),
      ),
    )
    .limit(1);
  if (!invoice) {
    const now = new Date();
    const periodStart = `${now.getFullYear()}-01-01`;
    const periodEnd = `${now.getFullYear()}-12-31`;
    [invoice] = await db
      .insert(duesInvoices)
      .values({
        membershipId,
        personId,
        organizationId: orgId,
        invoiceNumber: INVOICE_NUMBER,
        periodStart,
        periodEnd,
        totalAmount: DUES_AMOUNT_CENTAVOS,
        currency: CURRENCY,
        fundAllocations: [],
        status: 'generated',
      })
      .returning();
  }
  const invoiceId = invoice!.id;
  console.log(`  ✓ Invoice: ${invoice!.invoiceNumber} — ${invoice!.totalAmount} centavos (${invoice!.status})`);

  // ── 8. Gateway config (encrypted) ───────────────────────────────────────────
  // AUTH_SECRET already validated non-null above
  const encryptedSecret = encryptCredential('sk_test_placeholder', AUTH_SECRET!);
  const encryptedWebhookSecret = encryptCredential('whsec_placeholder', AUTH_SECRET!);

  await db
    .insert(duesGatewayConfigs)
    .values({
      organizationId: orgId,
      provider: 'paymongo',
      publicKey: 'pk_test_placeholder',
      encryptedSecret,
      encryptedWebhookSecret,
      connected: true,
    })
    .onConflictDoUpdate({
      target: duesGatewayConfigs.organizationId,
      set: {
        encryptedSecret,
        encryptedWebhookSecret,
        publicKey: 'pk_test_placeholder',
        connected: true,
        updatedAt: new Date(),
      },
    });
  console.log('  ✓ Gateway config: paymongo placeholder keys (encrypted with AUTH_SECRET)');

  // ── 9. Mint payment token (fresh each run) ───────────────────────────────────
  // Uses the WIRED slice-1 token system: HMAC-SHA256 via PAYMENT_TOKEN_SECRET
  // (falls back to INVITE_TOKEN_SECRET). validatePaymentToken resolves ONLY
  // payment_token rows keyed by hashPaymentToken(raw, getPaymentTokenSecret()).
  // Do NOT use generatePaymentLink (legacy, keyed on PAYMENT_LINK_SECRET, dead path).
  const secret = getPaymentTokenSecret();
  const { raw, hash } = generatePaymentToken(secret);
  const expiresAt = defaultPaymentTokenExpiry();

  const tokenRepo = new PaymentTokenRepository(db);
  await tokenRepo.create({
    tokenHash: hash,
    personId,
    organizationId: orgId,
    invoiceId,
    amount: DUES_AMOUNT_CENTAVOS,
    currency: CURRENCY,
    expiresAt,
    createdByOfficer: personId, // dev only: person acts as their own officer
  });

  console.log('  ✓ Payment token minted (72h TTL)');
  console.log('');
  console.log('─'.repeat(64));
  console.log('  Pay-link URL:');
  console.log(`  http://localhost:3004/pay/${raw}`);
  console.log('');
  console.log('  Validate (API must be running on :7213):');
  console.log(`  curl http://localhost:7213/pay/${raw}/validate`);
  console.log('─'.repeat(64));
} finally {
  await closeDatabaseConnection(db);
}
