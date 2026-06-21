/**
 * surveys Slice 2 (Wave-2 cluster B2, content) — survey_response dedup
 * constraint + anonymous-NULL exception, against real Postgres.
 *
 * Characterizes the live DB invariants the fake-db chain test could never
 * touch:
 *   - `survey_responses_survey_responder_unique` = plain UNIQUE(survey_id,
 *     responder_id). Two ATTRIBUTED responses by the same person to the same
 *     survey raise 23505; but two ANONYMOUS responses (responder_id=NULL)
 *     coexist because SQL treats NULLs as distinct.
 *   - org_id / survey_id are NOT NULL → 23502 (characterization, no migration).
 *   - SurveyResponseRepository.findByResponderAndSurvey resolves the attributed
 *     row and returns undefined for a non-responder.
 *
 * Drives the REAL SurveyResponseRepository.submitResponse insert path (not raw
 * SQL) so the 23505 is the production write path's, and asserts the raw
 * Postgres error code — never a stubbed throw. Skips when DB unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  createContentScratch,
  CONTENT_ORG,
  seedPerson,
  seedSurvey,
  seedSurveyResponse,
} from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { SurveyResponseRepository } from './survey.repo';
import type { NewSurveyResponse } from './survey.schema';

let H: ScratchDb;
let responses: SurveyResponseRepository;

beforeAll(async () => {
  H = await createContentScratch();
  if (!H.dbReachable) return;
  responses = new SurveyResponseRepository(H.db as never);
});
afterAll(async () => {
  await H?.teardown();
});

/** Extract the Postgres SQLSTATE off either the error or its drizzle `.cause`. */
function pgCode(e: unknown): string | undefined {
  return (
    (e as { code?: string; cause?: { code?: string } }).code ??
    (e as { cause?: { code?: string } }).cause?.code
  );
}

function responseData(o: Partial<NewSurveyResponse> = {}): NewSurveyResponse {
  return {
    organizationId: CONTENT_ORG,
    surveyId: crypto.randomUUID(),
    answers: [{ questionId: 'q1', value: 9 }],
    ...o,
  } as NewSurveyResponse;
}

describe('survey_response dedup — survey_responses_survey_responder_unique (real PG)', () => {
  test('two ATTRIBUTED inserts with the same (survey_id, responder_id) → second raises 23505', async () => {
    if (!H.dbReachable) return;
    const survey = await seedSurvey(H);
    const responder = await seedPerson(H);

    // First attributed response persists via the real repo write path.
    const first = await responses.submitResponse(
      responseData({ surveyId: survey.id, responderId: responder.id }),
    );
    expect(first.responderId).toBe(responder.id);

    // Second attributed response for the SAME (survey, responder) must collide.
    let code: string | undefined;
    try {
      await responses.submitResponse(
        responseData({ surveyId: survey.id, responderId: responder.id }),
      );
      throw new Error('expected unique-violation, but the insert succeeded');
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23505');

    // Exactly one row survives for that (survey, responder).
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".survey_response
        WHERE survey_id = $1 AND responder_id = $2`,
      [survey.id, responder.id],
    );
    expect(rows[0].n).toBe(1);
  });

  test('TWO anonymous inserts (same survey_id, responder_id=NULL) BOTH succeed — NULLs distinct → count=2', async () => {
    if (!H.dbReachable) return;
    const survey = await seedSurvey(H);

    const a = await responses.submitResponse(
      responseData({ surveyId: survey.id, responderId: null as never }),
    );
    const b = await responses.submitResponse(
      responseData({ surveyId: survey.id, responderId: null as never }),
    );
    expect(a.id).not.toBe(b.id);
    expect(a.responderId).toBeNull();
    expect(b.responderId).toBeNull();

    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".survey_response
        WHERE survey_id = $1 AND responder_id IS NULL`,
      [survey.id],
    );
    expect(rows[0].n).toBe(2);
  });

  test('same person ATTRIBUTED to TWO DIFFERENT surveys → both succeed (key is the pair)', async () => {
    if (!H.dbReachable) return;
    const surveyA = await seedSurvey(H);
    const surveyB = await seedSurvey(H);
    const responder = await seedPerson(H);

    const ra = await responses.submitResponse(
      responseData({ surveyId: surveyA.id, responderId: responder.id }),
    );
    const rb = await responses.submitResponse(
      responseData({ surveyId: surveyB.id, responderId: responder.id }),
    );
    expect(ra.surveyId).toBe(surveyA.id);
    expect(rb.surveyId).toBe(surveyB.id);

    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".survey_response
        WHERE responder_id = $1`,
      [responder.id],
    );
    expect(rows[0].n).toBe(2);
  });

  test('organization_id NULL → 23502 (NOT NULL characterization)', async () => {
    if (!H.dbReachable) return;
    const survey = await seedSurvey(H);
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".survey_response (id, organization_id, survey_id, responder_id)
         VALUES ($1, NULL, $2, NULL)`,
        [crypto.randomUUID(), survey.id],
      );
      throw new Error('expected NOT-NULL violation, but the insert succeeded');
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23502');
  });

  test('survey_id NULL → 23502 (NOT NULL characterization)', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".survey_response (id, organization_id, survey_id, responder_id)
         VALUES ($1, $2, NULL, NULL)`,
        [crypto.randomUUID(), CONTENT_ORG],
      );
      throw new Error('expected NOT-NULL violation, but the insert succeeded');
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23502');
  });

  test('findByResponderAndSurvey resolves the attributed row; undefined for a non-responder', async () => {
    if (!H.dbReachable) return;
    const survey = await seedSurvey(H);
    const responder = await seedPerson(H);
    const stranger = await seedPerson(H);
    const seeded = await seedSurveyResponse(H, {
      surveyId: survey.id,
      responderId: responder.id,
      organizationId: CONTENT_ORG,
      status: 'completed',
    });

    const found = await responses.findByResponderAndSurvey(responder.id, survey.id);
    expect(found?.id).toBe(seeded.id);
    expect(found?.responderId).toBe(responder.id);
    expect(found?.surveyId).toBe(survey.id);

    const missing = await responses.findByResponderAndSurvey(stranger.id, survey.id);
    expect(missing).toBeUndefined();
  });
});
