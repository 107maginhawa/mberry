/**
 * S-C4-010: pagination-convention guard.
 *
 * Cycle-3 audit IC-05 flagged ~70 `findMany` call sites without explicit
 * pagination. The base `DatabaseRepository.findMany` does enforce a
 * DEFAULT_QUERY_LIMIT (100) safety cap, but the audit's real concern is
 * that the convention is undocumented and that a small set of unbounded
 * loops/jobs can legitimately exceed 100 records and silently truncate.
 *
 * This slice:
 *   1. Codifies the convention in `docs/product/PERFORMANCE.md` (asserted here).
 *   2. Keeps the runtime cap in `core/database.repo.ts` and exports it
 *      from a stable constants module so handlers reaching outside the
 *      base class can reuse it.
 *   3. Adds `MAX_QUERY_LIMIT` for explicit larger pages.
 *
 * Per-call regression coverage for the highest-risk sites (jobs / audit
 * retention scan) lives in those modules' own tests; this file only
 * guards the convention surface.
 */
import { describe, test, expect } from 'bun:test';
import { DEFAULT_QUERY_LIMIT } from './database.repo';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './pagination';

// ponytail: the prose-doc guard (asserting docs/product/PERFORMANCE.md spells out
// the convention) was dropped in the lean-launch cleanup — that doc was deleted
// with the old product docs. The convention now lives in the code constants below
// (the real enforcement surface) + CLAUDE.md. These guard the runtime behavior.
describe('S-C4-010: pagination convention', () => {
  test('DEFAULT_QUERY_LIMIT in base repo matches documented page size', () => {
    expect(DEFAULT_QUERY_LIMIT).toBe(DEFAULT_PAGE_SIZE);
  });

  test('MAX_PAGE_SIZE is greater than DEFAULT_PAGE_SIZE', () => {
    expect(MAX_PAGE_SIZE).toBeGreaterThan(DEFAULT_PAGE_SIZE);
  });

  test('MAX_PAGE_SIZE is bounded (no runaway pages)', () => {
    expect(MAX_PAGE_SIZE).toBeLessThanOrEqual(1000);
  });
});
