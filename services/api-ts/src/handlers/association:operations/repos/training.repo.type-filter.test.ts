/**
 * FIX-007 (G7a / M9-R1) — the advertised training `type` search filter must be real.
 *
 * Before FIX-007 the `trainings` table had no `type` column and
 * TrainingRepository.buildWhereConditions ignored the `type` filter, so a
 * `?type=webinar` search silently returned everything (a no-op filter). This
 * test captures the Drizzle `where` condition the repo builds for a
 * `{ type }` filter and asserts a real `type` predicate is present.
 */

import { describe, test, expect } from 'bun:test';
import { TrainingRepository } from './training.repo';

/**
 * Walk a Drizzle SQL/condition tree and collect column names and bound
 * param values. `eq(trainings.type, 'webinar')` surfaces as COL:type
 * followed (somewhere) by VAL:webinar.
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

function hasTypeFilter(whereCond: unknown, value: string): boolean {
  const tokens = walkChunks(whereCond);
  return tokens.includes('COL:type') && tokens.includes('VAL:' + value);
}

describe('[FIX-007] TrainingRepository applies a real type filter', () => {
  test('buildWhereConditions includes a type=webinar predicate', () => {
    const repo = new TrainingRepository({} as any, null as any);
    // buildWhereConditions is protected; exercise it via the subclass surface.
    const cond = (repo as any).buildWhereConditions({ organizationId: 'org-1', type: 'webinar' });
    expect(hasTypeFilter(cond, 'webinar')).toBe(true);
  });

  test('buildWhereConditions omits type predicate when no type filter given', () => {
    const repo = new TrainingRepository({} as any, null as any);
    const cond = (repo as any).buildWhereConditions({ organizationId: 'org-1' });
    const tokens = walkChunks(cond);
    expect(tokens.includes('COL:type')).toBe(false);
  });
});
