/**
 * Real-Postgres integration test for the MISSING inter-module contract:
 *   election certification  →  officer-term transition.
 *
 * The producer (`handlers/member/governance/certifyElection.ts`) tallies votes,
 * marks winning nominees `elected`, flips the election to `published`, and emits
 * `'election.published'` with `{ electionId, organizationId, publishedBy, winners }`
 * where each winner is `{ positionId, winnerId(=personId) }`.
 *
 * The consumer (the `election.published` handler in
 * `core/domain-event-consumers.ts`, ~lines 1188-1243) is the OTHER half of the
 * contract. For every winner it:
 *   1. finds the outgoing ACTIVE `officer_term` for that position,
 *   2. ENDS it (status → 'completed', sets end_date),
 *   3. writes the 5 ELECTION_TRANSITION_CHECKLIST_ITEMS `transition_checklist` rows
 *      against the outgoing term,
 *   4. MINTS a new ACTIVE `officer_term` for the winner (position/person/org),
 *   5. re-emits `officer.transitioned` (when there was an incumbent) or
 *      `officer.assigned` (when the seat was vacant).
 *
 * Both unit suites are mock-only (`stubRepo` + hand-mocked `db` chains), so a
 * repo returns whatever the test hands it — NEITHER side is proven against real
 * rows + real FKs + real enum casts. This file closes that gap end-to-end:
 *
 *   - Drives the REAL `certifyElection` handler against real `election` /
 *     `election_nominee` / `election_vote` rows (real tally → real winners).
 *   - Wires the REAL consumer onto the same real DB and drives the cascade.
 *   - Asserts the REAL persisted cross-module effect read back from Postgres:
 *       * the outgoing term's row is `completed` with an `end_date`,
 *       * a NEW active `officer_term` exists with the winner's person / the
 *         contested position / the org,
 *       * the 5 `transition_checklist` rows are written against the outgoing term,
 *       * and the re-emitted `officer.transitioned` / `officer.assigned` event
 *         fired with the right ids.
 *
 * Isolation: the shared `createScratch` harness stands up a per-suite scratch
 * schema by COPYING the real public table structures
 * (`CREATE TABLE … (LIKE public.<t> INCLUDING ALL)`), so every real column /
 * default / enum / NOT-NULL / CHECK is present and FKs are dropped (so we can
 * seed rows without standing up every parent). All DB work is real; only the
 * external President-authorization read (`OfficerTermRepository
 * .findActiveByPersonAndOrg`, used by certifyElection's BR-33 guard) and the
 * logger are mocked — the cascade's term/checklist writes use the REAL repos
 * against the REAL `H.db`.
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly (`if (!H.dbReachable) return`).
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { certifyElection } from './certifyElection';
import { domainEvents } from '@/core/domain-events';
import {
  registerDomainEventConsumers,
  type DomainEventMembershipRepo,
} from '@/core/domain-event-consumers';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';

let H: ScratchDb;

const noopLogger = {
  debug() {}, info() {}, warn() {}, error() {},
  child() { return noopLogger; },
} as any;

const noopMembershipRepo: DomainEventMembershipRepo = {
  findByPersonAndOrg: async () => null,
  updateOneById: async () => ({}),
};

function freshId(): string {
  return crypto.randomUUID();
}

// ─── Raw seeders (bypass the repo write-path so we can seed exact states) ────

async function insertPerson(): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".person (id, first_name, last_name) VALUES ($1, 'Cand', $2)`,
    [id, id.slice(0, 8)],
  );
  return id;
}

/** Insert a real `position` row (FK target for officer_term + nominee + vote). */
async function insertPosition(opts: {
  organizationId: string;
  title?: string;
  level?: 'national' | 'regional' | 'chapter';
}): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".position (id, organization_id, title, level)
     VALUES ($1, $2, $3, COALESCE($4::position_level,'national'))`,
    [id, opts.organizationId, opts.title ?? 'President', opts.level ?? null],
  );
  return id;
}

/** Insert an ACTIVE officer_term (the incumbent the cascade should END). */
async function insertActiveTerm(opts: {
  positionId: string;
  personId: string;
  organizationId: string;
}): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".officer_term
       (id, position_id, person_id, organization_id, status, start_date)
     VALUES ($1, $2, $3, $4, 'active'::term_status, now() - interval '6 months')`,
    [id, opts.positionId, opts.personId, opts.organizationId],
  );
  return id;
}

async function readOfficerTerm(id: string): Promise<any> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".officer_term WHERE id = $1`,
    [id],
  );
  return rows[0];
}

