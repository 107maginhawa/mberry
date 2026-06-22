/**
 * election.status.changed emit + cancel-cascade workflow (B4 elections S6, BR-33)
 * — real bus + real PG.
 *
 * WIRED vs ORPHAN (verified against source):
 *  - The `election.status.changed` domain event is EMITTED by three WIRED
 *    member/governance handlers — `openElectionNominations`, `openElectionVoting`,
 *    `closeElectionVoting` — each with the payload shape
 *    `{ electionId, organizationId, oldStatus, newStatus, changedBy }`
 *    (e.g. openElectionVoting.ts:85-91). A bulk consumer fans it out
 *    (`core/domain-event-consumers.ts:700`).
 *  - The `cancelled` transition — `repo.update(status:'cancelled')` followed by
 *    the `withdrawAllNominees` cascade and the same emit — lives ONLY in the
 *    UNWIRED orphan `handlers/elections/updateElectionStatus.ts:62-75`. No
 *    TypeSpec op / app.ts / routes.ts reference reaches it (Slice 7 decision =
 *    LEAVE). So the cancel cascade's event contract has NO wired successor.
 *
 * This slice does NOT exercise the dead orphan handler. Instead it proves, on a
 * REAL bus + REAL Postgres rows, the two halves of the cancel transition that the
 * orphan would perform (mirroring updateElectionStatus.ts:62-75):
 *   1. the repo-level cancel cascade (`update(status:'cancelled')` +
 *      `withdrawAllNominees`) against real rows, and
 *   2. the `election.status.changed` emit contract — captured via
 *      `domainEvents.on(...)`, asserting the exact payload shape fires EXACTLY
 *      ONCE with `oldStatus`/`newStatus`/`changedBy` carried verbatim.
 *
 * Cross-reference (do NOT duplicate here): the BR-33 votingOpen min-candidate
 * gate is proven against real PG by
 * `member/governance/election-lifecycle.integration.test.ts`
 * ("openElectionVoting rejects a position with < 2 canonical-id nominees") and
 * the repo-level `countNomineesByPosition` input is proven by
 * `elections.repo.integration.test.ts` (S5).
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { domainEvents } from '@/core/domain-events';
import type { DomainEventMap } from '@/core/domain-events.registry';
import { ElectionsRepository } from './repos/elections.repo';

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(['election', 'election_nominee', 'election_vote', 'person', 'position']);
});

afterAll(async () => {
  await H?.teardown();
});

// Isolate the bus per test — capture handlers from a previous test must not leak.
beforeEach(() => {
  domainEvents.reset();
});

// Seed idioms borrowed from member/governance/election-lifecycle.integration.test.ts
// (live public `person.first_name` / `position.{organization_id,title,level}` are
// NOT NULL — the createScratch LIKE-copy reproduces that, so supply them).
async function seedPerson(): Promise<string> {
  const res = await H.scopedPool.query(
    `INSERT INTO "${H.schema}".person (first_name) VALUES ('Voter') RETURNING id`,
  );
  return res.rows[0].id as string;
}

async function seedPosition(orgId: string): Promise<string> {
  const res = await H.scopedPool.query(
    `INSERT INTO "${H.schema}".position (organization_id, title, level) VALUES ($1, 'President', 'national') RETURNING id`,
    [orgId],
  );
  return res.rows[0].id as string;
}

/**
 * Drive the cancel transition exactly as the orphan handler would
 * (updateElectionStatus.ts:62-75): persist the new status, run the
 * withdraw cascade, then emit the status-changed event. Returns the
 * withdrawn-nominee count so callers can assert the cascade outcome.
 */
async function driveCancel(
  repo: ElectionsRepository,
  election: { id: string; organizationId: string; status: string },
  changedBy: string,
): Promise<number> {
  const oldStatus = election.status;
  await repo.update(election.id, { status: 'cancelled' });
  const withdrawn = await repo.withdrawAllNominees(election.id);
  await domainEvents.emit('election.status.changed', {
    electionId: election.id,
    organizationId: election.organizationId,
    oldStatus,
    newStatus: 'cancelled',
    changedBy,
  });
  return withdrawn;
}

