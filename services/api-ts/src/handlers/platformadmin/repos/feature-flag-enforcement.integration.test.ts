/**
 * Real-PG integration test for `featureFlagRepoPort.findEnforcementFlags`.
 *
 * This is the headline platformadmin gap (B4 / DoD #1/#2): the 3-table
 * resolution join (organization → association, subscription → pricing_tier →
 * slug, then the final feature_flag fan-out) was deliberately SKIPPED in the
 * hand-DDL `platformadmin-repos.integration.test.ts` (its author omitted the
 * `subscription` + `pricing_tier` tables) and is otherwise proven NOWHERE — the
 * gate test (`src/middleware/feature-flag-gate.test.ts`) stubs the port with
 * canned rows, so the join SQL itself ran against no real Postgres ever.
 *
 * Here we use `createScratch(['organization','feature_flag','subscription',
 * 'pricing_tier'])` so each table arrives with its real NOT-NULL columns and
 * unique constraints (via `LIKE ... INCLUDING ALL`) — including the NOT-NULL
 * `created_by`/`updated_by` on subscription/pricing_tier that defeated the
 * hand-DDL approach. We then drive the REAL drizzle query builders through
 * `featureFlagRepoPort(...)` and assert the resolved row set, module scoping,
 * shape mapping, and the best-effort fail-open narrowing — all against real
 * persisted rows, never a stubbed set.
 *
 * Source facts (verified, not trusted from brief):
 *   - findEnforcementFlags pushes the tier SLUG (not UUID) into target_id.
 *   - tier resolution is wrapped in try/catch: a missing subscription simply
 *     narrows the candidate set, never throws.
 *   - orgId is always a candidate (line 273), so even an org whose
 *     association/subscription don't resolve still returns its org-level flag.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { featureFlagRepoPort } from './platform-admin.repo';
import { resolveFlagDecision } from '@/middleware/feature-flag-gate';

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(['organization', 'feature_flag', 'subscription', 'pricing_tier']);
});

afterAll(async () => {
  await H?.teardown();
});

function uuid(): string {
  return crypto.randomUUID();
}

async function seedOrg(opts: { id: string; associationId: string; slug: string }): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".organization
       (id, association_id, name, slug, org_type, status, created_at, updated_at, version)
     VALUES ($1, $2, $3, $4, 'chapter', 'active', now(), now(), 1)`,
    [opts.id, opts.associationId, `Org ${opts.slug}`, opts.slug],
  );
}

async function seedPricingTier(opts: { id: string; slug: string }): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".pricing_tier
       (id, name, slug, monthly_price, annual_price, currency, trial_days, is_active, sort_order,
        created_at, updated_at, created_by, updated_by)
     VALUES ($1, $2, $3, 0, 0, 'PHP', 30, true, 0, now(), now(), $4, $4)`,
    [opts.id, `Tier ${opts.slug}`, opts.slug, uuid()],
  );
}

async function seedSubscription(opts: { organizationId: string; pricingTierId: string }): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".subscription
       (id, organization_id, pricing_tier_id, status, billing_cycle,
        created_at, updated_at, created_by, updated_by)
     VALUES ($1, $2, $3, 'active', 'monthly', now(), now(), $4, $4)`,
    [uuid(), opts.organizationId, opts.pricingTierId, uuid()],
  );
}

async function seedFlag(opts: {
  targetType: string;
  targetId: string;
  moduleName: string;
  enabled: boolean;
  isOverride?: boolean;
}): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".feature_flag
       (id, target_type, target_id, module_name, enabled, is_override, created_at, updated_at, version)
     VALUES ($1, $2, $3, $4, $5, $6, now(), now(), 1)`,
    [uuid(), opts.targetType, opts.targetId, opts.moduleName, opts.enabled, opts.isOverride ?? false],
  );
}

describe('featureFlagRepoPort.findEnforcementFlags (real-PG 3-table resolution)', () => {
  test('org→association→tier-slug resolution returns exactly the 3 scoped flag rows', async () => {
    if (!H.dbReachable) return;

    const orgId = uuid();
    const associationId = uuid();
    const tierId = uuid();

    await seedOrg({ id: orgId, associationId, slug: `o-${orgId.slice(0, 8)}` });
    await seedPricingTier({ id: tierId, slug: 'pro' });
    await seedSubscription({ organizationId: orgId, pricingTierId: tierId });

    await seedFlag({ targetType: 'org', targetId: orgId, moduleName: 'events', enabled: false });
    await seedFlag({ targetType: 'association', targetId: associationId, moduleName: 'events', enabled: true });
    await seedFlag({ targetType: 'tier', targetId: 'pro', moduleName: 'events', enabled: true });

    const port = featureFlagRepoPort(H.db as never);
    const rows = await port.findEnforcementFlags(orgId, 'events');

    // Exactly the 3 scoped rows resolve — proves org->assoc select (282),
    // subscription->tier->slug chain (289-297), and inArray fan-out (303-306).
    expect(rows.length).toBe(3);
    const targetIdSet = new Set(rows.map((r) => r.targetId));
    expect(targetIdSet).toEqual(new Set([orgId, associationId, 'pro']));
  });

  test('module scoping: a dues flag on the same org target is NOT returned for events', async () => {
    if (!H.dbReachable) return;

    const orgId = uuid();
    const associationId = uuid();

    await seedOrg({ id: orgId, associationId, slug: `o-${orgId.slice(0, 8)}` });
    // No subscription -> tier branch silently narrows.
    await seedFlag({ targetType: 'org', targetId: orgId, moduleName: 'events', enabled: true });
    await seedFlag({ targetType: 'org', targetId: orgId, moduleName: 'dues', enabled: false });

    const port = featureFlagRepoPort(H.db as never);
    const rows = await port.findEnforcementFlags(orgId, 'events');

    // Proves the eq(module_name) AND-clause: only the 'events' row resolves.
    expect(rows.length).toBe(1);
    expect(rows[0]!.moduleName).toBe('events');
    expect(rows[0]!.targetId).toBe(orgId);
    expect(rows.some((r) => r.moduleName === 'dues')).toBe(false);
  });

  test('shape mapping carries real persisted enabled/isOverride booleans', async () => {
    if (!H.dbReachable) return;

    const orgId = uuid();
    const associationId = uuid();

    await seedOrg({ id: orgId, associationId, slug: `o-${orgId.slice(0, 8)}` });
    await seedFlag({
      targetType: 'org',
      targetId: orgId,
      moduleName: 'billing',
      enabled: false,
      isOverride: true,
    });

    const port = featureFlagRepoPort(H.db as never);
    const rows = await port.findEnforcementFlags(orgId, 'billing');

    expect(rows.length).toBe(1);
    const row = rows[0]!;
    // Proves the .map() at 308-314 carries the real persisted values, not just length.
    expect(row).toEqual({
      targetType: 'org',
      targetId: orgId,
      moduleName: 'billing',
      enabled: false,
      isOverride: true,
    });
  });

  test('no-subscription fail-open narrowing: resolves only {org, association} flags, never throws', async () => {
    if (!H.dbReachable) return;

    const orgId = uuid();
    const associationId = uuid();
    const otherTierId = uuid();

    const otherTierSlug = `enterprise-${orgId.slice(0, 8)}`;
    await seedOrg({ id: orgId, associationId, slug: `o-${orgId.slice(0, 8)}` });
    // A tier flag EXISTS, but this org has NO subscription, so that tier slug
    // must NOT be in the candidate set — the try/catch tier branch narrows.
    await seedPricingTier({ id: otherTierId, slug: otherTierSlug });
    await seedFlag({ targetType: 'tier', targetId: otherTierSlug, moduleName: 'events', enabled: false });
    await seedFlag({ targetType: 'org', targetId: orgId, moduleName: 'events', enabled: true });
    await seedFlag({ targetType: 'association', targetId: associationId, moduleName: 'events', enabled: true });

    const port = featureFlagRepoPort(H.db as never);
    let rows: Awaited<ReturnType<typeof port.findEnforcementFlags>>;
    // Must not throw despite missing subscription.
    expect(async () => {
      rows = await port.findEnforcementFlags(orgId, 'events');
    }).not.toThrow();
    rows = await port.findEnforcementFlags(orgId, 'events');

    expect(rows.length).toBe(2);
    expect(new Set(rows.map((r) => r.targetId))).toEqual(new Set([orgId, associationId]));
    // The unrelated tier flag is NOT resolved for this unsubscribed org.
    expect(rows.some((r) => r.targetId === otherTierSlug)).toBe(false);
  });

  test('no-association edge: missing org row still returns the org-level flag (orgId always pushed)', async () => {
    if (!H.dbReachable) return;

    const orgId = uuid();
    // Deliberately NO organization row seeded -> the org->association select
    // resolves nothing, so association is never a candidate. But orgId itself
    // is always pushed at line 273, so an org-level flag still resolves.
    await seedFlag({ targetType: 'org', targetId: orgId, moduleName: 'events', enabled: true });

    const port = featureFlagRepoPort(H.db as never);
    const rows = await port.findEnforcementFlags(orgId, 'events');

    expect(rows.length).toBe(1);
    expect(rows[0]!.targetId).toBe(orgId);
    expect(rows[0]!.targetType).toBe('org');
  });

  test('negative: unknown org with no flags resolves to an empty set', async () => {
    if (!H.dbReachable) return;

    const port = featureFlagRepoPort(H.db as never);
    const rows = await port.findEnforcementFlags(uuid(), 'events');

    expect(rows).toEqual([]);
  });
});

/**
 * S2 (inter-module: repo ⇄ feature-flag-gate) — precedence input contract.
 *
 * The gate's precedence resolver (`resolveFlagDecision`, the REAL function
 * exported from src/middleware/feature-flag-gate.ts) is unit-tested against a
 * canned stub set (feature-flag-gate.test.ts:40), and `findEnforcementFlags`
 * is proven (S1) against real Postgres — but the two halves have never been
 * wired together end-to-end. Here we feed the REAL rows returned by
 * `findEnforcementFlags` into the REAL `resolveFlagDecision`, so the override
 * precedence + tier-keying + fail-open contracts are proven across the
 * repo↔gate boundary against persisted rows.
 *
 * Gate decision contract (mirrors middleware/feature-flag-gate.ts:112-123):
 *   - resolveFlagDecision === false  -> gate would 403 (DISABLED)
 *   - resolveFlagDecision === true   -> gate passes (ENABLED)
 *   - resolveFlagDecision undefined  -> gate fail-opens (ENABLED)
 */
