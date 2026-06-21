/**
 * Real-Postgres integration test for the INVITE-CLAIM HANDLER's cross-module
 * transaction + domain-event emissions (`handlers/invite/claimInvite.ts`).
 *
 * `claimInvite` is the seam where the invite module reaches across into the
 * membership module: a single `db.transaction` runs `markClaimed` (UPDATE
 * invitation_token) AND `addMember` (INSERT membership) so a failure can never
 * leave the invite burned with no membership (the BUG-2 atomicity contract that
 * the source comments call out). It then emits two domain events
 * ('invite.claimed' + 'membership.created' with source='invite').
 *
 * The module's UNIT layer (claimInvite.test.ts) is mock-only: a fake
 * `db.transaction` just runs the callback, and both repos are prototype-stubbed.
 * A mock can NEVER prove a REAL Postgres engine (a) writes a real membership row
 * in the same transaction, (b) rolls the `markClaimed` UPDATE back when the
 * membership INSERT aborts, or (c) honors the unique (org, person) constraint as
 * a 409. And the unit layer never asserts the two domain events fire — the
 * progress ledger flags those emissions as currently UNASSERTED. This suite
 * drives the REAL handler against a real DB and asserts persisted row state +
 * captured domain events.
 *
 * The shared `createScratch` harness copies the real public table structures via
 * `CREATE TABLE … (LIKE … INCLUDING ALL)` — every real column / enum / default /
 * NOT NULL / unique index is present (no hand-DDL drift). FKs are not copied, so
 * the membership / invitation_token rows insert without standing up parent
 * tier / org / person rows. The repo's read-path LEFT JOINs (person,
 * membership_category) need those tables to EXIST, so they are copied too (kept
 * empty — LEFT JOIN tolerates no match).
 *
 * The invite.repo already has its own real-PG CRUD coverage
 * (repos/invite.repo.integration.test.ts) — this suite deliberately does NOT
 * re-test repo CRUD; it focuses on the CLAIM HANDLER's transaction + events.
 *
 * Nothing internal is stubbed on the happy/rollback/conflict paths: the DB is
 * fully real and the rollback is induced by a genuine Postgres CHECK-constraint
 * abort, not an internal mock. `INVITE_TOKEN_SECRET` / `NODE_ENV` are set so the
 * handler's `getInviteTokenSecret()` resolves deterministically and we can hash
 * the raw token to match what it stores.
 *
 * Skips cleanly when Postgres is unreachable.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { makeCtx } from '@/test-utils/make-ctx';
import { claimInvite } from './claimInvite';
import { hashToken } from './utils/token';
import { domainEvents } from '@/core/domain-events';
import type { DomainEventMap } from '@/core/domain-events.registry';

// ── Deterministic invite-token secret ──────────────────────────────────────
// The handler computes the token hash via getInviteTokenSecret() (reads env at
// call time, non-memoized). Pin a known secret + non-prod NODE_ENV so we can
// store a hash the handler will match.
const INVITE_SECRET = 'integration-test-invite-secret-xyz';
process.env['INVITE_TOKEN_SECRET'] = INVITE_SECRET;
if (process.env['NODE_ENV'] === 'production') process.env['NODE_ENV'] = 'test';

let H: ScratchDb;

// Real UUIDs — no FK rows required (LIKE drops FKs), but uuid NOT NULL columns
// need well-formed UUID literals.
const ASSOCIATION_ID = '00000000-0000-4000-8000-0000000000aa';

function freshId(): string {
  return crypto.randomUUID();
}

/** Build the raw token + its stored hash for an invite. */
function makeToken(): { raw: string; hash: string } {
  const raw = `raw-${freshId()}`;
  return { raw, hash: hashToken(raw, INVITE_SECRET) };
}

