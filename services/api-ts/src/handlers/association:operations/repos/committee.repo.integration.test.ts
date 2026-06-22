/**
 * Real-PG integration for CommitteeRepository, replacing the fake-db illusion
 * (committee.repo.test.ts). Proves the BR-39 dissolve state (the only remaining
 * coverage of dissolve after the handler test was deleted), member add/remove
 * active-flagging, listMembers active-only ordering, and chairperson lookup.
 * Skips when DB unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { CommitteeRepository } from './committee.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let repo: CommitteeRepository;
const ORG = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b2';

beforeAll(async () => {
  H = await createScratch(['committee', 'committee_member']);
  if (H.dbReachable) repo = new CommitteeRepository(H.db as never);
});
afterAll(async () => { await H?.teardown(); });

describe('CommitteeRepository — real-PG', () => {
  test('list(orgId) is org-scoped and ordered by createdAt DESC', async () => {
    if (!H.dbReachable) return;
    await repo.create({ organizationId: ORG, name: 'Older', status: 'active', createdAt: new Date('2030-01-01T00:00:00Z') } as never);
    await repo.create({ organizationId: ORG, name: 'Newer', status: 'active', createdAt: new Date('2030-02-01T00:00:00Z') } as never);
    await repo.create({ organizationId: ORG_B, name: 'OtherOrg', status: 'active' } as never);

    const list = await repo.list(ORG);
    expect(list.length).toBe(2);
    expect(list.every((c) => c.organizationId === ORG)).toBe(true);
    expect(list[0]!.name).toBe('Newer'); // DESC by createdAt
    expect(list[1]!.name).toBe('Older');
  });

  test('[BR-39] dissolve sets completed + dissolvedAt/dissolvedBy/dissolutionReason AND deactivates members (rows retained)', async () => {
    if (!H.dbReachable) return;
    const c = await repo.create({ organizationId: ORG, name: 'To Dissolve', status: 'active' } as never);
    const by = crypto.randomUUID();
    // Two active members + a pre-removed one — dissolution must revoke the
    // active ones but never delete any row (BR-39 retains all data).
    await repo.addMember({ organizationId: ORG, committeeId: c.id, personId: crypto.randomUUID(), role: 'chairperson' } as never);
    await repo.addMember({ organizationId: ORG, committeeId: c.id, personId: crypto.randomUUID(), role: 'member' } as never);
    const preRemoved = await repo.addMember({ organizationId: ORG, committeeId: c.id, personId: crypto.randomUUID(), role: 'member' } as never);
    await repo.removeMember(preRemoved.id);

    const dissolved = await repo.dissolve(c.id, by, 'mandate fulfilled');
    expect(dissolved.status).toBe('completed');
    expect(dissolved.dissolvedAt).not.toBeNull();
    expect(dissolved.dissolvedBy).toBe(by);
    expect(dissolved.dissolutionReason).toBe('mandate fulfilled');

    // No active members remain (access revoked).
    expect((await repo.listMembers(c.id)).length).toBe(0);
    // But ALL three member rows are retained (nothing deleted).
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n, count(*) FILTER (WHERE active) AS active_n
         FROM "${H.schema}".committee_member WHERE committee_id=$1`,
      [c.id],
    );
    expect(rows[0].n).toBe(3);
    expect(Number(rows[0].active_n)).toBe(0);
  });

  test('addMember/removeMember flip active+removedAt; listMembers returns only active', async () => {
    if (!H.dbReachable) return;
    const c = await repo.create({ organizationId: ORG, name: 'Members', status: 'active' } as never);
    const m1 = await repo.addMember({ organizationId: ORG, committeeId: c.id, personId: crypto.randomUUID(), role: 'member' } as never);
    const m2 = await repo.addMember({ organizationId: ORG, committeeId: c.id, personId: crypto.randomUUID(), role: 'member' } as never);
    expect(m1.active).toBe(true);

    const removed = await repo.removeMember(m2.id);
    expect(removed.active).toBe(false);
    expect(removed.removedAt).not.toBeNull();

    const active = await repo.listMembers(c.id);
    expect(active.length).toBe(1);
    expect(active[0]!.id).toBe(m1.id);
  });

  test('findChairperson returns the active chairperson; getMember is active-only', async () => {
    if (!H.dbReachable) return;
    const c = await repo.create({ organizationId: ORG, name: 'Chaired', status: 'active' } as never);
    const chairPerson = crypto.randomUUID();
    await repo.addMember({ organizationId: ORG, committeeId: c.id, personId: chairPerson, role: 'chairperson' } as never);
    await repo.addMember({ organizationId: ORG, committeeId: c.id, personId: crypto.randomUUID(), role: 'member' } as never);

    const chair = await repo.findChairperson(c.id);
    expect(chair?.role).toBe('chairperson');
    expect(chair?.personId).toBe(chairPerson);
    expect(await repo.getMember(c.id, chairPerson)).toBeTruthy();
    expect(await repo.getMember(c.id, crypto.randomUUID())).toBeUndefined();
  });
});