describe('gate precedence over real rows (repo ⇄ feature-flag-gate)', () => {
  test('org override(enabled:false) beats association(enabled:true) → gate DISABLED', async () => {
    if (!H.dbReachable) return;

    const orgId = uuid();
    const associationId = uuid();

    await seedOrg({ id: orgId, associationId, slug: `o-${orgId.slice(0, 8)}` });
    // Org-level explicit override DISABLED vs association-level ENABLED.
    await seedFlag({
      targetType: 'org',
      targetId: orgId,
      moduleName: 'events',
      enabled: false,
      isOverride: true,
    });
    await seedFlag({
      targetType: 'association',
      targetId: associationId,
      moduleName: 'events',
      enabled: true,
    });

    const port = featureFlagRepoPort(H.db as never);
    const rows = await port.findEnforcementFlags(orgId, 'events');

    // Both real rows must resolve (proves the join feeds both into the gate).
    expect(rows.length).toBe(2);
    expect(new Set(rows.map((r) => r.targetId))).toEqual(new Set([orgId, associationId]));

    // The REAL precedence resolver, over the REAL persisted rows, picks the
    // org override (priority 4) over the association default (priority 2).
    const decision = resolveFlagDecision(rows);
    expect(decision).toBe(false); // gate -> 403 DISABLED
  });

  test('tier(enabled:false) with no org/association rows → gate DISABLED (tier-only path)', async () => {
    if (!H.dbReachable) return;

    const orgId = uuid();
    const associationId = uuid();
    const tierId = uuid();
    const tierSlug = `tier-${orgId.slice(0, 8)}`;

    await seedOrg({ id: orgId, associationId, slug: `o-${orgId.slice(0, 8)}` });
    await seedPricingTier({ id: tierId, slug: tierSlug });
    await seedSubscription({ organizationId: orgId, pricingTierId: tierId });
    // ONLY a tier-level DISABLED flag exists — no org, no association row.
    await seedFlag({ targetType: 'tier', targetId: tierSlug, moduleName: 'events', enabled: false });

    const port = featureFlagRepoPort(H.db as never);
    const rows = await port.findEnforcementFlags(orgId, 'events');

    // Exactly the single tier row resolves (keyed by SLUG — see contract test below).
    expect(rows.length).toBe(1);
    expect(rows[0]!.targetType).toBe('tier');
    expect(rows[0]!.targetId).toBe(tierSlug);

    const decision = resolveFlagDecision(rows);
    expect(decision).toBe(false); // tier-only DISABLED -> gate 403
  });

  test('empty row set (module never flagged) → resolver undefined → gate FAIL-OPEN (enabled)', async () => {
    if (!H.dbReachable) return;

    const orgId = uuid();
    const associationId = uuid();

    await seedOrg({ id: orgId, associationId, slug: `o-${orgId.slice(0, 8)}` });
    // Flag the org for a DIFFERENT module only; 'events' is never flagged.
    await seedFlag({ targetType: 'org', targetId: orgId, moduleName: 'dues', enabled: false });

    const port = featureFlagRepoPort(H.db as never);
    const rows = await port.findEnforcementFlags(orgId, 'events');

    expect(rows).toEqual([]);
    // No rows -> resolver returns undefined -> gate passes (fail-open).
    const decision = resolveFlagDecision(rows);
    expect(decision).toBeUndefined();
  });

  test('CONTRACT (surface, do not fix): tier flags key on pricing-tier SLUG, not tier UUID', async () => {
    if (!H.dbReachable) return;

    const orgId = uuid();
    const associationId = uuid();
    const tierId = uuid();
    const tierSlug = `slugkey-${orgId.slice(0, 8)}`;

    await seedOrg({ id: orgId, associationId, slug: `o-${orgId.slice(0, 8)}` });
    await seedPricingTier({ id: tierId, slug: tierSlug });
    await seedSubscription({ organizationId: orgId, pricingTierId: tierId });

    // Seed TWO tier-keyed flag rows for the same module: one keyed by the SLUG
    // (the repo's actual candidate), one keyed by the tier UUID (the plausible
    // alternative). The repo pushes the SLUG into target_id (platform-admin.repo.ts:297),
    // so ONLY the slug-keyed row must resolve. This pins the data-integrity
    // contract: feature_flag tier rows MUST be authored keyed by slug, else
    // a UUID-keyed row is silently invisible to enforcement.
    await seedFlag({ targetType: 'tier', targetId: tierSlug, moduleName: 'events', enabled: false });
    await seedFlag({ targetType: 'tier', targetId: tierId, moduleName: 'events', enabled: true });

    const port = featureFlagRepoPort(H.db as never);
    const rows = await port.findEnforcementFlags(orgId, 'events');

    // The repo resolves the SLUG-keyed row only — the UUID-keyed row is unreachable.
    expect(rows.length).toBe(1);
    expect(rows[0]!.targetId).toBe(tierSlug);
    expect(rows[0]!.targetId).not.toBe(tierId);
    expect(rows[0]!.enabled).toBe(false);

    // End-to-end: the slug-keyed DISABLED row drives the gate to 403; the
    // UUID-keyed ENABLED row, were it ever consulted, would have flipped this.
    // FLAGGED as a product/data-integrity decision (slug-keying), NOT changed.
    const decision = resolveFlagDecision(rows);
    expect(decision).toBe(false);
  });
});