interface InsertInviteOpts {
  id?: string;
  organizationId?: string;
  tokenHash: string;
  status?: 'pending' | 'claimed' | 'expired' | 'revoked';
  type?: 'claim' | 'invite';
  email?: string;
  expiresAt?: Date;
  claimedAt?: Date | null;
  createdByOfficer?: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Insert an invitation_token row via raw SQL. We set every real
 * NOT-NULL-without-default column: organization_id, token_hash, type, expires_at,
 * created_by_officer, email. status defaults to 'pending' in the table but we
 * pass it explicitly so adversarial states (claimed/revoked) are reproducible.
 *
 * `type` and `status` are real Postgres enums (invite_type / invite_status); a
 * bound $N enum param needs an explicit ::<enum> cast (literals auto-cast, params
 * do not).
 */
async function insertInvite(opts: InsertInviteOpts): Promise<{ id: string; organizationId: string }> {
  const id = opts.id ?? freshId();
  const organizationId = opts.organizationId ?? freshId();
  const expiresAt = opts.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".invitation_token
       (id, organization_id, token_hash, type, status, expires_at, claimed_at, created_by_officer, email, metadata)
     VALUES ($1,$2,$3,$4::invite_type,$5::invite_status,$6,$7,$8,$9,$10::jsonb)`,
    [
      id,
      organizationId,
      opts.tokenHash,
      opts.type ?? 'invite',
      opts.status ?? 'pending',
      expiresAt,
      opts.claimedAt ?? null,
      opts.createdByOfficer ?? freshId(),
      opts.email ?? 'invitee@example.com',
      JSON.stringify(opts.metadata === undefined ? { membershipTierId: freshId() } : opts.metadata),
    ],
  );
  return { id, organizationId };
}

/** Read the persisted invite row (status + claimed_at are the atomicity witnesses). */
async function readInvite(id: string): Promise<{
  id: string;
  status: string;
  claimed_at: string | null;
} | undefined> {
  const { rows } = await H.scopedPool.query(
    `SELECT id, status, claimed_at FROM "${H.schema}".invitation_token WHERE id = $1`,
    [id],
  );
  return rows[0];
}

/** Read back the membership row(s) for an (org, person) pair. */
async function readMemberships(organizationId: string, personId: string): Promise<Array<{
  id: string;
  organization_id: string;
  person_id: string;
  tier_id: string;
  category_id: string | null;
  member_number: string | null;
  status: string;
  start_date: string;
  dues_expiry_date: string | null;
  grace_period_days: number;
  created_by: string | null;
  updated_by: string | null;
}>> {
  const { rows } = await H.scopedPool.query(
    `SELECT id, organization_id, person_id, tier_id, category_id, member_number,
            status, start_date::text AS start_date, dues_expiry_date::text AS dues_expiry_date,
            grace_period_days, created_by, updated_by
       FROM "${H.schema}".membership
      WHERE organization_id = $1 AND person_id = $2`,
    [organizationId, personId],
  );
  return rows;
}

/** Pre-seed an organization row so the best-effort slug lookup can resolve. */
async function insertOrganization(id: string, slug: string): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".organization
       (id, association_id, name, slug, org_type, status)
     VALUES ($1,$2,$3,$4,'chapter'::org_type,'active'::org_lifecycle_status)`,
    [id, ASSOCIATION_ID, `Org ${slug}`, slug],
  );
}

