// Business Rules: [BR-30]
/**
 * Real-DB integration tests for the billing credential repositories:
 *   - MerchantAccountRepository (merchant_account)
 *   - BillingConfigRepository   (billing_config — per-org gateway credentials, BR-30)
 *
 * The existing mock suites (billing.repo.test.ts, billing-config.repo.test.ts)
 * only inspect the Drizzle `where` tree these repos build — no query ever runs
 * against Postgres, so they CANNOT prove:
 *   - the DB-level UNIQUE constraints actually fire
 *       (`merchant_accounts_person_unique` → one merchant account per person;
 *        `billing_configs_org_provider_mode_unique` → one config per
 *        org+provider+mode). A regression dropping either constraint passes the
 *        mock suite but silently allows duplicate/cross-tenant credential rows.
 *   - the JSONB `metadata->>'stripeAccountId'` predicate in findByStripeAccountId
 *     resolves real rows.
 *   - the AES-256-GCM credential round-trip: a secret encrypted via
 *     core/gateway.encryptCredential is STORED as ciphertext (≠ plaintext),
 *     reads back byte-identical, and decrypts to the original — i.e. plaintext
 *     credentials never touch the column.
 *
 * This suite drives the real query builders + the real encryption helpers
 * against REAL rows in an isolated scratch schema and asserts the REAL persisted
 * data (returned rows, JSONB lookups, decrypted plaintext, 23505 violations
 * actually raising) — never "did not throw".
 *
 * Isolation: the shared `createScratch` harness copies the real public table
 * structures via `CREATE TABLE … (LIKE public.<t> INCLUDING ALL)` so every real
 * column/default/CHECK/UNIQUE/enum is present (UNIQUE indexes ARE copied by
 * INCLUDING ALL — that is what lets us prove 23505). FKs are NOT copied, so rows
 * insert without parent org/person rows. The encryptCredential helper takes its
 * secret as a direct argument (no env var needed) — we pass a fixed literal,
 * mirroring core/gateway.test.ts.
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { MerchantAccountRepository, BillingConfigRepository } from './billing.repo';
import { encryptCredential, decryptCredential } from '@/core/gateway';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;

// Fixed encryption secret for the AES-256-GCM round-trip. encryptCredential
// derives a sha256 key from this, so any non-empty string works; we pin one so
// the round-trip is deterministic and a wrong-secret decrypt provably throws.
const ENCRYPTION_SECRET = 'integration-test-encryption-secret-32!';

// uuid NOT NULL columns need real UUIDs (no FK rows required — LIKE drops FKs).
const ORG_A = '00000000-0000-4000-8000-00000000a001';
const ORG_B = '00000000-0000-4000-8000-00000000b001';

function freshId(): string {
  return crypto.randomUUID();
}

// ─── raw seeders ──────────────────────────────────────────────────────────
// Raw SQL (rather than the repo write path) lets us seed arbitrary
// metadata/active/provider/testMode combinations directly. We set every real
// NOT-NULL column without a default and rely on column defaults (id,
// timestamps, version, active, provider, test_mode) for the rest. The
// `provider` bound param needs an explicit ::gateway_provider cast (bound
// enum params don't auto-cast the way literals do).

async function insertMerchantAccount(opts: {
  id?: string;
  organizationId?: string;
  person?: string;
  active?: boolean;
  metadata?: Record<string, unknown>;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".merchant_account
       (id, organization_id, person, active, metadata)
     VALUES ($1,$2,$3,COALESCE($4, true),$5::jsonb)`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.person ?? freshId(),
      opts.active ?? null,
      JSON.stringify(opts.metadata ?? {}),
    ],
  );
  return id;
}

async function insertBillingConfig(opts: {
  id?: string;
  organizationId?: string;
  provider?: 'stripe' | 'paymongo';
  encryptedSecretKey?: string;
  encryptedWebhookSecret?: string | null;
  testMode?: boolean;
  apiUrl?: string | null;
  active?: boolean;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".billing_config
       (id, organization_id, provider, encrypted_secret_key, encrypted_webhook_secret,
        test_mode, api_url, active)
     VALUES ($1,$2,COALESCE($3::gateway_provider,'stripe'),$4,$5,
             COALESCE($6, true),$7,COALESCE($8, true))`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.provider ?? null,
      opts.encryptedSecretKey ?? 'enc_placeholder',
      opts.encryptedWebhookSecret ?? null,
      opts.testMode ?? null,
      opts.apiUrl ?? null,
      opts.active ?? null,
    ],
  );
  return id;
}

beforeAll(async () => {
  H = await createScratch(['merchant_account', 'billing_config']);
});

afterAll(async () => {
  await H?.teardown();
});

// ═══════════════════════════════════════════════════════════════════════════
// MerchantAccountRepository — one-account-per-person UNIQUE + reads
// ═══════════════════════════════════════════════════════════════════════════

describe('MerchantAccountRepository UNIQUE(person) constraint (real DB)', () => {
  test('one-account-per-person: a duplicate person insert raises 23505', async () => {
    if (!H.dbReachable) return;
    const repo = new MerchantAccountRepository(H.db as any, noopLogger);
    const person = freshId();

    // First account for this person succeeds.
    const first = await repo.createOne({
      organizationId: ORG_A,
      person,
      active: true,
      metadata: { stripeAccountId: 'acct_first' },
    } as any);
    expect(first.person).toBe(person);

    // Second account for the SAME person must violate the unique constraint.
    let code: string | undefined;
    try {
      await repo.createOne({
        organizationId: ORG_A,
        person,
        active: true,
        metadata: { stripeAccountId: 'acct_second' },
      } as any);
      throw new Error('expected unique-violation, but insert succeeded');
    } catch (err: any) {
      // pg surfaces the raw driver error code (drizzle does not wrap it).
      code = err?.code ?? err?.cause?.code;
    }
    expect(code).toBe('23505');

    // Prove the duplicate did NOT land: exactly one row remains for the person.
    const { rows } = await H.scopedPool.query(
      `SELECT COUNT(*)::int AS n FROM "${H.schema}".merchant_account WHERE person = $1`,
      [person],
    );
    expect(rows[0].n).toBe(1);
  });

  test('the constraint is person-global, NOT org-scoped (same person, different org still collides)', async () => {
    if (!H.dbReachable) return;
    // merchant_accounts_person_unique is on (person) alone — so the same person
    // cannot hold a merchant account under two different orgs. This pins that
    // intentional shape; if someone widens it to (org, person) this test fails
    // loudly so the decision is deliberate.
    const person = freshId();
    await insertMerchantAccount({ organizationId: ORG_A, person });

    let code: string | undefined;
    try {
      await insertMerchantAccount({ organizationId: ORG_B, person });
    } catch (err: any) {
      code = err?.code ?? err?.cause?.code;
    }
    expect(code).toBe('23505');
  });

  test('different persons each get their own account (no false collision)', async () => {
    if (!H.dbReachable) return;
    const repo = new MerchantAccountRepository(H.db as any, noopLogger);
    const p1 = await repo.createOne({
      organizationId: ORG_A, person: freshId(), active: true, metadata: {},
    } as any);
    const p2 = await repo.createOne({
      organizationId: ORG_A, person: freshId(), active: true, metadata: {},
    } as any);
    expect(p1.id).not.toBe(p2.id);
  });
});

describe('MerchantAccountRepository reads (real DB)', () => {
  test('findByPerson returns the persisted row for the matching person, null otherwise', async () => {
    if (!H.dbReachable) return;
    const repo = new MerchantAccountRepository(H.db as any, noopLogger);
    const person = freshId();
    const id = await insertMerchantAccount({
      organizationId: ORG_A, person, metadata: { onboardingComplete: true },
    });

    const found = await repo.findByPerson(person);
    expect(found?.id).toBe(id);
    expect(found?.person).toBe(person);
    expect((found?.metadata as any)?.onboardingComplete).toBe(true);

    const miss = await repo.findByPerson(freshId());
    expect(miss).toBeNull();
  });

  test('findByStripeAccountId resolves via the metadata JSONB ->> predicate', async () => {
    if (!H.dbReachable) return;
    const repo = new MerchantAccountRepository(H.db as any, noopLogger);
    const wantedAcct = `acct_${freshId().slice(0, 8)}`;
    const wanted = await insertMerchantAccount({
      organizationId: ORG_A, metadata: { stripeAccountId: wantedAcct, onboardingComplete: false },
    });
    // Decoy row with a different stripeAccountId — must not be returned.
    await insertMerchantAccount({
      organizationId: ORG_A, metadata: { stripeAccountId: 'acct_decoy' },
    });

    const found = await repo.findByStripeAccountId(wantedAcct);
    expect(found?.id).toBe(wanted);
    expect((found?.metadata as any)?.stripeAccountId).toBe(wantedAcct);

    const miss = await repo.findByStripeAccountId('acct_does_not_exist');
    expect(miss).toBeNull();
  });

  test('updateMetadata persists the new JSONB and bumps version, read back from PG', async () => {
    if (!H.dbReachable) return;
    const repo = new MerchantAccountRepository(H.db as any, noopLogger);
    const id = await insertMerchantAccount({
      organizationId: ORG_A, metadata: { stripeAccountStatus: 'pending', onboardingComplete: false },
    });

    const editor = freshId();
    const updated = await repo.updateMetadata(
      id,
      { stripeAccountStatus: 'active', onboardingComplete: true, stripeAccountId: 'acct_live' },
      editor,
    );
    expect((updated.metadata as any).stripeAccountStatus).toBe('active');
    expect(updated.version).toBe(2); // baseEntityFields default 1 → +1
    expect(updated.updatedBy).toBe(editor);

    // Read straight from Postgres to confirm the column actually holds the new JSON.
    const { rows } = await H.scopedPool.query(
      `SELECT metadata, version FROM "${H.schema}".merchant_account WHERE id = $1`,
      [id],
    );
    expect(rows[0].metadata.onboardingComplete).toBe(true);
    expect(rows[0].metadata.stripeAccountId).toBe('acct_live');
    expect(rows[0].version).toBe(2);
  });

  test('findMany org filter isolates accounts from another org (tenant guard)', async () => {
    if (!H.dbReachable) return;
    const repo = new MerchantAccountRepository(H.db as any, noopLogger);
    const orgX = freshId();
    const orgY = freshId();
    const mine = await insertMerchantAccount({ organizationId: orgX });
    await insertMerchantAccount({ organizationId: orgY });

    const rows = await repo.findMany({ organizationId: orgX });
    expect(rows.map((r) => r.id)).toEqual([mine]);
    expect(rows.every((r) => r.organizationId === orgX)).toBe(true);
  });

  test('active=false filter is honoured (explicit-false guard, not skipped)', async () => {
    if (!H.dbReachable) return;
    const repo = new MerchantAccountRepository(H.db as any, noopLogger);
    const org = freshId();
    const live = await insertMerchantAccount({ organizationId: org, active: true });
    const disabled = await insertMerchantAccount({ organizationId: org, active: false });

    const inactive = await repo.findMany({ organizationId: org, active: false });
    expect(inactive.map((r) => r.id)).toEqual([disabled]);

    const enabled = await repo.findMany({ organizationId: org, active: true });
    expect(enabled.map((r) => r.id)).toEqual([live]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BillingConfigRepository — one-active-config-per-org/provider/mode UNIQUE
// ═══════════════════════════════════════════════════════════════════════════

describe('BillingConfigRepository UNIQUE(org, provider, test_mode) constraint (real DB)', () => {
  test('duplicate org+provider+mode raises 23505', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    await insertBillingConfig({ organizationId: org, provider: 'stripe', testMode: true });

    let code: string | undefined;
    try {
      await insertBillingConfig({ organizationId: org, provider: 'stripe', testMode: true });
    } catch (err: any) {
      code = err?.code ?? err?.cause?.code;
    }
    expect(code).toBe('23505');

    // Only one row for that (org, provider, mode) tuple survived.
    const { rows } = await H.scopedPool.query(
      `SELECT COUNT(*)::int AS n FROM "${H.schema}".billing_config
         WHERE organization_id = $1 AND provider = 'stripe' AND test_mode = true`,
      [org],
    );
    expect(rows[0].n).toBe(1);
  });

  test('the SAME org may hold distinct test-mode and live-mode configs (mode is part of the key)', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const testCfg = await insertBillingConfig({ organizationId: org, provider: 'stripe', testMode: true });
    // Flipping test_mode → false changes the unique tuple, so this must succeed.
    const liveCfg = await insertBillingConfig({ organizationId: org, provider: 'stripe', testMode: false });
    expect(testCfg).not.toBe(liveCfg);

    const { rows } = await H.scopedPool.query(
      `SELECT COUNT(*)::int AS n FROM "${H.schema}".billing_config WHERE organization_id = $1`,
      [org],
    );
    expect(rows[0].n).toBe(2);
  });

  test('the SAME org may hold distinct stripe and paymongo configs in the same mode (provider is part of the key)', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    await insertBillingConfig({ organizationId: org, provider: 'stripe', testMode: true });
    // Different provider, same org+mode → different tuple → succeeds.
    await insertBillingConfig({ organizationId: org, provider: 'paymongo', testMode: true });

    const { rows } = await H.scopedPool.query(
      `SELECT provider FROM "${H.schema}".billing_config WHERE organization_id = $1 ORDER BY provider`,
      [org],
    );
    expect(rows.map((r: any) => r.provider)).toEqual(['paymongo', 'stripe']);
  });

  test('two different orgs may each hold a stripe/test config (org is part of the key)', async () => {
    if (!H.dbReachable) return;
    const orgX = freshId();
    const orgY = freshId();
    // Same provider + mode but different orgs — must NOT collide.
    await insertBillingConfig({ organizationId: orgX, provider: 'stripe', testMode: true });
    await insertBillingConfig({ organizationId: orgY, provider: 'stripe', testMode: true });
    // (no throw above is the assertion; confirm both rows exist)
    const { rows } = await H.scopedPool.query(
      `SELECT COUNT(*)::int AS n FROM "${H.schema}".billing_config
         WHERE organization_id = ANY($1::uuid[]) AND provider = 'stripe' AND test_mode = true`,
      [[orgX, orgY]],
    );
    expect(rows[0].n).toBe(2);
  });
});

describe('BillingConfigRepository config read/write (real DB)', () => {
  test('findActiveConfig matches the org+provider+mode tuple and ignores others', async () => {
    if (!H.dbReachable) return;
    const repo = new BillingConfigRepository(H.db as any, noopLogger);
    const org = freshId();
    const stripeTest = await insertBillingConfig({ organizationId: org, provider: 'stripe', testMode: true });
    const stripeLive = await insertBillingConfig({ organizationId: org, provider: 'stripe', testMode: false });
    const paymongoTest = await insertBillingConfig({ organizationId: org, provider: 'paymongo', testMode: true });

    expect((await repo.findActiveConfig(org, 'stripe', true))?.id).toBe(stripeTest);
    expect((await repo.findActiveConfig(org, 'stripe', false))?.id).toBe(stripeLive);
    expect((await repo.findActiveConfig(org, 'paymongo', true))?.id).toBe(paymongoTest);
    // No paymongo live config exists for this org → null.
    expect(await repo.findActiveConfig(org, 'paymongo', false)).toBeNull();
  });

  test('findActiveConfig excludes inactive configs (active flag filter)', async () => {
    if (!H.dbReachable) return;
    const repo = new BillingConfigRepository(H.db as any, noopLogger);
    const org = freshId();
    // Only an INACTIVE stripe/test config exists — findActiveConfig must skip it.
    await insertBillingConfig({ organizationId: org, provider: 'stripe', testMode: true, active: false });
    expect(await repo.findActiveConfig(org, 'stripe', true)).toBeNull();
  });

  test('findActiveConfig never crosses org boundaries (BR-30 isolation)', async () => {
    if (!H.dbReachable) return;
    const repo = new BillingConfigRepository(H.db as any, noopLogger);
    const orgX = freshId();
    const orgY = freshId();
    await insertBillingConfig({ organizationId: orgX, provider: 'stripe', testMode: true });

    // Querying orgY must NOT return orgX's config even though provider+mode match.
    expect(await repo.findActiveConfig(orgY, 'stripe', true)).toBeNull();
  });

  test('createOne round-trips provider/testMode/apiUrl/active and reads back through findOneById', async () => {
    if (!H.dbReachable) return;
    const repo = new BillingConfigRepository(H.db as any, noopLogger);
    const org = freshId();
    const created = await repo.createOne({
      organizationId: org,
      provider: 'paymongo',
      encryptedSecretKey: 'enc_sk',
      encryptedWebhookSecret: 'enc_wh',
      testMode: false,
      apiUrl: 'https://api.example.test',
      active: true,
    } as any);

    const reread = await repo.findOneById(created.id);
    expect(reread?.provider).toBe('paymongo');
    expect(reread?.testMode).toBe(false);
    expect(reread?.apiUrl).toBe('https://api.example.test');
    expect(reread?.active).toBe(true);
    expect(reread?.encryptedWebhookSecret).toBe('enc_wh');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AES-256-GCM credential encryption round-trip (BR-30)
//   encrypt → STORE in billing_config → read back → decrypt → assert plaintext,
//   and prove the stored column is ciphertext, never the plaintext secret.
// ═══════════════════════════════════════════════════════════════════════════

describe('BillingConfig credential encryption round-trip (real DB, BR-30)', () => {
  test('stored encrypted_secret_key is ciphertext that decrypts back to the original plaintext', async () => {
    if (!H.dbReachable) return;
    const repo = new BillingConfigRepository(H.db as any, noopLogger);
    const org = freshId();
    const plaintextSecret = 'sk_live_superSecretKey_9f8e7d6c!@#';
    const plaintextWebhook = 'whsec_topSecretWebhook_abcdef123';

    // 1) Encrypt with the real AES-256-GCM helper.
    const encSecret = encryptCredential(plaintextSecret, ENCRYPTION_SECRET);
    const encWebhook = encryptCredential(plaintextWebhook, ENCRYPTION_SECRET);
    // Ciphertext must already differ from plaintext before it ever hits the DB.
    expect(encSecret).not.toBe(plaintextSecret);
    expect(encWebhook).not.toBe(plaintextWebhook);

    // 2) Store via the repo.
    const created = await repo.createOne({
      organizationId: org,
      provider: 'stripe',
      encryptedSecretKey: encSecret,
      encryptedWebhookSecret: encWebhook,
      testMode: true,
      active: true,
    } as any);

    // 3) Read the raw column straight from Postgres (no repo in the loop).
    const { rows } = await H.scopedPool.query(
      `SELECT encrypted_secret_key, encrypted_webhook_secret
         FROM "${H.schema}".billing_config WHERE id = $1`,
      [created.id],
    );
    const storedSecret: string = rows[0].encrypted_secret_key;
    const storedWebhook: string = rows[0].encrypted_webhook_secret;

    // The stored bytes are the ciphertext, NOT the plaintext (leakage guard).
    expect(storedSecret).toBe(encSecret);
    expect(storedSecret).not.toBe(plaintextSecret);
    expect(storedSecret).not.toContain('sk_live_');
    expect(storedWebhook).not.toContain('whsec_');

    // 4) Decrypt what came back out of the column → original plaintext.
    expect(decryptCredential(storedSecret, ENCRYPTION_SECRET)).toBe(plaintextSecret);
    expect(decryptCredential(storedWebhook, ENCRYPTION_SECRET)).toBe(plaintextWebhook);
  });

  test('round-trip survives findActiveConfig → decrypt (the real read path used by the gateway)', async () => {
    if (!H.dbReachable) return;
    const repo = new BillingConfigRepository(H.db as any, noopLogger);
    const org = freshId();
    const plaintext = 'sk_test_roundTripViaActiveConfig_42';
    await insertBillingConfig({
      organizationId: org,
      provider: 'stripe',
      testMode: true,
      active: true,
      encryptedSecretKey: encryptCredential(plaintext, ENCRYPTION_SECRET),
    });

    const cfg = await repo.findActiveConfig(org, 'stripe', true);
    expect(cfg).not.toBeNull();
    // The gateway decrypts cfg.encryptedSecretKey before use — prove that works.
    expect(decryptCredential(cfg!.encryptedSecretKey, ENCRYPTION_SECRET)).toBe(plaintext);
  });

  test('a wrong encryption secret cannot decrypt the stored ciphertext (tamper/auth-tag guard)', async () => {
    if (!H.dbReachable) return;
    const repo = new BillingConfigRepository(H.db as any, noopLogger);
    const org = freshId();
    const plaintext = 'sk_live_only_the_right_secret_unlocks';
    const created = await repo.createOne({
      organizationId: org,
      provider: 'stripe',
      encryptedSecretKey: encryptCredential(plaintext, ENCRYPTION_SECRET),
      testMode: false,
      active: true,
    } as any);

    const reread = await repo.findOneById(created.id);
    // Right secret unlocks; wrong secret fails the GCM auth tag.
    expect(decryptCredential(reread!.encryptedSecretKey, ENCRYPTION_SECRET)).toBe(plaintext);
    expect(() => decryptCredential(reread!.encryptedSecretKey, 'a-different-wrong-secret-32-chars!')).toThrow();
  });
});
