import { describe, test, expect } from 'bun:test';
import { CommunicationsRepository } from './communications.repo';

function makeDb(rowsSets: any[][] = [[]]) {
  let callIndex = 0;
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    then: (resolve: any) => {
      const rows = rowsSets[callIndex] ?? [];
      callIndex++;
      return Promise.resolve(rows).then(resolve);
    },
    [Symbol.iterator]: function* () { yield* (rowsSets[0] ?? []); },
  };
  return {
    select: () => chain,
    insert: () => ({ values: () => ({ returning: () => Promise.resolve(rowsSets[0] ?? []) }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve(rowsSets[0] ?? []) }) }) }),
  } as any;
}

function makeAnnouncement(overrides: Record<string, any> = {}) {
  return {
    id: 'ann-1',
    organizationId: 'org-1',
    authorId: 'user-1',
    title: 'Test Announcement',
    content: 'Hello members',
    status: 'draft',
    ...overrides,
  };
}

describe('CommunicationsRepository', () => {
  describe('list', () => {
    test('returns announcements with total for org', async () => {
      const anns = [makeAnnouncement(), makeAnnouncement({ id: 'ann-2' })];
      const repo = new CommunicationsRepository(makeDb([anns, [{ count: 2 }]]));
      const result = await repo.list('org-1');
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    test('returns empty with zero total', async () => {
      const repo = new CommunicationsRepository(makeDb([[], [{ count: 0 }]]));
      const result = await repo.list('org-1');
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('get', () => {
    test('returns announcement with stats', async () => {
      const ann = makeAnnouncement();
      const stats = { id: 'stat-1', recipients: 50 };
      const repo = new CommunicationsRepository(makeDb([[ann], [stats]]));
      const result = await repo.get('ann-1');
      expect(result?.title).toBe('Test Announcement');
      expect(result?.stats?.recipients).toBe(50);
    });

    test('returns undefined when not found', async () => {
      const repo = new CommunicationsRepository(makeDb([[], []]));
      const result = await repo.get('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('create', () => {
    test('inserts and returns announcement', async () => {
      const ann = makeAnnouncement();
      const repo = new CommunicationsRepository(makeDb([[ann]]));
      const result = await repo.create({ title: 'Test', content: 'Hello' } as any);
      expect(result).toEqual(ann);
    });
  });

  describe('updateStatus', () => {
    test('updates status and returns', async () => {
      const updated = makeAnnouncement({ status: 'sent' });
      const repo = new CommunicationsRepository(makeDb([[updated]]));
      const result = await repo.updateStatus('ann-1', 'sent');
      expect(result.status).toBe('sent');
    });
  });

  describe('createStats', () => {
    test('inserts stats (returns void)', async () => {
      const repo = new CommunicationsRepository(makeDb([[]]));
      // createStats returns void
      await repo.createStats('ann-1', 50);
      // No error = success
    });
  });
});
