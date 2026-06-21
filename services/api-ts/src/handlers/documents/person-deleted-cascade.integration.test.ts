/**
 * Real-Postgres integration test for the inter-module contract:
 *   person.deleted  →  documents cascade.
 *
 * The producer (`handlers/person/accountDeletionCascade.ts`) emits
 * `'person.deleted'` with `{ personId, scheduledAt }`. ONE of the ~9
 * subscribers in `core/domain-event-consumers.ts` (~line 1729) is the
 * documents half of that contract:
 *
 *     domainEvents.on('person.deleted', async ({ personId }) => {
 *       await deps.db.delete(documents).where(eq(documents.ownerId, personId));
 *     });
 *
 * The pre-existing fake-db `documents.repo.test.ts` never touches this cascade
 * at all — the cross-module delete (and crucially its OWNER-scoped, NOT
 * org-scoped semantics) was unproven against real rows. This file closes that
 * gap by:
 *   - seeding real `document` rows owned by two different people across two orgs,
 *   - wiring the REAL consumer onto the REAL scratch DB,
 *   - `await`-emitting the REAL `person.deleted` event on the REAL bus,
 *   - reading the surviving rows back from Postgres.
 *
 * Asserted REAL outcomes (not toBeDefined / not 200-only):
 *   - every document owned by the deleted person is gone (count = 0),
 *   - documents owned by OTHER people survive untouched (negative branch),
 *   - a document owned by the deleted person but in a DIFFERENT org is ALSO
 *     deleted — the cascade is owner-scoped, NOT org-scoped. This documents the
 *     actual (slightly surprising) semantics so a future "org-scoped delete"
 *     refactor would break this test on purpose.
 *
 * Isolation: `createContentScratch` copies the real `document` table structure
 * (LIKE … INCLUDING ALL) into a per-suite scratch schema; FKs are dropped so we
 * seed documents without standing up every parent row. The OTHER person.deleted
 * subscribers registered by `registerDomainEventConsumers` touch tables NOT in
 * this scratch set — each is wrapped in its own try/catch and only logs on
 * failure, so they never abort the emit (verified: emit resolves, documents
 * cascade still runs). If Postgres is unreachable the suite skips cleanly.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  createContentScratch,
  CONTENT_ORG,
  seedOrg,
  seedPerson,
} from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { domainEvents } from '@/core/domain-events';
import {
  registerDomainEventConsumers,
  type DomainEventMembershipRepo,
} from '@/core/domain-event-consumers';

let H: ScratchDb;

const noopLogger = {
  debug() {}, info() {}, warn() {}, error() {},
  child() { return noopLogger; },
} as never;

const noopMembershipRepo: DomainEventMembershipRepo = {
  findByPersonAndOrg: async () => null,
  updateOneById: async () => ({}),
};

/** Insert one real `document` row, filling the NOT-NULL-no-default columns. */
async function seedDocument(o: {
  id?: string;
  ownerId: string;
  organizationId?: string;
  title?: string;
  status?: string;
}): Promise<string> {
  const id = o.id ?? crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".document
       (id, organization_id, title, mime_type, storage_key, owner_id, owner_type, document_status)
     VALUES ($1,$2,$3,'application/pdf',$4,$5,'person',
        COALESCE($6::document_status,'draft'))`,
    [
      id,
      o.organizationId ?? CONTENT_ORG,
      o.title ?? 'Doc',
      `s3://${id}`,
      o.ownerId,
      o.status ?? null,
    ],
  );
  return id;
}

async function countByOwner(ownerId: string): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS n FROM "${H.schema}".document WHERE owner_id = $1`,
    [ownerId],
  );
  return rows[0].n;
}

async function docExists(id: string): Promise<boolean> {
  const { rows } = await H.scopedPool.query(
    `SELECT 1 FROM "${H.schema}".document WHERE id = $1`,
    [id],
  );
  return rows.length === 1;
}

/**
 * Wire the REAL person.deleted consumers onto the REAL H.db and await the emit.
 * `emit()` awaits Promise.allSettled of every handler, so the documents delete
 * is complete when this resolves. The bus is reset first so only our wiring runs.
 */
async function runCascade(personId: string): Promise<void> {
  domainEvents.reset();
  registerDomainEventConsumers(
    { membershipRepo: noopMembershipRepo, db: H.db as never },
    noopLogger,
  );
  await domainEvents.emit('person.deleted', {
    personId,
    scheduledAt: new Date().toISOString(),
  });
}

beforeAll(async () => {
  H = await createContentScratch();
});

afterAll(async () => {
  domainEvents.reset();
  await H?.teardown();
});

beforeEach(() => {
  domainEvents.reset();
});

describe('person.deleted → documents cascade (real DB)', () => {
  test('deletes ONLY the deleted person\'s documents; other people\'s survive', async () => {
    if (!H.dbReachable) return;

    const personA = await seedPerson(H);
    const personB = await seedPerson(H);

    // PERSON_A owns two docs in ORG; PERSON_B owns one doc in the same ORG.
    const docX = await seedDocument({ ownerId: personA.id, status: 'published' });
    const docX2 = await seedDocument({ ownerId: personA.id, status: 'archived' });
    const docY = await seedDocument({ ownerId: personB.id, status: 'published' });

    expect(await countByOwner(personA.id)).toBe(2);
    expect(await countByOwner(personB.id)).toBe(1);

    // ── Drive the REAL cascade for PERSON_A ─────────────────────────────────
    await runCascade(personA.id);

    // PERSON_A's docs are gone (both X and X2, regardless of status).
    expect(await countByOwner(personA.id)).toBe(0);
    expect(await docExists(docX)).toBe(false);
    expect(await docExists(docX2)).toBe(false);

    // PERSON_B's doc survives — the delete is owner-scoped, not a blanket wipe.
    expect(await countByOwner(personB.id)).toBe(1);
    expect(await docExists(docY)).toBe(true);
  });

  test('cascade is OWNER-scoped, NOT org-scoped: a doc owned by the deleted person in ANOTHER org is ALSO deleted', async () => {
    if (!H.dbReachable) return;

    const orgB = seedOrg('11111111-2222-3333-4444-555555555555');
    expect(orgB).not.toBe(CONTENT_ORG);

    const personA = await seedPerson(H);

    // Same owner, two different orgs.
    const docInOrgA = await seedDocument({ ownerId: personA.id, organizationId: CONTENT_ORG });
    const docInOrgB = await seedDocument({ ownerId: personA.id, organizationId: orgB });

    expect(await countByOwner(personA.id)).toBe(2);

    await runCascade(personA.id);

    // BOTH are deleted — the consumer filters on owner_id alone, never org.
    expect(await countByOwner(personA.id)).toBe(0);
    expect(await docExists(docInOrgA)).toBe(false);
    expect(await docExists(docInOrgB)).toBe(false);
  });

  test('deleting a person with NO documents is a clean no-op (other owners untouched)', async () => {
    if (!H.dbReachable) return;

    const ghost = await seedPerson(H);
    const owner = await seedPerson(H);
    const keep = await seedDocument({ ownerId: owner.id });

    expect(await countByOwner(ghost.id)).toBe(0);

    await runCascade(ghost.id);

    // No rows removed for an owner with nothing; an unrelated owner's doc stays.
    expect(await countByOwner(owner.id)).toBe(1);
    expect(await docExists(keep)).toBe(true);
  });
});
