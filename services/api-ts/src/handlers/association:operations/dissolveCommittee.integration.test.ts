/**
 * Real-Postgres integration tests for committee dissolution (BR-39 / WF-108).
 *
 * Target: handlers/association:operations/dissolveCommittee.ts
 *         + CommitteeRepository.dissolve (repos/committee.repo.ts)
 *
 * BR-39 (m19-committee-management): "IF committee dissolved THEN all data
 * (meetings, minutes, tasks, reports) retained indefinitely for audit; members
 * lose workspace access; officers/platform admins retain read access." The
 * dissolution is a *status change only* — no rows are deleted, no member/seat/
 * task rows are mutated. The committee row gains status='completed' (the DB
 * `committee_status` enum has no 'dissolved' literal — the handler maps the
 * dissolved state onto 'completed'), plus dissolvedAt / dissolvedBy /
 * dissolutionReason audit metadata.
 *
 * The sibling unit suites (committees.test.ts, ac-m19.committee.test.ts,
 * committee.repo.test.ts) only exercise hand-rolled in-memory committee objects
 * or a fake update-chain db — they never run the real UPDATE against a real
 * `committee` table, and they never assert that the dissolution leaves the
 * committee's members and tasks untouched. So they cannot catch:
 *   - a dissolve() that silently writes the wrong column / loses the reason,
 *   - the enum mismatch trap (writing a value the real `committee_status` enum
 *     rejects),
 *   - a regression that starts deleting/deactivating member or task rows on
 *     dissolution (a BR-39 violation),
 *   - the already-dissolved idempotency guard firing against real persisted
 *     status.
 *
 * This suite drives the REAL `dissolveCommittee` handler against REAL rows in a
 * per-suite scratch schema (LIKE public.<t> INCLUDING ALL — real columns / enums
 * / defaults), and reads the persisted row state back through a raw pool — never
 * "did not throw".
 *
 * ── ROUTING NOTE (documented, not asserted) ────────────────────────────────
 * As of this writing the `dissolveCommittee` handler is NOT wired into any
 * route: it appears nowhere in src/generated/openapi/routes.ts, the generated
 * registry, or src/app.ts (grep `dissolveCommittee` across src returns only the
 * handler definition + test files). Consequently the BR-39 spec'd authorization
 * gate ("Dissolve committee: president, chairperson") and the org-scope guard
 * — which the platform expresses as route-level `@extension("x-require-position")`
 * / `@extension("x-require-officer")` middleware — are NOT enforced by anything,
 * because no middleware chain runs. The handler body itself performs no org-scope
 * check and no role check: it dissolves any committee by id for any caller with a
 * session. These tests therefore assert the dissolution *mechanics* (the only
 * behaviour the handler actually owns) and explicitly document the missing gate
 * as an unrouted-handler gap rather than a handler bug.
 *
 * Isolation: shared `createScratch` harness. FKs are NOT copied by LIKE, so we
 * seed committee / committee_member / committee_task rows directly without
 * standing up parent org / person rows. The handler runs against H.db (drizzle
 * pinned to the scratch search_path), so its UPDATE lands in the scratch schema
 * too. Audit is inert (makeCtx supplies no `audit`); the handler only stashes
 * audit metadata onto ctx vars, which we read back directly.
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { dissolveCommittee } from './dissolveCommittee';

let H: ScratchDb;

const noopLogger = {
  debug() {}, info() {}, warn() {}, error() {},
  child() { return noopLogger; },
} as any;

function freshId(): string {
  return crypto.randomUUID();
}

// `committee.dissolved_by` / `committee_member.person_id` are real `uuid`
// columns, so every actor / person id seeded or passed through the handler must
// be a valid UUID. Named constants keep the attribution assertions readable.
const ACTOR = {
  presidentA: freshId(),
  presidentB: freshId(),
  officer: freshId(),
  originalPresident: freshId(),
  rankAndFileMember: freshId(),
  outsider: freshId(),
} as const;

// ─── Raw seed helpers (set every real NOT-NULL-without-default column) ──────

async function insertCommittee(opts: {
  id?: string;
  organizationId?: string;
  name?: string;
  description?: string | null;
  status?: 'active' | 'completed';
  dissolvedAt?: Date | null;
  dissolvedBy?: string | null;
  dissolutionReason?: string | null;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".committee
       (id, organization_id, name, description, status,
        dissolved_at, dissolved_by, dissolution_reason)
     VALUES ($1,$2,$3,$4,$5::committee_status,$6,$7,$8)`,
    [
      id,
      opts.organizationId ?? freshId(),
      opts.name ?? 'Ethics Committee',
      'description' in opts ? opts.description : 'Oversees ethical conduct',
      opts.status ?? 'active',
      'dissolvedAt' in opts ? opts.dissolvedAt : null,
      'dissolvedBy' in opts ? opts.dissolvedBy : null,
      'dissolutionReason' in opts ? opts.dissolutionReason : null,
    ],
  );
  return id;
}

async function insertMember(opts: {
  id?: string;
  committeeId: string;
  organizationId?: string;
  personId?: string;
  role?: 'member' | 'chairperson' | 'vice_chairperson' | 'secretary';
  active?: boolean;
}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".committee_member
       (id, organization_id, committee_id, person_id, role, active)
     VALUES ($1,$2,$3,$4,$5::committee_member_role,$6)`,
    [
      id,
      opts.organizationId ?? freshId(),
      opts.committeeId,
      opts.personId ?? freshId(),
      opts.role ?? 'member',
      opts.active ?? true,
    ],
  );
  return id;
}

async function insertTask(opts: {
  id?: string;
  committeeId: string;
  organizationId?: string;
  title?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".committee_task
       (id, organization_id, committee_id, title, status, priority)
     VALUES ($1,$2,$3,$4,$5::committee_task_status,$6::committee_task_priority)`,
    [
      id,
      opts.organizationId ?? freshId(),
      opts.committeeId,
      opts.title ?? 'Draft annual report',
      opts.status ?? 'pending',
      opts.priority ?? 'medium',
    ],
  );
  return id;
}

/** Read a single committee row back from Postgres (bypassing the repo). */
async function readCommittee(id: string): Promise<any> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".committee WHERE id = $1`,
    [id],
  );
  return rows[0];
}

