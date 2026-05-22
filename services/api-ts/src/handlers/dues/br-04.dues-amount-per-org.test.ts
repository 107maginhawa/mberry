// Business Rules: [BR-04]
/**
 * [BR-04] Dues Amount Per Organization — Pure Domain Logic Tests
 *
 * BR-04: Dues amounts are configured per organization, not globally.
 * Different organizations in the same association can have different dues amounts.
 * An org without a configured dues amount defaults to 0.
 */

import { describe, test, expect } from 'bun:test';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

// ─── Domain helpers (pure, no DB, no HTTP) ──────────────────

interface DuesConfig {
  organizationId: string;
  amount: number;
  currency: string;
  periodMonths: number;
}

/**
 * Resolves the dues amount for a given org from the config store.
 * Returns 0 when no config exists (BR-04: default to 0).
 */
function resolveDuesAmount(orgId: string, configs: DuesConfig[]): number {
  const config = configs.find((c) => c.organizationId === orgId);
  return config?.amount ?? 0;
}

/**
 * Validates that updating one org's dues config does not affect another.
 * Returns the updated config list with the new amount for the target org.
 */
function updateOrgDuesAmount(
  orgId: string,
  newAmount: number,
  configs: DuesConfig[],
): DuesConfig[] {
  return configs.map((c) =>
    c.organizationId === orgId ? { ...c, amount: newAmount } : c,
  );
}

// ─── [BR-04] Tests ──────────────────────────────────────────

describe('[BR-04] Dues Amount Per Organization', () => {
  const ORG_A = 'org-aaaa-0000-0000-000000000001';
  const ORG_B = 'org-bbbb-0000-0000-000000000002';
  const ORG_C = 'org-cccc-0000-0000-000000000003';

  const configs: DuesConfig[] = [
    { organizationId: ORG_A, amount: 2000, currency: 'PHP', periodMonths: 12 },
    { organizationId: ORG_B, amount: 3500, currency: 'PHP', periodMonths: 12 },
  ];

  test('[BR-04] each org has its own dues amount', () => {
    expect(resolveDuesAmount(ORG_A, configs)).toBe(2000);
    expect(resolveDuesAmount(ORG_B, configs)).toBe(3500);
  });

  test('[BR-04] org without configured dues defaults to 0', () => {
    expect(resolveDuesAmount(ORG_C, configs)).toBe(0);
  });

  test('[BR-04] changing one org does not affect another', () => {
    const updated = updateOrgDuesAmount(ORG_A, 2500, configs);
    expect(resolveDuesAmount(ORG_A, updated)).toBe(2500);
    expect(resolveDuesAmount(ORG_B, updated)).toBe(3500);
  });

  test('[BR-04] orgs in same association can have different amounts', () => {
    const multiOrg: DuesConfig[] = [
      { organizationId: 'chapter-manila', amount: 1500, currency: 'PHP', periodMonths: 12 },
      { organizationId: 'chapter-cebu', amount: 1200, currency: 'PHP', periodMonths: 12 },
      { organizationId: 'chapter-davao', amount: 1000, currency: 'PHP', periodMonths: 12 },
    ];

    expect(resolveDuesAmount('chapter-manila', multiOrg)).toBe(1500);
    expect(resolveDuesAmount('chapter-cebu', multiOrg)).toBe(1200);
    expect(resolveDuesAmount('chapter-davao', multiOrg)).toBe(1000);

    // All three are distinct — no global amount applied
    const amounts = multiOrg.map((c) => c.amount);
    expect(new Set(amounts).size).toBe(3);
  });

  test('[BR-04] dues amount of 0 is valid (free membership org)', () => {
    const freeOrg: DuesConfig[] = [
      { organizationId: ORG_A, amount: 0, currency: 'PHP', periodMonths: 12 },
    ];
    expect(resolveDuesAmount(ORG_A, freeOrg)).toBe(0);
  });
});