/** All active terms for a position (used to find the freshly minted winner term). */
async function activeTermsForPosition(positionId: string): Promise<any[]> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".officer_term
       WHERE position_id = $1 AND status = 'active'`,
    [positionId],
  );
  return rows;
}

async function checklistRowsForTerm(officerTermId: string): Promise<any[]> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".transition_checklist
       WHERE officer_term_id = $1 ORDER BY item`,
    [officerTermId],
  );
  return rows;
}

async function readElection(id: string): Promise<any> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".election WHERE id = $1`,
    [id],
  );
  return rows[0];
}

async function nomineeStatus(id: string): Promise<string> {
  const { rows } = await H.scopedPool.query(
    `SELECT status FROM "${H.schema}".election_nominee WHERE id = $1`,
    [id],
  );
  return rows[0]?.status;
}

// ─── Election scenario builder (real rows, all FKs satisfied) ────────────────

/**
 * Build a real `awaitingConfirmation` officer election for ONE position with two
 * nominees, casting `winnerVotes` ballots for nomineeWin and `loserVotes` for
 * nomineeLose. Returns the ids needed for assertions. Uses the REAL
 * ElectionsRepository against H.db so the certify tally reads real rows.
 */
async function buildElection(opts: {
  orgId: string;
  positionId: string;
  winnerVotes: number;
  loserVotes: number;
  type?: 'officer' | 'bylaw';
  passageThreshold?: number | null;
}): Promise<{
  electionId: string;
  winningPersonId: string;
  losingPersonId: string;
  winningNomineeId: string;
  losingNomineeId: string;
}> {
  const repo = new ElectionsRepository(H.db as any);

  const election = await repo.create({
    organizationId: opts.orgId,
    title: `Cascade Election ${freshId().slice(0, 6)}`,
    type: opts.type ?? 'officer',
    status: 'awaitingConfirmation',
    votingMode: 'online',
    votingOpenAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    votingCloseAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    passageThreshold: opts.passageThreshold ?? null,
    positions: [{ id: opts.positionId, title: 'President', sortOrder: 0 }],
  } as any);

  const winningPersonId = await insertPerson();
  const losingPersonId = await insertPerson();

  const winNom = await repo.addNominee({
    electionId: election.id,
    positionId: opts.positionId,
    personId: winningPersonId,
    nominatedBy: winningPersonId,
    organizationId: opts.orgId,
  });
  const loseNom = await repo.addNominee({
    electionId: election.id,
    positionId: opts.positionId,
    personId: losingPersonId,
    nominatedBy: losingPersonId,
    organizationId: opts.orgId,
  });

  // Distinct voters for each ballot (election_vote unique on election+voter+position).
  for (let i = 0; i < opts.winnerVotes; i++) {
    const voter = await insertPerson();
    await repo.castVote({
      electionId: election.id,
      positionId: opts.positionId,
      nomineeId: winNom.id,
      voterId: voter,
      organizationId: opts.orgId,
    });
  }
  for (let i = 0; i < opts.loserVotes; i++) {
    const voter = await insertPerson();
    await repo.castVote({
      electionId: election.id,
      positionId: opts.positionId,
      nomineeId: loseNom.id,
      voterId: voter,
      organizationId: opts.orgId,
    });
  }

  return {
    electionId: election.id,
    winningPersonId,
    losingPersonId,
    winningNomineeId: winNom.id,
    losingNomineeId: loseNom.id,
  };
}

/**
 * Drive the REAL certifyElection handler against H.db as the President.
 * certifyElection's BR-33 guard reads OfficerTermRepository.findActiveByPersonAndOrg
 * to confirm the caller holds an active 'President' term — that single external
 * read is stubbed; everything else (tally, winner mint, election update) is real.
 * Returns the parsed response body { ...election, tallies, voterCount, winners }.
 */
async function runCertifyAsPresident(electionId: string, orgId: string): Promise<any> {
  const PRESIDENT_ID = freshId();
  restoreRepo(OfficerTermRepository);
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [
      { id: freshId(), positionTitle: 'President', personId: PRESIDENT_ID, organizationId: orgId, status: 'active' },
    ],
  });
  try {
    const ctx = makeCtx({
      user: { id: PRESIDENT_ID, role: 'user', twoFactorEnabled: true },
      organizationId: orgId,
      database: H.db,
      logger: noopLogger,
      _params: { electionId },
    });
    const res: any = await certifyElection(ctx);
    expect(res.status).toBe(200);
    return { body: res.body, presidentId: PRESIDENT_ID };
  } finally {
    restoreRepo(OfficerTermRepository);
  }
}

/**
 * Run the cross-module cascade for an `election.published` payload deterministically.
 *
 * certifyElection fires `domainEvents.emit('election.published', …).catch(()=>{})`
 * WITHOUT awaiting it, so we cannot observe its completion. Instead we capture the
 * exact payload certify would emit (the `winners` array it returned), then register
 * the REAL consumer onto H.db and `await domainEvents.emit(...)` ourselves so the
 * full cascade is complete (and its re-emitted officer.* events captured) before we
 * assert. The bus is reset first so only our wiring runs (no double cascade).
 */
