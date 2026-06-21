/**
 * Inter-module integration: person.deleted → surveys anonymize cascade
 * (real bus + real PG).
 *
 * Wires the REAL `registerDomainEventConsumers` against a scratch-schema
 * Postgres, emits `person.deleted` through the REAL `domainEvents` bus, and
 * asserts the REAL persisted `survey_response` rows. The surveys consumer
 * (core/domain-event-consumers.ts:1779-1788) runs a single
 * `update(surveyResponses).set({responderId:null, updatedBy:SYSTEM}).where(
 * eq(responderId, personId))`, awaited inside `emit`'s Promise.allSettled, so
 * the rows are settled by the time `emit()` resolves — no polling needed.
 *
 * The responder_id FK is `onDelete:'restrict'`, so this anonymize-in-place
 * cascade MUST run before any hard person delete. It nulls the responder
 * reference (de-anonymizes the identified response so a removed member can no
 * longer be mapped to their individual answers) while RETAINING the answers
 * for aggregate integrity — BR-32. The prior mock-only test could never prove
 * the answers are kept nor that no rows are deleted.
 *
 * Mirrors reviews/reviewsPersonDeletedCascade.integration.test.ts. Skips when
 * the DB is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  createContentScratch,
  CONTENT_ORG,
  seedSurvey,
  seedSurveyResponse,
} from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { registerDomainEventConsumers } from '@/core/domain-event-consumers';
import { domainEvents } from '@/core/domain-events';
import { SYSTEM_USER_ID } from '@/core/constants';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as never;

// registerDomainEventConsumers requires a membershipRepo dep; the surveys
// person.deleted consumer never calls it.
const membershipRepo = {
  async findByPersonAndOrg() { return null; },
  async updateOneById() { return undefined; },
} as never;

/** Read one survey_response row back by id (raw, scratch-scoped). */
async function readResponse(id: string): Promise<Record<string, unknown> | undefined> {
  const { rows } = await H.scopedPool.query(
    `SELECT id, responder_id, updated_by, answers, status
       FROM "${H.schema}".survey_response WHERE id = $1`,
    [id],
  );
  return rows[0];
}

async function countResponses(): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS c FROM "${H.schema}".survey_response`,
  );
  return rows[0]!.c as number;
}

beforeAll(async () => {
  H = await createContentScratch();
  if (!H.dbReachable) return;
  // Clean slate on the global bus, then register the real consumers against our db.
  domainEvents.reset();
  registerDomainEventConsumers({ membershipRepo, db: H.db as never }, noopLogger);
});

afterAll(async () => {
  domainEvents.reset();
  await H?.teardown();
});

describe('person.deleted → surveys anonymize cascade (real bus, real-PG)', () => {
  test('identified response is anonymized in place (responder NULL, answers retained); other member untouched', async () => {
    if (!H.dbReachable) return;

    const personX = crypto.randomUUID();
    const personY = crypto.randomUUID();
    const survey = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });

    const xAnswers = [{ questionId: 'q1', value: 'X answer' }];
    const yAnswers = [{ questionId: 'q1', value: 'Y answer' }];

    // (a) personX's identified response → must be anonymized in place.
    const x = await seedSurveyResponse(H, {
      surveyId: survey.id,
      organizationId: CONTENT_ORG,
      responderId: personX,
      answers: xAnswers,
      status: 'completed',
      updatedBy: personX, // pre-cascade updated_by — must change to SYSTEM after.
    });

    // (b) personY's response → untouched.
    const y = await seedSurveyResponse(H, {
      surveyId: survey.id,
      organizationId: CONTENT_ORG,
      responderId: personY,
      answers: yAnswers,
      status: 'completed',
      updatedBy: personY,
    });
    const yBefore = await readResponse(y.id);

    const countBefore = await countResponses();

    await domainEvents.emit('person.deleted', { personId: personX } as never);

    // (a) anonymized in place: responder NULL, stamped SYSTEM, answers UNCHANGED (BR-32).
    const xAfter = await readResponse(x.id);
    expect(xAfter).toBeDefined();
    expect(xAfter!['responder_id']).toBeNull();
    expect(xAfter!['updated_by']).toBe(SYSTEM_USER_ID);
    expect(xAfter!['answers']).toEqual(xAnswers);
    // status (and the row itself) preserved — anonymize, not delete.
    expect(xAfter!['status']).toBe('completed');

    // (b) personY's row identical to pre-cascade.
    expect(await readResponse(y.id)).toEqual(yBefore);

    // Cascade does NOT delete rows — count unchanged.
    expect(await countResponses()).toBe(countBefore);
  });

  test('an already-anonymous response (responder_id NULL) is unaffected; no error', async () => {
    if (!H.dbReachable) return;

    const survey = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    const anonAnswers = [{ questionId: 'q1', value: 'anon' }];

    // responder_id NULL from the start (anonymous response).
    const anon = await seedSurveyResponse(H, {
      surveyId: survey.id,
      organizationId: CONTENT_ORG,
      responderId: null,
      answers: anonAnswers,
      status: 'completed',
      updatedBy: null,
    });
    const anonBefore = await readResponse(anon.id);

    // Emit for some unrelated person — the NULL-responder row must not match
    // the `eq(responderId, personId)` predicate (NULL != anything).
    await domainEvents.emit('person.deleted', { personId: crypto.randomUUID() } as never);

    expect(await readResponse(anon.id)).toEqual(anonBefore);
  });

  test('person.deleted for a responder with zero responses → no-op, bus stays alive', async () => {
    if (!H.dbReachable) return;

    // Sentinel attributed response by a DIFFERENT person.
    const survey = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    const keeper = crypto.randomUUID();
    const sentinel = await seedSurveyResponse(H, {
      surveyId: survey.id,
      organizationId: CONTENT_ORG,
      responderId: keeper,
      answers: [{ questionId: 'q1', value: 'keep' }],
      status: 'completed',
      updatedBy: keeper,
    });
    const sentinelBefore = await readResponse(sentinel.id);
    const totalBefore = await countResponses();

    // No responses for this person → the UPDATE matches zero rows.
    await domainEvents.emit('person.deleted', { personId: crypto.randomUUID() } as never);

    // Nothing changed, no rows deleted; sentinel still attributed to its keeper.
    expect(await countResponses()).toBe(totalBefore);
    const sentinelAfter = await readResponse(sentinel.id);
    expect(sentinelAfter).toEqual(sentinelBefore);
    expect(sentinelAfter!['responder_id']).toBe(keeper);

    // Bus still alive: a subsequent emit for the keeper anonymizes its row.
    await domainEvents.emit('person.deleted', { personId: keeper } as never);
    const afterKeeperDelete = await readResponse(sentinel.id);
    expect(afterKeeperDelete!['responder_id']).toBeNull();
    expect(afterKeeperDelete!['updated_by']).toBe(SYSTEM_USER_ID);
  });
});