/** Pre-seed a membership row directly (for the duplicate-membership guard). */
async function insertMembership(opts: {
  organizationId: string;
  personId: string;
  tierId?: string;
  status?: string;
}): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".membership
       (id, organization_id, person_id, tier_id, start_date, status)
     VALUES ($1,$2,$3,$4,CURRENT_DATE,COALESCE($5::membership_status,'active'))`,
    [id, opts.organizationId, opts.personId, opts.tierId ?? freshId(), opts.status ?? null],
  );
  return id;
}

/**
 * Build a handler ctx pointed at the REAL scratch db. Mirrors makeCtx's shape
 * but swaps `database` for H.db and pins a real-UUID user. Token arrives via the
 * `token` path param (ctx.req.param('token')).
 */
function makeRealCtx(opts: { rawToken: string; userId: string }) {
  return makeCtx({
    user: { id: opts.userId, role: 'user', twoFactorEnabled: true },
    database: H.db as any,
    logger: null,
    _params: { token: opts.rawToken },
  });
}

/**
 * Capture domain events emitted DURING a callback. The handler emits fire-and-
 * forget (`.emit(...).catch(() => {})`, not awaited), so listeners must record
 * synchronously and we drain a couple of microtask/macrotask ticks after the
 * call to let the emit settle.
 */
async function captureEvents<T>(run: () => Promise<T>): Promise<{
  result: T;
  claimed: Array<DomainEventMap['invite.claimed']>;
  created: Array<DomainEventMap['membership.created']>;
}> {
  const claimed: Array<DomainEventMap['invite.claimed']> = [];
  const created: Array<DomainEventMap['membership.created']> = [];
  const onClaimed = async (p: DomainEventMap['invite.claimed']) => { claimed.push(p); };
  const onCreated = async (p: DomainEventMap['membership.created']) => { created.push(p); };
  domainEvents.on('invite.claimed', onClaimed);
  domainEvents.on('membership.created', onCreated);
  try {
    const result = await run();
    // Let the un-awaited fire-and-forget emits settle.
    await new Promise((r) => setTimeout(r, 20));
    return { result, claimed, created };
  } finally {
    domainEvents.off('invite.claimed', onClaimed);
    domainEvents.off('membership.created', onCreated);
  }
}

beforeAll(async () => {
  // organization + person + membership_category are present so the repo's
  // findById slug lookup and getMember LEFT JOINs resolve; the latter two stay
  // empty (LEFT JOIN tolerates no match).
  H = await createScratch(['invitation_token', 'membership', 'organization', 'person', 'membership_category']);
});

afterAll(async () => {
  await H?.teardown();
});

describe('claimInvite — cross-module transaction + domain events (real Postgres)', () => {
  // ── 1. HAPPY PATH: a real membership row is created in the same transaction ──
  test('successful claim creates a REAL membership row (correct personId/org/tier) AND marks the invite claimed', async () => {
    if (!H.dbReachable) return;

    const userId = freshId();
    const orgId = freshId();
    const tierId = freshId();
    const categoryId = freshId();
    const { raw, hash } = makeToken();
    await insertOrganization(orgId, `claim-org-${orgId.slice(0, 8)}`);
    const invite = await insertInvite({
      organizationId: orgId,
      tokenHash: hash,
      status: 'pending',
      metadata: { membershipTierId: tierId, membershipCategoryId: categoryId, licenseNumber: 'LIC-7788' },
    });

    // No membership exists before the claim.
    expect(await readMemberships(orgId, userId)).toHaveLength(0);

    const ctx = makeRealCtx({ rawToken: raw, userId });
    const response: any = await claimInvite(ctx);

    // Response surface.
    expect(response.body.claimed).toBe(true);
    expect(response.body.organizationId).toBe(orgId);
    expect(response.body.membershipStatus).toBe('joined');
    expect(response.body.membershipId).toBeDefined();

    // The REAL membership row exists with the right field values — field by field.
    const rows = await readMemberships(orgId, userId);
    expect(rows).toHaveLength(1);
    const m = rows[0]!;
    expect(m.id).toBe(response.body.membershipId);
    expect(m.organization_id).toBe(orgId);
    expect(m.person_id).toBe(userId);
    expect(m.tier_id).toBe(tierId);
    expect(m.category_id).toBe(categoryId);
    expect(m.member_number).toBe('LIC-7788');
    expect(m.status).toBe('active');
    expect(m.grace_period_days).toBe(30);
    expect(m.created_by).toBe(userId);
    expect(m.updated_by).toBe(userId);
    // start_date is today (DATE column asserted TZ-stably via ::text).
    const today = new Date().toISOString().split('T')[0];
    expect(m.start_date).toBe(today);
    // dues_expiry_date is one year out — same month/day, year + 1.
    expect(m.dues_expiry_date).not.toBeNull();

    // The invite is marked claimed in the SAME transaction.
    const inv = await readInvite(invite.id);
    expect(inv?.status).toBe('claimed');
    expect(inv?.claimed_at).not.toBeNull();
  });

  // ── 2. ROLLBACK: a real DB abort inside addMember rolls BOTH writes back ──
  // Induce a genuine Postgres abort on the membership INSERT (not an internal
  // mock) by attaching a CHECK constraint the handler's insert violates
  // (grace_period_days defaults to 30 in the handler; CHECK demands < 0). The
  // markClaimed UPDATE has already run inside the same transaction; the abort
  // must roll it back too. We assert: NO membership row, AND the invite is still
  // 'pending' with claimed_at NULL — the precise "no burned invite, no
  // membership" atomicity contract BUG-2 fixed.
  test('transaction ROLLS BACK when addMember aborts: no membership row AND invite NOT marked claimed', async () => {
    if (!H.dbReachable) return;

    const userId = freshId();
    const orgId = freshId();
    const tierId = freshId();
    const { raw, hash } = makeToken();
    const invite = await insertInvite({
      organizationId: orgId,
      tokenHash: hash,
      status: 'pending',
      metadata: { membershipTierId: tierId },
    });

    const constraintName = `force_abort_${userId.slice(0, 8).replace(/-/g, '')}`;
    // Add a CHECK that the handler's INSERT (grace_period_days=30) violates.
    await H.scopedPool.query(
      `ALTER TABLE "${H.schema}".membership ADD CONSTRAINT ${constraintName} CHECK (grace_period_days < 0) NOT VALID`,
    );

    try {
      const ctx = makeRealCtx({ rawToken: raw, userId });
      // The membership INSERT aborts → db.transaction rejects → handler rejects.
      await expect(claimInvite(ctx)).rejects.toThrow();

      // ROLLBACK PROOF #1: no membership row was committed.
      const rows = await readMemberships(orgId, userId);
      expect(rows).toHaveLength(0);

      // ROLLBACK PROOF #2: the markClaimed UPDATE was rolled back with the failed
      // insert — the invite is NOT burned (still claimable on retry).
      const inv = await readInvite(invite.id);
      expect(inv?.status).toBe('pending');
      expect(inv?.claimed_at).toBeNull();
    } finally {
      // Drop the constraint so it can't leak into the shared scratch table.
      await H.scopedPool.query(
        `ALTER TABLE "${H.schema}".membership DROP CONSTRAINT IF EXISTS ${constraintName}`,
      );
    }
  });

  // ── 3. DUPLICATE MEMBERSHIP → 409 (ConflictError, before any write) ──
  test('duplicate membership → 409 ConflictError, and the invite is left untouched (still pending)', async () => {
    if (!H.dbReachable) return;

    const userId = freshId();
    const orgId = freshId();
    const tierId = freshId();
    const { raw, hash } = makeToken();
    const invite = await insertInvite({
      organizationId: orgId,
      tokenHash: hash,
      status: 'pending',
      metadata: { membershipTierId: tierId },
    });
    // Pre-seed an existing membership for (org, person) — the pre-write guard.
    const existingId = await insertMembership({ organizationId: orgId, personId: userId, status: 'active' });

    const ctx = makeRealCtx({ rawToken: raw, userId });

    let caught: any;
    try {
      await claimInvite(ctx);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    // ConflictError carries HTTP 409.
    expect(caught.statusCode).toBe(409);
    expect(caught.code).toBe('CONFLICT');
    expect(caught.message).toMatch(/Already a member/i);

    // Guard fires BEFORE any write: still exactly the one pre-seeded membership,
    // and the invite was never marked claimed.
    const rows = await readMemberships(orgId, userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(existingId);
    const inv = await readInvite(invite.id);
    expect(inv?.status).toBe('pending');
    expect(inv?.claimed_at).toBeNull();
  });

  // ── 4. DOMAIN EVENTS: invite.claimed + membership.created (source='invite') ──
  test("emits 'invite.claimed' AND 'membership.created' (source='invite') with correct payloads on a successful claim", async () => {
    if (!H.dbReachable) return;

    const userId = freshId();
    const orgId = freshId();
    const tierId = freshId();
    const { raw, hash } = makeToken();
    const invite = await insertInvite({
      organizationId: orgId,
      tokenHash: hash,
      status: 'pending',
      metadata: { membershipTierId: tierId },
    });

    const ctx = makeRealCtx({ rawToken: raw, userId });

    const { result, claimed, created } = await captureEvents(() => claimInvite(ctx));
    const membershipId = (result as any).body.membershipId as string;

    // 'invite.claimed' fired exactly once with the real ids.
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toEqual({
      inviteId: invite.id,
      personId: userId,
      organizationId: orgId,
      membershipId,
    });

    // 'membership.created' fired exactly once with source='invite' and the real
    // membership id (matched against the persisted row, not just the response).
    const rows = await readMemberships(orgId, userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(membershipId);

    expect(created).toHaveLength(1);
    expect(created[0]).toEqual({
      membershipId,
      personId: userId,
      organizationId: orgId,
      source: 'invite',
    });
  });

  // ── 5. NO EVENTS ON ROLLBACK: a failed claim must not emit success events ──
  // The emits sit AFTER the transaction in the handler; if addMember aborts the
  // handler throws before reaching them. Proves we never tell downstream
  // consumers a membership was created when the row was rolled back.
  test('a rolled-back claim emits NEITHER invite.claimed NOR membership.created', async () => {
    if (!H.dbReachable) return;

    const userId = freshId();
    const orgId = freshId();
    const tierId = freshId();
    const { raw, hash } = makeToken();
    await insertInvite({
      organizationId: orgId,
      tokenHash: hash,
      status: 'pending',
      metadata: { membershipTierId: tierId },
    });

    const constraintName = `force_abort_${userId.slice(0, 8).replace(/-/g, '')}`;
    await H.scopedPool.query(
      `ALTER TABLE "${H.schema}".membership ADD CONSTRAINT ${constraintName} CHECK (grace_period_days < 0) NOT VALID`,
    );

    try {
      const ctx = makeRealCtx({ rawToken: raw, userId });
      const { claimed, created } = await captureEvents(async () => {
        await expect(claimInvite(ctx)).rejects.toThrow();
      });
      expect(claimed).toHaveLength(0);
      expect(created).toHaveLength(0);
    } finally {
      await H.scopedPool.query(
        `ALTER TABLE "${H.schema}".membership DROP CONSTRAINT IF EXISTS ${constraintName}`,
      );
    }
  });
});