async function runCascade(payload: {
  electionId: string;
  organizationId: string;
  publishedBy: string;
  winners: { positionId: string; winnerId: string }[];
}): Promise<{
  transitioned: any[];
  assigned: any[];
}> {
  domainEvents.reset();

  const transitioned: any[] = [];
  const assigned: any[] = [];
  domainEvents.on('officer.transitioned', async (p) => { transitioned.push(p); });
  domainEvents.on('officer.assigned', async (p) => { assigned.push(p); });

  // Wire the REAL election.published consumer (+ all others) onto the REAL H.db.
  registerDomainEventConsumers({ membershipRepo: noopMembershipRepo, db: H.db as any }, noopLogger);

  // emit() awaits Promise.allSettled of every handler, so the cascade — including
  // the re-emitted officer.* events captured above — is fully done when this resolves.
  await domainEvents.emit('election.published', payload);

  return { transitioned, assigned };
}

beforeAll(async () => {
  H = await createScratch([
    'person',
    'position',
    'officer_term',
    'transition_checklist',
    'election',
    'election_nominee',
    'election_vote',
  ]);
});

afterAll(async () => {
  restoreRepo(OfficerTermRepository);
  domainEvents.reset();
  await H?.teardown();
});

beforeEach(() => {
  // Each test wires its own consumers; clear cross-test handler accumulation.
  domainEvents.reset();
});

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT 1 — incumbent seat: certify → outgoing term ended, winner minted,
// checklist written, officer.transitioned emitted.
// ═══════════════════════════════════════════════════════════════════════════

