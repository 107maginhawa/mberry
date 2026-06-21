/**
 * Real-PG integration suite for DocumentRepository (Wave-2 cluster B2, content).
 *
 * Replaces the fake-db `toBeDefined()` illusion in repos/documents.repo.test.ts:
 * the `tag` filter emits a real Postgres jsonb containment fragment
 * (`tags @> '["x"]'::jsonb`) and the `q` filter emits
 * `or(ilike(title,'%q%'), ilike(file_name,'%q%'))` — neither is ever exercised
 * against real SQL by the stub. This proves both clauses return the EXACT subset
 * (and respect org-scope) against an isolated scratch Postgres schema.
 *
 * Owns its own document seeding locally (raw scopedPool INSERTs filling the
 * NOT-NULL cols + tags::jsonb); imports only the scratch harness + ORG ids from
 * content-fixtures. Skips cleanly when DB unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { DocumentRepository } from './documents.repo';
import { createContentScratch, CONTENT_ORG, seedOrg } from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';

const ORG = CONTENT_ORG;
const ORG_B = seedOrg('00000000-0000-4000-8000-00000000d0b2');

let H: ScratchDb;
let repo: DocumentRepository;

interface SeedDocOpts {
  id?: string;
  organizationId?: string;
  title?: string;
  fileName?: string;
  tags?: string[];
  status?: string;
}

/**
 * Insert one `document` row, filling every NOT-NULL-no-default column
 * (organization_id, title, mime_type, storage_key, owner_id, owner_type) plus
 * document_status and tags::jsonb. file_name has a DB default of '' but we set
 * it for the ilike(file_name) assertions.
 */
async function seedDoc(o: SeedDocOpts = {}): Promise<string> {
  const id = o.id ?? crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".document
       (id, organization_id, title, file_name, mime_type, storage_key,
        owner_id, owner_type, document_status, tags)
     VALUES ($1::uuid,$2::uuid,$3,$4,'application/pdf',$5,$6::uuid,'person',$7,$8::jsonb)`,
    [
      id,
      o.organizationId ?? ORG,
      o.title ?? 'Untitled',
      o.fileName ?? 'file.pdf',
      `key/${id}`,
      crypto.randomUUID(),
      o.status ?? 'published',
      JSON.stringify(o.tags ?? []),
    ],
  );
  return id;
}

const sorted = (ids: string[]) => [...ids].sort();

beforeAll(async () => {
  H = await createContentScratch();
  if (!H.dbReachable) return;
  repo = new DocumentRepository(H.db as never);
});
afterAll(async () => {
  await H?.teardown();
});

describe('DocumentRepository.buildWhereConditions — jsonb @> tag containment (real PG)', () => {
  test('tag filter returns EXACTLY the docs whose tags array contains the tag', async () => {
    if (!H.dbReachable) return;
    const docA = await seedDoc({ tags: ['compliance', 'hr'] });
    const docB = await seedDoc({ tags: ['compliance'] });
    const docC = await seedDoc({ tags: ['finance'] });

    const compliance = await repo.findMany({ organizationId: ORG, tag: 'compliance' });
    expect(compliance.length).toBe(2);
    expect(sorted(compliance.map((d) => d.id))).toEqual(sorted([docA, docB]));
    // docC (finance-only) is excluded — proves containment is membership, not row presence.
    expect(compliance.some((d) => d.id === docC)).toBe(false);

    const finance = await repo.findMany({ organizationId: ORG, tag: 'finance' });
    expect(finance.length).toBe(1);
    expect(finance[0]!.id).toBe(docC);

    const none = await repo.findMany({ organizationId: ORG, tag: 'nonexistent' });
    expect(none.length).toBe(0);
  });

  test('tag containment is org-scoped — a foreign-org doc with the same tag is never returned', async () => {
    if (!H.dbReachable) return;
    const foreign = await seedDoc({ organizationId: ORG_B, tags: ['compliance'] });

    const compliance = await repo.findMany({ organizationId: ORG, tag: 'compliance' });
    expect(compliance.some((d) => d.id === foreign)).toBe(false);
    expect(compliance.every((d) => d.organizationId === ORG)).toBe(true);
  });
});

describe('DocumentRepository.buildWhereConditions — ilike q search (real PG)', () => {
  test('q searches title OR file_name, case-insensitively', async () => {
    if (!H.dbReachable) return;
    const titleDoc = await seedDoc({
      title: 'Annual Policy Manual',
      fileName: 'manual-2030.pdf',
      tags: ['q-title'],
    });
    const fileDoc = await seedDoc({
      title: 'Member Handbook',
      fileName: 'bylaws.pdf',
      tags: ['q-file'],
    });
    const financeDoc = await seedDoc({
      title: 'Finance Report',
      fileName: 'q4.pdf',
      tags: ['q-finance'],
    });

    // title-only match
    const policy = await repo.findMany({ organizationId: ORG, q: 'policy' });
    expect(policy.map((d) => d.id)).toEqual([titleDoc]);

    // file_name match — proves the or(title, file_name) branch
    const bylaws = await repo.findMany({ organizationId: ORG, q: 'bylaws' });
    expect(bylaws.map((d) => d.id)).toEqual([fileDoc]);

    // upper-case query still matches lower-cased title — proves ilike case-insensitivity
    const finance = await repo.findMany({ organizationId: ORG, q: 'FINANCE' });
    expect(finance.map((d) => d.id)).toEqual([financeDoc]);
  });

  test('q search is org-scoped', async () => {
    if (!H.dbReachable) return;
    const foreign = await seedDoc({
      organizationId: ORG_B,
      title: 'Foreign Policy Brief',
      fileName: 'foreign.pdf',
    });
    const policy = await repo.findMany({ organizationId: ORG, q: 'policy' });
    expect(policy.some((d) => d.id === foreign)).toBe(false);
  });
});
