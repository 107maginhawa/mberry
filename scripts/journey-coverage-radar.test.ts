// Unit tests for the journey-coverage review radar (Track 2 lean — advisory).
// Pure mapping logic, no stack. Run: `bun test scripts/journey-coverage-radar.test.ts`
import { describe, expect, test } from 'bun:test';
import { journeyTokens, moduleOf, classifyChanges } from './journey-coverage-radar';

describe('journeyTokens', () => {
  test('extracts API path segments a journey exercises', () => {
    const src = `
      // @journey-firewall
      const r = await independentRead('member', (api) => api.get('/persons/me'))
      const p = await apiFetch(page, '/association/member/dues-payments', { method: 'POST' })
      const b = await api.get('/api/billing/merchant-accounts/me')
    `;
    const toks = journeyTokens(src);
    expect(toks).toContain('dues-payments');
    expect(toks).toContain('billing');
    expect(toks).toContain('persons');
    // generic noise filtered out
    expect(toks).not.toContain('api');
    expect(toks).not.toContain('me');
  });
});

describe('moduleOf', () => {
  test('maps a backend handler file to its module dir', () => {
    expect(moduleOf('services/api-ts/src/handlers/dues/repos/dues-payments.repo.ts')).toBe('dues');
    expect(moduleOf('services/api-ts/src/handlers/billing/onboard.ts')).toBe('billing');
  });
  test('returns null for non-handler files', () => {
    expect(moduleOf('apps/memberry/src/routes/dashboard.tsx')).toBeNull();
    expect(moduleOf('scripts/foo.ts')).toBeNull();
  });
});

describe('classifyChanges', () => {
  const journeyTokenSet = new Set(['dues-payments', 'billing', 'member', 'persons', 'membership']);

  test('splits touched handler modules into covered vs uncovered', () => {
    const changed = [
      'services/api-ts/src/handlers/billing/onboard.ts', // covered (billing)
      'services/api-ts/src/handlers/dues/x.ts', // covered (dues-payments contains dues)
      'services/api-ts/src/handlers/surveys/poll.ts', // UNCOVERED
      'apps/memberry/src/foo.tsx', // ignored (not a handler)
    ];
    const { covered, uncovered } = classifyChanges(changed, journeyTokenSet);
    const covMods = covered.map((c) => c.module);
    const uncovMods = uncovered.map((c) => c.module);
    expect(covMods).toContain('billing');
    expect(covMods).toContain('dues');
    expect(uncovMods).toEqual(['surveys']);
  });

  test('empty when no handler files changed', () => {
    const { covered, uncovered } = classifyChanges(['apps/memberry/src/x.tsx'], journeyTokenSet);
    expect(covered).toEqual([]);
    expect(uncovered).toEqual([]);
  });
});
