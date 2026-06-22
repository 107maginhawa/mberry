/**
 * [M15] Slice 4 (W3 jobs S4) — Cross-org IDOR seam against REAL PostgreSQL.
 *
 * job_application carries no org column; createJobApplication/updateJobApplication
 * derive the org from the parent posting and treat a posting outside the caller's
 * org as missing (404). This was previously asserted only against stub repos. Here
 * we drive the REAL handlers against the REAL repos via createScratch with a
 * genuine two-org dataset, and assert the data-layer outcome (persisted rows /
 * read-back status), not just the HTTP code.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { makeCtx } from '@/test-utils/make-ctx';
import { createJobApplication } from './createJobApplication';
import { updateJobApplication } from './updateJobApplication';
import { JobPostingRepository, JobApplicationRepository } from './repos/jobs.repo';

const ORG_A = '11111111-1111-1111-1111-111111111111';
const ORG_B = '22222222-2222-2222-2222-222222222222';
const APPLICANT = '33333333-3333-3333-3333-333333333333';

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(['job_posting', 'job_application']);
});

afterAll(async () => {
  await H?.teardown();
});

function ctxFor(opts: {
  org: string;
  personId: string;
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
}) {
  return makeCtx({
    database: H.db,
    organizationId: opts.org,
    user: { id: opts.personId, role: 'user', twoFactorEnabled: true },
    session: { id: 'session-1', userId: opts.personId, user: { id: opts.personId } },
    _body: opts.body ?? {},
    _params: opts.params ?? {},
  });
}

async function countApplications(): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS c FROM "${H.schema}".job_application`,
  );
  return rows[0].c as number;
}

describe('[M15] cross-org IDOR — createJobApplication / updateJobApplication (real PG)', () => {
  test('cross-org apply by UUID → 404, zero application rows persisted (IDOR guard)', async () => {
    if (!H.dbReachable) return;
    const postingRepo = new JobPostingRepository(H.db as never);

    // org-B owns an active, non-expired posting.
    const orgBPosting = await postingRepo.create({
      organizationId: ORG_B,
      title: 'Org B Engineer',
      organizationName: 'Org B',
      type: 'full_time',
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const before = await countApplications();
    // Caller scoped to org-A tries to apply to org-B's posting by its real UUID.
    const ctx = ctxFor({ org: ORG_A, personId: APPLICANT, body: { postingId: orgBPosting.id } });
    const res = await createJobApplication(ctx);

    expect(res.status).toBe(404);
    expect((res as { body: { error: string } }).body.error).toContain('not found');
    // Real data-layer proof: NOTHING was inserted.
    const after = await countApplications();
    expect(after).toBe(before);
    // And specifically no row for this (person, posting).
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS c FROM "${H.schema}".job_application WHERE posting_id=$1 AND person_id=$2`,
      [orgBPosting.id, APPLICANT],
    );
    expect(rows[0].c).toBe(0);
  });

  test('same-org apply to active posting → 201, exactly one row with correct person/posting/status', async () => {
    if (!H.dbReachable) return;
    const postingRepo = new JobPostingRepository(H.db as never);

    const orgAPosting = await postingRepo.create({
      organizationId: ORG_A,
      title: 'Org A Engineer',
      organizationName: 'Org A',
      type: 'full_time',
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const ctx = ctxFor({ org: ORG_A, personId: APPLICANT, body: { postingId: orgAPosting.id } });
    const res = await createJobApplication(ctx);
    expect(res.status).toBe(201);

    const { rows } = await H.scopedPool.query(
      `SELECT person_id, posting_id, status FROM "${H.schema}".job_application WHERE posting_id=$1 AND person_id=$2`,
      [orgAPosting.id, APPLICANT],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].person_id).toBe(APPLICANT);
    expect(rows[0].posting_id).toBe(orgAPosting.id);
    expect(rows[0].status).toBe('applied');
  });

  test('apply to draft (non-active) posting → 409 not accepting, zero rows', async () => {
    if (!H.dbReachable) return;
    const postingRepo = new JobPostingRepository(H.db as never);

    const draft = await postingRepo.create({
      organizationId: ORG_A,
      title: 'Org A Draft',
      organizationName: 'Org A',
      type: 'full_time',
      status: 'draft',
    });

    const ctx = ctxFor({ org: ORG_A, personId: APPLICANT, body: { postingId: draft.id } });
    const res = await createJobApplication(ctx);
    expect(res.status).toBe(409);
    expect((res as { body: { error: string } }).body.error).toContain('not accepting');

    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS c FROM "${H.schema}".job_application WHERE posting_id=$1`,
      [draft.id],
    );
    expect(rows[0].c).toBe(0);
  });

  test('apply to active posting with past expires_at → 409 expired, zero rows', async () => {
    if (!H.dbReachable) return;
    const postingRepo = new JobPostingRepository(H.db as never);

    const expired = await postingRepo.create({
      organizationId: ORG_A,
      title: 'Org A Expired',
      organizationName: 'Org A',
      type: 'full_time',
      status: 'active',
      expiresAt: new Date('2020-01-01T00:00:00Z'),
    });

    const ctx = ctxFor({ org: ORG_A, personId: APPLICANT, body: { postingId: expired.id } });
    const res = await createJobApplication(ctx);
    expect(res.status).toBe(409);
    expect((res as { body: { error: string } }).body.error).toContain('expired');

    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS c FROM "${H.schema}".job_application WHERE posting_id=$1`,
      [expired.id],
    );
    expect(rows[0].c).toBe(0);
  });

  test('updateJobApplication on app whose parent posting is org-B → 404, row status UNCHANGED', async () => {
    if (!H.dbReachable) return;
    const postingRepo = new JobPostingRepository(H.db as never);
    const appRepo = new JobApplicationRepository(H.db as never);

    // org-B posting + an application against it, persisted directly.
    const orgBPosting = await postingRepo.create({
      organizationId: ORG_B,
      title: 'Org B Role',
      organizationName: 'Org B',
      type: 'full_time',
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    const app = await appRepo.create({
      postingId: orgBPosting.id,
      personId: APPLICANT,
      appliedAt: new Date(),
      status: 'applied',
    });

    // Caller scoped to org-A tries to update org-B's application by its UUID.
    const ctx = ctxFor({
      org: ORG_A,
      personId: APPLICANT,
      params: { applicationId: app.id },
      body: { status: 'rejected' },
    });
    const res = await updateJobApplication(ctx);
    expect(res.status).toBe(404);

    // Real read-back: the status was NOT mutated by the cross-org caller.
    const { rows } = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".job_application WHERE id=$1`,
      [app.id],
    );
    expect(rows[0].status).toBe('applied');
  });
});
