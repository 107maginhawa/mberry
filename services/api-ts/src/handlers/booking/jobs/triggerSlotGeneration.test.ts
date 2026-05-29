/**
 * Tests for triggerSlotGeneration job utility
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { triggerSlotGeneration, type TriggerSlotGenerationDeps } from './index';

// Dependencies are injected (not process-global mock.module) so this file
// cannot poison sibling test files (e.g. slotGenerator.test.ts) that share
// the same Bun process and rely on the real ./slotGenerator + repo modules.
const mockFindActiveEventsByOwner = mock(async (_ownerId: string) => [
  { id: 'event-1' },
  { id: 'event-2' },
]);

const mockFindMany = mock(async (_filters?: any) => [
  { id: 'event-A' },
  { id: 'event-B' },
  { id: 'event-C' },
]);

const mockRegenerateEventSlots = mock(async (_db: any, _eventId: string) => {});

const deps: TriggerSlotGenerationDeps = {
  eventRepoFactory: () => ({
    findActiveEventsByOwner: mockFindActiveEventsByOwner,
    findMany: mockFindMany,
  }),
  regenerate: mockRegenerateEventSlots,
};

const fakeDb = {} as any;

describe('triggerSlotGeneration', () => {
  beforeEach(() => {
    mockFindActiveEventsByOwner.mockClear();
    mockFindMany.mockClear();
    mockRegenerateEventSlots.mockClear();
  });

  it('with ownerId: calls findActiveEventsByOwner and regenerates each event', async () => {
    await triggerSlotGeneration(fakeDb, 'owner-1', deps);

    expect(mockFindActiveEventsByOwner).toHaveBeenCalledTimes(1);
    expect(mockFindActiveEventsByOwner).toHaveBeenCalledWith('owner-1');
    expect(mockFindMany).not.toHaveBeenCalled();

    expect(mockRegenerateEventSlots).toHaveBeenCalledTimes(2);
    expect(mockRegenerateEventSlots).toHaveBeenCalledWith(fakeDb, 'event-1');
    expect(mockRegenerateEventSlots).toHaveBeenCalledWith(fakeDb, 'event-2');
  });

  it('without ownerId: calls findMany with active status and regenerates each event', async () => {
    await triggerSlotGeneration(fakeDb, undefined, deps);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledWith({ status: 'active' });
    expect(mockFindActiveEventsByOwner).not.toHaveBeenCalled();

    expect(mockRegenerateEventSlots).toHaveBeenCalledTimes(3);
    expect(mockRegenerateEventSlots).toHaveBeenCalledWith(fakeDb, 'event-A');
    expect(mockRegenerateEventSlots).toHaveBeenCalledWith(fakeDb, 'event-B');
    expect(mockRegenerateEventSlots).toHaveBeenCalledWith(fakeDb, 'event-C');
  });

  it('with ownerId: handles zero active events gracefully', async () => {
    mockFindActiveEventsByOwner.mockImplementationOnce(async () => []);

    await triggerSlotGeneration(fakeDb, 'owner-empty', deps);

    expect(mockFindActiveEventsByOwner).toHaveBeenCalledTimes(1);
    expect(mockRegenerateEventSlots).not.toHaveBeenCalled();
  });
});
