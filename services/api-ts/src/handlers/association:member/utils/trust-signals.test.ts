import { describe, test, expect } from 'bun:test';
import { batchLoadTrustSignals } from './trust-signals';

function createMockDb(responses: { memberships: any[]; credentials: any[]; credits: any[]; licenses: any[]; privacy: any[] }) {
  let callIdx = 0;
  const ordered = [responses.memberships, responses.credentials, responses.credits, responses.licenses, responses.privacy];
  const makeChain = () => {
    const result = ordered[callIdx++] ?? [];
    const chain: any = {
      where: () => chain,
      groupBy: () => Promise.resolve(result),
      limit: () => Promise.resolve(result),
      then: (resolve: any) => Promise.resolve(result).then(resolve),
      [Symbol.toStringTag]: 'Promise',
    };
    // Make it thenable (Promise-like) for cases without groupBy
    chain[Symbol.for('nodejs.util.promisify.custom')] = () => Promise.resolve(result);
    return chain;
  };
  return {
    select: (..._args: any[]) => ({
      from: (_table: any) => makeChain(),
    }),
  } as any;
}

describe('batchLoadTrustSignals', () => {
  test('returns empty map for empty personIds', async () => {
    const db = createMockDb({ memberships: [], credentials: [], credits: [], licenses: [], privacy: [] });
    const result = await batchLoadTrustSignals(db, [], 'org-1');
    expect(result.size).toBe(0);
  });

  test('returns trust signals with privacy gating', async () => {
    const db = createMockDb({
      memberships: [{ personId: 'p-1', status: 'active' }],
      credentials: [{ personId: 'p-1', count: 3 }],
      credits: [{ personId: 'p-1', total: 24 }],
      licenses: [{ personId: 'p-1' }],
      privacy: [{ personId: 'p-1', credentialsVisible: true, duesStatusVisible: true, ceComplianceVisible: true }],
    });

    const result = await batchLoadTrustSignals(db, ['p-1'], 'org-1');
    const signals = result.get('p-1')!;

    expect(signals.duesStatus).toBe('current');
    expect(signals.credentialCount).toBe(3);
    expect(signals.ceCreditsEarned).toBe(24);
    expect(signals.hasVerifiedLicense).toBe(true);
  });

  test('hides signals when privacy toggles are off', async () => {
    const db = createMockDb({
      memberships: [{ personId: 'p-1', status: 'active' }],
      credentials: [{ personId: 'p-1', count: 5 }],
      credits: [{ personId: 'p-1', total: 10 }],
      licenses: [{ personId: 'p-1' }],
      privacy: [{ personId: 'p-1', credentialsVisible: false, duesStatusVisible: false, ceComplianceVisible: false }],
    });

    const result = await batchLoadTrustSignals(db, ['p-1'], 'org-1');
    const signals = result.get('p-1')!;

    expect(signals.duesStatus).toBeNull();
    expect(signals.credentialCount).toBe(0);
    expect(signals.ceCreditsEarned).toBe(0);
    expect(signals.hasVerifiedLicense).toBe(false);
  });

  test('admin bypasses privacy gating', async () => {
    const db = createMockDb({
      memberships: [{ personId: 'p-1', status: 'active' }],
      credentials: [{ personId: 'p-1', count: 2 }],
      credits: [{ personId: 'p-1', total: 8 }],
      licenses: [{ personId: 'p-1' }],
      privacy: [{ personId: 'p-1', credentialsVisible: false, duesStatusVisible: false, ceComplianceVisible: false }],
    });

    const result = await batchLoadTrustSignals(db, ['p-1'], 'org-1', true); // isAdmin=true
    const signals = result.get('p-1')!;

    expect(signals.duesStatus).toBe('current');
    expect(signals.credentialCount).toBe(2);
    expect(signals.ceCreditsEarned).toBe(8);
    expect(signals.hasVerifiedLicense).toBe(true);
  });

  test('only shows positive dues status (active/gracePeriod)', async () => {
    const db = createMockDb({
      memberships: [{ personId: 'p-1', status: 'lapsed' }],
      credentials: [],
      credits: [],
      licenses: [],
      privacy: [{ personId: 'p-1', duesStatusVisible: true, credentialsVisible: true, ceComplianceVisible: true }],
    });

    const result = await batchLoadTrustSignals(db, ['p-1'], 'org-1');
    const signals = result.get('p-1')!;

    // lapsed = NOT positive, so duesStatus should be null even with toggle on
    expect(signals.duesStatus).toBeNull();
  });
});
