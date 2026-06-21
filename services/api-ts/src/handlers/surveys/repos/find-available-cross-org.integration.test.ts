/**
 * surveys Slice 3 (Wave-2 cluster B2, content) — findAvailableForMember
 * cross-org isolation + LEFT-JOIN dedup, against real Postgres.
 *
 * `SurveyRepository.findAvailableForMember` (survey.repo.ts:139-199) is the
 * member-facing /my/surveys availability query. It is the highest-confidentiality
 * surface in the module: it scopes the result to the orgs the member ACTUALLY
 * belongs to via `inArray(surveys.organizationId, <membership subquery>)`, so a
 * regression there would leak active surveys from foreign orgs. Its only prior
 * test was a `fakeDb()` chain asserting `db.__calls.leftJoin === true` — i.e. it
 * proved a builder flag was set, NOT that the SQL excludes foreign-org rows.
 *
 * This suite drives the REAL repo against scratch Postgres (membership subquery,
 * the active-status filter, the optional org narrowing, the surveyType narrowing,
 * and the per-member LEFT JOIN onto survey_response) and asserts the persisted
 * result set — proving ZERO foreign-org rows ever appear. Classification:
 * characterization (the source looks correct but is wholly unproven); the value
 * is catching a future regression into a cross-org leak. Skips when DB
 * unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  createContentScratch,
  CONTENT_ORG,
  seedOrg,
  seedPerson,
  seedMembership,
  seedSurvey,
  seedSurveyResponse,
} from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { SurveyRepository } from './survey.repo';

let H: ScratchDb;
let repo: SurveyRepository;

// A distinct org the member does NOT belong to (cross-org leak target).
const ORG_B = seedOrg('00000000-0000-4000-8000-00000000b002');

const PAGE = { pagination: { limit: 50, offset: 0 } };

beforeAll(async () => {
  H = await createContentScratch();
  if (!H.dbReachable) return;
  repo = new SurveyRepository(H.db as never);
});
afterAll(async () => {
  await H?.teardown();
});

describe('findAvailableForMember — cross-org isolation (real PG)', () => {
  test('member in orgA ONLY → returns EXACTLY the orgA active survey, zero orgB rows', async () => {
    if (!H.dbReachable) return;
    const member = await seedPerson(H);
    await seedMembership(H, { personId: member.id, organizationId: CONTENT_ORG });

    const surveyA = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    // An active survey in an org the member does NOT belong to — must never leak.
    await seedSurvey(H, { organizationId: ORG_B, status: 'active' });

    const res = await repo.findAvailableForMember(undefined, member.id, PAGE);

    expect(res.totalCount).toBe(1);
    expect(res.data.length).toBe(1);
    expect(res.data[0]!.id).toBe(surveyA.id);
    // The membership-subquery boundary: no foreign-org row may appear.
    expect(res.data.every((s) => s.organizationId === CONTENT_ORG)).toBe(true);
  });

  test('org narrowing arg = an org the member is NOT in → ZERO rows (narrowing restricts, never widens)', async () => {
    if (!H.dbReachable) return;
    const member = await seedPerson(H);
    await seedMembership(H, { personId: member.id, organizationId: CONTENT_ORG });
    // Active survey exists in BOTH orgs; member belongs to CONTENT_ORG only.
    await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    await seedSurvey(H, { organizationId: ORG_B, status: 'active' });

    // Pass ORG_B as the narrowing arg. Even though an active survey exists there,
    // the membership subquery excludes it, so the AND yields nothing.
    const res = await repo.findAvailableForMember(ORG_B, member.id, PAGE);
    expect(res.totalCount).toBe(0);
    expect(res.data.length).toBe(0);
  });

  test('a draft orgA survey is excluded; flipping it to active makes it appear', async () => {
    if (!H.dbReachable) return;
    const member = await seedPerson(H);
    await seedMembership(H, { personId: member.id, organizationId: CONTENT_ORG });

    const draft = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'draft' });

    const before = await repo.findAvailableForMember(undefined, member.id, PAGE);
    expect(before.data.some((s) => s.id === draft.id)).toBe(false);

    // Flip to active — the status='active' filter now admits it.
    await H.scopedPool.query(
      `UPDATE "${H.schema}".survey SET status = 'active' WHERE id = $1`,
      [draft.id],
    );

    const after = await repo.findAvailableForMember(undefined, member.id, PAGE);
    const found = after.data.find((s) => s.id === draft.id);
    expect(found).toBeDefined();
    expect(found!.status).toBe('active');
  });

  test('LEFT-JOIN dedup: a completed response → ONE row with myResponseStatus=completed; an unanswered survey → null', async () => {
    if (!H.dbReachable) return;
    const member = await seedPerson(H);
    await seedMembership(H, { personId: member.id, organizationId: CONTENT_ORG });

    const answered = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    const unanswered = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });

    await seedSurveyResponse(H, {
      surveyId: answered.id,
      responderId: member.id,
      organizationId: CONTENT_ORG,
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    const res = await repo.findAvailableForMember(undefined, member.id, PAGE);

    // The answered survey appears EXACTLY ONCE (LEFT JOIN keyed on responderId,
    // not a fan-out) carrying the member's response status.
    const answeredRows = res.data.filter((s) => s.id === answered.id);
    expect(answeredRows.length).toBe(1);
    expect(answeredRows[0]!.myResponseStatus).toBe('completed');
    expect(answeredRows[0]!.myCompletedAt).not.toBeNull();

    // The unanswered active survey appears with null response status (the
    // per-member LEFT JOIN yields nulls for the missing side).
    const unansweredRow = res.data.find((s) => s.id === unanswered.id);
    expect(unansweredRow).toBeDefined();
    expect(unansweredRow!.myResponseStatus).toBeNull();
    expect(unansweredRow!.myCompletedAt).toBeNull();
  });

  test('LEFT-JOIN is per-member: another member\'s completed response does NOT attach to my row', async () => {
    if (!H.dbReachable) return;
    const me = await seedPerson(H);
    const other = await seedPerson(H);
    await seedMembership(H, { personId: me.id, organizationId: CONTENT_ORG });

    const survey = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    // A DIFFERENT member completed this survey — the join keys on MY responderId,
    // so my row must still read null (no cross-member status bleed).
    await seedSurveyResponse(H, {
      surveyId: survey.id,
      responderId: other.id,
      organizationId: CONTENT_ORG,
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    const res = await repo.findAvailableForMember(undefined, me.id, PAGE);
    const row = res.data.filter((s) => s.id === survey.id);
    expect(row.length).toBe(1); // no fan-out from the other member's response
    expect(row[0]!.myResponseStatus).toBeNull();
  });

  test('surveyType opt narrows to matching survey_type only', async () => {
    if (!H.dbReachable) return;
    const member = await seedPerson(H);
    await seedMembership(H, { personId: member.id, organizationId: CONTENT_ORG });

    const poll = await seedSurvey(H, {
      organizationId: CONTENT_ORG,
      status: 'active',
      surveyType: 'poll',
    });
    const feedback = await seedSurvey(H, {
      organizationId: CONTENT_ORG,
      status: 'active',
      surveyType: 'feedback',
    });

    const res = await repo.findAvailableForMember(undefined, member.id, {
      surveyType: 'poll',
      pagination: { limit: 50, offset: 0 },
    });

    expect(res.data.some((s) => s.id === poll.id)).toBe(true);
    expect(res.data.some((s) => s.id === feedback.id)).toBe(false);
    expect(res.data.every((s) => s.surveyType === 'poll')).toBe(true);
    expect(res.totalCount).toBe(1);
  });
});