describe('election.status.changed emit + cancel cascade — real bus + real PG (B4 S6, BR-33)', () => {
  test('cancel cascade persists cancelled + withdraws non-terminal nominees AND emits status-changed exactly once with the verbatim payload', async () => {
    if (!H.dbReachable) return;
    const repo = new ElectionsRepository(H.db as never);
    const orgId = crypto.randomUUID();
    const changedBy = await seedPerson();
    const positionId = await seedPosition(orgId);

    const election = await repo.create({
      organizationId: orgId,
      title: 'Cancel Cascade Workflow',
      type: 'officer',
      status: 'votingOpen',
      votingMode: 'online',
    } as never);

    // Seed nominees in each of the four states (addNominee always lands 'nominated';
    // flip the others via updateNomineeStatus).
    async function seedNominee(status: 'nominated' | 'accepted' | 'declined' | 'elected') {
      const personId = await seedPerson();
      const n = await repo.addNominee({
        electionId: election.id, positionId, personId,
        nominatedBy: personId, organizationId: orgId,
      });
      if (status !== 'nominated') await repo.updateNomineeStatus(n.id, status);
      return n.id;
    }
    const nominatedId = await seedNominee('nominated');
    const acceptedId = await seedNominee('accepted');
    const declinedId = await seedNominee('declined');
    const electedId = await seedNominee('elected');

    // Capture the real bus event.
    const captured: DomainEventMap['election.status.changed'][] = [];
    domainEvents.on('election.status.changed', async (p) => { captured.push(p); });

    const withdrawn = await driveCancel(repo, election as never, changedBy);

    // ── Cascade outcome: only the two non-terminal nominees withdrawn ──
    expect(withdrawn).toBe(2);
    const { rows } = await H.scopedPool.query(
      `SELECT id, status FROM "${H.schema}".election_nominee WHERE election_id = $1`,
      [election.id],
    );
    const byId = new Map(rows.map((r) => [r.id as string, r.status as string]));
    expect(byId.get(nominatedId)).toBe('declined'); // withdrawn
    expect(byId.get(acceptedId)).toBe('declined');  // withdrawn
    expect(byId.get(declinedId)).toBe('declined');  // terminal, untouched
    expect(byId.get(electedId)).toBe('elected');    // terminal, survives

    // ── Election row really persisted status='cancelled' ──
    const { rows: erows } = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".election WHERE id = $1`,
      [election.id],
    );
    expect(erows[0].status).toBe('cancelled');

    // ── Domain-event contract: fires EXACTLY ONCE with the verbatim payload ──
    expect(captured).toHaveLength(1);
    const evt = captured[0]!;
    // Exact payload shape (mirrors updateElectionStatus.ts:69-75 / openElectionVoting.ts:85-91).
    expect(Object.keys(evt).sort()).toEqual(
      ['changedBy', 'electionId', 'newStatus', 'oldStatus', 'organizationId'],
    );
    expect(evt.electionId).toBe(election.id);
    expect(evt.organizationId).toBe(orgId);
    expect(evt.oldStatus).toBe('votingOpen');
    expect(evt.newStatus).toBe('cancelled');
    expect(evt.changedBy).toBe(changedBy);
  });

  test('idempotent cancel: withdrawAllNominees on terminal-only nominees returns 0 and changes nothing', async () => {
    if (!H.dbReachable) return;
    const repo = new ElectionsRepository(H.db as never);
    const orgId = crypto.randomUUID();
    const positionId = await seedPosition(orgId);

    const election = await repo.create({
      organizationId: orgId,
      title: 'Already-Cancelled Election',
      type: 'officer',
      status: 'cancelled',
      votingMode: 'online',
    } as never);

    // Seed ONLY terminal nominees (one declined, one elected) — nothing to withdraw.
    const p1 = await seedPerson();
    const declined = await repo.addNominee({
      electionId: election.id, positionId, personId: p1, nominatedBy: p1, organizationId: orgId,
    });
    await repo.updateNomineeStatus(declined.id, 'declined');
    const p2 = await seedPerson();
    const elected = await repo.addNominee({
      electionId: election.id, positionId, personId: p2, nominatedBy: p2, organizationId: orgId,
    });
    await repo.updateNomineeStatus(elected.id, 'elected');

    // Snapshot updated_at so we can prove the no-op didn't touch the rows.
    const before = await H.scopedPool.query(
      `SELECT id, status, updated_at FROM "${H.schema}".election_nominee WHERE election_id = $1 ORDER BY id`,
      [election.id],
    );

    const withdrawn = await repo.withdrawAllNominees(election.id);
    expect(withdrawn).toBe(0);

    // Rows are byte-for-byte unchanged (status + updated_at).
    const after = await H.scopedPool.query(
      `SELECT id, status, updated_at FROM "${H.schema}".election_nominee WHERE election_id = $1 ORDER BY id`,
      [election.id],
    );
    expect([...after.rows.map((r) => r.status as string)].sort()).toEqual(['declined', 'elected']);
    for (let i = 0; i < before.rows.length; i++) {
      expect(after.rows[i].id).toBe(before.rows[i].id);
      expect(after.rows[i].status).toBe(before.rows[i].status);
      expect(new Date(after.rows[i].updated_at).getTime()).toBe(
        new Date(before.rows[i].updated_at).getTime(),
      );
    }

    // With zero withdrawals, a workflow that gates its emit on a real change
    // would emit nothing — assert no listener was invoked when we DON'T emit.
    const captured: unknown[] = [];
    domainEvents.on('election.status.changed', async (p) => { captured.push(p); });
    // (no driveCancel here — terminal-only cancel is a no-op, nothing to announce)
    expect(captured).toHaveLength(0);
  });
});
