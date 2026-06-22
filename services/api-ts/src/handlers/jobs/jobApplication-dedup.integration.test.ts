/**
 * [M15] Slice 5 (W3 jobs S5) → W3 FOLLOW-UP S1 — duplicate-application dedup:
 * close the TOCTOU race with a DB-level unique index + 23505 backstop.
 *
 * Dedup for job applications was a check-then-create app-layer guard only:
 * createJobApplication.ts calls findByPersonAndPosting and 409s if a row already
 * exists. That guard works when serialized but races under concurrency — two
 * requests both read "no existing row" before either inserts (TOCTOU). The
 * original S5 CHARACTERIZED the gap (both concurrent inserts persisted, 2 rows).
 *
 * The W3 follow-up (independent review recommendation) closes the race:
 *   - migration 0084 adds UNIQUE INDEX (person_id, posting_id) — DB backstop.
 *   - createJobApplication catches the 23505 and re-throws the SAME ConflictError
 *     the serial guard returns, so the concurrent loser gets a clean 409 (not 500).
 *
 * Defense-in-depth: the serial app-layer guard is KEPT (avoids the round-trip in
 * the common case); the DB index is the authoritative backstop for the race.
 * sourceChanged=true, realBugFound=false (the serial guard already worked; this
 * closes the concurrent window + makes the loser a clean 409).
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

  test('CONCURRENT race: two raw create() for same (person, posting) → exactly ONE persists, loser raises 23505 (DB backstop)', async () => {
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
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );

    // FIX: the migration-0084 UNIQUE INDEX (person_id, posting_id) closes the
    // TOCTOU race. Exactly one insert wins; the loser is rejected by the DB.
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // The losing insert raised Postgres unique_violation (23505).
    const loser = rejected[0]!.reason as { code?: string; cause?: { code?: string } };
    const code = loser.code ?? loser.cause?.code;
    expect(code).toBe('23505');

    // Real data-layer proof: exactly ONE row for the (person, posting).
    expect(await countFor(posting.id, APPLICANT)).toBe(1);
  });

  test('DIFFERENT (person, posting) still inserts cleanly — unique index does not over-constrain', async () => {
    if (!H.dbReachable) return;
    const postingX = await activePosting('Distinct Role X');
    const postingY = await activePosting('Distinct Role Y');
    const appRepo = new JobApplicationRepository(H.db as never);

    const otherApplicant = '66666666-6666-6666-6666-666666666666';

    // Same person, DIFFERENT posting → allowed.
    const a = await appRepo.create({
      postingId: postingX.id,
      personId: APPLICANT,
      appliedAt: new Date(),
      status: 'applied',
    });
    // DIFFERENT person, same posting → allowed.
    const b = await appRepo.create({
      postingId: postingX.id,
      personId: otherApplicant,
      appliedAt: new Date(),
      status: 'applied',
    });
    // Same person again on yet another posting → allowed.
    const c = await appRepo.create({
      postingId: postingY.id,
      personId: APPLICANT,
      appliedAt: new Date(),
      status: 'applied',
    });

    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(c.id).toBeTruthy();
    expect(await countFor(postingX.id, APPLICANT)).toBe(1);
    expect(await countFor(postingX.id, otherApplicant)).toBe(1);
    expect(await countFor(postingY.id, APPLICANT)).toBe(1);
  });

  test('handler backstop: concurrent applies via createJobApplication → one 201, loser gets clean 409 (not 500)', async () => {
    if (!H.dbReachable) return;
    const posting = await activePosting('Handler Race Role');
    const racer = '77777777-7777-7777-7777-777777777777';

    // Two concurrent handler calls for the same (person, posting). Both pass the
    // check-then-create guard, but the DB unique index rejects the loser; the
    // handler's 23505 catch converts it to a 409 ConflictError, not an unhandled 500.
    const call = () =>
      createJobApplication(
        ctxFor({ org: ORG_A, personId: racer, body: { postingId: posting.id } }),
      );

    const [r1, r2] = await Promise.all([call(), call()]);
    const statuses = [r1.status, r2.status].sort();

    expect(statuses).toEqual([201, 409]);
    // Exactly one row persisted despite the concurrent double-apply.
    expect(await countFor(posting.id, racer)).toBe(1);
  });
});
