// Unit tests for the must-never-break journey gate logic (Phase C).
// Pure source-text analysis — no stack. Run: `bun test scripts/audit-e2e-depth.test.ts`
import { describe, expect, test } from 'bun:test';
import { detectClauses, journeyMissingClauses } from './audit-e2e-depth';

// A fully-compliant must-never-break journey: marker + clause 1 (error surface)
// + clause 4 (independent read) + clause 3 (status) + clause 2 (goal value).
const COMPLIANT = `
// @journey-firewall
import { test, expect } from './helpers/test-fixture'
import { independentRead } from './helpers/independent-read'
test.use({ failOnUnexpected4xx: true, failOnConsoleError: true })
test('journey', async () => {
  const r = await independentRead('member', async (api) => api.get('/persons/me'))
  expect(r.status).toBe(200)
  expect(r.personId).toBe(memberId)
})
`;

describe('journey gate — detectClauses', () => {
  test('flags a fully-compliant journey as having all 4 clauses', () => {
    const c = detectClauses(COMPLIANT);
    expect(c.journey).toBe(true);
    expect([c.c1, c.c2, c.c3, c.c4]).toEqual([true, true, true, true]);
    expect(journeyMissingClauses(c)).toEqual([]);
  });

  test('detects independentRead called WITH a generic type param (real spec form)', () => {
    const src = `
// @journey-firewall
import { independentRead } from './helpers/independent-read'
test.use({ failOnUnexpected4xx: true })
test('j', async () => {
  const r = await independentRead<{ status: number; id?: string }>('member', async (api) =>
    api.get('/persons/me'))
  expect(r.status).toBe(200)
  expect(r.id).toBe(memberId)
})
`;
    const c = detectClauses(src);
    expect(c.c4).toBe(true);
    expect(journeyMissingClauses(c)).toEqual([]);
  });

  test('a non-journey spec is never gated (no marker → no violations)', () => {
    const c = detectClauses(`
      import { test, expect } from '@playwright/test'
      test('x', async () => { await page.goto('/'); await expect(page.locator('h1')).toBeVisible() })
    `);
    expect(c.journey).toBe(false);
    expect(journeyMissingClauses(c)).toEqual([]);
  });

  test('RED: journey missing the independent read → clause 4 violation', () => {
    const src = COMPLIANT.replace("import { independentRead } from './helpers/independent-read'", '')
      .replace(/const r = await independentRead[\s\S]*?\n/, 'const r = { status: 200, personId: memberId }\n');
    const c = detectClauses(src);
    expect(c.c4).toBe(false);
    expect(journeyMissingClauses(c)).toContain('clause4');
  });

  test('RED: journey missing the error surface → clause 1 violation', () => {
    const src = COMPLIANT.replace('test.use({ failOnUnexpected4xx: true, failOnConsoleError: true })', '');
    const c = detectClauses(src);
    expect(c.c1).toBe(false);
    expect(journeyMissingClauses(c)).toContain('clause1');
  });

  test('RED: journey with only a status assertion (no goal value) → clause 2 violation', () => {
    const src = COMPLIANT.replace('expect(r.personId).toBe(memberId)', '');
    const c = detectClauses(src);
    expect(c.c3).toBe(true); // still has status
    expect(c.c2).toBe(false); // no goal-value assertion
    expect(journeyMissingClauses(c)).toContain('clause2');
  });

  test('RED: journey with no status assertion → clause 3 violation', () => {
    const src = COMPLIANT.replace('expect(r.status).toBe(200)', '');
    const c = detectClauses(src);
    expect(c.c3).toBe(false);
    expect(journeyMissingClauses(c)).toContain('clause3');
  });
});
