/**
 * Tests for DocumentRepository, DocumentVersionRepository, DocumentTagRepository
 *
 * All database calls are intercepted by a hand-crafted db stub so no real
 * Postgres connection is needed.
 */

import { describe, test, expect } from 'bun:test';
import { DocumentRepository, DocumentVersionRepository, DocumentTagRepository } from './documents.repo';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeDocument(overrides: Record<string, any> = {}) {
  return {
    id: 'doc-1',
    organizationId: 'org-1',
    ownerId: 'owner-1',
    ownerType: 'chapter',
    title: 'Test Document',
    fileName: 'test.pdf',
    fileUrl: 'https://example.com/test.pdf',
    accessLevel: 'members',
    category: 'policies',
    status: 'published',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  };
}

function makeVersion(overrides: Record<string, any> = {}) {
  return {
    id: 'ver-1',
    documentId: 'doc-1',
    organizationId: 'org-1',
    versionNumber: 1,
    fileUrl: 'https://example.com/test-v1.pdf',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  };
}

function makeTag(overrides: Record<string, any> = {}) {
  return {
    id: 'tag-1',
    organizationId: 'org-1',
    name: 'Policy',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  };
}

/**
 * Build a minimal db stub whose chainable select/update/insert methods
 * resolve to whatever rows are provided.
 */
function makeDb({
  selectRows = [] as any[],
  selectRowsSets = undefined as any[][] | undefined,
  insertRow = {} as any,
  updateRow = {} as any,
}: {
  selectRows?: any[];
  selectRowsSets?: any[][];
  insertRow?: any;
  updateRow?: any;
} = {}) {
  let selectCallCount = 0;

  const awaitable = (result: any) => ({
    from: () => awaitable(result),
    leftJoin: () => awaitable(result),
    innerJoin: () => awaitable(result),
    where: () => awaitable(result),
    limit: (_n: number) => awaitable(result),
    returning: () => Promise.resolve(result),
    orderBy: () => awaitable(result),
    offset: (_n: number) => awaitable(result),
    groupBy: () => awaitable(result),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  });

  return {
    select: (_fields?: any) => {
      const rows = selectRowsSets
        ? selectRowsSets[selectCallCount++] ?? selectRows
        : selectRows;
      return awaitable(rows);
    },
    insert: (_table: any) => ({
      values: (data: any) => ({
        returning: () =>
          Promise.resolve(Array.isArray(data) ? data.map(() => insertRow) : [insertRow]),
        then: (resolve: any, reject?: any) => Promise.resolve().then(resolve, reject),
      }),
    }),
    update: (_table: any) => ({
      set: (_data: any) => ({
        where: () => ({
          returning: () => Promise.resolve([updateRow]),
        }),
      }),
    }),
    delete: (_table: any) => ({
      where: () => Promise.resolve({ rowCount: 1 }),
    }),
  };
}

// ---------------------------------------------------------------------------
// DocumentRepository.buildWhereConditions
// ---------------------------------------------------------------------------

describe('DocumentRepository.buildWhereConditions', () => {
  test('returns undefined when no filters provided', () => {
    const db = makeDb();
    const repo = new DocumentRepository(db as any);

    // Access the protected method via cast
    const result = (repo as any).buildWhereConditions(undefined);
    expect(result).toBeUndefined();
  });

  test('returns undefined when empty filters object provided', () => {
    const db = makeDb();
    const repo = new DocumentRepository(db as any);

    const result = (repo as any).buildWhereConditions({});
    expect(result).toBeUndefined();
  });

  test('builds conditions for organizationId filter', () => {
    const db = makeDb();
    const repo = new DocumentRepository(db as any);

    const result = (repo as any).buildWhereConditions({ organizationId: 'org-1' });
    expect(result).toBeDefined();
  });

  test('builds conditions for q (search) filter with ilike', () => {
    const db = makeDb();
    const repo = new DocumentRepository(db as any);

    const result = (repo as any).buildWhereConditions({ q: 'policy' });
    expect(result).toBeDefined();
  });

  test('builds conditions for multiple filters combined', () => {
    const db = makeDb();
    const repo = new DocumentRepository(db as any);

    const result = (repo as any).buildWhereConditions({
      organizationId: 'org-1',
      status: 'published',
      category: 'policies',
    });
    expect(result).toBeDefined();
  });

  test('builds conditions for accessLevel filter', () => {
    const db = makeDb();
    const repo = new DocumentRepository(db as any);

    const result = (repo as any).buildWhereConditions({ accessLevel: 'members' });
    expect(result).toBeDefined();
  });

  test('builds conditions for status filter', () => {
    const db = makeDb();
    const repo = new DocumentRepository(db as any);

    const result = (repo as any).buildWhereConditions({ status: 'draft' });
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// DocumentRepository via findMany (integration through base class)
// ---------------------------------------------------------------------------

describe('DocumentRepository.findMany', () => {
  test('returns documents for an organization', async () => {
    const d1 = makeDocument();
    const d2 = makeDocument({ id: 'doc-2', title: 'Second Doc' });
    const db = makeDb({ selectRows: [d1, d2] });
    const repo = new DocumentRepository(db as any);

    const result = await repo.findMany({ organizationId: 'org-1' });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('doc-1');
    expect(result[1].id).toBe('doc-2');
  });

  test('returns empty array when no documents match', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new DocumentRepository(db as any);

    const result = await repo.findMany({ organizationId: 'org-empty' });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DocumentVersionRepository.getLatestVersionNumber
// ---------------------------------------------------------------------------

describe('DocumentVersionRepository.getLatestVersionNumber', () => {
  test('returns 0 when no versions exist', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new DocumentVersionRepository(db as any);

    const result = await repo.getLatestVersionNumber('doc-1');
    expect(result).toBe(0);
  });

  test('returns latest version number when versions exist', async () => {
    const v3 = makeVersion({ versionNumber: 3 });
    const db = makeDb({ selectRows: [v3] });
    const repo = new DocumentVersionRepository(db as any);

    const result = await repo.getLatestVersionNumber('doc-1');
    expect(result).toBe(3);
  });

  test('returns version number 1 for first version', async () => {
    const v1 = makeVersion({ versionNumber: 1 });
    const db = makeDb({ selectRows: [v1] });
    const repo = new DocumentVersionRepository(db as any);

    const result = await repo.getLatestVersionNumber('doc-1');
    expect(result).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// DocumentTagRepository.buildWhereConditions
// ---------------------------------------------------------------------------

describe('DocumentTagRepository.buildWhereConditions', () => {
  test('returns undefined when no filters provided', () => {
    const db = makeDb();
    const repo = new DocumentTagRepository(db as any);

    const result = (repo as any).buildWhereConditions(undefined);
    expect(result).toBeUndefined();
  });

  test('builds conditions for q filter with ilike', () => {
    const db = makeDb();
    const repo = new DocumentTagRepository(db as any);

    const result = (repo as any).buildWhereConditions({ q: 'policy' });
    expect(result).toBeDefined();
  });

  test('builds conditions for organizationId filter', () => {
    const db = makeDb();
    const repo = new DocumentTagRepository(db as any);

    const result = (repo as any).buildWhereConditions({ organizationId: 'org-1' });
    expect(result).toBeDefined();
  });

  test('builds combined conditions for organizationId and q', () => {
    const db = makeDb();
    const repo = new DocumentTagRepository(db as any);

    const result = (repo as any).buildWhereConditions({ organizationId: 'org-1', q: 'policy' });
    expect(result).toBeDefined();
  });
});
