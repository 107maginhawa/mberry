import { describe, it, expect, beforeEach } from 'bun:test';
import { SavedSegmentRepository, CommunicationsRepository } from './repos/communication.repo';

/**
 * VS-032 — Saved Segments + Stats integration tests.
 *
 * These tests use mock database instances to validate repository logic
 * without requiring a live database connection.
 */

// ---------------------------------------------------------------------------
// Mock database helpers
// ---------------------------------------------------------------------------

function createMockDb(store: Record<string, any[]> = {}) {
  const segments: any[] = store.segments ?? [];

  return {
    insert: (_table: any) => ({
      values: (data: any) => ({
        returning: () => {
          const row = { id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), version: 1, ...data };
          segments.push(row);
          return [row];
        },
      }),
    }),
    select: (_fields?: any) => ({
      from: (_table: any) => ({
        where: (_cond: any) => ({
          orderBy: (_order: any) => Promise.resolve([...segments]),
          limit: (_n: number) => segments,
        }),
      }),
    }),
    delete: (_table: any) => ({
      where: (_cond: any) => {
        // Remove first matching segment
        const idx = segments.findIndex(() => true);
        if (idx >= 0) segments.splice(idx, 1);
      },
    }),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests: Saved Segment CRUD
// ---------------------------------------------------------------------------

describe('SavedSegmentRepository', () => {
  let db: any;
  let store: { segments: any[] };

  beforeEach(() => {
    store = { segments: [] };
    db = createMockDb(store);
  });

  it('creates a saved segment', async () => {
    const repo = new SavedSegmentRepository(db);
    const result = await repo.create({
      organizationId: 'org-1',
      name: 'Active Regulars',
      filters: { duesStatus: 'active', membershipTier: 'regular' },
    });

    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.name).toBe('Active Regulars');
    expect(result.filters).toEqual({ duesStatus: 'active', membershipTier: 'regular' });
    expect(result.organizationId).toBe('org-1');
  });

  it('lists saved segments for an org', async () => {
    const repo = new SavedSegmentRepository(db);
    await repo.create({
      organizationId: 'org-1',
      name: 'Segment A',
      filters: { duesStatus: 'active' },
    });
    await repo.create({
      organizationId: 'org-1',
      name: 'Segment B',
      filters: { membershipTier: 'fellow' },
    });

    const list = await repo.list('org-1');
    expect(list.length).toBe(2);
    expect(list[0].name).toBe('Segment A');
    expect(list[1].name).toBe('Segment B');
  });

  it('deletes a saved segment', async () => {
    const repo = new SavedSegmentRepository(db);
    const created = await repo.create({
      organizationId: 'org-1',
      name: 'To Delete',
      filters: { duesStatus: 'expired' },
    });

    expect(store.segments.length).toBe(1);
    await repo.delete(created.id, 'org-1');
    expect(store.segments.length).toBe(0);
  });

  it('CRUD lifecycle: create → list → delete → verify gone', async () => {
    const repo = new SavedSegmentRepository(db);

    // Create
    const seg = await repo.create({
      organizationId: 'org-1',
      name: 'Lifecycle Test',
      filters: { cpdCompliant: true, joinedAfter: '2024-01-01' },
    });
    expect(seg.name).toBe('Lifecycle Test');

    // List
    const afterCreate = await repo.list('org-1');
    expect(afterCreate.length).toBe(1);

    // Delete
    await repo.delete(seg.id, 'org-1');

    // Verify gone
    const afterDelete = await repo.list('org-1');
    expect(afterDelete.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Stats writeback
// ---------------------------------------------------------------------------

describe('CommunicationsRepository.createStats', () => {
  it('creates stats with delivery counts', async () => {
    const statsStore: any[] = [];
    const db = {
      insert: (_table: any) => ({
        values: (data: any) => {
          const row = { id: crypto.randomUUID(), ...data };
          statsStore.push(row);
          return { returning: undefined };
        },
      }),
      select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: () => [] }), limit: () => [] }) }) }),
      delete: () => ({ where: () => {} }),
    } as any;

    const repo = new CommunicationsRepository(db);
    await repo.createStats('ann-1', 50, 'org-1', {
      emailSent: 45,
      pushDelivered: 30,
      inappViews: 20,
    });

    expect(statsStore.length).toBe(1);
    expect(statsStore[0].announcementId).toBe('ann-1');
    expect(statsStore[0].recipients).toBe(50);
    expect(statsStore[0].emailSent).toBe(45);
    expect(statsStore[0].pushDelivered).toBe(30);
    expect(statsStore[0].inappViews).toBe(20);
  });

  it('defaults delivery counts to 0 when not provided', async () => {
    const statsStore: any[] = [];
    const db = {
      insert: (_table: any) => ({
        values: (data: any) => {
          statsStore.push({ id: crypto.randomUUID(), ...data });
          return { returning: undefined };
        },
      }),
      select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: () => [] }), limit: () => [] }) }) }),
      delete: () => ({ where: () => {} }),
    } as any;

    const repo = new CommunicationsRepository(db);
    await repo.createStats('ann-2', 10, 'org-1');

    expect(statsStore[0].emailSent).toBe(0);
    expect(statsStore[0].pushDelivered).toBe(0);
    expect(statsStore[0].inappViews).toBe(0);
  });
});
