/**
 * Unit suite for CommitteeRepository.
 *
 * Harness: stateful fake DatabaseInstance (./__fake-db) — same identity-tagged
 * pattern as dues/repos/dues-payments.repo.test.ts. Exercises the repo's own
 * code paths (committee CRUD + dissolve, member lifecycle, chairperson/member
 * lookups) without a live Postgres. Drizzle where() predicates are opaque to
 * the fake, so each test seeds exactly the rows the call should observe.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { CommitteeRepository } from './committee.repo';
import { committees, committeeMembers } from './committee.schema';
import { makeFakeDb, type FakeDb } from './__fake-db';

let fake: FakeDb;
let repo: CommitteeRepository;

beforeEach(() => {
  fake = makeFakeDb();
  repo = new CommitteeRepository(fake.db);
});

describe('CommitteeRepository — committee CRUD', () => {
  test('list returns rows for an org (org-scoped where recorded)', async () => {
    fake.seed(committees, [{ id: 'c1', organizationId: 'org-1', name: 'Finance' }]);
    const out = await repo.list('org-1');
    expect(out).toHaveLength(1);
    expect(fake.whereCalls.some((w) => w.kind === 'select' && w.table === committees)).toBe(true);
  });

  test('listAll paginates without org scoping', async () => {
    fake.seed(committees, [{ id: 'c1' }, { id: 'c2' }]);
    const out = await repo.listAll(10, 0);
    expect(out).toHaveLength(2);
  });

  test('get returns first match or undefined', async () => {
    fake.seed(committees, [{ id: 'c1', name: 'Ethics' }]);
    expect((await repo.get('c1'))?.name).toBe('Ethics');

    fake.seed(committees, []);
    expect(await repo.get('missing')).toBeUndefined();
  });

  test('create stores and returns the new committee', async () => {
    const created = await repo.create({ organizationId: 'org-1', name: 'New' } as any);
    expect(created.id).toBeDefined();
    expect(created.name).toBe('New');
    expect(fake.rows(committees)).toHaveLength(1);
  });

  test('update sets fields + updatedAt', async () => {
    fake.seed(committees, [{ id: 'c1', name: 'Old' }]);
    const updated = await repo.update('c1', { name: 'Renamed' });
    expect(updated.name).toBe('Renamed');
    expect(updated.updatedAt).toBeInstanceOf(Date);
  });

  test('dissolve marks completed with reason and audit fields', async () => {
    fake.seed(committees, [{ id: 'c1', status: 'active' }]);
    const out = await repo.dissolve('c1', 'officer-9', 'merged');
    expect(out.status).toBe('completed');
    expect(out.dissolvedBy).toBe('officer-9');
    expect(out.dissolutionReason).toBe('merged');
    expect(out.dissolvedAt).toBeInstanceOf(Date);
  });

  test('dissolve without reason stores null reason', async () => {
    fake.seed(committees, [{ id: 'c1', status: 'active' }]);
    const out = await repo.dissolve('c1', 'officer-9');
    expect(out.dissolutionReason).toBeNull();
  });
});

describe('CommitteeRepository — members', () => {
  test('listMembers returns active members for a committee', async () => {
    fake.seed(committeeMembers, [
      { id: 'm1', committeeId: 'c1', active: true, personId: 'p1' },
    ]);
    const out = await repo.listMembers('c1');
    expect(out).toHaveLength(1);
  });

  test('addMember inserts a member row', async () => {
    const m = await repo.addMember({ committeeId: 'c1', personId: 'p1', role: 'member' } as any);
    expect(m.id).toBeDefined();
    expect(fake.rows(committeeMembers)).toHaveLength(1);
  });

  test('removeMember soft-deactivates with removedAt', async () => {
    fake.seed(committeeMembers, [{ id: 'm1', active: true }]);
    const out = await repo.removeMember('m1');
    expect(out.active).toBe(false);
    expect(out.removedAt).toBeInstanceOf(Date);
  });

  test('updateMemberRole sets new role', async () => {
    fake.seed(committeeMembers, [{ id: 'm1', role: 'member' }]);
    const out = await repo.updateMemberRole('m1', 'chairperson');
    expect(out.role).toBe('chairperson');
  });

  test('findChairperson returns chair or undefined', async () => {
    fake.seed(committeeMembers, [{ id: 'm1', role: 'chairperson', active: true }]);
    expect((await repo.findChairperson('c1'))?.role).toBe('chairperson');

    fake.seed(committeeMembers, []);
    expect(await repo.findChairperson('c1')).toBeUndefined();
  });

  test('getMember returns the member or undefined', async () => {
    fake.seed(committeeMembers, [{ id: 'm1', personId: 'p1', active: true }]);
    expect((await repo.getMember('c1', 'p1'))?.id).toBe('m1');

    fake.seed(committeeMembers, []);
    expect(await repo.getMember('c1', 'nobody')).toBeUndefined();
  });
});
