/**
 * [M15] Slice 5 (W3 jobs S5) — duplicate-application dedup: characterize + flag the race.
 *
 * Dedup for job applications is a check-then-create app-layer guard:
 * createJobApplication.ts:34-37 calls findByPersonAndPosting and 409s if a row
 * already exists. There is NO unique index on (person_id, posting_id) — the live
 * catalog shows only the pkey + 3 plain btree indexes. So:
 *   - SERIALIZED: the app guard works — a second apply 409s, exactly one row.
 *   - CONCURRENT (TOCTOU): two appRepo.create for the same (person, posting) can
 *     both insert. Nothing at the DB layer stops it.
 *
 * This slice CHARACTERIZES both behaviors against real PG and flags the missing
 * DB-level dedup as a data-integrity gap. We deliberately do NOT add a unique
 * index here — that is a schema change requiring a pre-backfill dedupe migration
 * (and would surface 23505 for the losing insert). Recommended as a follow-up,
 * out of scope for the floor-40 ratchet. realBugFound=false (characterize+flag).
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { makeCtx } from '@/test-utils/make-ctx';
import { createJobApplication } from './createJobApplication';
import { JobPostingRepository, JobApplicationRepository } from './repos/jobs.repo';

const ORG_A = '44444444-4444-4444-4444-444444444444';
const APPLICANT = '55555555-5555-5555-5555-555555555555';

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(['job_posting', 'job_application']);
});

afterAll(async () => {
  await H?.teardown();
});

function ctxFor(opts: { org: string; personId: string; body: Record<string, unknown> }) {
  return makeCtx({
    database: H.db,
    organizationId: opts.org,
    user: { id: opts.personId, role: 'user', twoFactorEnabled: true },
    session: { id: 'session-1', userId: opts.personId, user: { id: opts.personId } },
    _body: opts.body,
    _params: {},
  });
}

async function activePosting(title: string) {
  const postingRepo = new JobPostingRepository(H.db as never);
  return postingRepo.create({
    organizationId: ORG_A,
    title,
    organizationName: 'Org A',
    type: 'full_time',
    status: 'active',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
}

async function countFor(postingId: string, personId: string): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS c FROM "${H.schema}".job_application WHERE posting_id=$1 AND person_id=$2`,
    [postingId, personId],
  );
  return rows[0].c as number;
}

describe('[M15] job-application dedup — app-layer guard vs no DB unique index (real PG)', () => {
  test('SERIALIZED: second apply for same (person, posting) → 409 already applied, exactly one row', async () => {
    if (!H.dbReachable) return;
    const posting = await activePosting('Serialized Dedup Role');

    const first = await createJobApplication(
      ctxFor({ org: ORG_A, personId: APPLICANT, body: { postingId: posting.id } }),
    );
    expect(first.status).toBe(201);

    const second = await createJobApplication(
      ctxFor({ org: ORG_A, personId: APPLICANT, body: { postingId: posting.id } }),
    );
    expect(second.status).toBe(409);
    expect((second as { body: { error: string } }).body.error).toContain('already applied');

    // The app-layer guard held when serialized: exactly one row persisted.
    expect(await countFor(posting.id, APPLICANT)).toBe(1);
  });

  test('CONCURRENT race: two raw create() for same (person, posting) BOTH persist — no DB dedup (GAP)', async () => {
    if (!H.dbReachable) return;
    const posting = await activePosting('Race Dedup Role');
    const appRepo = new JobApplicationRepository(H.db as never);

    // Fire two inserts for the SAME (person, posting) concurrently, bypassing the
    // handler's check-then-create guard (which a real two-request race also bypasses
    // because both requests read "no existing row" before either inserts).
    const make = () =>
      appRepo.create({
        postingId: posting.id,
        personId: APPLICANT,
        appliedAt: new Date(),
        status: 'applied',
      });

    const results = await Promise.allSettled([make(), make()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // GAP: BOTH inserts succeed today. There is no unique (person_id, posting_id)
    // index, so the DB does not reject the duplicate. If a follow-up migration adds
    // the partial-unique index, the loser would reject with 23505 and this assert
    // would flip — that is the intended forcing function for the fix.
    expect(fulfilled.length).toBe(2);
    expect(rejected.length).toBe(0);

    // Real data-layer proof of the duplicate: two rows for the same (person, posting).
    expect(await countFor(posting.id, APPLICANT)).toBe(2);
  });
});
