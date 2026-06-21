/**
 * Shared real-PG seed helpers for the Wave-2 "content" cluster (B2):
 * reviews + surveys + documents.
 *
 * Built ON TOP of `createScratch` (pg-scratch.ts) — mirrors the B1
 * `scheduling-fixtures.ts` pattern. The three content modules are org-scoped
 * CRUD with no FKs into scheduling; they share a person/org/membership seed
 * (surveys' `findAvailableForMember` + `personBelongsToOrg` couple to the
 * `membership` table; reviews' restrict-FKs reference `person`). Rather than
 * re-hand-rolling INSERTs (and the enum casts they need) per suite, this
 * exposes `seed*` helpers that fill the required NOT-NULL columns and
 * round-trip overrides.
 *
 * FKs are NOT copied by `LIKE … INCLUDING ALL`, so a review/membership row can
 * be seeded without parent person/org rows — but the helpers default ids to
 * fresh UUIDs so the partial-unique / unique indexes (copied by INCLUDING ALL)
 * admit independent rows.
 *
 * surveys Slice 1 extends this file with `seedSurvey` / `seedSurveyResponse`.
 * documents owns its own document/version/tag/access-log seeders locally.
 *
 * Usage:
 *   let H: ScratchDb
 *   beforeAll(async () => { H = await createContentScratch() })
 *   afterAll(async () => { await H?.teardown() })
 *   test('...', async () => {
 *     if (!H.dbReachable) return
 *     const p = await seedPerson(H)
 *     await seedMembership(H, { personId: p.id, organizationId: CONTENT_ORG })
 *   })
 */
import { createScratch, type ScratchDb } from './pg-scratch';

/** The public table set every content-cluster suite needs (extend via `extra`). */
export const CONTENT_TABLES = [
  'review',
  'survey',
  'survey_response',
  'document',
  'document_tag',
  'document_access_log',
  'document_version',
  'person',
  'membership',
] as const;

/** A fixed org id (FKs are dropped, so any valid UUID works; reuse pda-metro-manila for realism). */
export const CONTENT_ORG = 'ed8e3a96-8126-4341-be42-e6eb7940c562';

/**
 * Stand up a scratch schema with the content tables. Pass `extra` to add
 * sibling tables a suite needs.
 */
export function createContentScratch(extra: string[] = []): Promise<ScratchDb> {
  return createScratch([...CONTENT_TABLES, ...extra]);
}

/**
 * Returns an org UUID. No `organization` row is inserted (org_id columns
 * reference a dropped FK in the scratch schema). Defaults to `CONTENT_ORG`;
 * pass an id to mint a distinct org for cross-org isolation tests.
 */
export function seedOrg(id?: string): string {
  return id ?? CONTENT_ORG;
}

export interface SeedPersonOpts {
  id?: string;
  firstName?: string;
}
export interface SeededPerson {
  id: string;
}

/** Insert one `person` row (only `first_name` is NOT-NULL without a default). */
export async function seedPerson(H: ScratchDb, o: SeedPersonOpts = {}): Promise<SeededPerson> {
  const id = o.id ?? crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".person (id, first_name) VALUES ($1, $2)`,
    [id, o.firstName ?? 'Test'],
  );
  return { id };
}

export interface SeedMembershipOpts {
  id?: string;
  personId?: string;
  organizationId?: string;
  tierId?: string;
  /** ISO date string (defaults to CURRENT_DATE). */
  startDate?: string | null;
  /** Defaults to 'active' (overriding the DB default 'pendingPayment') so surveys see a member. */
  status?: string | null;
}
export interface SeededMembership {
  id: string;
  personId: string;
  organizationId: string;
  status: string;
}

/**
 * Insert one `membership` row, filling the NOT-NULL columns without DB defaults
 * (organization_id, person_id, tier_id, start_date) and overriding `status` to
 * 'active'. `grace_period_days`/`joined_at` fall through to their DB defaults.
 * Enum params need an explicit `::membership_status` cast.
 */
export async function seedMembership(
  H: ScratchDb,
  o: SeedMembershipOpts = {},
): Promise<SeededMembership> {
  const id = o.id ?? crypto.randomUUID();
  const personId = o.personId ?? crypto.randomUUID();
  const organizationId = o.organizationId ?? CONTENT_ORG;
  const tierId = o.tierId ?? crypto.randomUUID();
  const status = o.status ?? 'active';
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".membership
       (id, organization_id, person_id, tier_id, start_date, status)
     VALUES ($1,$2,$3,$4,
        COALESCE($5::date, CURRENT_DATE),
        COALESCE($6::membership_status, 'active'))`,
    [id, organizationId, personId, tierId, o.startDate ?? null, o.status ?? null],
  );
  return { id, personId, organizationId, status };
}

export interface SeedReviewOpts {
  id?: string;
  organizationId?: string;
  /** review.context_id — the flexible "what is being reviewed" reference. */
  context?: string;
  reviewerId?: string;
  reviewType?: string;
  reviewedEntity?: string | null;
  /** Defaults to a valid 5. Pass an out-of-range value to exercise the CHECK. */
  npsScore?: number | null;
  comment?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}
export interface SeededReview {
  id: string;
  organizationId: string;
  reviewer: string;
  context: string;
  reviewType: string;
  npsScore: number;
}

/**
 * Insert one `review` row filling the NOT-NULL columns
 * (organization_id, context_id, reviewer_id, review_type, nps_score) +
 * optional reviewed_entity_id/comment. `npsScore` defaults to a valid 5;
 * `??` only substitutes null/undefined, so a passed `0` (valid boundary) or
 * `-1` (CHECK violation) is preserved.
 */
export async function seedReview(H: ScratchDb, o: SeedReviewOpts = {}): Promise<SeededReview> {
  const id = o.id ?? crypto.randomUUID();
  const organizationId = o.organizationId ?? CONTENT_ORG;
  const context = o.context ?? crypto.randomUUID();
  const reviewer = o.reviewerId ?? crypto.randomUUID();
  const reviewType = o.reviewType ?? 'nps';
  const npsScore = o.npsScore ?? 5;
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".review
       (id, organization_id, context_id, reviewer_id, review_type,
        reviewed_entity_id, nps_score, comment, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      organizationId,
      context,
      reviewer,
      reviewType,
      o.reviewedEntity ?? null,
      npsScore,
      o.comment ?? null,
      o.createdBy ?? null,
      o.updatedBy ?? null,
    ],
  );
  return { id, organizationId, reviewer, context, reviewType, npsScore };
}