describe('election.published cascade — incumbent seat (real DB)', () => {
  test('certify → ends outgoing term, mints winner term, writes checklist, emits officer.transitioned', async () => {
    if (!H.dbReachable) return;

    const orgId = freshId();
    const positionId = await insertPosition({ organizationId: orgId, title: 'President' });

    // An incumbent already holds the seat (the cascade must END this term).
    const incumbentId = await insertPerson();
    const outgoingTermId = await insertActiveTerm({ positionId, personId: incumbentId, organizationId: orgId });

    // Real election: winner gets 3 votes, loser gets 1.
    const scenario = await buildElection({ orgId, positionId, winnerVotes: 3, loserVotes: 1 });

    // ── PRODUCER: real certifyElection ──────────────────────────────────────
    const { body, presidentId } = await runCertifyAsPresident(scenario.electionId, orgId);

    // Election was actually flipped to published in Postgres.
    const electionRow = await readElection(scenario.electionId);
    expect(electionRow.status).toBe('published');
    expect(electionRow.published_at).not.toBeNull();

    // The winning nominee was marked elected (real row), the loser was not.
    expect(await nomineeStatus(scenario.winningNomineeId)).toBe('elected');
    expect(await nomineeStatus(scenario.losingNomineeId)).toBe('nominated');

    // certify computed the right winner (personId, not nomineeId — it maps nominee→person).
    expect(body.winners).toHaveLength(1);
    expect(body.winners[0]).toEqual({ positionId, winnerId: scenario.winningPersonId });

    // ── CONSUMER: real cascade on the same real DB ──────────────────────────
    const { transitioned, assigned } = await runCascade({
      electionId: scenario.electionId,
      organizationId: orgId,
      publishedBy: presidentId,
      winners: body.winners,
    });

    // 1. Outgoing term ENDED (status completed + end_date stamped) in Postgres.
    const outgoing = await readOfficerTerm(outgoingTermId);
    expect(outgoing.status).toBe('completed');
    expect(outgoing.end_date).not.toBeNull();

    // 2. A NEW active term exists for the WINNER on the contested position/org.
    const active = await activeTermsForPosition(positionId);
    expect(active).toHaveLength(1);
    const newTerm = active[0];
    expect(newTerm.id).not.toBe(outgoingTermId);
    expect(newTerm.person_id).toBe(scenario.winningPersonId);
    expect(newTerm.position_id).toBe(positionId);
    expect(newTerm.organization_id).toBe(orgId);
    expect(newTerm.start_date).not.toBeNull();
    expect(newTerm.notes).toContain(scenario.electionId);

    // 3. The 5 canonical transition-checklist rows were written against the OUTGOING term.
    const checklist = await checklistRowsForTerm(outgoingTermId);
    expect(checklist).toHaveLength(5);
    for (const row of checklist) {
      expect(row.status).toBe('pending');
      expect(row.organization_id).toBe(orgId);
      expect(typeof row.item).toBe('string');
      expect(row.item.length).toBeGreaterThan(0);
    }
    // No checklist was written against the freshly minted term.
    expect(await checklistRowsForTerm(newTerm.id)).toHaveLength(0);

    // 4. officer.transitioned was re-emitted with the right ids; officer.assigned was NOT.
    expect(assigned).toHaveLength(0);
    expect(transitioned).toHaveLength(1);
    expect(transitioned[0]).toMatchObject({
      outgoingTermId,
      newTermId: newTerm.id,
      outgoingPersonId: incumbentId,
      successorPersonId: scenario.winningPersonId,
      positionId,
      organizationId: orgId,
      transitionedBy: presidentId,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT 2 — vacant seat: certify → winner minted, NO outgoing term / checklist,
// officer.assigned emitted (not transitioned).
// ═══════════════════════════════════════════════════════════════════════════

describe('election.published cascade — vacant seat (real DB)', () => {
  test('certify with no incumbent → mints winner term, emits officer.assigned, writes no checklist', async () => {
    if (!H.dbReachable) return;

    const orgId = freshId();
    // No active officer_term seeded for this position → seat is vacant.
    const positionId = await insertPosition({ organizationId: orgId, title: 'Secretary' });

    const scenario = await buildElection({ orgId, positionId, winnerVotes: 2, loserVotes: 0 });

    const { body, presidentId } = await runCertifyAsPresident(scenario.electionId, orgId);
    expect(body.winners).toEqual([{ positionId, winnerId: scenario.winningPersonId }]);

    const { transitioned, assigned } = await runCascade({
      electionId: scenario.electionId,
      organizationId: orgId,
      publishedBy: presidentId,
      winners: body.winners,
    });

    // A single new active term for the winner exists.
    const active = await activeTermsForPosition(positionId);
    expect(active).toHaveLength(1);
    expect(active[0].person_id).toBe(scenario.winningPersonId);
    expect(active[0].position_id).toBe(positionId);
    expect(active[0].organization_id).toBe(orgId);

    // No checklist rows anywhere for this org (no outgoing term to hand over).
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".transition_checklist WHERE organization_id = $1`,
      [orgId],
    );
    expect(rows[0].n).toBe(0);

    // Vacant seat → officer.assigned (NOT transitioned).
    expect(transitioned).toHaveLength(0);
    expect(assigned).toHaveLength(1);
    expect(assigned[0]).toMatchObject({
      termId: active[0].id,
      personId: scenario.winningPersonId,
      positionId,
      organizationId: orgId,
      assignedBy: presidentId,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT 3 — no winners: a failed-threshold bylaw election publishes with an
// empty winners[] → the cascade is a NO-OP (no term touched, no event emitted).
// Proves the consumer doesn't mint/transition on a winner-less publish.
// ═══════════════════════════════════════════════════════════════════════════

describe('election.published cascade — winnerless publish is a no-op (real DB)', () => {
  test('bylaw election failing passageThreshold publishes with no winners → no term/checklist/event', async () => {
    if (!H.dbReachable) return;

    const orgId = freshId();
    const positionId = await insertPosition({ organizationId: orgId, title: 'Bylaw Amendment' });
    const incumbentId = await insertPerson();
    const outgoingTermId = await insertActiveTerm({ positionId, personId: incumbentId, organizationId: orgId });

    // Bylaw needing 80% of voters; winner has 1 of 2 voters = 50% < 80% → no winner.
    const scenario = await buildElection({
      orgId,
      positionId,
      winnerVotes: 1,
      loserVotes: 1,
      type: 'bylaw',
      passageThreshold: 80,
    });

    const { body, presidentId } = await runCertifyAsPresident(scenario.electionId, orgId);

    // Published, but with NO winners (threshold not cleared).
    expect((await readElection(scenario.electionId)).status).toBe('published');
    expect(body.winners).toHaveLength(0);
    // The top nominee was NOT marked elected (no winner crossed threshold).
    expect(await nomineeStatus(scenario.winningNomineeId)).toBe('nominated');

    const { transitioned, assigned } = await runCascade({
      electionId: scenario.electionId,
      organizationId: orgId,
      publishedBy: presidentId,
      winners: body.winners,
    });

    // The incumbent's active term is UNTOUCHED — no winner to transition to.
    const outgoing = await readOfficerTerm(outgoingTermId);
    expect(outgoing.status).toBe('active');
    expect(outgoing.end_date).toBeNull();

    // Still exactly the one (incumbent) active term — nothing minted.
    const active = await activeTermsForPosition(positionId);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(outgoingTermId);

    // No checklist, no events.
    expect(await checklistRowsForTerm(outgoingTermId)).toHaveLength(0);
    expect(transitioned).toHaveLength(0);
    expect(assigned).toHaveLength(0);
  });
});
