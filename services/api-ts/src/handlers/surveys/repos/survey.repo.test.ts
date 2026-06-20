import { describe, test, expect } from 'bun:test';
import { SurveyRepository } from './survey.repo';

// Minimal fake Drizzle that records the query builder chain and returns canned rows.
function fakeDb(activeRows: any[], countRows: any[]) {
  const calls: any = { leftJoin: false, where: null };
  const chain: any = {
    select: () => chain,
    from: () => chain,
    leftJoin: () => { calls.leftJoin = true; return chain; },
    innerJoin: () => chain,
    where: (w: any) => { calls.where = w; return chain; },
    limit: () => chain,
    offset: () => chain,
    orderBy: () => Promise.resolve(activeRows),
  };
  // count path: select({count}).from().where() resolves directly
  let selectCount = 0;
  const db: any = {
    __calls: calls,
    select: (arg?: any) => {
      if (arg && 'count' in arg) {
        selectCount++;
        return { from: () => ({ where: () => Promise.resolve(countRows) }) };
      }
      return chain;
    },
  };
  return db;
}

describe('findAvailableForMember', () => {
  test('uses a LEFT JOIN and returns active surveys with null status for unanswered', async () => {
    const rows = [
      { survey: { id: 's1', surveyType: 'poll', status: 'active' }, myResponseStatus: null, myCompletedAt: null },
    ];
    const db = fakeDb(rows, [{ count: 1 }]);
    const repo = new SurveyRepository(db);
    const res = await repo.findAvailableForMember('org-1', 'member-1', { pagination: { limit: 20, offset: 0 } });

    expect(db.__calls.leftJoin).toBe(true);
    expect(res.totalCount).toBe(1);
    expect(res.data[0].id).toBe('s1');
    expect(res.data[0].myResponseStatus).toBeNull();
  });
});