/** Read a single committee_member row back. */
async function readMember(id: string): Promise<any> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".committee_member WHERE id = $1`,
    [id],
  );
  return rows[0];
}

/** Read a single committee_task row back. */
async function readTask(id: string): Promise<any> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".committee_task WHERE id = $1`,
    [id],
  );
  return rows[0];
}

function countMembers(committeeId: string): Promise<number> {
  return H.scopedPool
    .query(`SELECT count(*)::int AS n FROM "${H.schema}".committee_member WHERE committee_id = $1`, [committeeId])
    .then((r) => r.rows[0].n as number);
}

function countActiveMembers(committeeId: string): Promise<number> {
  return H.scopedPool
    .query(
      `SELECT count(*)::int AS n FROM "${H.schema}".committee_member WHERE committee_id = $1 AND active = true`,
      [committeeId],
    )
    .then((r) => r.rows[0].n as number);
}

function countTasks(committeeId: string): Promise<number> {
  return H.scopedPool
    .query(`SELECT count(*)::int AS n FROM "${H.schema}".committee_task WHERE committee_id = $1`, [committeeId])
    .then((r) => r.rows[0].n as number);
}

/**
 * A ctx whose database is the REAL scratch db, with the dissolution route's
 * `:id` path param + JSON body + an authenticated session (the handler reads
 * `session.user.id` for `dissolvedBy`).
 */
function ctxFor(opts: {
  id: string;
  reason?: string;
  actorId?: string;
  session?: any;
}): any {
  const actorId = opts.actorId ?? ACTOR.presidentA;
  const session =
    'session' in opts
      ? opts.session
      : { id: 'session-1', userId: actorId, user: { id: actorId, role: 'user' } };
  return makeCtx({
    database: H.db,
    logger: noopLogger,
    session,
    _params: { id: opts.id },
    _body: opts.reason === undefined ? {} : { reason: opts.reason },
  });
}

