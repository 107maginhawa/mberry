/**
 * FIX-008 (M9-R2) — countAutoByTraining: the credit-value lock depends on a
 * correct count of AUTO credit entries already awarded for a training.
 *
 * This test captures the Drizzle `where` condition the repo builds and asserts
 * it filters on BOTH the trainingId and type='auto' (so manual entries that
 * happen to reference a training do not falsely lock the value), and that the
 * count value is returned.
 */

import { describe, test, expect } from 'bun:test';
import { CreditEntryRepository } from './credits.repo';

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

function captureCountDb(rows: any[]) {
  const capture: { where?: unknown } = {};
  const db: any = {
    select: () => ({
      from: () => ({
        where: (cond: unknown) => {
          capture.where = cond;
          return Promise.resolve(rows);
        },
      }),
    }),
  };
  return { db, capture };
}

describe('[FIX-008] CreditEntryRepository.countAutoByTraining', () => {
  test('filters on trainingId AND type=auto', async () => {
    const { db, capture } = captureCountDb([{ count: 3 }]);
    const repo = new CreditEntryRepository(db, null as any);
    const result = await repo.countAutoByTraining('training-99');

    expect(result).toBe(3);
    const tokens = walkChunks(capture.where);
    expect(tokens).toContain('COL:training_id');
    expect(tokens).toContain('VAL:training-99');
    expect(tokens).toContain('COL:type');
    expect(tokens).toContain('VAL:auto');
  });

  test('returns 0 when no rows match', async () => {
    const { db } = captureCountDb([]);
    const repo = new CreditEntryRepository(db, null as any);
    expect(await repo.countAutoByTraining('training-empty')).toBe(0);
  });
});
