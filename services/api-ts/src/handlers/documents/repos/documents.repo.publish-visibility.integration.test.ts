/**
 * Real-PG publish-visibility proof for DocumentRepository (B2 documents s2).
 *
 * The non-officer search path (searchDocuments.ts, FIX-004/WF-073) forces
 * effectiveStatus='published' regardless of the query param. That gate is
 * characterized at the handler layer (searchDocuments.test.ts), BUT the
 * REPO-level proof that `status='published'` actually EXCLUDES draft/archived
 * rows from the persisted set — i.e. no draft/archived doc can leak to a
 * member-scoped read — was missing. This asserts the real SQL filter
 * (`eq(documents.document_status, 'published')`) against Postgres.
 *
 * Characterization (no bug): the DB enum + the repo eq() filter already enforce
 * the boundary correctly; this locks it so a regression into a leak is caught.
 *
 * Seeds raw rows via H.scopedPool (FKs dropped by LIKE … INCLUDING ALL).
 * NOTE schema/DB drift: `document.size` is TEXT nullable in the live DB while
 * the drizzle schema declares bigint — so `size` is omitted from the insert
 * (nullable) rather than asserted.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { DocumentRepository } from './documents.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let repo: DocumentRepository;

const ORG = '00000000-0000-4000-8000-00000000d0c1';
const ORG_B = '00000000-0000-4000-8000-00000000d0c2';

/** Insert one document row, filling every NOT-NULL col without a default. */
async function seedDoc(
  status: 'draft' | 'published' | 'archived',
  organizationId = ORG,
): Promise<string> {
  const id = crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".document
       (id, organization_id, title, file_name, mime_type, storage_key,
        owner_id, owner_type, document_status)
     VALUES ($1,$2,$3,'f.pdf','application/pdf','k/1',$4,'person',$5)`,
    [id, organizationId, `Doc ${status}`, crypto.randomUUID(), status],
  );
  return id;
}

beforeAll(async () => {
  H = await createScratch(['document']);
  if (!H.dbReachable) return;
  repo = new DocumentRepository(H.db as never);
});
afterAll(async () => {
  await H?.teardown();
});

describe('DocumentRepository publish-visibility — status filter excludes draft/archived (no leak)', () => {
  test('status=published returns ONLY the published doc; draft + archived never leak', async () => {
    if (!H.dbReachable) return;
    const draftId = await seedDoc('draft');
    const publishedId = await seedDoc('published');
    const archivedId = await seedDoc('archived');

    const published = await repo.findMany({ organizationId: ORG, status: 'published' });
    const ids = published.map((d) => d.id);

    expect(ids).toEqual([publishedId]);
    expect(ids).not.toContain(draftId);
    expect(ids).not.toContain(archivedId);
    expect(published[0]!.status).toBe('published');
  });

  test('no status filter (officer path) returns all three statuses', async () => {
    if (!H.dbReachable) return;
    const all = await repo.findMany({ organizationId: ORG });
    const statuses = all.map((d) => d.status).sort();
    expect(all.length).toBe(3);
    expect(statuses).toEqual(['archived', 'draft', 'published']);
  });

  test('status=draft returns ONLY the draft', async () => {
    if (!H.dbReachable) return;
    const draftRows = await repo.findMany({ organizationId: ORG, status: 'draft' });
    expect(draftRows.length).toBe(1);
    expect(draftRows[0]!.status).toBe('draft');
  });

  test('a published doc in ORG_B is excluded from ORG published reads (org-scope holds)', async () => {
    if (!H.dbReachable) return;
    const foreignId = await seedDoc('published', ORG_B);

    const orgPublished = await repo.findMany({ organizationId: ORG, status: 'published' });
    expect(orgPublished.map((d) => d.id)).not.toContain(foreignId);
    expect(orgPublished.every((d) => d.organizationId === ORG)).toBe(true);

    // sanity: ORG_B sees its own published doc (the row really persisted)
    const orgBPublished = await repo.findMany({ organizationId: ORG_B, status: 'published' });
    expect(orgBPublished.map((d) => d.id)).toEqual([foreignId]);
  });
});
