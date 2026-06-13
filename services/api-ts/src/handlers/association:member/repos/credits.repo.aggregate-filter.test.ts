/**
 * FIX-005 (G3) — void-exclusion in aggregate reads.
 *
 * The credit repo's aggregate/read methods must exclude voided entries
 * (status != 'active') so an officer void actually reduces member-visible
 * totals, the transcript PDF, and compliance numbers. Before FIX-005,
 * sumCreditsByOrg / sumCreditsForCycle / sumCreditsByCategoryBatch / findMany
 * summed ALL rows regardless of status, so a void had no effect on what the
 * member or regulator saw.
 *
 * NOTE (product-decision boundary): this fix ONLY adds the status='active'
 * (void-exclusion) filter. It deliberately does NOT touch verificationStatus
 * — whether member-submitted 'pending' manual entries count toward totals is
 * an unresolved product-decision and is left exactly as-is (counted).
 *
 * These tests capture the Drizzle `where` SQL the repo builds (no live DB)
 * and assert a status='active' predicate is present.
 */

import { describe, test, expect } from 'bun:test';
import { CreditEntryRepository } from './credits.repo';

/**
 * Walk a Drizzle SQL/condition tree and collect column names and bound
 * param values. `eq(creditEntries.status, 'active')` surfaces as
 * COL:status followed (somewhere) by VAL:active.
 */
function walkChunks(node: any): string[] {
  const out: string[] = [];
  if (!node || typeof node !== 'object') return out;
  if (typeof node.name === 'string' && node.columnType) out.push('COL:' + node.name);
  if ('value' in node && ['string', 'number', 'boolean'].includes(typeof node.value)) {
    out.push('VAL:' + String(node.value));
  }
  const sub = node.queryChunks ?? (Array.isArray(node.value) ? node.value : null);
  if (Array.isArray(sub)) for (const c of sub) out.push(...walkChunks(c));
  return out;
}

function hasActiveStatusFilter(whereCond: unknown): boolean {
  const tokens = walkChunks(whereCond);
  return tokens.includes('COL:status') && tokens.includes('VAL:active');
}

/**
 * Build a mock db that captures the `where` condition passed to a SELECT.
 * Models the chains used by each repo method:
 *   select().from().where().groupBy()  → sumCreditsByOrg / sumCreditsByCategoryBatch
 *   select().from().where()            → sumCreditsForCycle (awaited directly)
 */
function captureDb(rows: any[]) {
  const capture: { where?: unknown } = {};
  const db: any = {
    select: () => ({
      from: () => ({
        where: (cond: unknown) => {
          capture.where = cond;
          const terminal: any = {
            groupBy: async () => rows,
            then: (r: any, j?: any) => Promise.resolve(rows).then(r, j),
          };
          return terminal;
        },
      }),
    }),
  };
  return { db, capture };
}

function makeRepo(db: any) {
  return new CreditEntryRepository(db, null as any);
}

describe('[FIX-005] credit aggregates exclude voided entries (status=active filter)', () => {
  test('sumCreditsByOrg filters status=active', async () => {
    const { db, capture } = captureDb([{ organizationId: 'org-1', total: 10 }]);
    await makeRepo(db).sumCreditsByOrg('p1', new Date(0), new Date());
    expect(hasActiveStatusFilter(capture.where)).toBe(true);
  });

  test('sumCreditsForCycle filters status=active', async () => {
    const { db, capture } = captureDb([{ total: 10 }]);
    await makeRepo(db).sumCreditsForCycle('p1', new Date(0), new Date(), 'org-1');
    expect(hasActiveStatusFilter(capture.where)).toBe(true);
  });

  test('sumCreditsByCategoryBatch filters status=active', async () => {
    const { db, capture } = captureDb([{ personId: 'p1', category: 'General', total: 10 }]);
    await makeRepo(db).sumCreditsByCategoryBatch(['p1'], new Date(0), new Date(), 'org-1');
    expect(hasActiveStatusFilter(capture.where)).toBe(true);
  });

  // findMany (base repo) uses Drizzle's mutate-in-place query builder:
  // `query.where(cond)` then `query.orderBy(...)` then `query.limit(...)` on
  // the SAME object, finally awaited. Model that shape.
  function findManyDb(capture: { where?: unknown }) {
    const query: any = {
      where: (cond: unknown) => { capture.where = cond; return query; },
      orderBy: (..._a: any[]) => query,
      limit: (_n: number) => query,
      offset: (_n: number) => query,
      then: (r: any, j?: any) => Promise.resolve([] as any[]).then(r, j),
    };
    return { select: () => ({ from: () => query }) };
  }

  test('listForPerson (transcript entry list) filters status=active', async () => {
    const capture: { where?: unknown } = {};
    await makeRepo(findManyDb(capture)).listForPerson('p1', { cycleStart: new Date(0), cycleEnd: new Date() });
    expect(hasActiveStatusFilter(capture.where)).toBe(true);
  });

  test('plain findMany({personId}) (DPA data export) does NOT force status=active — voided entries remain in the legal record', async () => {
    const capture: { where?: unknown } = {};
    await makeRepo(findManyDb(capture)).findMany({ personId: 'p1' });
    expect(hasActiveStatusFilter(capture.where)).toBe(false);
  });
});
