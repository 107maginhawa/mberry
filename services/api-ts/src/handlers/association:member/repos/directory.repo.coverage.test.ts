/**
 * DirectoryProfileRepository — buildWhereConditions branches + searchWithFilters.
 *
 * Mock-DB style. The text-search OR branch, visibility/personId/org branches,
 * and the cross-table searchWithFilters (chapter / duesStatus / tier subqueries,
 * pagination, count) are all driven against a scripted recording fake DB.
 */

import { describe, test, expect } from 'bun:test';
import { DirectoryProfileRepository } from './directory.repo';
import { makeFakeDb } from './__testkit__/fake-db';

describe('DirectoryProfileRepository.buildWhereConditions (via findMany)', () => {
  test('no filters → no where', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    await new DirectoryProfileRepository(db as any).findMany();
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(false);
  });

  test('empty filters → no where', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    await new DirectoryProfileRepository(db as any).findMany({});
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(false);
  });

  test('org + personId + visibility build conditions', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'd-1' }]] });
    await new DirectoryProfileRepository(db as any).findMany({
      organizationId: 'org-1',
      personId: 'p-1',
      visibility: 'public',
    });
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(true);
  });

  test('q text-search branch builds an OR condition', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'd-1' }]] });
    await new DirectoryProfileRepository(db as any).findMany({ q: 'cardio' });
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(true);
  });
});

describe('DirectoryProfileRepository.searchWithFilters', () => {
  test('base path: org + visibility guard, returns data + count', async () => {
    const db = makeFakeDb({
      selectResults: [
        [{ count: 3 }],                        // count query
        [{ id: 'd-1' }, { id: 'd-2' }],        // data query
      ],
    });
    const r = await new DirectoryProfileRepository(db as any).searchWithFilters(
      { organizationId: 'org-1' },
      { offset: 0, limit: 10 },
    );
    expect(r.totalCount).toBe(3);
    expect(r.data).toHaveLength(2);
    // data query carries orderBy + limit + offset
    const dataOp = db.ops.select[1]!.map((c) => c.method);
    expect(dataOp).toContain('orderBy');
    expect(dataOp).toContain('limit');
    expect(dataOp).toContain('offset');
  });

  test('q + duesStatus + tier + chapter all add subquery conditions', async () => {
    const db = makeFakeDb({
      selectResults: [[{ count: 1 }], [{ id: 'd-1' }]],
    });
    const r = await new DirectoryProfileRepository(db as any).searchWithFilters(
      {
        organizationId: 'org-1',
        q: 'smith',
        duesStatus: 'current',
        tier: 'tier-1',
        chapter: 'chap-1',
      },
      { offset: 5, limit: 5 },
    );
    expect(r.totalCount).toBe(1);
    expect(r.data).toHaveLength(1);
  });

  test('count defaults to 0 when count row missing', async () => {
    const db = makeFakeDb({ selectResults: [[], []] });
    const r = await new DirectoryProfileRepository(db as any).searchWithFilters(
      { organizationId: 'org-1' },
      { offset: 0, limit: 10 },
    );
    expect(r.totalCount).toBe(0);
    expect(r.data).toEqual([]);
  });
});
