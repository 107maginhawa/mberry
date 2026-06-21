/**
 * surveys Slice 4 (Wave-2 cluster B2, content) — `personBelongsToOrg`
 * tenant-boundary guard, against real Postgres.
 *
 * `personBelongsToOrg` (utils/membership-check.ts) is the tenant-boundary gate
 * for the /my/surveys/* routes that live OUTSIDE the /org/:orgSlug tree (where
 * x-org-id is absent and organizationId comes from the survey itself). It
 * delegates to `MembershipRepository.findByPersonAndOrg`, which selects from the
 * public `membership` table filtered by (person_id, organization_id) with NO
 * status filter — so presence in ANY status (active, lapsed, …) grants access.
 *
 * It gates `submitSurveyResponse.ts:57-60` (non-member → NotFoundError). It was
 * UNTESTED at the util level; the only existing repo test was a fakeDb chain
 * that never proved the real (person, org) WHERE binds correctly on Postgres.
 *
 * This drives the REAL util against scratch PG with real seeded `membership`
 * rows — proving the guard returns `true` only for a genuine member of the
 * exact org, and `false` for a foreign org or an unknown person (the cross-org
 * leak the fake-db chain could never catch). Skips when DB unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  createContentScratch,
  CONTENT_ORG,
  seedPerson,
  seedMembership,
} from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { personBelongsToOrg } from './membership-check';

let H: ScratchDb;

/** A second, distinct org id (FKs dropped — any valid UUID works). */
const ORG_B = '11111111-2222-4333-8444-555555555555';

beforeAll(async () => {
  H = await createContentScratch();
});
afterAll(async () => {
  await H?.teardown();
});

describe('personBelongsToOrg — tenant-boundary guard (real PG)', () => {
  test('a genuine member of orgA → true', async () => {
    if (!H.dbReachable) return;
    const personA = await seedPerson(H);
    await seedMembership(H, { personId: personA.id, organizationId: CONTENT_ORG });

    const allowed = await personBelongsToOrg(
      H.db as never,
      null,
      personA.id,
      CONTENT_ORG,
    );
    expect(allowed).toBe(true);
  });

  test('member of orgA queried against orgB → false (cross-org isolation)', async () => {
    if (!H.dbReachable) return;
    const personA = await seedPerson(H);
    // membership ONLY in CONTENT_ORG, never ORG_B
    await seedMembership(H, { personId: personA.id, organizationId: CONTENT_ORG });

    const sameOrg = await personBelongsToOrg(
      H.db as never,
      null,
      personA.id,
      CONTENT_ORG,
    );
    const foreignOrg = await personBelongsToOrg(
      H.db as never,
      null,
      personA.id,
      ORG_B,
    );
    expect(sameOrg).toBe(true);
    expect(foreignOrg).toBe(false);
  });

  test('a person with NO membership anywhere → false', async () => {
    if (!H.dbReachable) return;
    const stranger = await seedPerson(H);

    const allowed = await personBelongsToOrg(
      H.db as never,
      null,
      stranger.id,
      CONTENT_ORG,
    );
    expect(allowed).toBe(false);
  });

  test('an entirely unknown person id (no person/membership row) → false', async () => {
    if (!H.dbReachable) return;
    const allowed = await personBelongsToOrg(
      H.db as never,
      null,
      crypto.randomUUID(),
      CONTENT_ORG,
    );
    expect(allowed).toBe(false);
  });

  test('membership of ANY status counts — a lapsed member still → true (presence-based, not status-filtered)', async () => {
    if (!H.dbReachable) return;
    const personA = await seedPerson(H);
    await seedMembership(H, {
      personId: personA.id,
      organizationId: CONTENT_ORG,
      status: 'lapsed',
    });

    const allowed = await personBelongsToOrg(
      H.db as never,
      null,
      personA.id,
      CONTENT_ORG,
    );
    expect(allowed).toBe(true);
  });

  test('multiple memberships across orgs: orgA → true, orgB → true, third org → false', async () => {
    if (!H.dbReachable) return;
    const personA = await seedPerson(H);
    await seedMembership(H, { personId: personA.id, organizationId: CONTENT_ORG });
    await seedMembership(H, { personId: personA.id, organizationId: ORG_B });

    const inA = await personBelongsToOrg(H.db as never, null, personA.id, CONTENT_ORG);
    const inB = await personBelongsToOrg(H.db as never, null, personA.id, ORG_B);
    const inThird = await personBelongsToOrg(
      H.db as never,
      null,
      personA.id,
      crypto.randomUUID(),
    );
    expect(inA).toBe(true);
    expect(inB).toBe(true);
    expect(inThird).toBe(false);
  });
});