beforeAll(async () => {
  H = await createScratch(['committee', 'committee_member', 'committee_task']);
});

afterAll(async () => {
  await H?.teardown();
});

// ═══════════════════════════════════════════════════════════════════════════
// Happy path — status → completed + dissolution metadata persisted (BR-39)
// ═══════════════════════════════════════════════════════════════════════════

describe('dissolveCommittee — status transition + metadata (real DB)', () => {
  test('flips an active committee to completed and persists dissolvedAt/By/reason', async () => {
    if (!H.dbReachable) return;
    const orgId = freshId();
    const committeeId = await insertCommittee({
      organizationId: orgId,
      name: 'Standing Ethics Board',
      status: 'active',
    });

    const before = Date.now();
    const res = (await dissolveCommittee(
      ctxFor({ id: committeeId, reason: 'Term ended', actorId: ACTOR.presidentA }),
    )) as any;
    const after = Date.now();

    // Handler returns 200 with the dissolved committee under { data }.
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(committeeId);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.dissolutionReason).toBe('Term ended');
    expect(res.body.data.dissolvedBy).toBe(ACTOR.presidentA);

    // Persisted row reflects the same state (not just the in-memory return value).
    const row = await readCommittee(committeeId);
    expect(row.status).toBe('completed');
    expect(row.dissolution_reason).toBe('Term ended');
    expect(row.dissolved_by).toBe(ACTOR.presidentA);
    // dissolvedAt is a real timestamp stamped during the handler call window.
    expect(row.dissolved_at).not.toBeNull();
    const ts = new Date(row.dissolved_at).getTime();
    expect(ts).toBeGreaterThanOrEqual(before - 1000);
    expect(ts).toBeLessThanOrEqual(after + 1000);

    // The org / name / description are untouched by dissolution.
    expect(row.organization_id).toBe(orgId);
    expect(row.name).toBe('Standing Ethics Board');
  });

  test('dissolution without a reason persists a NULL reason (not the string "undefined")', async () => {
    if (!H.dbReachable) return;
    const committeeId = await insertCommittee({ status: 'active' });

    const res = (await dissolveCommittee(ctxFor({ id: committeeId }))) as any;

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.dissolutionReason).toBeNull();

    const row = await readCommittee(committeeId);
    expect(row.status).toBe('completed');
    expect(row.dissolution_reason).toBeNull();
    expect(row.dissolved_at).not.toBeNull();
  });

  test('records dissolvedBy from the authenticated session user (audit attribution)', async () => {
    if (!H.dbReachable) return;
    const committeeId = await insertCommittee({ status: 'active' });

    await dissolveCommittee(ctxFor({ id: committeeId, reason: 'Merged', actorId: ACTOR.officer }));

    const row = await readCommittee(committeeId);
    expect(row.dissolved_by).toBe(ACTOR.officer);
  });

  test('sets the audit ctx vars (resourceId / description / details) for the audit middleware', async () => {
    if (!H.dbReachable) return;
    const committeeId = await insertCommittee({ name: 'Audit Cmte', status: 'active' });
    const ctx = ctxFor({ id: committeeId, reason: 'Cleanup' });

    await dissolveCommittee(ctx);

    expect(ctx.get('auditResourceId')).toBe(committeeId);
    expect(ctx.get('auditDescription')).toBe('Dissolved committee: Audit Cmte');
    expect(ctx.get('auditDetails')).toEqual({ reason: 'Cleanup' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BR-39 historical preservation — members, seats, tasks retained read-only
// ═══════════════════════════════════════════════════════════════════════════

describe('dissolveCommittee — BR-39 historical preservation (real DB)', () => {
  test('dissolution does NOT delete or deactivate committee members (rows retained as-is)', async () => {
    if (!H.dbReachable) return;
    const orgId = freshId();
    const committeeId = await insertCommittee({ organizationId: orgId, status: 'active' });
    const chairId = await insertMember({
      committeeId,
      organizationId: orgId,
      role: 'chairperson',
      active: true,
    });
    const memberId = await insertMember({
      committeeId,
      organizationId: orgId,
      role: 'member',
      active: true,
    });

    expect(await countMembers(committeeId)).toBe(2);
    expect(await countActiveMembers(committeeId)).toBe(2);

    await dissolveCommittee(ctxFor({ id: committeeId, reason: 'Term ended' }));

    // BR-39: no member rows deleted, and crucially `active` is NOT flipped to
    // false on dissolution — workspace access is a *read* concern enforced
    // elsewhere; the historical seat record is preserved verbatim.
    expect(await countMembers(committeeId)).toBe(2);
    expect(await countActiveMembers(committeeId)).toBe(2);

    const chair = await readMember(chairId);
    expect(chair.active).toBe(true);
    expect(chair.role).toBe('chairperson');
    expect(chair.removed_at).toBeNull();

    const member = await readMember(memberId);
    expect(member.active).toBe(true);
    expect(member.role).toBe('member');
    expect(member.removed_at).toBeNull();
  });

  test('dissolution does NOT delete or alter committee tasks (open + completed retained)', async () => {
    if (!H.dbReachable) return;
    const orgId = freshId();
    const committeeId = await insertCommittee({ organizationId: orgId, status: 'active' });
    const openTaskId = await insertTask({
      committeeId,
      organizationId: orgId,
      title: 'Open task at dissolution',
      status: 'pending',
    });
    const doneTaskId = await insertTask({
      committeeId,
      organizationId: orgId,
      title: 'Closed task',
      status: 'completed',
    });

    expect(await countTasks(committeeId)).toBe(2);

    // WF-108 exception flow: dissolution is allowed even with open tasks — they
    // are archived (retained), not blocked and not deleted.
    await dissolveCommittee(ctxFor({ id: committeeId, reason: 'Project complete' }));

    expect(await countTasks(committeeId)).toBe(2);

    const openTask = await readTask(openTaskId);
    // The open task keeps its original status — dissolution does not silently
    // force-complete or cancel it.
    expect(openTask.status).toBe('pending');
    expect(openTask.title).toBe('Open task at dissolution');

    const doneTask = await readTask(doneTaskId);
    expect(doneTask.status).toBe('completed');
  });

  test('only the targeted committee is dissolved — a sibling committee in the same org is untouched', async () => {
    if (!H.dbReachable) return;
    const orgId = freshId();
    const target = await insertCommittee({ organizationId: orgId, name: 'Target', status: 'active' });
    const bystander = await insertCommittee({ organizationId: orgId, name: 'Bystander', status: 'active' });

    await dissolveCommittee(ctxFor({ id: target, reason: 'done' }));

    const targetRow = await readCommittee(target);
    expect(targetRow.status).toBe('completed');

    // The other active committee in the same org must remain active + un-stamped.
    const bystanderRow = await readCommittee(bystander);
    expect(bystanderRow.status).toBe('active');
    expect(bystanderRow.dissolved_at).toBeNull();
    expect(bystanderRow.dissolved_by).toBeNull();
    expect(bystanderRow.dissolution_reason).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Guards — not found + already-dissolved idempotency (real persisted status)
// ═══════════════════════════════════════════════════════════════════════════

describe('dissolveCommittee — guards (real DB)', () => {
  test('NotFoundError (404) for a committee id that does not exist', async () => {
    if (!H.dbReachable) return;
    let raised: any = null;
    try {
      await dissolveCommittee(ctxFor({ id: freshId(), reason: 'nope' }));
    } catch (err) {
      raised = err;
    }
    expect(raised).not.toBeNull();
    expect(raised.code).toBe('NOT_FOUND');
    expect(raised.statusCode).toBe(404);
  });

  test('BusinessLogicError COMMITTEE_ALREADY_DISSOLVED (422) when status is already completed', async () => {
    if (!H.dbReachable) return;
    // Seed a committee already in the dissolved (completed) state.
    const committeeId = await insertCommittee({
      status: 'completed',
      dissolvedAt: new Date('2026-01-01T00:00:00.000Z'),
      dissolvedBy: ACTOR.originalPresident,
      dissolutionReason: 'Original reason',
    });

    let raised: any = null;
    try {
      await dissolveCommittee(ctxFor({ id: committeeId, reason: 'second attempt', actorId: ACTOR.presidentB }));
    } catch (err) {
      raised = err;
    }
    expect(raised).not.toBeNull();
    expect(raised.code).toBe('COMMITTEE_ALREADY_DISSOLVED');
    expect(raised.statusCode).toBe(422);

    // Idempotency: the original dissolution metadata is NOT overwritten by the
    // rejected second attempt.
    const row = await readCommittee(committeeId);
    expect(row.status).toBe('completed');
    expect(row.dissolved_by).toBe(ACTOR.originalPresident);
    expect(row.dissolution_reason).toBe('Original reason');
    expect(new Date(row.dissolved_at).toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  test('a second dissolve of a freshly-dissolved committee is rejected (idempotent close)', async () => {
    if (!H.dbReachable) return;
    const committeeId = await insertCommittee({ status: 'active' });

    // First dissolution succeeds.
    const first = (await dissolveCommittee(ctxFor({ id: committeeId, reason: 'first', actorId: ACTOR.presidentA }))) as any;
    expect(first.status).toBe(200);

    // Second dissolution of the now-completed committee is rejected.
    let raised: any = null;
    try {
      await dissolveCommittee(ctxFor({ id: committeeId, reason: 'second', actorId: ACTOR.presidentB }));
    } catch (err) {
      raised = err;
    }
    expect(raised?.code).toBe('COMMITTEE_ALREADY_DISSOLVED');

    // The first actor's attribution survives — the rejected retry left no trace.
    const row = await readCommittee(committeeId);
    expect(row.dissolved_by).toBe(ACTOR.presidentA);
    expect(row.dissolution_reason).toBe('first');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Authorization / org-scope — documents the UNROUTED-HANDLER gap (real DB)
// ═══════════════════════════════════════════════════════════════════════════

describe('dissolveCommittee — authorization gap (unrouted handler, real DB)', () => {
  test('GAP: handler enforces NO role/position gate — any caller with a session can dissolve', async () => {
    if (!H.dbReachable) return;
    // A plain `member`-role caller (NOT president/chairperson). BR-39 permissions
    // say only president/chairperson may dissolve, but that gate lives in the
    // route-level @extension("x-require-position") middleware — and this handler
    // is unrouted, so NO middleware runs. The handler body has no role check, so
    // the dissolution succeeds. This test pins that gap so a future fix (routing
    // the handler with the position extension, or an inline guard) is a visible,
    // intentional behaviour change rather than a silent one.
    const committeeId = await insertCommittee({ status: 'active' });
    const res = (await dissolveCommittee(
      ctxFor({
        id: committeeId,
        reason: 'dissolved by a non-officer',
        session: { id: 's', userId: ACTOR.rankAndFileMember, user: { id: ACTOR.rankAndFileMember, role: 'member' } },
      }),
    )) as any;

    expect(res.status).toBe(200);
    const row = await readCommittee(committeeId);
    expect(row.status).toBe('completed');
    expect(row.dissolved_by).toBe(ACTOR.rankAndFileMember);
  });

  test('GAP: handler enforces NO org-scope check — a committee is dissolvable regardless of caller org', async () => {
    if (!H.dbReachable) return;
    // The committee belongs to orgA. The handler never reads the caller's org and
    // never compares it to committee.organizationId, so a caller with no org
    // affiliation to orgA still dissolves it. Again: org-scope enforcement would
    // come from route middleware that is absent on this unrouted handler.
    const orgA = freshId();
    const committeeId = await insertCommittee({ organizationId: orgA, status: 'active' });

    const res = (await dissolveCommittee(
      ctxFor({
        id: committeeId,
        reason: 'cross-org dissolve',
        session: { id: 's', userId: ACTOR.outsider, user: { id: ACTOR.outsider, role: 'user', organizationId: freshId() } },
      }),
    )) as any;

    expect(res.status).toBe(200);
    const row = await readCommittee(committeeId);
    expect(row.status).toBe('completed');
    // The committee's own org is unchanged — dissolution does not re-scope it.
    expect(row.organization_id).toBe(orgA);
  });
});
