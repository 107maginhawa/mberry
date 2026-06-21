/**
 * surveys Slice 1 (Wave-2 cluster B2, content) — content-fixtures survey/response
 * seed helpers self-test against real Postgres.
 *
 * Proves the new `seedSurvey` / `seedSurveyResponse` helpers (appended to
 * content-fixtures.ts) persist real rows with the correct columns + JSONB shape,
 * and that `seedMembership` (reviews S1) satisfies every NOT-NULL column. These
 * helpers are the foundation the surveys S2-S7 real-PG slices build on. Skips
 * cleanly when DB unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  createContentScratch,
  CONTENT_ORG,
  seedPerson,
  seedMembership,
  seedSurvey,
  seedSurveyResponse,
} from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
beforeAll(async () => {
  H = await createContentScratch();
});
afterAll(async () => {
  await H?.teardown();
});

describe('surveys fixtures — seedSurvey / seedSurveyResponse / seedMembership (real PG)', () => {
  test('suite reachability guard is a boolean', () => {
    expect(typeof H.dbReachable).toBe('boolean');
  });

  test('seedSurvey persists status, survey_type, org, and defaults questions/settings to []/{}', async () => {
    if (!H.dbReachable) return;
    const s = await seedSurvey(H, {
      organizationId: CONTENT_ORG,
      status: 'active',
      surveyType: 'poll',
    });
    const { rows } = await H.scopedPool.query(
      `SELECT status, survey_type, organization_id, questions, settings
         FROM "${H.schema}".survey WHERE id = $1`,
      [s.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('active');
    expect(rows[0].survey_type).toBe('poll');
    expect(rows[0].organization_id).toBe(CONTENT_ORG);
    // DB defaults applied (omitted in opts) — empty array / empty object JSONB.
    expect(rows[0].questions).toEqual([]);
    expect(rows[0].settings).toEqual({});
    // return value mirrors persisted row
    expect(s.status).toBe('active');
    expect(s.surveyType).toBe('poll');
    expect(s.organizationId).toBe(CONTENT_ORG);
  });

  test('seedSurvey round-trips explicit questions/settings JSONB', async () => {
    if (!H.dbReachable) return;
    const questions = [{ id: 'q1', type: 'nps', text: 'How likely?', required: true, order: 0 }];
    const settings = { anonymous: true, allowReedit: false };
    const s = await seedSurvey(H, { questions, settings });
    const { rows } = await H.scopedPool.query(
      `SELECT questions, settings FROM "${H.schema}".survey WHERE id = $1`,
      [s.id],
    );
    expect(rows[0].questions).toEqual(questions);
    expect(rows[0].settings).toEqual(settings);
  });

  test('seedSurveyResponse persists responder_id, status, and round-trips answers JSONB array', async () => {
    if (!H.dbReachable) return;
    const survey = await seedSurvey(H);
    const responder = await seedPerson(H);
    const answers = [{ questionId: 'q1', value: 9 }];
    const r = await seedSurveyResponse(H, {
      surveyId: survey.id,
      responderId: responder.id,
      organizationId: CONTENT_ORG,
      answers,
      status: 'completed',
    });
    const { rows } = await H.scopedPool.query(
      `SELECT responder_id, status, answers, organization_id, survey_id
         FROM "${H.schema}".survey_response WHERE id = $1`,
      [r.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].responder_id).toBe(responder.id);
    expect(rows[0].status).toBe('completed');
    expect(rows[0].answers).toEqual(answers);
    expect(rows[0].organization_id).toBe(CONTENT_ORG);
    expect(rows[0].survey_id).toBe(survey.id);
    expect(r.responderId).toBe(responder.id);
  });

  test('seedSurveyResponse with explicit null responder_id persists an anonymous (NULL) row', async () => {
    if (!H.dbReachable) return;
    const survey = await seedSurvey(H);
    const r = await seedSurveyResponse(H, { surveyId: survey.id, responderId: null });
    const { rows } = await H.scopedPool.query(
      `SELECT responder_id, status, answers FROM "${H.schema}".survey_response WHERE id = $1`,
      [r.id],
    );
    expect(rows[0].responder_id).toBeNull();
    // DB defaults applied when omitted
    expect(rows[0].status).toBe('pending');
    expect(rows[0].answers).toEqual([]);
    expect(r.responderId).toBeNull();
  });

  test('seedMembership satisfies every NOT-NULL column; person_id + organization_id round-trip', async () => {
    if (!H.dbReachable) return;
    const p = await seedPerson(H);
    const m = await seedMembership(H, { personId: p.id, organizationId: CONTENT_ORG });
    const { rows } = await H.scopedPool.query(
      `SELECT person_id, organization_id, tier_id, start_date, status
         FROM "${H.schema}".membership WHERE id = $1`,
      [m.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].person_id).toBe(p.id);
    expect(rows[0].organization_id).toBe(CONTENT_ORG);
    // NOT-NULL-no-default cols are filled by the helper
    expect(rows[0].tier_id).not.toBeNull();
    expect(rows[0].start_date).not.toBeNull();
    expect(rows[0].status).toBe('active');
  });
});
