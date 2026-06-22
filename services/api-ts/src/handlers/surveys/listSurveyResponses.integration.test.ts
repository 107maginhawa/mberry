/**
 * [BR-40] Survey Anonymity — READ-SIDE defense-in-depth (real PG).
 *
 * R1-3 backfill. The WRITE path (submitSurveyResponse) is already real-PG
 * covered in submitSurveyResponse.integration.test.ts. The READ path is NOT:
 * `listSurveyResponses` (FIX-007 / PR #18) nulls responderId AND the
 * created_by/updated_by audit columns for anonymous surveys as defense-in-depth
 * so that even a legacy/abnormal ATTRIBUTED row in an anonymous survey can never
 * deanonymize a respondent through this endpoint. That strip was previously
 * proven only by a pure-fn characterization test (communication/br-40.survey-
 * anonymity.test.ts re-implements canViewRespondentIdentity inline) — so a
 * regression that drops the read-side strip would NOT be caught.
 *
 * This suite drives the REAL `listSurveyResponses` handler against a
 * `createContentScratch` schema, deliberately seeding an anonymous survey with a
 * FULLY-ATTRIBUTED response row (responder_id + created_by + updated_by all set,
 * simulating a legacy row written before the strip landed), and asserts the
 * handler returns every re-identifying column nulled. An identified survey is
 * the control: its responderId must survive.
 *
 * Skips cleanly when Postgres is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  createContentScratch,
  CONTENT_ORG,
  seedSurvey,
} from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { listSurveyResponses } from './listSurveyResponses';

let H: ScratchDb;

beforeAll(async () => {
  H = await createContentScratch();
});
afterAll(async () => {
  await H?.teardown();
});

function makeLogger(): Record<string, (...a: unknown[]) => unknown> {
  const l: Record<string, (...a: unknown[]) => unknown> = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
  l['child'] = () => l;
  return l;
}

interface RespBody {
  data: Array<Record<string, unknown>>;
  pagination: { totalCount: number };
}

/** Build a listSurveyResponses ctx wired to the REAL scratch db, as an admin
 * (admin role bypasses the officer-term gate, so no governance tables needed). */
function makeCtx(surveyId: string) {
  let captured: { body: RespBody; status: number } = { body: { data: [], pagination: { totalCount: 0 } }, status: 0 };
  const store: Record<string, unknown> = {
    session: { user: { id: 'admin-1', name: 'Admin', email: 'a@test.com', role: 'admin' } },
    database: H.db,
    logger: makeLogger(),
    organizationId: CONTENT_ORG,
  };
  const ctx = {
    get: (k: string) => store[k],
    req: {
      param: (_k: string) => surveyId,
      valid: (_k: 'query') => ({}),
    },
    json: (body: RespBody, status: number) => {
      captured = { body, status };
      return new Response(JSON.stringify(body), { status });
    },
    _captured: () => captured,
  };
  return ctx as never;
}

/** Insert a COMPLETED, fully-attributed response row directly — the
 * created_by/updated_by columns aren't settable via seedSurveyResponse, and the
 * point of this test is precisely to set them non-null. */
async function seedAttributedResponse(surveyId: string, who: string): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".survey_response
       (id, organization_id, survey_id, responder_id, answers, status, completed_at, created_by, updated_by)
     VALUES ($1,$2,$3,$4,'[]'::jsonb,'completed', now(), $5, $6)`,
    [crypto.randomUUID(), CONTENT_ORG, surveyId, who, who, who],
  );
}

describe('[BR-40] listSurveyResponses anonymity strip (real PG)', () => {
  test('anonymous survey: a fully-attributed legacy row is returned with responderId + createdBy + updatedBy NULLED', async () => {
    if (!H.dbReachable) return;
    const who = crypto.randomUUID();
    const survey = await seedSurvey(H, { organizationId: CONTENT_ORG, settings: { anonymous: true } });
    await seedAttributedResponse(survey.id, who);

    const ctx = makeCtx(survey.id);
    const res = await listSurveyResponses(ctx);
    expect(res.status).toBe(200);

    const { body } = (ctx as unknown as { _captured: () => { body: RespBody } })._captured();
    expect(body.data.length).toBe(1);
    const row = body.data[0]!;
    // The read-side defense-in-depth: every re-identifying column is nulled,
    // even though the persisted row carried the actor in all three.
    expect(row['responderId']).toBeNull();
    expect(row['createdBy']).toBeNull();
    expect(row['updatedBy']).toBeNull();
  });

  test('identified survey: responderId survives (the strip is conditional, not blanket)', async () => {
    if (!H.dbReachable) return;
    const who = crypto.randomUUID();
    const survey = await seedSurvey(H, { organizationId: CONTENT_ORG, settings: { anonymous: false } });
    await seedAttributedResponse(survey.id, who);

    const ctx = makeCtx(survey.id);
    const res = await listSurveyResponses(ctx);
    expect(res.status).toBe(200);

    const { body } = (ctx as unknown as { _captured: () => { body: RespBody } })._captured();
    expect(body.data.length).toBe(1);
    expect(body.data[0]!['responderId']).toBe(who);
  });
});
