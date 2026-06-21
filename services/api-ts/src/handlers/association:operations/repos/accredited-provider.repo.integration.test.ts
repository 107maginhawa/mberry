/**
 * Real-PG integration for AccreditedProviderRepository, replacing the fake-db
 * illusion (accredited-provider.repo.test.ts). Finishes the "every repo has a
 * real-PG file" DoD item: CRUD + org-scoped reads + the expiringSoon computation.
 * Skips when DB unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { AccreditedProviderRepository } from './accredited-provider.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let repo: AccreditedProviderRepository;
const ORG = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b2';

function provider(o: Partial<Record<string, unknown>> = {}) {
  return { organizationId: ORG, name: 'Academy', accreditationNumber: `ACC-${crypto.randomUUID().slice(0, 8)}`, status: 'active', ...o } as never;
}
const days = (n: number) => new Date(Date.now() + n * 86400000);

beforeAll(async () => {
  H = await createScratch(['accredited_provider']);
  if (H.dbReachable) repo = new AccreditedProviderRepository(H.db as never);
});
afterAll(async () => { await H?.teardown(); });

describe('AccreditedProviderRepository — real-PG', () => {
  test('createOne + getByOrg is org-scoped (undefined for a different org)', async () => {
    if (!H.dbReachable) return;
    const p = await repo.createOne(provider());
    expect((await repo.getByOrg(p.id, ORG))?.id).toBe(p.id);
    expect(await repo.getByOrg(p.id, ORG_B)).toBeUndefined();
  });

  test('listWithExpiry returns org rows + total, applies status filter', async () => {
    if (!H.dbReachable) return;
    await repo.createOne(provider({ status: 'active' }));
    await repo.createOne(provider({ status: 'suspended' }));
    await repo.createOne(provider({ organizationId: ORG_B, status: 'active' }));

    const all = await repo.listWithExpiry(ORG);
    expect(all.data.every((p) => p.organizationId === ORG)).toBe(true);
    expect(all.total).toBeGreaterThanOrEqual(2);

    const suspended = await repo.listWithExpiry(ORG, 'suspended');
    expect(suspended.data.every((p) => p.status === 'suspended')).toBe(true);
  });

  test('expiringSoon flag: within 30 days = true, beyond = false, null = false', async () => {
    if (!H.dbReachable) return;
    const soon = await repo.createOne(provider({ expiryDate: days(15) }));
    const far = await repo.createOne(provider({ expiryDate: days(60) }));
    const none = await repo.createOne(provider({ expiryDate: null }));

    const list = await repo.listWithExpiry(ORG);
    const byId = (id: string) => list.data.find((p) => p.id === id);
    expect(byId(soon.id)?.expiringSoon).toBe(true);
    expect(byId(far.id)?.expiringSoon).toBe(false);
    expect(byId(none.id)?.expiringSoon).toBe(false);
  });

  test('update mutates a field', async () => {
    if (!H.dbReachable) return;
    const p = await repo.createOne(provider({ status: 'active' }));
    const updated = await repo.update(p.id, { status: 'expired' } as never);
    expect(updated.status).toBe('expired');
  });
});
